"use client";

import LeaveSidebar from "../components/LeaveSidebar";
import StatutoryReport from "./StatutoryReport";

export default function LeaveReportPage() {
  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="statutory-report" />
      <div className="p-4 min-[801px]:ml-[175px]">
        <div className="mx-auto max-w-[1400px]">
          <StatutoryReport />
        </div>
      </div>
    </div>
  );
}
