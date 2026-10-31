import { findHolidayDate, parseDateOnly, holidayLeaveMessage } from "@/lib/leave-administration";

export const getStudentLeaveRequests = async ({ input }: { input?: unknown }) => ({
  success: true,
  data: [],
  input,
});

export const createStudentLeaveRequest = async ({ input }: { input?: unknown }) => {
  if (input && typeof input === "object") {
    const raw = input as Record<string, unknown>;
    const startValue = typeof raw.startDate === "string" ? raw.startDate.slice(0, 10) : "";
    const endValue = typeof raw.endDate === "string" ? raw.endDate.slice(0, 10) : startValue;
    const startDate = parseDateOnly(startValue);
    const endDate = parseDateOnly(endValue);
    if (startDate && endDate && endDate >= startDate) {
      const holiday = await findHolidayDate(startDate, endDate);
      if (holiday) {
        throw new Error(holidayLeaveMessage);
      }
    }
  }
  return {
    success: true,
    data: input,
  };
};

export const updateStudentLeaveRequestStatus = async ({ input }: { input?: unknown }) => ({
  success: true,
  data: input,
});

export const deleteStudentLeaveRequest = async ({ input }: { input?: unknown }) => ({
  success: true,
  data: input,
});
