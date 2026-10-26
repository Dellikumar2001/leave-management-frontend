import { prisma } from "@/lib/prisma";
import { calculateLeaveBalance } from "@/lib/leave-eligibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [employees, leaveTypes, yearEndRecords, approvedApplications] = await Promise.all([
      prisma.employee.findMany({
        orderBy: { employeeId: "asc" },
        include: {
          leaveRecords: {
            select: {
              leaveTypeId: true,
              isEligible: true,
              daysAllowed: true,
              leaveBalance: true,
              creditedDays: true,
              bf: true,
              earned: true,
              joiningDate: true,
            },
          },
          employeeLeaveApplications: {
            where: {
              status: "Approved",
            },
            select: {
              leaveTypeId: true,
              daysCount: true,
            },
          },
        },
      }),
      prisma.leaveType.findMany({
        orderBy: { id: "asc" },
        select: { id: true, code: true, name: true, status: true, daysAllowed: true },
      }),
      prisma.leaveYearEndRecord.findMany({
        select: { employeeId: true, leaveTypeId: true }
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

    const processedSet = new Set(yearEndRecords.map((r) => `${r.employeeId}-${r.leaveTypeId}`));
    const leaveTypesById = new Map(leaveTypes.map((leaveType) => [leaveType.id, leaveType]));
    const leaveYear = new Date().getUTCFullYear();

    const employeesWithBalances = employees.map((employee) => {
      // Find default calculation date from joiningDate
      const firstJoiningDate = employee.leaveRecords[0]?.joiningDate;
      const leaveCalculationDate = firstJoiningDate
        ? new Date(firstJoiningDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }).replace(/\//g, "-")
        : "01-01-2026";

      return {
        ...employee,
        leaveCalculationDate,
        leaveRecords: employee.leaveRecords.map(({ joiningDate, ...record }) => {
          const leaveType = leaveTypesById.get(record.leaveTypeId);
          const isEligible = record.isEligible && leaveType?.status === "ACTIVE";

          const eligible = record.daysAllowed > 0 ? record.daysAllowed : (leaveType?.daysAllowed ?? 0);
          const bf = record.bf ?? 0;
          const credit = record.creditedDays ?? 0;
          const earn = record.earned ?? 0;

          // Sum taken from approved applications
          const taken = approvedApplications
            .filter(
              (app) =>
                app.employeeId === employee.employeeId &&
                app.leaveTypeId === record.leaveTypeId
            )
            .reduce((sum, app) => sum + app.daysCount, 0);

          const total = Math.max(0, eligible + bf + credit + earn - taken);

          return {
            ...record,
            daysAllowed: eligible,
            bf,
            creditedDays: credit,
            earned: earn,
            taken,
            total,
            leaveBalance:
              typeof record.leaveBalance === "number" && record.leaveBalance >= 0
                ? record.leaveBalance
                : isEligible && leaveType
                ? calculateLeaveBalance(eligible, joiningDate, leaveYear) + credit
                : 0,
            formattedDate: new Date(joiningDate).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }).replace(/\//g, "-"),
          };
        }),
      };
    });

    return Response.json({ employees: employeesWithBalances, leaveTypes });
  } catch (error) {
    console.error("Failed to load leave eligibility:", error);
    return Response.json({ error: "Unable to load leave entitlement from the database." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const rawBody = (await request.json()) as
      | {
          employeeId?: string;
          leaveTypeId?: number;
          daysAllowed?: number | string;
          bf?: number | string;
          creditedDays?: number | string;
          earned?: number | string;
          leaveBalance?: number | string;
          updates?: Array<{
            employeeId?: string;
            leaveTypeId?: number;
            daysAllowed?: number | string;
            bf?: number | string;
            creditedDays?: number | string;
            earned?: number | string;
            leaveBalance?: number | string;
          }>;
        }
      | Array<{
          employeeId?: string;
          leaveTypeId?: number;
          daysAllowed?: number | string;
          bf?: number | string;
          creditedDays?: number | string;
          earned?: number | string;
          leaveBalance?: number | string;
        }>;

    const items = Array.isArray(rawBody)
      ? rawBody
      : Array.isArray(rawBody?.updates)
      ? rawBody.updates
      : [rawBody];

    if (!items.length) {
      return Response.json(
        { error: "No records provided to update." },
        { status: 400 }
      );
    }

    const operations = items.map((item) => {
      const { employeeId, leaveTypeId, daysAllowed, bf, creditedDays, earned, leaveBalance } = item;

      if (!employeeId || !leaveTypeId) {
        throw new Error("employeeId and leaveTypeId are required for each update.");
      }

      const dataToUpdate: {
        daysAllowed?: number;
        bf?: number;
        creditedDays?: number;
        earned?: number;
        leaveBalance?: number;
      } = {};

      if (daysAllowed !== undefined && daysAllowed !== null && daysAllowed !== "") {
        dataToUpdate.daysAllowed = Math.max(0, Math.round(Number(daysAllowed)) || 0);
      }
      if (bf !== undefined && bf !== null && bf !== "") {
        dataToUpdate.bf = Math.max(0, Math.round(Number(bf)) || 0);
      }
      if (creditedDays !== undefined && creditedDays !== null && creditedDays !== "") {
        dataToUpdate.creditedDays = Math.max(0, Math.round(Number(creditedDays)) || 0);
      }
      if (earned !== undefined && earned !== null && earned !== "") {
        dataToUpdate.earned = Math.max(0, Math.round(Number(earned)) || 0);
      }
      if (leaveBalance !== undefined && leaveBalance !== null && leaveBalance !== "") {
        dataToUpdate.leaveBalance = Math.max(0, Math.round(Number(leaveBalance)) || 0);
      }

      return prisma.employeeLeaveEligibility.upsert({
        where: {
          employeeId_leaveTypeId: {
            employeeId: String(employeeId),
            leaveTypeId: Number(leaveTypeId),
          },
        },
        update: dataToUpdate,
        create: {
          employeeId: String(employeeId),
          leaveTypeId: Number(leaveTypeId),
          daysAllowed: dataToUpdate.daysAllowed ?? 0,
          bf: dataToUpdate.bf ?? 0,
          creditedDays: dataToUpdate.creditedDays ?? 0,
          earned: dataToUpdate.earned ?? 0,
          leaveBalance: dataToUpdate.leaveBalance ?? 0,
          isEligible: true,
        },
      });
    });

    const results = await prisma.$transaction(operations);

    return Response.json({
      success: true,
      count: results.length,
      records: results.length === 1 ? results[0] : results,
    });
  } catch (error: unknown) {
    console.error("Failed to update leave eligibility record(s):", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to update leave eligibility record." },
      { status: 500 }
    );
  }
}