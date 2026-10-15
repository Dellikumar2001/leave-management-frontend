import { getDemoEmployee } from "@/lib/demo-employee";
import { GET as getIndividualReport } from "../individual-report/route";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const employee = await getDemoEmployee();
    if (!employee) {
      return Response.json(
        { error: "Configure the authenticated employee session before using My Report." },
        { status: 401 },
      );
    }

    const params = new URL(request.url).searchParams;
    const hasDateRange = params.has("startDate") || params.has("endDate");
    if (!hasDateRange) {
      return Response.json({
        employee: {
          employeeId: employee.employeeId,
          name: employee.name,
          designation: employee.designation,
          department: employee.department,
          stream: employee.stream,
          mobile: employee.mobileNumber,
          workEmail: employee.workEmail,
        },
      });
    }

    const reportParams = new URLSearchParams(params);
    reportParams.set("employeeId", employee.employeeId);
    const reportRequest = new Request(
      `${new URL(request.url).origin}/api/individual-report?${reportParams.toString()}`,
    );
    return getIndividualReport(reportRequest);
  } catch (error) {
    console.error("Failed to load the current employee report:", error);
    return Response.json({ error: "Unable to load the current employee report." }, { status: 503 });
  }
}
