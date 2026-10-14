"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  Baby,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Ban,
  Coins,
  FileBarChart,
  FileText,
  FileCheck,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

export type LeaveSidebarPage =
  | "dashboard"
  | "leave-category"
  | "leave-requests"
  | "leave-types"
  | "eligibility"
  | "create-eligibility"
  | "holiday-calendar"
  | "settings"
  | "leave-refresh"
  | "maternity-leave"
  | "block-leave"
  | "credit-leave"
  | "individual-report"
  | "leave-report"
  | "statutory-report"
  | "paternity-leave"
  | "leave-status-report";

type LeaveSidebarProps = {
  activePage: LeaveSidebarPage;
};

type SubItem = {
  id: string;
  label: string;
  href: string;
  Icon?: ComponentType<{ size?: number; className?: string }>;
};

type NavItem = {
  id: string;
  label: string;
  href: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  subItems?: readonly SubItem[];
};

const leaveSettingsNavigation: readonly NavItem[] = [
  {
    id: "leave-category",
    label: "Leave category",
    href: "/leave-category",
    Icon: CalendarDays,
  },
  {
    id: "leave-requests",
    label: "Leave groups",
    href: "/leave-requests",
    Icon: ClipboardList,
  },
  {
    id: "leave-types",
    label: "Leave types",
    href: "/leave-type",
    Icon: CalendarDays,
  },
  {
    id: "eligibility",
    label: "Leave eligibility",
    href: "/leave-eligibility",
    Icon: Users,
  },
  {
    id: "create-eligibility",
    label: "Create leave eligibility",
    href: "/create-eligibility",
    Icon: Users,
  },
  {
    id: "holiday-calendar",
    label: "Holiday calendar",
    href: "/holiday-calendar",
    Icon: CalendarDays,
  },
];

const leaveAdminNavigation: readonly NavItem[] = [
  {
    id: "block-leave",
    label: "Block Leave",
    href: "/block-leave",
    Icon: Ban,
  },
  {
    id: "credit-leave",
    label: "Credit Leave",
    href: "/creditleave",
    Icon: Coins,
  },
  {
    id: "leave-refresh",
    label: "Leave Refresh",
    href: "/leave-refresh",
    Icon: RefreshCw,
  },
  {
    id: "paternity-leave",
    label: "Paternity Leave",
    href: "/paternity-leave",
    Icon: Baby,
  },
  {
    id: "maternity-leave",
    label: "Maternity Leave",
    href: "/maternity-leave",
    Icon: Baby,
  },
];

const leaveReportNavigation: readonly NavItem[] = [
  {
    id: "individual-report",
    label: "Individual Report",
    href: "/leave-report/individual",
    Icon: FileBarChart,
  },
  {
    id: "statutory-report",
    label: "Statutory Report",
    href: "/leave-report",
    Icon: FileText,
  },
  {
    id: "leave-status-report",
    label: "Leave Status Report",
    href: "/leave-reports/leave-status-report",
    Icon: FileCheck,
  },
];

