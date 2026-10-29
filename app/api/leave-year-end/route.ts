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
      approvedApplications,
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
      (prisma.leaveYearEndProcess
        ? prisma.leaveYearEndProcess.findMany({
            orderBy: { processedAt: "desc" },
            take: 5,
            include: {
              records: {
                take: 20,
              },
            },
          })
        : Promise.resolve([])),
      (prisma.leaveYearEndRecord
        ? prisma.leaveYearEndRecord.findMany({
            where: { nextCycle: nextCycle.code },
            select: { employeeId: true, leaveTypeId: true, status: true },
          })
        : Promise.resolve([])),
    ]);

    const processedMap = new Set(
      (existingNextCycleRecords || []).map((r) => `${r.employeeId}-${r.leaveTypeId}`)
    );

    // Index approved applications by composite key (employeeId:leaveTypeId) matching Entitlement table
    const approvedDaysMap = new Map<string, number>();
    for (const app of approvedApplications ?? []) {
      const key = `${app.employeeId}:${app.leaveTypeId}`;
      approvedDaysMap.set(key, (approvedDaysMap.get(key) ?? 0) + (app.daysCount ?? 0));
    }

    // Extract unique filter options
    const streams = Array.from(new Set(allEmployees.map((e) => e.stream).filter(Boolean))).sort();
    const departments = Array.from(new Set(allEmployees.map((e) => e.department).filter(Boolean))).sort();
    const employeeTypes = ["Teaching", "Non-Teaching"];
    const employmentTypes = ["Permanent", "Contract", "Temporary", "Probation"];

    // Default policy rules per leave type fetched directly from leave_types carryForward setting (ML & EL carry forward)
    const rules = leaveTypes.map((lt) => {
      const isCarryForward = Boolean(lt.carryForward) || lt.code === "ML" || lt.code === "EL";
      return {
        leaveTypeId: lt.id,
        leaveTypeCode: lt.code,
        leaveTypeName: lt.name,
        rule: (isCarryForward ? "CARRY_FORWARD" : getDefaultRuleForLeaveType(lt.code, lt.name, lt.carryForward)) as "CARRY_FORWARD" | "RESET",
        maxCarryForwardDays: null,
        defaultDays: lt.daysAllowed,
      };
    });

    // Precalculate preview records for each employee and leave type
    const previewRecords = allEmployees.flatMap((employee) => {
      const empType = employee.employeeType || (employee.stream === "AIDED" ? "Teaching" : "Teaching");
      const empStatus = employee.employmentType || "Permanent";

      return leaveTypes.map((lt) => {
        const eligibility = employee.leaveRecords.find((r) => r.leaveTypeId === lt.id);
        const isEligible = Boolean(eligibility ? eligibility.isEligible && lt.status === "ACTIVE" : lt.status === "ACTIVE");
        const entitlement = isEligible ? ((eligibility?.daysAllowed && eligibility.daysAllowed > 0) ? eligibility.daysAllowed : lt.daysAllowed) : 0;
        const bf = isEligible ? (eligibility?.bf ?? 0) : 0;
        const credit = isEligible ? (eligibility?.creditedDays ?? 0) : 0;
        const earn = isEligible ? (eligibility?.earned ?? 0) : 0;

        // Approved days taken matching the Entitlement table
        const taken = approvedDaysMap.get(`${employee.employeeId}:${lt.id}`) ?? 0;

        // Entitlement table Total for this leave type: Math.max(0, eligible + bf + credit + earn - taken)
        const entitlementTotal = Math.max(0, entitlement + bf + credit + earn - taken);

        // Rule calculation: carry forward enabled for ML & EL or whenever carryForward flag is true
        const isCarryForward = Boolean(lt.carryForward) || lt.code === "ML" || lt.code === "EL";
        const rule = isCarryForward ? "CARRY_FORWARD" : "RESET";

        // Fetch Total from the Entitlement table for carry-forward leaves (ML & EL)
        const carriedForwardDays = isEligible && isCarryForward ? entitlementTotal : 0;

        // Proposed opening = entitlement column in leave year end process + carry forward leave
        const proposedOpeningBalance = isEligible ? entitlement + carriedForwardDays : 0;
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
          carryForward: isCarryForward,
          currentCycle: currentCycle.code,
          nextCycle: nextCycle.code,
          entitlement,
          leaveUsed: taken,
          availableBalance: entitlementTotal,
          rule,
          maxCarryForward: null,
          carriedForwardDays,
          proposedOpeningBalance,
          isEligible,
          isAlreadyProcessed,
        };
      });
    });

    const employeesSummary = allEmployees.map((emp) => {
      const records = previewRecords.filter((r) => r.employeeId === emp.employeeId);
      const isAlreadyProcessed = records.length > 0 && records.every((r) => r.isAlreadyProcessed);
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
      { error: "Unable to load leave year-end process data.", details: error instanceof Error ? error.message : String(error) },
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

    // Fetch target employees, leave types, and approved applications (matching Entitlement table)
    const [employees, leaveTypes, approvedApplications] = await Promise.all([
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
      prisma.employeeLeaveApplication.findMany({
        where: {
          status: { equals: "Approved", mode: "insensitive" },
        },
        select: {
          employeeId: true,
          leaveTypeId: true,
          daysCount: true,
        },
      }),
    ]);

    const approvedDaysMap = new Map<string, number>();
    for (const app of approvedApplications ?? []) {
      const key = `${app.employeeId}:${app.leaveTypeId}`;
      approvedDaysMap.set(key, (approvedDaysMap.get(key) ?? 0) + (app.daysCount ?? 0));
    }

    // Prepare rule lookup: carry forward enabled for ML & EL or whenever carryForward flag is true
    const ruleMap = new Map<number, { rule: "CARRY_FORWARD" | "RESET"; maxCarryForwardDays: number | null }>();
    leaveTypes.forEach((lt) => {
      const isCarryForward = Boolean(lt.carryForward) || lt.code === "ML" || lt.code === "EL";
      const custom = customRules?.find((r) => r.leaveTypeId === lt.id);
      if (custom) {
        ruleMap.set(lt.id, {
          rule: isCarryForward ? "CARRY_FORWARD" : custom.rule,
          maxCarryForwardDays: null,
        });
      } else {
        ruleMap.set(lt.id, {
          rule: isCarryForward ? "CARRY_FORWARD" : getDefaultRuleForLeaveType(lt.code, lt.name, lt.carryForward),
          maxCarryForwardDays: null,
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
        const entitlement = isEligible ? ((eligibility?.daysAllowed && eligibility.daysAllowed > 0) ? eligibility.daysAllowed : lt.daysAllowed) : 0;
        const bf = isEligible ? (eligibility?.bf ?? 0) : 0;
        const credit = isEligible ? (eligibility?.creditedDays ?? 0) : 0;
        const earn = isEligible ? (eligibility?.earned ?? 0) : 0;

        // Approved days taken matching the Entitlement table
        const taken = approvedDaysMap.get(`${employee.employeeId}:${lt.id}`) ?? 0;

        // Entitlement table Total for this leave type: Math.max(0, eligible + bf + credit + earn - taken)
        const entitlementTotal = Math.max(0, entitlement + bf + credit + earn - taken);

        const ruleConfig = ruleMap.get(lt.id);
        const isCarryForward = Boolean(lt.carryForward) || lt.code === "ML" || lt.code === "EL" || ruleConfig?.rule === "CARRY_FORWARD";
        const rule = isCarryForward ? "CARRY_FORWARD" : "RESET";

        let carriedForwardDays = 0;
        if (isCarryForward && isEligible) {
          // Fetch Total from the Entitlement table for carry-forward leaves (ML & EL)
          carriedForwardDays = entitlementTotal;
          totalCarriedForward += carriedForwardDays;
        } else {
          totalReset++;
        }

        // Proposed opening = entitlement column in leave year end process + carry forward leave
        const proposedOpeningBalance = isEligible ? entitlement + carriedForwardDays : 0;
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
          leaveUsed: taken,
          availableBalance: entitlementTotal,
          rule,
          maxCarryForward: null,
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
            creditedDays: update.carriedForwardDays,
            daysAllowed: update.entitlement,
          },
          create: {
            employeeId: update.employeeId,
            leaveTypeId: update.leaveTypeId,
            isEligible: true,
            daysAllowed: update.entitlement,
            leaveBalance: update.newBalance,
            creditedDays: update.carriedForwardDays,
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

    await prisma.$transaction(async (tx) => {
      await tx.leaveYearEndRecord.deleteMany({
        where: { nextCycle: cycle },
      });
      await tx.leaveYearEndProcess.deleteMany({
        where: { nextCycle: cycle },
      });
      await tx.employeeCycleBalance.deleteMany({
        where: { cycle },
      });
    });

    return Response.json({ success: true, message: `Reverted year-end records for cycle ${cycle}` });
  } catch (error) {
    console.error("Failed to revert year-end process:", error);
    return Response.json({ error: "Failed to revert year-end process." }, { status: 500 });
  }
}
