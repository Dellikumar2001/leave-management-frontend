import { handleRestRequest } from "@/lib/rpc/adapter";
import {
    getStudentLeaveRequests,
    createStudentLeaveRequest,
    updateStudentLeaveRequestStatus,
    deleteStudentLeaveRequest,
} from "@/app/api/rpc/routers/student-leave-requests";
import { prisma } from "@/lib/prisma";
import {
    blockedLeaveMessage,
    findBlockedDate,
    findHolidayDate,
    holidayLeaveMessage,
    parseDateOnly,
} from "@/lib/leave-administration";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
    return handleRestRequest(getStudentLeaveRequests, request);
}

export async function POST(request: NextRequest) {
    const body = await request.clone().json().catch(() => null) as Record<string, unknown> | null;
    if (body) {
        const startValue = typeof body.startDate === "string" ? body.startDate.slice(0, 10) : "";
        const endValue = typeof body.endDate === "string" ? body.endDate.slice(0, 10) : startValue;
        const startDate = parseDateOnly(startValue);
        const endDate = parseDateOnly(endValue);

        if (startDate && endDate && endDate >= startDate) {
            const holiday = await findHolidayDate(startDate, endDate);
            if (holiday) {
                return Response.json({ success: false, error: holidayLeaveMessage }, { status: 409 });
            }

            let employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
            if (!employeeId && Number.isSafeInteger(body.studentId)) {
                const student = await prisma.student.findUnique({
                    where: { id: body.studentId as number },
                    select: { studentCode: true },
                });
                employeeId = student?.studentCode ?? "";
            }

            if (employeeId && await findBlockedDate(employeeId, startDate, endDate)) {
                return Response.json({ success: false, error: blockedLeaveMessage }, { status: 409 });
            }
        }
    }
    return handleRestRequest(createStudentLeaveRequest, request);
}

export async function PATCH(request: NextRequest) {
    return handleRestRequest(updateStudentLeaveRequestStatus, request);
}

export async function DELETE(request: NextRequest) {
    return handleRestRequest(deleteStudentLeaveRequest, request);
}
