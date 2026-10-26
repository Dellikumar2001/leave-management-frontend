"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import {
  Baby,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Ban,
  Coins,
  FileBarChart,
  FileText,
  FileCheck,
  Mail,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  User,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";

export type LeaveSidebarPage =
  | "dashboard"
  | "leave-category"
  | "leave-requests"
  | "leave-types"
  | "eligibility"
  | "create-eligibility"
  | "approver-settings"
  | "leave-approve-reject"
  | "holiday-calendar"
  | "leave-mail-format"
  | "settings"
  | "leave-refresh"
  | "maternity-leave"
  | "block-leave"
  | "credit-leave"
  | "individual-report"
  | "my-report"
  | "leave-report"
  | "credit-leave-report"
  | "statutory-report"
  | "paternity-leave"
  | "leave-status-report"
  | "employee-status-report"
  | "approver-report"
  | "leave-year-end";

type LeaveSidebarProps = {
  activePage: LeaveSidebarPage | string;
};

export type NavItem = {
  id: string;
  label: string;
  href?: string;
  Icon?: ComponentType<{ size?: number; className?: string }>;
  subItems?: readonly NavItem[];
};

function isItemActive(item: NavItem, activePage: string): boolean {
  if (item.id === activePage) return true;
  if (item.subItems && item.subItems.length > 0) {
    return item.subItems.some((sub) => isItemActive(sub, activePage));
  }
  return false;
}

const leaveSettingsNavigation: readonly NavItem[] = [
  {
    id: "leave-category",
    label: "Leave Category",
    href: "/leave-category",
    Icon: CalendarDays,
  },
  {
    id: "leave-types",
    label: "Leave types",
    href: "/leave-type",
    Icon: CalendarDays,
  },
  {
    id: "leave-requests",
    label: "Leave Groups",
    href: "/leave-requests",
    Icon: ClipboardList,
  },
  {
    id: "eligibility",
    label: "Leave Entitlement",
    href: "/leave-eligibility",
    Icon: Users,
  },
  {
    id: "create-eligibility",
    label: "Create Leave Entitlement",
    href: "/create-eligibility",
    Icon: Users,
  },
  {
    id: "approver-settings",
    label: "Approver settings",
    href: "/approver-settings",
    Icon: ShieldCheck,
  },
  {
    id: "leave-approve-reject",
    label: "Leave Approve/Reject",
    href: "/leave-approve-reject",
    Icon: CheckCircle2,
  },
  {
    id: "holiday-calendar",
    label: "Holiday Calendar",
    href: "/holiday-calendar",
    Icon: CalendarDays,
  },
  {
    id: "leave-year-end",
    label: "Leave Year-End Process",
    href: "/leave-year-end",
    Icon: RefreshCw,
  },
  {
    id: "leave-mail-format",
    label: "Leave mail format",
    href: "/leave-mail-format",
    Icon: Mail,
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
    id: "credit-leave-report",
    label: "Credit Leave Report",
    href: "/leave-report/credit",
    Icon: Coins,
  },
  {
    id: "year-end-leave-report",
    label: "Year End Leave Report",
    href: "/leave-report/year-end",
    Icon: FileBarChart,
  },
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
  {
    id: "employee-status-report",
    label: "Individual Status Report",
    href: "/leave-report/employee-status",
    Icon: Users,
  },
  {
    id: "approver-report",
    label: "Approver Report",
    href: "/leave-report/approver-report",
    Icon: UserCheck,
  },
];

