import { ORPCError, os } from "@orpc/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/rpc/auth";
import type { BaseContext } from "@/lib/rpc/context";
import { authedProcedure } from "@/lib/rpc/procedures";

const o = os.$context<BaseContext>();

// Define enums locally to avoid import issues with generated client
const StudentLeaveTypeEnum = z.enum(["MEDICAL", "ON_DUTY", "GENERAL", "HOSTEL", "OTHER"]);
const StudentLeaveStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED"]);
const HOD_PENDING_STAGE = "PENDING_HOD";
const EXTENSION_HEAD_PENDING_STAGE = "PENDING_EXTENSION_HEAD";
const DSA_PENDING_STAGE = "PENDING_DSA";
const OD_EVENT_CATEGORY_ENUM = z.enum(["CLUB_EVENT", "COLLEGE_EVENT"]);
const OD_META_PREFIX = "[OD_META:";
const OD_REASON_PREFIX = "[OD_PERIODS:"; // Backward-compatible parser for older encoded records.

function normalizeToDateOnly(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function encodeODReason(reason: string, periods: number[], odRequestCategory: z.infer<typeof OD_EVENT_CATEGORY_ENUM>) {
    return `${OD_META_PREFIX}PERIODS=${periods.join(",")};CATEGORY=${odRequestCategory}]\n${reason}`;
}

function parseODFromReason(reason: string | null | undefined) {
    if (!reason) {
        return {
            odPeriods: [] as number[],
            odRequestCategory: null as "CLUB_EVENT" | "COLLEGE_EVENT" | null,
            cleanReason: "",
        };
    }

    if (reason.startsWith(OD_META_PREFIX)) {
        const endBracketIndex = reason.indexOf("]");
        if (endBracketIndex === -1) {
            return {
                odPeriods: [] as number[],
                odRequestCategory: null as "CLUB_EVENT" | "COLLEGE_EVENT" | null,
                cleanReason: reason,
            };
        }

        const metaChunk = reason.slice(OD_META_PREFIX.length, endBracketIndex);
        const cleanReason = reason.slice(endBracketIndex + 1).trimStart();
        const parts = Object.fromEntries(
            metaChunk
                .split(";")
                .map((entry) => entry.split("="))
                .filter((entry) => entry.length === 2)
                .map(([k, v]) => [k.trim().toUpperCase(), v.trim()]),
        ) as Record<string, string>;

        const odPeriods = (parts.PERIODS || "")
            .split(",")
            .map((p) => Number(p))
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);
        const rawCategory = (parts.CATEGORY || "").toUpperCase();
        const odRequestCategory = rawCategory === "CLUB_EVENT" || rawCategory === "COLLEGE_EVENT"
            ? (rawCategory as "CLUB_EVENT" | "COLLEGE_EVENT")
            : null;

        return { odPeriods, odRequestCategory, cleanReason };
    }

    // Backward compatibility for existing records encoded as [OD_PERIODS:...]
    if (!reason.startsWith(OD_REASON_PREFIX)) {
        return {
            odPeriods: [] as number[],
            odRequestCategory: null as "CLUB_EVENT" | "COLLEGE_EVENT" | null,
            cleanReason: reason || "",
        };
    }

    const endBracketIndex = reason.indexOf("]");
    if (endBracketIndex === -1) {
        return {
            odPeriods: [] as number[],
            odRequestCategory: null as "CLUB_EVENT" | "COLLEGE_EVENT" | null,
            cleanReason: reason,
        };
    }

    const periodChunk = reason.slice(OD_REASON_PREFIX.length, endBracketIndex);
    const cleanReason = reason.slice(endBracketIndex + 1).trimStart();
    const odPeriods = periodChunk
        .split(",")
        .map((p) => Number(p))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);

    return { odPeriods, odRequestCategory: null as "CLUB_EVENT" | "COLLEGE_EVENT" | null, cleanReason };
}

