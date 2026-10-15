export const getStudentLeaveRequests = async ({ input }: { input?: unknown }) => ({
  success: true,
  data: [],
  input,
});

export const createStudentLeaveRequest = async ({ input }: { input?: unknown }) => ({
  success: true,
  data: input,
});

export const updateStudentLeaveRequestStatus = async ({ input }: { input?: unknown }) => ({
  success: true,
  data: input,
});

export const deleteStudentLeaveRequest = async ({ input }: { input?: unknown }) => ({
  success: true,
  data: input,
});