function SubGroupItem({
  item,
  activePage,
  level = 1,
}: {
  item: NavItem;
  activePage: string;
  level?: number;
}) {
  const isSubActive = isItemActive(item, activePage);

  const [subOpen, setSubOpen] = useState(isSubActive);
  const [prevIsSubActive, setPrevIsSubActive] = useState(isSubActive);

  if (isSubActive !== prevIsSubActive) {
    setPrevIsSubActive(isSubActive);
    if (isSubActive) {
      setSubOpen(true);
    }
  }

  const ItemIcon = item.Icon;

  return (
    <div className="w-full">
      <div
        className={`flex w-full items-center justify-between rounded-md transition-colors ${
          level === 1 ? "min-h-[34px] px-2 text-[12.5px]" : "min-h-[30px] px-1.5 text-[12px]"
        } ${
          isSubActive
            ? "bg-slate-100/70 font-semibold text-slate-900"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        <Link
          href={item.href || "#"}
          onClick={(e) => {
            if (!item.href || item.href === "#") {
              e.preventDefault();
              setSubOpen((prev) => !prev);
            } else {
              setSubOpen(true);
            }
          }}
          className="flex min-w-0 flex-1 items-center gap-2 no-underline text-inherit"
        >
          {ItemIcon && (
            <ItemIcon
              size={level === 1 ? 14 : 13}
              className={isSubActive ? "text-emerald-700 shrink-0" : "text-slate-400 shrink-0"}
            />
          )}
          <span className="truncate">{item.label}</span>
        </Link>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSubOpen((prev) => !prev);
          }}
          aria-expanded={subOpen}
          aria-label={`Toggle ${item.label}`}
          className="p-1 -mr-0.5 text-slate-400 hover:text-slate-600"
        >
          <ChevronRight
            size={12}
            className={`transition-transform duration-200 ${
              subOpen ? "rotate-90" : "rotate-0"
            }`}
          />
        </button>
      </div>

      {subOpen && item.subItems && (
        <div
          className={`mt-0.5 space-y-0.5 border-l border-slate-200 ${
            level === 1 ? "ml-2.5 pl-1.5" : "ml-2 pl-1.5"
          }`}
        >
          {item.subItems.map((sub) => {
            if (sub.subItems && sub.subItems.length > 0) {
              return (
                <SubGroupItem
                  key={sub.id}
                  item={sub}
                  activePage={activePage}
                  level={level + 1}
                />
              );
            }

            const isCurrent = sub.id === activePage;
            const SubIcon = sub.Icon ?? ItemIcon;

            return (
              <Link
                key={sub.id}
                href={sub.href || "#"}
                aria-current={isCurrent ? "page" : undefined}
                className={`flex min-h-[28px] items-center gap-1.5 rounded-md px-1.5 text-[11.5px] no-underline transition-colors ${
                  isCurrent
                    ? "bg-emerald-50 font-semibold text-emerald-800"
                    : "text-slate-600 hover:bg-emerald-50/60 hover:text-slate-900"
                }`}
              >
                {SubIcon && (
                  <SubIcon
                    size={12}
                    className={
                      isCurrent ? "text-emerald-700 shrink-0" : "text-slate-400 shrink-0"
                    }
                  />
                )}
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
  const isChildActive = items.some((item) => isItemActive(item, activePage));

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
                href={item.href || "#"}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-[34px] items-center gap-2 rounded-md px-2 text-[12.5px] no-underline transition-colors ${isActive
                  ? "bg-emerald-50 font-semibold text-emerald-800"
                  : "text-slate-600 hover:bg-emerald-50/60 hover:text-slate-900"
                  }`}
              >
                {ItemIcon && (
                  <ItemIcon
                    size={14}
                    className={
                      isActive ? "text-emerald-700" : "text-slate-400"
                    }
                  />
                )}
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
        />

        <SidebarGroup
          icon={ShieldCheck}
          label="Leave Admin"
          items={leaveAdminNavigation}
          activePage={activePage}
        />

        <SidebarGroup
          icon={FileBarChart}
          label="Leave Reports"
          items={leaveReportNavigation}
          activePage={activePage}
        />

        <Link
          href="/my-report"
          aria-current={activePage === "my-report" ? "page" : undefined}
          className={`flex min-h-[38px] items-center gap-[11px] rounded-md px-3 text-[13px] font-medium no-underline transition-colors ${activePage === "my-report"
            ? "bg-emerald-50 font-semibold text-emerald-800"
            : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            }`}
        >
          <FileText size={16} className={activePage === "my-report" ? "text-emerald-700" : "text-slate-500"} />
          <span>My Report</span>
        </Link>
      </nav>
    </aside>
  );
}