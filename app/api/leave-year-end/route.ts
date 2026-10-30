import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  AVAILABLE_CYCLES,
  getCycleInfo,
  getDefaultNextCycle,
  getDefaultRuleForLeaveType,
  getDefaultMaxCarryForward,
} from "@/lib/leave-year-end";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const currentCycleCode = searchParams.get("currentCycle") || "2025-2026";
    const nextCycleCode = searchParams.get("nextCycle") || getDefaultNextCycle(currentCycleCode);

    const currentCycle = getCycleInfo(currentCycleCode) || AVAILABLE_CYCLES[2];
    const nextCycle = getCycleInfo(nextCycleCode) || AVAILABLE_CYCLES[3];

    const cycleStart = new Date(`${currentCycle.startDate}T00:00:00.000Z`);
    const cycleEnd = new Date(`${currentCycle.endDate}T23:59:59.999Z`);

    const [
      allEmployees,
      leaveTypes,
      recentProcesses,
      existingNextCycleRecords,
    ] = await Promise.all([
      prisma.employee.findMany({
        orderBy: { employeeId: "asc" },
        include: {
          leaveRecords: {
            include: {
              leaveType: true,
            },
          },
          employeeLeaveApplications: {
            where: {
              status: "Approved",
              startDate: { lte: cycleEnd },
              endDate: { gte: cycleStart },
            },
          },
        },
      }),
      prisma.leaveType.findMany({
        where: { status: "ACTIVE" },
        orderBy: { id: "asc" },
      }),
      prisma.leaveYearEndProcess.findMany({
        orderBy: { processedAt: "desc" },
        take: 5,
        include: {
          records: {
            take: 20,
          },
        },
      }),
      prisma.leaveYearEndRecord.findMany({
        where: { nextCycle: nextCycle.code },
        select: { employeeId: true, leaveTypeId: true, status: true },
      }),
    ]);

    const processedMap = new Set(
      existingNextCycleRecords.map((r) => `${r.employeeId}-${r.leaveTypeId}`)
    );

    // Extract unique filter options
    const streams = Array.from(new Set(allEmployees.map((e) => e.stream).filter(Boolean))).sort();
    const departments = Array.from(new Set(allEmployees.map((e) => e.department).filter(Boolean))).sort();
    const employeeTypes = ["Teaching", "Non-Teaching"];
    const employmentTypes = ["Permanent", "Contract", "Temporary", "Probation"];

    // Default policy rules per leave type fetched directly from leave_types carryForward setting
    const rules = leaveTypes.map((lt) => ({
      leaveTypeId: lt.id,
      leaveTypeCode: lt.code,
      leaveTypeName: lt.name,
      rule: getDefaultRuleForLeaveType(lt.code, lt.name, lt.carryForward),
      maxCarryForwardDays: getDefaultMaxCarryForward(lt.code, lt.name, lt.carryForward),
      defaultDays: lt.daysAllowed,
    }));

    // Precalculate preview records for each employee and leave type
    const previewRecords = allEmployees.flatMap((employee) => {
      const empType = employee.employeeType || (employee.stream === "AIDED" ? "Teaching" : "Teaching");
      const empStatus = employee.employmentType || "Permanent";

      return leaveTypes.map((lt) => {
        const eligibility = employee.leaveRecords.find((r) => r.leaveTypeId === lt.id);
        const isEligible = Boolean(eligibility ? eligibility.isEligible && lt.status === "ACTIVE" : lt.status === "ACTIVE");
        const entitlement = isEligible ? (eligibility?.daysAllowed ?? lt.daysAllowed) : 0;
        const bf = isEligible ? (eligibility?.bf ?? 0) : 0;
        const credited = isEligible ? (eligibility?.creditedDays ?? 0) : 0;

        // Calculate leave used in the current cycle
        const matchingApps = employee.employeeLeaveApplications.filter(
          (app) => app.leaveTypeId === lt.id
        );
        const leaveUsed = isEligible ? matchingApps.reduce((sum, app) => {
          const appStart = new Date(app.startDate);
          const appEnd = new Date(app.endDate);
          const clampedStart = appStart < cycleStart ? cycleStart : appStart;
          const clampedEnd = appEnd > cycleEnd ? cycleEnd : appEnd;

          const totalDays = Math.max(1, Math.round((appEnd.getTime() - appStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          const clampedDays = Math.max(1, Math.round((clampedEnd.getTime() - clampedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

          const days = app.daysCount ? Math.min(app.daysCount, Math.round(app.daysCount * (clampedDays / totalDays))) : clampedDays;
          return sum + days;
        }, 0) : 0;

        // Available balance at cycle closing: (entitlement + bf + credited) - leaveUsed
        const availableBalance = isEligible ? Math.max(0, (entitlement + bf + credited) - leaveUsed) : 0;

        // Rule calculation
        const ruleConfig = rules.find((r) => r.leaveTypeId === lt.id);
        const rule = ruleConfig?.rule || (lt.carryForward ? "CARRY_FORWARD" : "RESET");
        const maxLimit = ruleConfig?.maxCarryForwardDays ?? null;

        let carriedForwardDays = 0;
        if (isEligible && rule === "CARRY_FORWARD") {
          carriedForwardDays = maxLimit !== null ? Math.min(availableBalance, maxLimit) : availableBalance;
        }

        const proposedOpeningBalance = isEligible ? carriedForwardDays + entitlement : 0;
        const isAlreadyProcessed = processedMap.has(`${employee.employeeId}-${lt.id}`);

        return {
          employeeId: employee.employeeId,
          employeeName: employee.name,
          department: employee.department,
          stream: employee.stream,
          employeeType: empType,
          employmentType: empStatus,
          leaveTypeId: lt.id,
          leaveTypeCode: lt.code,
          leaveTypeName: lt.name,
          carryForward: Boolean(lt.carryForward),
          currentCycle: currentCycle.code,
          nextCycle: nextCycle.code,
          entitlement,
          leaveUsed,
          availableBalance,
          rule,
          maxCarryForward: maxLimit,
          carriedForwardDays,
          proposedOpeningBalance,
          isEligible,
          isAlreadyProcessed,
        };
      });
    });

    const employeesSummary = allEmployees.map((emp) => {
      const records = previewRecords.filter((r) => r.employeeId === emp.employeeId);
      const isAlreadyProcessed = records.length > 0 && records.some((r) => r.isAlreadyProcessed);
      return {
        employeeId: emp.employeeId,
        name: emp.name,
        stream: emp.stream,
        department: emp.department,
        employeeType: emp.employeeType || "Teaching",
        employmentType: emp.employmentType || "Permanent",
        totalLeaveTypes: records.length,
        totalCarryForward: records.reduce((s, r) => s + r.carriedForwardDays, 0),
        isAlreadyProcessed,
      };
    });

    return Response.json({
      cycles: AVAILABLE_CYCLES,
      currentCycle,
      nextCycle,
      filters: {
        streams,
        departments,
        employeeTypes,
        employmentTypes,
      },
      leaveTypes,
      rules,
      employees: employeesSummary,
      previewRecords,
      recentProcesses,
    });
  } catch (error) {
    console.error("Failed to load Year-End Process preview:", error);
    return Response.json(
      { error: "Unable to load leave year-end process data." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      currentCycle: currentCycleCode,
      nextCycle: nextCycleCode,
      employeeIds,
      rules: customRules,
      processedBy = "Administrator",
    } = body as {
      currentCycle?: string;
      nextCycle?: string;
      employeeIds?: string[];
      rules?: {
        leaveTypeId: number;
        rule: "CARRY_FORWARD" | "RESET";
        maxCarryForwardDays: number | null;
      }[];
      processedBy?: string;
    };

    if (!currentCycleCode || !nextCycleCode) {
      return Response.json({ error: "Current and Next leave cycles are required." }, { status: 400 });
    }

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return Response.json({ error: "Select at least one employee to process." }, { status: 400 });
    }

    const currentCycle = getCycleInfo(currentCycleCode);
    const nextCycle = getCycleInfo(nextCycleCode);
    if (!currentCycle || !nextCycle) {
      return Response.json({ error: "Invalid leave cycle range." }, { status: 400 });
    }

    const cycleStart = new Date(`${currentCycle.startDate}T00:00:00.000Z`);
    const cycleEnd = new Date(`${currentCycle.endDate}T23:59:59.999Z`);

    // Fetch target employees and leave types
    const [employees, leaveTypes] = await Promise.all([
      prisma.employee.findMany({
        where: { employeeId: { in: employeeIds } },
        include: {
          leaveRecords: {
            include: { leaveType: true },
          },
          employeeLeaveApplications: {
            where: {
              status: "Approved",
              startDate: { lte: cycleEnd },
              endDate: { gte: cycleStart },
            },
          },
        },
      }),
      prisma.leaveType.findMany({
        where: { status: "ACTIVE" },
        orderBy: { id: "asc" },
      }),
    ]);

    // Helper to get base leave group/category (e.g. CL_A and CL_S both map to "CL")
    const getBaseCode = (code: string, name: string): string => {
      const c = (code || "").toUpperCase();
      const n = (name || "").toUpperCase();
      if (c === "CL" || c.startsWith("CL_") || n.includes("CASUAL")) return "CL";
      if ((c === "ML" || c.startsWith("ML_") || c === "MDL" || n.includes("MEDICAL")) && !n.includes("MATERNITY")) return "ML";
      if (c === "EL" || c.startsWith("EL_") || n.includes("EARNED")) return "EL";
      if (c === "SL" || c.startsWith("SL_") || n.includes("SICK")) return "SL";
      if (c === "RH" || c.startsWith("RH_") || n.includes("RESTRICTED")) return "RH";
      return c;
    };

    // Prepare rule lookup
    const ruleMap = new Map<number, { rule: "CARRY_FORWARD" | "RESET"; maxCarryForwardDays: number | null }>();
    leaveTypes.forEach((lt) => {
      const base = getBaseCode(lt.code, lt.name);
      // Check direct rule or sibling stream rule
      const direct = customRules?.find((r) => r.leaveTypeId === lt.id);
      const siblingRule = direct || customRules?.find((r) => {
        const sibling = leaveTypes.find((x) => x.id === r.leaveTypeId);
        return sibling && getBaseCode(sibling.code, sibling.name) === base;
      });

      if (siblingRule) {
        ruleMap.set(lt.id, {
          rule: siblingRule.rule,
          maxCarryForwardDays: siblingRule.maxCarryForwardDays,
        });
      } else {
        ruleMap.set(lt.id, {
          rule: getDefaultRuleForLeaveType(lt.code, lt.name, lt.carryForward),
          maxCarryForwardDays: getDefaultMaxCarryForward(lt.code, lt.name, lt.carryForward),
        });
      }
    });

    let totalBalancesCreated = 0;
    let totalCarriedForward = 0;
    let totalReset = 0;
    let totalSkipped = 0;
    const totalFailed = 0;

    type ProcessRecordInput = {
      employeeId: string;
      employeeName: string;
      department: string;
      stream: string;
      leaveTypeId: number;
      leaveTypeCode: string;
      leaveTypeName: string;
      currentCycle: string;
      nextCycle: string;
      entitlement: number;
      leaveUsed: number;
      availableBalance: number;
      rule: string;
      maxCarryForward: number | null;
      carriedForwardDays: number;
      proposedOpeningBalance: number;
      status: "SUCCESS" | "SKIPPED" | "FAILED";
      reason?: string;
    };

    const recordsToCreate: ProcessRecordInput[] = [];
    const eligibilityUpdates: {
      employeeId: string;
      leaveTypeId: number;
      newBalance: number;
      carriedForwardDays: number;
      entitlement: number;
    }[] = [];
    const cycleBalancesToUpsert: {
      employeeId: string;
      leaveTypeId: number;
      cycle: string;
      openingBalance: number;
      carriedForward: number;
      entitlement: number;
      currentBalance: number;
    }[] = [];

    for (const employee of employees) {
      for (const lt of leaveTypes) {
        const eligibility = employee.leaveRecords.find((r) => r.leaveTypeId === lt.id);
        const isEligible = Boolean(eligibility ? eligibility.isEligible && lt.status === "ACTIVE" : lt.status === "ACTIVE");
        const entitlement = isEligible ? (eligibility?.daysAllowed ?? lt.daysAllowed) : 0;
        const bf = isEligible ? (eligibility?.bf ?? 0) : 0;
        const credited = isEligible ? (eligibility?.creditedDays ?? 0) : 0;

        const matchingApps = employee.employeeLeaveApplications.filter(
          (app) => app.leaveTypeId === lt.id
        );
        const leaveUsed = isEligible ? matchingApps.reduce((sum, app) => {
          const appStart = new Date(app.startDate);
          const appEnd = new Date(app.endDate);
          const clampedStart = appStart < cycleStart ? cycleStart : appStart;
          const clampedEnd = appEnd > cycleEnd ? cycleEnd : appEnd;

          const totalDays = Math.max(1, Math.round((appEnd.getTime() - appStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          const clampedDays = Math.max(1, Math.round((clampedEnd.getTime() - clampedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

          const days = app.daysCount ? Math.min(app.daysCount, Math.round(app.daysCount * (clampedDays / totalDays))) : clampedDays;
          return sum + days;
        }, 0) : 0;

        const availableBalance = isEligible ? Math.max(0, (entitlement + bf + credited) - leaveUsed) : 0;

        const ruleConfig = ruleMap.get(lt.id);
        const rule = ruleConfig?.rule || (lt.carryForward ? "CARRY_FORWARD" : "RESET");
        const maxLimit = ruleConfig?.maxCarryForwardDays ?? null;

        const isCarryForward = isEligible && rule === "CARRY_FORWARD";
        let carriedForwardDays = 0;
        if (isCarryForward) {
          carriedForwardDays = maxLimit !== null ? Math.min(availableBalance, maxLimit) : availableBalance;
          totalCarriedForward += carriedForwardDays;
        } else {
          totalReset++;
        }

        const proposedOpeningBalance = isEligible ? carriedForwardDays + entitlement : 0;
        totalBalancesCreated++;

        const status: "SUCCESS" | "SKIPPED" = isCarryForward ? "SUCCESS" : "SKIPPED";
        if (status === "SKIPPED") {
          totalSkipped++;
        }

        recordsToCreate.push({
          employeeId: employee.employeeId,
          employeeName: employee.name,
          department: employee.department,
          stream: employee.stream,
          leaveTypeId: lt.id,
          leaveTypeCode: lt.code,
          leaveTypeName: lt.name,
          currentCycle: currentCycle.code,
          nextCycle: nextCycle.code,
          entitlement,
          leaveUsed,
          availableBalance,
          rule,
          maxCarryForward: maxLimit,
          carriedForwardDays,
          proposedOpeningBalance,
          status,
          reason: isCarryForward ? undefined : "Reset (No carry forward for this leave type)",
        });

        if (isEligible) {
          eligibilityUpdates.push({
            employeeId: employee.employeeId,
            leaveTypeId: lt.id,
            newBalance: proposedOpeningBalance,
            carriedForwardDays,
            entitlement,
          });

          cycleBalancesToUpsert.push({
            employeeId: employee.employeeId,
            leaveTypeId: lt.id,
            cycle: nextCycle.code,
            openingBalance: proposedOpeningBalance,
            carriedForward: carriedForwardDays,
            entitlement,
            currentBalance: proposedOpeningBalance,
          });
        }
      }
    }

    // Execute in a transaction for complete safety and atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Clean up previous records for these employees in this cycle so re-running is cleanly supported
      await tx.leaveYearEndRecord.deleteMany({
        where: {
          nextCycle: nextCycle.code,
          employeeId: { in: employees.map((e) => e.employeeId) },
        },
      });

      // 1. Create the parent process record
      const process = await tx.leaveYearEndProcess.create({
        data: {
          currentCycle: currentCycle.code,
          nextCycle: nextCycle.code,
          processedBy,
          totalEmployees: employees.length,
          totalBalancesCreated,
          totalCarriedForward,
          totalReset,
          totalSkipped,
          totalFailed,
          status: totalFailed > 0 ? "PARTIAL" : "COMPLETED",
        },
      });

      // 2. Create detailed record items
      if (recordsToCreate.length > 0) {
        await tx.leaveYearEndRecord.createMany({
          data: recordsToCreate.map((r) => ({
            processId: process.id,
            ...r,
          })),
        });
      }

      // 3. Upsert cycle balances
      for (const cb of cycleBalancesToUpsert) {
        await tx.employeeCycleBalance.upsert({
          where: {
            employeeId_leaveTypeId_cycle: {
              employeeId: cb.employeeId,
              leaveTypeId: cb.leaveTypeId,
              cycle: cb.cycle,
            },
          },
          update: {
            openingBalance: cb.openingBalance,
            carriedForward: cb.carriedForward,
            entitlement: cb.entitlement,
            currentBalance: cb.currentBalance,
          },
          create: cb,
        });
      }

      // 4. Update live EmployeeLeaveEligibility balance for active use
      for (const update of eligibilityUpdates) {
        await tx.employeeLeaveEligibility.upsert({
          where: {
            employeeId_leaveTypeId: {
              employeeId: update.employeeId,
              leaveTypeId: update.leaveTypeId,
            },
          },
          update: {
            leaveBalance: update.newBalance,
            bf: update.carriedForwardDays,
            creditedDays: 0,
            daysAllowed: update.entitlement,
          },
          create: {
            employeeId: update.employeeId,
            leaveTypeId: update.leaveTypeId,
            isEligible: true,
            daysAllowed: update.entitlement,
            leaveBalance: update.newBalance,
            bf: update.carriedForwardDays,
            creditedDays: 0,
          },
        });
      }


      // 5. Create notifications for the affected employees
      const notifications = employees.map((emp) => ({
        employeeId: emp.employeeId,
        title: "Leave Year-End Process Completed",
        content: `Your leave balances have been initialized for cycle ${nextCycle.code}. Carried forward and new allocations are now available.`,
        type: "YEAR_END_PROCESS",
      }));

      await tx.employeeNotification.createMany({
        data: notifications,
      });

      return process;
    });

    return Response.json({
      success: true,
      summary: {
        processId: result.id,
        currentCycle: currentCycle.code,
        nextCycle: nextCycle.code,
        processedAt: result.processedAt,
        processedBy: result.processedBy,
        totalEmployees: employees.length,
        totalBalancesCreated,
        totalCarriedForward,
        totalReset,
        totalSkipped,
        totalFailed,
      },
      records: recordsToCreate,
    });
  } catch (error) {
    console.error("Year-End Process execution failed:", error);
    return Response.json(
      { error: "Failed to execute Year-End Process. Transaction rolled back." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cycle = searchParams.get("cycle") || "2026-2027";
    const employeeId = searchParams.get("employeeId");
    const leaveTypeIdsParam = searchParams.get("leaveTypeIds");
    const leaveTypeIds = leaveTypeIdsParam
      ? leaveTypeIdsParam.split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n))
      : [];

    const leaveTypeFilter = leaveTypeIds.length > 0 ? { in: leaveTypeIds } : undefined;

    await prisma.$transaction(async (tx) => {
      // 1. Fetch existing year-end records BEFORE deleting so we can restore original values
      const existingRecords = await tx.leaveYearEndRecord.findMany({
        where: {
          nextCycle: cycle,
          ...(employeeId ? { employeeId } : {}),
          ...(leaveTypeFilter ? { leaveTypeId: leaveTypeFilter } : {}),
        },
        select: {
          employeeId: true,
          leaveTypeId: true,
          entitlement: true,
          leaveUsed: true,
          availableBalance: true,
          carriedForwardDays: true,
          proposedOpeningBalance: true,
          rule: true,
        },
      });

      // 2. Restore each employee's leave eligibility to pre-process values
      // The original balance was: entitlement + bf_before + creditedDays_before - leaveUsed
      // The year-end process set: leaveBalance = proposedOpeningBalance, bf = carriedForwardDays, creditedDays = 0
      // To rollback: restore leaveBalance to the original availableBalance (closing balance before process),
      // set bf = 0 (remove the carried forward), restore creditedDays = 0 (we can't recover original credited days)
      // Most accurate: restore leaveBalance = entitlement (the original daysAllowed) since that's the base
      // But actually the best approach: use the stored data to compute original values
      for (const rec of existingRecords) {
        // The original balance before the year-end process:
        // availableBalance = (entitlement + old_bf + old_credited) - leaveUsed
        // Since we stored entitlement, leaveUsed, and availableBalance, we can restore:
        // - leaveBalance back to availableBalance (what they had before year-end)
        // - bf = availableBalance - entitlement (could be the old bf portion, or 0 if negative)
        // - daysAllowed = entitlement
        // But a simpler and correct approach: restore the balance as it was before the process ran.
        // Before the process, leaveBalance held the "live" balance. The process replaced it with proposedOpeningBalance.
        // The stored availableBalance IS the closing balance of the current cycle.
        // Restore: leaveBalance = original total (entitlement + original_bf + credited - leaveUsed was availableBalance)
        // Since we don't have the original bf/credited separately, the safest rollback is:
        // leaveBalance = entitlement (reset to base entitlement, removing all carry forward effects)
        // bf = 0, creditedDays = 0
        // This is the cleanest rollback — revert to the base entitlement for that leave type.

        await tx.employeeLeaveEligibility.updateMany({
          where: {
            employeeId: rec.employeeId,
            leaveTypeId: rec.leaveTypeId,
          },
          data: {
            leaveBalance: rec.entitlement,
            bf: 0,
            creditedDays: 0,
            daysAllowed: rec.entitlement,
          },
        });
      }

      // 3. Delete the year-end records
      if (employeeId) {
        await tx.leaveYearEndRecord.deleteMany({
          where: {
            nextCycle: cycle,
            employeeId,
            ...(leaveTypeFilter ? { leaveTypeId: leaveTypeFilter } : {}),
          },
        });
        await tx.employeeCycleBalance.deleteMany({
          where: {
            cycle,
            employeeId,
            ...(leaveTypeFilter ? { leaveTypeId: leaveTypeFilter } : {}),
          },
        });
      } else {
        await tx.leaveYearEndRecord.deleteMany({
          where: {
            nextCycle: cycle,
            ...(leaveTypeFilter ? { leaveTypeId: leaveTypeFilter } : {}),
          },
        });
        if (!leaveTypeFilter) {
          await tx.leaveYearEndProcess.deleteMany({
            where: { nextCycle: cycle },
          });
        }
        await tx.employeeCycleBalance.deleteMany({
          where: {
            cycle,
            ...(leaveTypeFilter ? { leaveTypeId: leaveTypeFilter } : {}),
          },
        });
      }
    });

    return Response.json({
      success: true,
      message: employeeId
        ? `Reverted year-end records for employee ${employeeId} in cycle ${cycle}`
        : `Reverted year-end records for cycle ${cycle}`,
    });
  } catch (error) {
    console.error("Failed to revert year-end process:", error);
    return Response.json({ error: "Failed to revert year-end process." }, { status: 500 });
  }
}
