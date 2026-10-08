import Link from "next/link";
import { CalendarDays, ClipboardList, House, Settings, Users } from "lucide-react";

export type LeaveSidebarPage =
  | "dashboard"
  | "leave-category"
  | "leave-requests"
  | "leave-types"
  | "eligibility"
  | "holiday-calendar"
  | "settings";

type LeaveSidebarProps = {
  activePage: LeaveSidebarPage;
};

const navigation = [
  { id: "dashboard", label: "Dashboard", href: "/", Icon: House },
  { id: "leave-category", label: "Leave category", href: "/leave-category", Icon: CalendarDays },
  { id: "leave-requests", label: "Leave groups", href: "/leave-requests", Icon: ClipboardList },
  { id: "leave-types", label: "Leave types", href: "/leave-type", Icon: CalendarDays },
  { id: "eligibility", label: "Eligibility", href: "/leave-eligibility", Icon: Users },
  { id: "holiday-calendar", label: "Holiday calendar", href: "/holiday-calendar", Icon: CalendarDays },
  { id: "settings", label: "Settings", href: "/leave-type", Icon: Settings },
] as const;

export default function LeaveSidebar({ activePage }: LeaveSidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden min-h-screen w-[175px] border-r border-slate-200 bg-white min-[801px]:block">
      <Link href="/" className="flex h-[66px] items-center gap-2 border-b border-slate-100 px-5 text-[17px] font-semibold text-slate-800 no-underline">
        <span className="grid size-6 place-items-center text-emerald-700"><CalendarDays size={22} /></span>
        <strong>Leave<span className="text-emerald-700">Flow</span></strong>
      </Link>
      <nav className="space-y-1 px-2 py-3" aria-label="Main navigation">
        {navigation.map(({ id, label, href, Icon }) => {
          const isActive = id === activePage;
          return (
            <Link
              key={id}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-[38px] items-center gap-[11px] rounded-md px-3 text-[13px] no-underline transition-colors ${isActive ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-700 hover:bg-emerald-50"}`}
            >
              <Icon size={16} className={isActive ? "text-emerald-700" : "text-slate-500"} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