const ListStudentLeaveRequestsSchema = z
    .object({
        studentId: z.coerce.number().optional(),
        search: z.string().optional(),
        departmentId: z.coerce.number().optional(),
        stream: z.enum(["AIDED", "SFS"]).optional(),
        leaveType: StudentLeaveTypeEnum.optional(),
        status: StudentLeaveStatusEnum.optional(),
        startDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        startDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })
    .superRefine((data, ctx) => {
        if (
            data.startDateFrom &&
            data.startDateTo &&
            data.startDateTo < data.startDateFrom
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "End date must be on or after start date",
                path: ["startDateTo"],
            });
        }
    })
    .optional();

export const getStudentLeaveRequests = authedProcedure
    .input(ListStudentLeaveRequestsSchema)
    .handler(async ({ input, context }: { input: z.infer<typeof ListStudentLeaveRequestsSchema>; context: BaseContext }) => {
        const user = context.user;
        const filters = input ?? {};
        const extensionPosition = await prisma.extensionActivityPosition.findFirst({
            where: { userId: user.id, position: "EXTENSION_ACTIVITY_HEAD" },
            select: { id: true },
        });
        const isExtensionHead = !!extensionPosition;

        let targetStudentId = filters.studentId;

        // If user is a student, they can only see their own leaves
        if (user.role === "STUDENT") {
            const student = await prisma.student.findUnique({
                where: { userId: user.id },
            });
            if (!student) throw new ORPCError("NOT_FOUND", { message: "Student record not found" });
            if (targetStudentId && targetStudentId !== student.id) {
                throw new ORPCError("FORBIDDEN", { message: "You can only view your own leave requests" });
            }
            targetStudentId = student.id;
        }

        const andConditions: Prisma.StudentLeaveRequestWhereInput[] = [];

        if (targetStudentId) {
            andConditions.push({ studentId: targetStudentId });
        }

        // Role-based leave workflow queue filtering:
        // - Department head reviews first (PENDING_HOD)
        // - Dean student affairs reviews next (PENDING_DSA)
        if (!targetStudentId) {
            if (user.role === "DEPARTMENT_HEAD") {
                if (user.departmentId) {
                    andConditions.push({
                        student: { departmentId: user.departmentId },
                    });
                }
            } else if (user.role === "DEAN_STUDENT_AFFAIRS") {
                andConditions.push({
                    status: "PENDING",
                    reviewerRole: DSA_PENDING_STAGE,
                });
            } else if (isExtensionHead) {
                andConditions.push({
                    status: "PENDING",
                    reviewerRole: EXTENSION_HEAD_PENDING_STAGE,
                });
            }
        }

        if (filters.status) {
            andConditions.push({ status: filters.status });
        }

        if (filters.leaveType) {
            andConditions.push({ type: filters.leaveType });
        }

        if (filters.startDateFrom || filters.startDateTo) {
            const durationFilter: Prisma.StudentLeaveRequestWhereInput = {};
            if (filters.startDateFrom) {
                durationFilter.endDate = {
                    gte: new Date(`${filters.startDateFrom}T00:00:00.000Z`),
                };
            }
            if (filters.startDateTo) {
                durationFilter.startDate = {
                    lte: new Date(`${filters.startDateTo}T23:59:59.999Z`),
                };
            }
            andConditions.push(durationFilter);
        }

        const studentBaseFilter: Prisma.StudentWhereInput = {};

        if (filters.departmentId) {
            studentBaseFilter.departmentId = filters.departmentId;
        }

        if (filters.stream) {
            studentBaseFilter.StreamName = {
                equals: filters.stream,
                mode: "insensitive",
            };
        }

        if (filters.search?.trim()) {
            const term = filters.search.trim();
            const searchWords = term.split(/\s+/).filter((word) => word.length > 0);

            const nameSearch =
                searchWords.length > 1
                    ? {
                          AND: searchWords.map((word) => ({
                              OR: [
                                  {
                                      firstName: {
                                          contains: word,
                                          mode: "insensitive" as const,
                                      },
                                  },
                                  {
                                      lastName: {
                                          contains: word,
                                          mode: "insensitive" as const,
                                      },
                                  },
                                  {
                                      name: {
                                          contains: word,
                                          mode: "insensitive" as const,
                                      },
                                  },
                              ],
                          })),
                      }
                    : {
                          OR: [
                              {
                                  firstName: {
                                      contains: term,
                                      mode: "insensitive" as const,
                                  },
                              },
                              {
                                  lastName: {
                                      contains: term,
                                      mode: "insensitive" as const,
                                  },
                              },
                              {
                                  name: {
                                      contains: term,
                                      mode: "insensitive" as const,
                                  },
                              },
                          ],
                      };

            andConditions.push({
                OR: [
                    { reason: { contains: term, mode: "insensitive" } },
                    {
                        student: {
                            ...studentBaseFilter,
                            OR: [
                                {
                                    studentId: {
                                        contains: term,
                                        mode: "insensitive",
                                    },
                                },
                                { user: nameSearch },
                            ],
                        },
                    },
                ],
            });
        } else if (Object.keys(studentBaseFilter).length > 0) {
            andConditions.push({ student: studentBaseFilter });
        }

        const whereClause: Prisma.StudentLeaveRequestWhereInput =
            andConditions.length > 0 ? { AND: andConditions } : {};

        const leaves = await prisma.studentLeaveRequest.findMany({
            where: whereClause,
            include: {
                student: {
                    include: {
                        user: { select: { name: true, firstName: true, lastName: true } },
                        department: { select: { id: true, name: true } },
                    },
                },
                reviewer: {
                    select: { name: true, firstName: true, lastName: true },
                },
            },
            orderBy: { appliedAt: "desc" },
        });

        const normalizedLeaves = leaves.map((leave: any) => {
            const parsed = parseODFromReason(leave.reason);
            return {
                ...leave,
                reason: parsed.cleanReason,
                odPeriods: parsed.odPeriods,
                odRequestCategory: parsed.odRequestCategory,
                isActionableForCurrentUser:
                    leave.status === "PENDING" &&
                    (
                        user.role === "ADMIN" ||
                        (isExtensionHead && leave.reviewerRole === EXTENSION_HEAD_PENDING_STAGE) ||
                        (user.role === "DEPARTMENT_HEAD" && (leave.reviewerRole === HOD_PENDING_STAGE || !leave.reviewerRole)) ||
                        (user.role === "DEAN_STUDENT_AFFAIRS" && leave.reviewerRole === DSA_PENDING_STAGE)
                    ),
            };
        });

        return { success: true, data: normalizedLeaves };
    });