function SubGroupItem({
  item,
  activePage,
}: {
  item: NavItem;
  activePage: string;
}) {
  const isSubActive =
    item.id === activePage ||
    (item.subItems?.some((sub) => sub.id === activePage) ?? false);

  const [subOpen, setSubOpen] = useState(true);

  useEffect(() => {
    if (isSubActive) {
      setSubOpen(true);
    }
  }, [isSubActive]);

  const ItemIcon = item.Icon;

  return (
    <div>
      <button
        type="button"
        onClick={() => setSubOpen((prev) => !prev)}
        aria-expanded={subOpen}
        className={`flex w-full min-h-[34px] items-center justify-between rounded-md px-2 text-[12.5px] transition-colors ${isSubActive
            ? "bg-slate-100/70 font-semibold text-slate-900"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
      >
        <span className="flex items-center gap-2">
          <ItemIcon
            size={14}
            className={isSubActive ? "text-emerald-700" : "text-slate-400"}
          />
          <span className="truncate">{item.label}</span>
        </span>

        <ChevronRight
          size={12}
          className={`text-slate-400 transition-transform duration-200 ${subOpen ? "rotate-90" : "rotate-0"
            }`}
        />
      </button>

      {subOpen && item.subItems && (
        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-slate-200 pl-2">
          {item.subItems.map((sub) => {
            const isCurrent = sub.id === activePage;
            const SubIcon = sub.Icon ?? ItemIcon;

            return (
              <Link
                key={sub.id}
                href={sub.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`flex min-h-[30px] items-center gap-2 rounded-md px-2 text-[12px] no-underline transition-colors ${isCurrent
                    ? "bg-emerald-50 font-semibold text-emerald-800"
                    : "text-slate-600 hover:bg-emerald-50/60 hover:text-slate-900"
                  }`}
              >
                <SubIcon
                  size={13}
                  className={
                    isCurrent ? "text-emerald-700" : "text-slate-400"
                  }
                />
                <span className="truncate">{sub.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SidebarGroup({
  icon: Icon,
  label,
  items,
  activePage,
  defaultOpen = false,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  items: readonly NavItem[];
  activePage: string;
  defaultOpen?: boolean;
}) {
  const isChildActive = items.some(
    (item) =>
      item.id === activePage ||
      (item.subItems?.some((sub) => sub.id === activePage) ?? false)
  );

  const [openState, setOpenState] = useState(() => ({
    activePage,
    isOpen: defaultOpen || isChildActive,
  }));

  const isOpen =
    openState.activePage === activePage
      ? openState.isOpen
      : defaultOpen || isChildActive;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpenState({ activePage, isOpen: !isOpen })}
        aria-expanded={isOpen}
        className={`flex w-full min-h-[38px] items-center justify-between rounded-md px-3 text-[13px] font-medium transition-colors ${isChildActive
            ? "bg-slate-100/70 font-semibold text-slate-900"
            : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          }`}
      >
        <span className="flex items-center gap-[11px]">
          <Icon
            size={16}
            className={isChildActive ? "text-emerald-700" : "text-slate-500"}
          />
          <span>{label}</span>
        </span>

        <ChevronRight
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-90" : "rotate-0"
            }`}
        />
      </button>

      {isOpen && (
        <div className="ml-2.5 mt-1 space-y-0.5 border-l border-slate-200 pl-2">
          {items.map((item) => {
            if (item.subItems && item.subItems.length > 0) {
              return (
                <SubGroupItem
                  key={item.id}
                  item={item}
                  activePage={activePage}
                />
              );
            }

            const isActive = item.id === activePage;
            const ItemIcon = item.Icon;

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-[34px] items-center gap-2 rounded-md px-2 text-[12.5px] no-underline transition-colors ${isActive
                    ? "bg-emerald-50 font-semibold text-emerald-800"
                    : "text-slate-600 hover:bg-emerald-50/60 hover:text-slate-900"
                  }`}
              >
                <ItemIcon
                  size={14}
                  className={
                    isActive ? "text-emerald-700" : "text-slate-400"
                  }
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function LeaveSidebar({
  activePage,
}: LeaveSidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden min-h-screen w-[175px] border-r border-slate-200 bg-white min-[801px]:block print:hidden">
      {/* Logo */}
      <Link
        href="/"
        className="flex h-[66px] items-center gap-2 border-b border-slate-100 px-5 text-[17px] font-semibold text-slate-800 no-underline"
      >
        <span className="grid size-6 place-items-center text-emerald-700">
          <CalendarDays size={22} />
        </span>

        <strong>
          Leave<span className="text-emerald-700">Flow</span>
        </strong>
      </Link>

      {/* Navigation groups */}
      <nav
        className="space-y-1 px-2 py-3"
        aria-label="Main navigation"
      >
        <SidebarGroup
          icon={Settings}
          label="Leave Settings"
          items={leaveSettingsNavigation}
          activePage={activePage}
          defaultOpen={true}
        />

        <SidebarGroup
          icon={ShieldCheck}
          label="Leave Admin"
          items={leaveAdminNavigation}
          activePage={activePage}
          defaultOpen={true}
        />

        <SidebarGroup
          icon={FileBarChart}
          label="Leave Report"
          items={leaveReportNavigation}
          activePage={activePage}
        />
      </nav>
    </aside>
  );
}