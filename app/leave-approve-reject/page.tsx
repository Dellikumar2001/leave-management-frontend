import LeaveSidebar from "../components/LeaveSidebar";
import ApprovalQueue from "../approver-settings/ApprovalQueue";

export default function LeaveApproveRejectPage() {
  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="leave-approve-reject" />
      <div className="p-4 min-[801px]:ml-[175px]">
        <div className="mx-auto max-w-[1400px]">
          <ApprovalQueue />
        </div>
      </div>
    </div>
  );
}