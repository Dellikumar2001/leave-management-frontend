import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export interface LeaveBalanceDetail {
  code: string;
  name: string;
  annualAccrual: number;
  carriedForward: number;
  credited: number;
  totalAvailable: number;
  taken: number;
  pendingApproval: number;
  remainingBalance: number;
  rules: {
    canCarryForward: boolean;
    maxCarryForwardDays: number | null;
    expiresAt?: string | null;
  };
}

export interface UserEntitlementData {
  userId: string;
  year: number;
  status: "ACTIVE" | "CLOSED" | "ARCHIVED";
  lastCalculatedAt: string;
  balances: Record<string, LeaveBalanceDetail>;
  metadata?: Record<string, unknown>;
}

export interface CarryForwardPolicyOverride {
  leaveCode: string;
  allowCarryForward?: boolean;
  maxCarryForwardDays?: number | null;
  baseAnnualAccrual?: number;
}

/**
 * Service for managing Entitlement lifecycles and Year-End Processing with atomic rollback capability.
 */
export class EntitlementsService {
  /**
   * Executes Year-End Rollover for year N -> N+1 within an ACID transaction.
   * Creates snapshots in YearEndProcessDetail so it can be rolled back anytime.
   */
  public static async executeYearEndProcess(params: {
    fromYear: number;
    toYear: number;
    userIds: string[];
    processedBy: string;
    policyOverrides?: Record<string, CarryForwardPolicyOverride>;
  }) {
    const { fromYear, toYear, userIds, processedBy, policyOverrides = {} } = params;

    if (toYear !== fromYear + 1) {
      throw new Error(`Invalid cycle range: toYear (${toYear}) must be fromYear (${fromYear}) + 1.`);
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error("Select at least one user to process.");
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Acquire transaction advisory lock to prevent concurrent executions for the same cycle
      const lockKey = fromYear * 10000 + toYear;
      const [lockResult]: any[] = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(${lockKey}) as locked`;
      if (!lockResult?.locked) {
        throw new Error(`Another Year-End Process for cycle ${fromYear} -> ${toYear} is already running.`);
      }

      // 2. Lock and retrieve existing entitlements for year N and N+1
      const existingFromEntitlements = (await tx.$queryRawUnsafe(
        `SELECT * FROM entitlements WHERE year = $1 AND user_id = ANY($2) FOR UPDATE`,
        fromYear,
        userIds
      )) as any[];

      const existingToEntitlements = (await tx.$queryRawUnsafe(
        `SELECT * FROM entitlements WHERE year = $1 AND user_id = ANY($2) FOR UPDATE`,
        toYear,
        userIds
      )) as any[];

      const fromMap = new Map<string, UserEntitlementData>(
        existingFromEntitlements.map((e) => [e.user_id, e.entitlement_data as UserEntitlementData])
      );
      const toMap = new Map<string, UserEntitlementData>(
        existingToEntitlements.map((e) => [e.user_id, e.entitlement_data as UserEntitlementData])
      );

      // 3. Create parent process record
      const parentProcess = await tx.yearEndProcess.create({
        data: {
          fromYear,
          toYear,
          status: "COMPLETED",
          totalUsers: userIds.length,
          processedBy,
        },
      });

      let totalCarriedForwardAllUsers = 0;
      const detailInserts = [];

      for (const userId of userIds) {
        const fromData = fromMap.get(userId);
        if (!fromData) {
          continue;
        }

        const priorToData = toMap.get(userId) || null;
        const newBalances: Record<string, LeaveBalanceDetail> = {};
        const carryForwardSummary: Record<string, { carried: number; remaining: number }> = {};

        for (const [code, balance] of Object.entries(fromData.balances || {})) {
          const override = policyOverrides[code];
          const canCarry = override?.allowCarryForward ?? balance.rules?.canCarryForward ?? true;
          const maxLimit =
            override?.maxCarryForwardDays !== undefined
              ? override.maxCarryForwardDays
              : balance.rules?.maxCarryForwardDays ?? null;

          const availableRemaining = Math.max(0, balance.totalAvailable - balance.taken);
          let carriedDays = 0;

          if (canCarry) {
            carriedDays = maxLimit !== null ? Math.min(availableRemaining, maxLimit) : availableRemaining;
          }

          totalCarriedForwardAllUsers += carriedDays;
          carryForwardSummary[code] = { carried: carriedDays, remaining: availableRemaining };

          const standardAccrual = override?.baseAnnualAccrual ?? balance.annualAccrual ?? 0;
          const totalNewAvailable = standardAccrual + carriedDays;

          newBalances[code] = {
            ...balance,
            annualAccrual: standardAccrual,
            carriedForward: carriedDays,
            credited: 0,
            totalAvailable: totalNewAvailable,
            taken: 0,
            pendingApproval: 0,
            remainingBalance: totalNewAvailable,
          };
        }

        const nextYearEntitlementData: UserEntitlementData = {
          userId,
          year: toYear,
          status: "ACTIVE",
          lastCalculatedAt: new Date().toISOString(),
          balances: newBalances,
          metadata: {
            generatedByProcessId: parentProcess.id,
            generatedAt: new Date().toISOString(),
          },
        };

        // Snapshot prior and after state
        detailInserts.push({
          processId: parentProcess.id,
          userId,
          fromYear,
          toYear,
          snapshotBefore: {
            fromYearData: fromData,
            priorToYearData: priorToData,
          } as unknown as Prisma.InputJsonValue,
          snapshotAfter: nextYearEntitlementData as unknown as Prisma.InputJsonValue,
          carryForwardSummary: carryForwardSummary as unknown as Prisma.InputJsonValue,
          status: "COMMITTED",
        });

        // Upsert into entitlements table
        await tx.$executeRaw`
          INSERT INTO entitlements (user_id, year, entitlement_data, created_at, updated_at)
          VALUES (${userId}, ${toYear}, ${JSON.stringify(nextYearEntitlementData)}::jsonb, NOW(), NOW())
          ON CONFLICT (user_id, year)
          DO UPDATE SET
            entitlement_data = EXCLUDED.entitlement_data,
            updated_at = NOW()
        `;
      }

      if (detailInserts.length > 0) {
        await tx.yearEndProcessDetail.createMany({ data: detailInserts });
      }

      await tx.yearEndProcess.update({
        where: { id: parentProcess.id },
        data: { totalCarriedForward: totalCarriedForwardAllUsers },
      });

      return {
        processId: parentProcess.id,
        totalUsersProcessed: detailInserts.length,
        totalCarriedForward: totalCarriedForwardAllUsers,
      };
    });
  }

  /**
   * Rolls back a Year-End Process (Full Batch or Specific Users).
   * Restores Year N+1 strictly from snapshot_before.
   */
  public static async rollbackYearEndProcess(params: {
    processId: number;
    rolledBackBy: string;
    targetUserIds?: string[];
  }) {
    const { processId, rolledBackBy, targetUserIds } = params;

    return await prisma.$transaction(async (tx) => {
      const process = await tx.yearEndProcess.findUnique({
        where: { id: processId },
        include: {
          details: {
            where: targetUserIds ? { userId: { in: targetUserIds } } : undefined,
          },
        },
      });

      if (!process) {
        throw new Error(`Process ID ${processId} not found.`);
      }

      if (process.status === "ROLLED_BACK") {
        throw new Error(`Process ${processId} has already been completely rolled back.`);
      }

      const activeDetails = process.details.filter((d) => d.status === "COMMITTED");
      if (activeDetails.length === 0) {
        throw new Error("No committed records available to roll back.");
      }

      for (const item of activeDetails) {
        const snapshot = item.snapshotBefore as unknown as {
          fromYearData: UserEntitlementData | null;
          priorToYearData: UserEntitlementData | null;
        };

        if (snapshot.priorToYearData) {
          // Restore previous N+1 entitlement state
          await tx.$executeRaw`
            UPDATE entitlements
            SET entitlement_data = ${JSON.stringify(snapshot.priorToYearData)}::jsonb,
                updated_at = NOW()
            WHERE user_id = ${item.userId} AND year = ${item.toYear}
          `;
        } else {
          // Delete created N+1 entitlement record
          await tx.$executeRaw`
            DELETE FROM entitlements
            WHERE user_id = ${item.userId} AND year = ${item.toYear}
          `;
        }

        await tx.yearEndProcessDetail.update({
          where: { id: item.id },
          data: {
            status: "ROLLED_BACK",
            rolledBackAt: new Date(),
          },
        });
      }

      const remainingActive = await tx.yearEndProcessDetail.count({
        where: { processId, status: "COMMITTED" },
      });

      const nextStatus = remainingActive === 0 ? "ROLLED_BACK" : "PARTIALLY_ROLLED_BACK";

      await tx.yearEndProcess.update({
        where: { id: processId },
        data: {
          status: nextStatus,
          rolledBackAt: new Date(),
          rolledBackBy,
        },
      });

      return {
        processId,
        rolledBackCount: activeDetails.length,
        status: nextStatus,
      };
    });
  }
}
