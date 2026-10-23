import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const levelFields = [
  "firstLevelApprover",
  "secondLevelApprover",
  "finalLevelApprover",
] as const;

export async function GET() {
  try {
    const applications = await prisma.employeeLeaveApplication.findMany({
      where: { status: { equals: "Pending", mode: "insensitive" } },
      include: {
        employee: { include: { approverSettings: true } },
        leaveType: { select: { name: true, code: true } },
        approvals: { orderBy: { level: "asc" } },
      },
      orderBy: [{ appliedAt: "desc" }, { id: "desc" }],
    });

    return Response.json({
      requests: applications.map((application) => {
        const settings = application.employee.approverSettings;
        const approvers = {
          level1: settings?.firstLevelApprover?.trim() || "",
          level2: settings?.secondLevelApprover?.trim() || "",
          level3: settings?.finalLevelApprover?.trim() || "",
          backup: settings?.backupOfficer?.trim() || "",
        };
        const currentApprovalLevel = Math.min(3, Math.max(1, application.currentApprovalLevel));
        const pendingWith = approvers[`level${currentApprovalLevel}` as "level1" | "level2" | "level3"];

        return {
          id: application.id,
          employeeId: application.employeeId,
          employeeName: application.employee.name,
          department: application.employee.department,
          leaveType: application.leaveType.name || application.leaveType.code,
          startDate: application.startDate.toISOString().slice(0, 10),
          endDate: application.endDate.toISOString().slice(0, 10),
          daysCount: application.daysCount,
          reason: application.reason,
          status: application.status,
          appliedAt: application.appliedAt.toISOString(),
          currentApprovalLevel,
          pendingWith: pendingWith || `Level ${currentApprovalLevel} approver`,
          approvers,
          approvals: application.approvals.map((approval) => ({
            level: approval.level,
            approver: approval.approver,
            action: approval.action,
            isBackup: approval.isBackup,
            remarks: approval.remarks,
            actionAt: approval.actionAt.toISOString(),
          })),
        };
      }),
    });
  } catch (error) {
    console.error("Failed to load employee leave approvals:", error);
    return Response.json({ error: "Unable to load leave approval requests." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const applicationId = Number(body.applicationId);
    const level = Number(body.level);
    const actor = typeof body.actor === "string" ? body.actor.trim() : "";
    const action = typeof body.action === "string" ? body.action.trim().toUpperCase() : "";
    const isBackup = body.isBackup === true;
    const remarks = typeof body.remarks === "string" ? body.remarks.trim() || null : null;

    if (!Number.isSafeInteger(applicationId) || applicationId < 1 || ![1, 2, 3].includes(level)) {
      return Response.json({ error: "A valid request and approval level are required." }, { status: 400 });
    }
    if (!actor || !["APPROVED", "REJECTED"].includes(action)) {
      return Response.json({ error: "Approver and decision are required." }, { status: 400 });
    }
    const application = await prisma.employeeLeaveApplication.findUnique({
      where: { id: applicationId },
      include: { employee: { include: { approverSettings: true } } },
    });
    if (!application) return Response.json({ error: "Leave request not found." }, { status: 404 });

    const settings = application.employee.approverSettings;
    const assignedActor = isBackup
      ? settings?.backupOfficer?.trim()
      : settings?.[levelFields[level - 1]]?.trim();
    if (!assignedActor || assignedActor.toLowerCase() !== actor.toLowerCase()) {
      return Response.json({ error: "This approver is not assigned to the selected approval level." }, { status: 403 });
    }
    if (action === "APPROVED" && level < 3 && !settings?.[levelFields[level]]) {
      return Response.json({ error: `Level ${level + 1} approver is not assigned for this employee.` }, { status: 409 });
    }

    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.employeeLeaveApplication.findUnique({
        where: { id: applicationId },
        include: { approvals: { select: { level: true, action: true } } },
      });
      if (!current || current.status.toLowerCase() !== "pending") {
        return { error: "This leave request is no longer pending.", status: 409 } as const;
      }
      if (current.currentApprovalLevel !== level) {
        return {
          error: `This request is pending with Level ${current.currentApprovalLevel}; Level ${level} cannot act yet.`,
          status: 409,
        } as const;
      }
      for (let previousLevel = 1; previousLevel < level; previousLevel += 1) {
        if (!current.approvals.some((approval) => approval.level === previousLevel && approval.action === "APPROVED")) {
          return { error: `Level ${previousLevel} must approve this request first.`, status: 409 } as const;
        }
      }

      const nextLevel = action === "APPROVED" && level < 3 ? level + 1 : level;
      const nextStatus = action === "REJECTED" ? "Rejected" : level === 3 ? "Approved" : "Pending";
      const changed = await transaction.employeeLeaveApplication.updateMany({
        where: {
          id: applicationId,
          currentApprovalLevel: level,
          status: { equals: "Pending", mode: "insensitive" },
        },
        data: {
          currentApprovalLevel: nextLevel,
          status: nextStatus,
          ...(nextStatus !== "Pending" ? { reviewedBy: actor, reviewedAt: new Date() } : {}),
          ...(remarks ? { remarks } : {}),
        },
      });
      if (changed.count !== 1) {
        return { error: "Another approver has already updated this request.", status: 409 } as const;
      }

      await transaction.employeeLeaveApproval.create({
        data: { applicationId, level, approver: actor, action, isBackup, remarks },
      });
      return { success: true } as const;
    });

    if (!result.success) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to update employee leave approval:", error);
    return Response.json({ error: "Unable to save this approval decision." }, { status: 500 });
  }
}