export const createStudentLeaveRequest = authedProcedure
    .input(z.object({
        studentId: z.coerce.number().optional(),
        type: StudentLeaveTypeEnum,
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        reason: z.string().min(5, "Reason must be at least 5 characters"),
        documentUrl: z.string().optional(),
        odDate: z.coerce.date().optional(),
        odPeriods: z.array(z.coerce.number().int().min(1).max(5)).optional(),
        odRequestCategory: OD_EVENT_CATEGORY_ENUM.optional(),
    }))
    .handler(async ({ input, context }) => {
        const user = context.user;

        let targetStudentId: number;
        let studentRecord;

        if (user.role === "STUDENT") {
            // Students can only create leave for themselves
            studentRecord = await prisma.student.findUnique({ where: { userId: user.id }, include: { user: { select: { name: true } } } });
            if (!studentRecord) throw new ORPCError("NOT_FOUND", { message: "Student record not found" });
            targetStudentId = studentRecord.id;
        } else if (input.studentId) {
            // Admin/HOD/Teacher creating on behalf of student
            studentRecord = await prisma.student.findUnique({ where: { id: input.studentId }, include: { user: { select: { name: true } } } });
            if (!studentRecord) throw new ORPCError("NOT_FOUND", { message: "Student not found" });
            targetStudentId = studentRecord.id;
        } else {
            throw new ORPCError("BAD_REQUEST", { message: "studentId is required for non-student users" });
        }

        if (input.startDate > input.endDate) {
            throw new ORPCError("BAD_REQUEST", { message: "Start date must be before end date" });
        }

        let startDate = input.startDate;
        let endDate = input.endDate;
        let reason = input.reason;
        let reviewerRole = HOD_PENDING_STAGE;

        // ON_DUTY must be a single-day, period-based request.
        if (input.type === "ON_DUTY") {
            const odDate = input.odDate ?? input.startDate;
            const normalizedDate = normalizeToDateOnly(odDate);
            const normalizedStart = normalizeToDateOnly(input.startDate);
            const normalizedEnd = normalizeToDateOnly(input.endDate);

            if (normalizedStart.getTime() !== normalizedEnd.getTime()) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "On Duty request must be for a single day only",
                });
            }

            const periods = Array.from(new Set((input.odPeriods || []).map((p) => Number(p))))
                .filter((p) => Number.isInteger(p) && p >= 1 && p <= 5)
                .sort((a, b) => a - b);

            if (periods.length === 0) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Select at least one period for On Duty request",
                });
            }
            if (!input.odRequestCategory) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Select OD request category (Club Event or College Event)",
                });
            }

            startDate = normalizedDate;
            endDate = normalizedDate;
            reason = encodeODReason(input.reason, periods, input.odRequestCategory);
            reviewerRole = input.odRequestCategory === "CLUB_EVENT" ? EXTENSION_HEAD_PENDING_STAGE : HOD_PENDING_STAGE;
        }

        const leave = await prisma.studentLeaveRequest.create({
            data: {
                studentId: targetStudentId,
                type: input.type as any,
                startDate,
                endDate,
                reason,
                documentUrl: input.documentUrl,
                status: "PENDING",
                reviewerRole,
            }
        });

        try {
            const studentName = studentRecord?.user?.name || "A student";
            if (reviewerRole === HOD_PENDING_STAGE && studentRecord?.departmentId) {
                const department = await prisma.department.findUnique({
                    where: { id: studentRecord.departmentId },
                    select: { headId: true }
                });
                if (department?.headId) {
                    await prisma.notification.create({
                        data: {
                            userId: department.headId,
                            title: `New Leave Request from ${studentName}`,
                            content: `${studentName} has submitted a leave request for your approval.`,
                            type: "leave_request",
                            priority: "normal",
                            actionUrl: "/students?tab=leave-requests",
                        }
                    });
                }
            } else if (reviewerRole === EXTENSION_HEAD_PENDING_STAGE) {
                const extHeads = await prisma.extensionActivityPosition.findMany({
                    where: { position: "EXTENSION_ACTIVITY_HEAD" },
                    select: { userId: true }
                });
                if (extHeads.length > 0) {
                    await prisma.notification.createMany({
                        data: extHeads.map(e => ({
                            userId: e.userId,
                            title: `New OD Request from ${studentName}`,
                            content: `${studentName} has submitted a club event OD request for your approval.`,
                            type: "leave_request",
                            priority: "normal",
                            actionUrl: "/students?tab=leave-requests",
                        }))
                    });
                }
            }
        } catch (error) {
            console.error("Failed to send leave request creation notifications:", error);
        }

        const parsed = parseODFromReason(leave.reason);
        return {
            success: true,
            message: "Leave request submitted successfully",
            data: {
                ...leave,
                reason: parsed.cleanReason,
                odPeriods: parsed.odPeriods,
                odRequestCategory: parsed.odRequestCategory,
            },
        };
    });

