import { prisma } from "@/lib/prisma";

export async function getDemoEmployee() {
  const employeeId = process.env.DEMO_EMPLOYEE_ID?.trim();
  if (process.env.NODE_ENV === "production") return null;

  const employee = employeeId
    ? await prisma.employee.findUnique({
        where: { employeeId },
        select: {
          employeeId: true,
          name: true,
          stream: true,
          department: true,
          designation: true,
          mobileNumber: true,
          workEmail: true,
        },
      })
    : await prisma.employee.findFirst({
        orderBy: { employeeId: "asc" },
        select: {
          employeeId: true,
          name: true,
          stream: true,
          department: true,
          designation: true,
          mobileNumber: true,
          workEmail: true,
        },
      });
  if (!employee) return null;
  if (employee.workEmail?.trim()) return employee;

  const student = await prisma.student.findFirst({
    where: { studentCode: employee.employeeId },
    select: { user: { select: { email: true } } },
  });
  return { ...employee, workEmail: student?.user.email?.trim() || null };
}