export const updateStudentLeaveRequestStatus = authedProcedure
    .input(z.object({
        id: z.coerce.number(),
        status: z.enum(["APPROVED", "REJECTED"]),
        remarks: z.string().optional(),
    }))
    .handler(async ({ input, context }) => {
        const user = context.user;
        if (user.role === "STUDENT") throw new ORPCError("FORBIDDEN", { message: "Students cannot approve leave requests" });
        const extensionPosition = await prisma.extensionActivityPosition.findFirst({
            where: { userId: user.id, position: "EXTENSION_ACTIVITY_HEAD" },
            select: { id: true },
        });
        const isExtensionHead = !!extensionPosition;
        const leave = await prisma.studentLeaveRequest.findUnique({
            where: { id: input.id },
            include: {
                student: {
                    select: {
                        departmentId: true,
                        userId: true,
                        user: { select: { name: true } }
                    },
                },
            },
        });
        if (!leave) throw new ORPCError("NOT_FOUND", { message: "Leave request not found" });

        if (leave.status !== "PENDING") {
            throw new ORPCError("BAD_REQUEST", { message: "Only pending leave requests can be reviewed" });
        }

        const stage = leave.reviewerRole || HOD_PENDING_STAGE;
        const isAdmin = user.role === "ADMIN";
        const isHod = user.role === "DEPARTMENT_HEAD";
        const isDsa = user.role === "DEAN_STUDENT_AFFAIRS";

        // Department-level guard for HOD
        if (isHod && user.departmentId && leave.student?.departmentId && user.departmentId !== leave.student.departmentId) {
            throw new ORPCError("FORBIDDEN", { message: "You can only review leave requests for your department students" });
        }

        // Stage access control
        if (stage === EXTENSION_HEAD_PENDING_STAGE && !(isExtensionHead || isAdmin)) {
            throw new ORPCError("FORBIDDEN", { message: "Only Extension Activity Head can perform first-level review for club events" });
        }
        if (stage === HOD_PENDING_STAGE && !(isHod || isAdmin)) {
            throw new ORPCError("FORBIDDEN", { message: "Only Department Head can perform first-level review" });
        }
        if (stage === DSA_PENDING_STAGE && !(isDsa || isAdmin)) {
            throw new ORPCError("FORBIDDEN", { message: "Only Dean Student Affairs can perform second-level review" });
        }

        let data: any = {};
        let message = "";
        const now = new Date();

        // Club-event first-level review (Extension Head/Admin)
        if (stage === EXTENSION_HEAD_PENDING_STAGE) {
            if (input.status === "APPROVED") {
                data = {
                    status: "PENDING",
                    reviewerRole: DSA_PENDING_STAGE,
                    reviewedBy: user.id,
                    reviewedAt: now,
                    remarks: input.remarks || null,
                };
                message = "OD request forwarded to Student Affairs";
            } else {
                data = {
                    status: "REJECTED",
                    reviewerRole: "EXTENSION_REJECTED",
                    reviewedBy: user.id,
                    reviewedAt: now,
                    remarks: input.remarks || null,
                };
                message = "OD request rejected by Extension Activity Head";
            }
        }

        // First-level review (HOD/Admin)
        if (stage === HOD_PENDING_STAGE) {
            if (input.status === "APPROVED") {
                data = {
                    status: "PENDING",
                    reviewerRole: DSA_PENDING_STAGE,
                    reviewedBy: user.id,
                    reviewedAt: now,
                    remarks: input.remarks || null,
                };
                message = "Leave request forwarded to Student Affairs";
            } else {
                data = {
                    status: "REJECTED",
                    reviewerRole: "HOD_REJECTED",
                    reviewedBy: user.id,
                    reviewedAt: now,
                    remarks: input.remarks || null,
                };
                message = "Leave request rejected by Department Head";
            }
        }

        // Second-level review (DSA/Admin)
        if (stage === DSA_PENDING_STAGE) {
            if (input.status === "APPROVED") {
                data = {
                    status: "APPROVED",
                    reviewerRole: "DSA_APPROVED",
                    reviewedBy: user.id,
                    reviewedAt: now,
                    remarks: input.remarks || leave.remarks || null,
                };
                message = "Leave request approved by Student Affairs";
            } else {
                data = {
                    status: "REJECTED",
                    reviewerRole: "DSA_REJECTED",
                    reviewedBy: user.id,
                    reviewedAt: now,
                    remarks: input.remarks || leave.remarks || null,
                };
                message = "Leave request rejected by Student Affairs";
            }
        }

        if (!message) {
            throw new ORPCError("BAD_REQUEST", { message: "Invalid leave workflow state" });
        }

        const updated = await prisma.studentLeaveRequest.update({
            where: { id: input.id },
            data,
        });

        try {
            const studentUserId = leave.student?.userId;
            const studentName = leave.student?.user?.name || "A student";

            if (studentUserId) {
                if (stage === EXTENSION_HEAD_PENDING_STAGE || stage === HOD_PENDING_STAGE) {
                    if (input.status === "APPROVED") {
                        const dsas = await prisma.user.findMany({
                            where: { role: "DEAN_STUDENT_AFFAIRS", isActive: true },
                            select: { id: true }
                        });
                        if (dsas.length > 0) {
                            await prisma.notification.createMany({
                                data: dsas.map(dsa => ({
                                    userId: dsa.id,
                                    title: "Leave Request Forwarded",
                                    content: `A leave request for ${studentName} has been approved and requires your review.`,
                                    type: "leave_request",
                                    priority: "normal",
                                    actionUrl: "/students?tab=leave-requests",
                                }))
                            });
                        }
                        
                        await prisma.notification.create({
                            data: {
                                userId: studentUserId,
                                title: stage === EXTENSION_HEAD_PENDING_STAGE ? "OD Request Approved by Extension Head" : "Leave Request Approved by HOD",
                                content: "Your request has been approved and forwarded to Student Affairs.",
                                type: "leave_request",
                                priority: "normal",
                                actionUrl: "/student-dashboard/leave-requests",
                            }
                        });
                    } else {
                        await prisma.notification.create({
                            data: {
                                userId: studentUserId,
                                title: stage === EXTENSION_HEAD_PENDING_STAGE ? "OD Request Rejected by Extension Head" : "Leave Request Rejected by HOD",
                                content: `Your request was rejected. Remarks: ${input.remarks || "None"}`,
                                type: "leave_request",
                                priority: "high",
                                actionUrl: "/student-dashboard/leave-requests",
                            }
                        });
                    }
                } else if (stage === DSA_PENDING_STAGE) {
                    if (input.status === "APPROVED") {
                        await prisma.notification.create({
                            data: {
                                userId: studentUserId,
                                title: "Leave Request Final Approved",
                                content: "Your request has been finally approved by Student Affairs.",
                                type: "leave_request",
                                priority: "normal",
                                actionUrl: "/student-dashboard/leave-requests",
                            }
                        });
                    } else {
                        await prisma.notification.create({
                            data: {
                                userId: studentUserId,
                                title: "Leave Request Rejected by Student Affairs",
                                content: `Your request was rejected. Remarks: ${input.remarks || "None"}`,
                                type: "leave_request",
                                priority: "high",
                                actionUrl: "/student-dashboard/leave-requests",
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Failed to send leave request update notifications:", error);
        }

        return { success: true, message, data: updated };
    });

export const deleteStudentLeaveRequest = authedProcedure
    .input(z.object({
        id: z.coerce.number(),
    }))
    .handler(async ({ input, context }) => {
        const user = context.user;

        const leave = await prisma.studentLeaveRequest.findUnique({
            where: { id: input.id },
            include: { student: true }
        });

        if (!leave) throw new ORPCError("NOT_FOUND", { message: "Leave request not found" });

        if (user.role === "STUDENT") {
            if (leave.student.userId !== user.id) {
                throw new ORPCError("FORBIDDEN", { message: "You can only delete your own leave requests" });
            }
            if (leave.status !== "PENDING") {
                throw new ORPCError("BAD_REQUEST", { message: "You can only delete pending leave requests" });
            }
        }

        await prisma.studentLeaveRequest.delete({
            where: { id: input.id }
        });

        return { success: true, message: "Leave request deleted successfully" };
    });

export const studentLeaveRequestsRouter = o.router({
    list: getStudentLeaveRequests,
    create: createStudentLeaveRequest,
    updateStatus: updateStudentLeaveRequestStatus,
    delete: deleteStudentLeaveRequest,
});
