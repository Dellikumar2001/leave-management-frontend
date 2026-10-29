# Database schema and page map

Reviewed against `prisma/schema.prisma` and the current `app/` and `lib/` code on 2026-10-29. This is an inventory of Prisma-managed tables, not a live database introspection; unmanaged tables, views, and database objects are not included. This is a migration guide, not a migration: no schema or application code was changed.

## How to read this document

- The schema has **28 Prisma models/tables**. Enum declarations are types, not tables.
- Column lists below use Prisma field names; when a database column name differs, it is shown in parentheses. Relation fields and computed/UI-only properties are not columns.
- A page generally calls an API route rather than Prisma directly. The usage map names both so the full data path is clear.
- “Should share” means the data has the same business meaning, not merely a coincidentally similar column name.

## Tables and columns

| Prisma model (physical table) | Database columns |
|---|---|
| `LeaveType` (`leave_types`) | `id`, `code`, `name`, `leaveGroup` (`leave_group`), `paymentType` (`payment_type`), `category`, `categoryMasterId` (`category_master_id`), `daysAllowed` (`days_allowed`), `description`, `status`, `applicableTo` (PostgreSQL enum array), `isUsed` (`is_used`), `carryForward` (`carry_forward`), `createdAt` (`created_at`), `updatedAt` (`updated_at`) |
| `LeaveEligibility` (`leave_eligibilities`) | `id`, `eligibilityName` (`eligibility_name`), `description`, `employeeType` (`employee_type`), `employmentType` (`employment_type`), `managementStream` (`management_stream`), `leaveGroup` (`leave_group`), `status`, `createdAt` (`created_at`), `updatedAt` (`updated_at`) |
| `Employee` (`employees`) | `employeeId` (`employee_id`), `name`, `stream`, `department`, `status`, `gender`, `designation`, `religion`, `mobileNumber` (`mobile_number`), `workEmail` (`work_email`), `employeeType` (`employee_type`), `employmentType` (`employment_type`) |
| `EmployeeLeaveEligibility` (`employee_leave_eligibilities`) | `employeeId` (`employee_id`), `leaveTypeId` (`leave_type_id`), `isEligible` (`is_eligible`), `daysAllowed` (`days_allowed`), `leaveBalance` (`leave_balance`), `creditedDays` (`credited_days`), `joiningDate` (`joining_date`), `bf`, `earned`, `gender` |
| `MaternityLeave` (`maternity_leaves`) | `id`, `employeeId` (`employee_id`), `employeeName` (`employee_name`), `noOfDays` (`no_of_days`), `remarks`, `status`, `createdAt` (`created_at`), `updatedAt` (`updated_at`) |
| `EmployeeLeaveBalance` (`employee_leave_balances`) | `employeeId` (`employee_id`), `category`, `balance` |
| `BlockedLeave` (`blocked_leaves`) | `id`, `employeeId` (`employee_id`), `date`, `createdAt` (`created_at`) |
| `LeaveCredit` (`leave_credits`) | `id`, `employeeId` (`employee_id`), `category`, `days`, `startDate` (`start_date`), `endDate` (`end_date`), `version`, `leaveTypeId` (`leave_type_id`), `createdAt` (`created_at`), `updatedAt` (`updated_at`) |
| `EmployeeNotification` (`employee_notifications`) | `id`, `employeeId` (`employee_id`), `title`, `content`, `type`, `isRead` (`is_read`), `createdAt` (`created_at`) |
| `LeaveCategoryMaster` (`LeaveCategoryMaster`) | `id`, `code`, `name`, `isPaid`, `description`, `status`, `createdAt`, `updatedAt` |
| `LeaveGroup` (`LeaveGroup`) | `id`, `code`, `name`, `description`, `effectiveFrom`, `status`, `categoryId`, `createdAt`, `updatedAt` |
| `LeaveGroupCategory` (`LeaveGroupCategory`) | `leaveGroupId`, `categoryId` |
| `LeaveGroupItem` (`LeaveGroupItem`) | `id`, `leaveGroupId`, `leaveTypeId`, `createdAt` |
| `Department` (`Department`) | `id`, `name`, `headId`, `createdAt`, `updatedAt` |
| `User` (`User`) | `id`, `email`, `firstName`, `lastName`, `name`, `role`, `isActive`, `departmentId`, `createdAt`, `updatedAt` |
| `Student` (`Student`) | `id`, `userId`, `departmentId`, `studentCode`, `firstName`, `lastName`, `name`, `stream`, `year`, `createdAt`, `updatedAt` |
| `StudentLeaveRequest` (`StudentLeaveRequest`) | `id`, `studentId`, `type`, `startDate`, `endDate`, `reason`, `documentUrl`, `status`, `reviewerRole`, `remarks`, `reviewedBy`, `paymentType`, `appliedAt`, `reviewedAt`, `createdAt`, `updatedAt` |
| `Notification` (`Notification`) | `id`, `userId`, `title`, `content`, `type`, `priority`, `actionUrl`, `isRead`, `createdAt`, `updatedAt` |
| `ExtensionActivityPosition` (`ExtensionActivityPosition`) | `id`, `userId`, `position`, `createdAt`, `updatedAt` |
| `Holiday` (`holiday_calendar`) | `id`, `date`, `name`, `type`, `description`, `status`, `repeatEveryYear` (`repeat_every_year`), `isHoliday` (`is_holiday`) |
| `PaternityLeave` (`paternity_leaves`) | `id`, `employeeId` (`employee_id`), `employeeName` (`employee_name`), `noOfDays` (`no_of_days`), `remarks`, `status`, `createdAt` (`created_at`), `updatedAt` (`updated_at`) |
| `EmployeeLeaveApplication` (`employee_leave_applications`) | `id`, `employeeId` (`employee_id`), `leaveTypeId` (`leave_type_id`), `startDate` (`start_date`), `endDate` (`end_date`), `daysCount` (`days_count`), `reason`, `status`, `currentApprovalLevel` (`current_approval_level`), `appliedAt` (`applied_at`), `reviewedBy` (`reviewed_by`), `reviewedAt` (`reviewed_at`), `remarks` |
| `EmployeeLeaveUsage` (`employee_leave_usage`) | `id`, `employeeId` (`employee_id`), `leaveTypeId` (`leave_type_id`), `startDate` (`start_date`), `endDate` (`end_date`), `daysCount` (`days_count`), `type`, `status`, `reason`, `appliedAt` (`applied_at`), `reviewedBy` (`reviewed_by`), `reviewedAt` (`reviewed_at`) |
| `EmployeeLeaveApproval` (`employee_leave_approvals`) | `id`, `applicationId` (`application_id`), `level`, `approver`, `action`, `isBackup` (`is_backup`), `remarks`, `actionAt` (`action_at`) |
| `EmployeeApprover` (`employee_approvers`) | `id`, `employeeId` (`employee_id`), `firstLevelApprover` (`first_level_approver`), `secondLevelApprover` (`second_level_approver`), `finalLevelApprover` (`final_level_approver`), `backupOfficer` (`backup_officer`), `finalLevelBackupOfficer` (`final_level_backup_officer`), `createdAt` (`created_at`), `updatedAt` (`updated_at`) |
| `LeaveYearEndProcess` (`leave_year_end_processes`) | `id`, `currentCycle` (`current_cycle`), `nextCycle` (`next_cycle`), `processedBy` (`processed_by`), `processedAt` (`processed_at`), `totalEmployees` (`total_employees`), `totalBalancesCreated` (`total_balances_created`), `totalCarriedForward` (`total_carried_forward`), `totalReset` (`total_reset`), `totalSkipped` (`total_skipped`), `totalFailed` (`total_failed`), `status` |
| `LeaveYearEndRecord` (`leave_year_end_records`) | `id`, `processId` (`process_id`), `employeeId` (`employee_id`), `employeeName` (`employee_name`), `department`, `stream`, `leaveTypeId` (`leave_type_id`), `leaveTypeCode` (`leave_type_code`), `leaveTypeName` (`leave_type_name`), `currentCycle` (`current_cycle`), `nextCycle` (`next_cycle`), `entitlement`, `leaveUsed` (`leave_used`), `availableBalance` (`available_balance`), `rule`, `maxCarryForward` (`max_carry_forward`), `carriedForwardDays` (`carried_forward_days`), `proposedOpeningBalance` (`proposed_opening_balance`), `status`, `reason`, `createdAt` (`created_at`) |
| `EmployeeCycleBalance` (`employee_cycle_balances`) | `id`, `employeeId` (`employee_id`), `leaveTypeId` (`leave_type_id`), `cycle`, `openingBalance` (`opening_balance`), `carriedForward` (`carried_forward`), `entitlement`, `currentBalance` (`current_balance`), `createdAt` (`created_at`), `updatedAt` (`updated_at`) |

Schema source locations: `prisma/schema.prisma` model declarations are at lines 53, 80, 96, 147, 166, 181, 191, 203, 221, 235, 251, 266, 276, 287, 298, 317, 334, 355, 369, 378, 392, 407, 430, 451, 466, 482, 501, and 531 respectively. Six enums are declared at lines 10–49.

## Which pages use which tables

The page names below are App Router paths under `app/`; API and shared-library files are included to identify the actual persistence boundary.

| Tables | API/data-access paths | Pages/components using those APIs |
|---|---|---|
| `LeaveType` | `app/api/leave-types/route.ts`, `app/api/leave-types/[id]/route.ts`; also eligibility, refresh, year-end and report routes | `/leave-type`, `/leave-type/[id]`, `/leave-requests`, `/leave-requests/[id]`, `/create-eligibility`, `/leave-eligibility`, `/leave-refresh`, `/leave-year-end`, `/leave-report/*`, `/leave-reports/leave-status-report`, `/maternity-leave`, `/paternity-leave` |
| `LeaveEligibility` | `app/api/eligibility/route.ts` | `/create-eligibility` |
| `Employee` | Used by most employee leave APIs: `leave-eligibility`, `leave-refresh`, `leave-year-end`, `block-leave`, `leave-credit`, `approver-settings`, `employee-leave-approvals`, and reports | `/leave-eligibility`, `/leave-refresh`, `/leave-year-end`, `/block-leave`, `/leave-report/*`, `/leave-reports/leave-status-report`, `/approver-settings`, `/maternity-leave`, `/paternity-leave`, and `app/components/leave-admin/*` |
| `EmployeeLeaveEligibility` | `app/api/leave-eligibility/route.ts`, `app/api/leave-refresh/route.ts`, plus maternity/paternity and year-end routes | `/leave-eligibility`, `/leave-refresh`, `/leave-year-end`, `/maternity-leave`, `/paternity-leave`, `/leave-report/individual` |
| `MaternityLeave` | `app/api/maternity-leave/route.ts` | `/maternity-leave` |
| `EmployeeLeaveBalance` | Updated by `app/api/leave-credit/route.ts`; read through the employee relation in `app/api/individual-report/route.ts` | `app/components/leave-admin/LeaveAdministrationpage.tsx`, `/leave-report/individual` |
| `BlockedLeave` | `app/api/block-leave/route.ts`, `lib/leave-administration.ts`; also checked by `app/student-leave-requests/route.ts` | `/block-leave`, `/leave-report/individual`; the student-request route has no corresponding active UI page found |
| `LeaveCredit` | `app/api/leave-credit/route.ts`, `app/api/leave-credit/report/route.ts`, `app/api/individual-report/route.ts` | `app/components/leave-admin/LeaveAdministrationpage.tsx`, `app/components/leave-admin/CreditLeaveReport.tsx`, `app/components/leave-admin/YearEndLeaveReport.tsx`, `/leave-report/individual` |
| `EmployeeNotification` | Written by block-leave, leave-credit, and year-end transaction handlers | No notification UI page found in the current `app/` code |
| `LeaveCategoryMaster` | `app/api/leave-categories/*`, `app/api/leave-types/*`, `app/api/leave-requests/*` | `/leave-category`, `/leave-type`, `/leave-type/[id]`, `/leave-requests`, `/leave-requests/[id]` |
| `LeaveGroup`, `LeaveGroupCategory`, `LeaveGroupItem` | `app/api/leave-requests/route.ts`, `app/api/leave-requests/[id]/route.ts` | `/leave-requests`, `/leave-requests/[id]`, `/leave-type`, `/leave-type/[id]`, `/create-eligibility` |
| `Student` | `app/api/individual-report/route.ts`, `app/api/leave-status-report/route.ts`; `app/student-leave-requests/route.ts` also resolves a submitted student ID | `/leave-report/individual`, `/leave-reports/leave-status-report`; no active student-request management page was found |
| `StudentLeaveRequest` | `app/api/individual-report/route.ts`, `app/api/leave-status-report/route.ts`; REST handler delegates to `app/api/rpc/routers/student-leave-requests.ts` | `/leave-report/individual`, `/leave-reports/leave-status-report`. The student-request endpoint has no active UI page found |
| `Department`, `User`, `Notification`, `ExtensionActivityPosition` | No active Prisma-backed UI flow found. The former student workflow references these in commented code in `app/student-leave-requests.ts`; the current router in `app/api/rpc/routers/student-leave-requests.ts` is a placeholder. | No active page found |
| `Holiday` | `app/api/holidays/*`, `app/api/individual-report/route.ts` | `/holiday-calendar`, `/leave-report/individual` |
| `PaternityLeave` | `app/api/paternity-leave/route.ts` | `/paternity-leave` |
| `EmployeeLeaveApplication` | `app/api/employee-leave-approvals/route.ts`, `app/api/employee-status-report/route.ts`, `app/api/leave-eligibility/route.ts`, `app/api/leave-year-end/route.ts` | `app/approver-settings/ApprovalQueue.tsx`, `/leave-report/employee-status`, `/leave-eligibility`, `/leave-year-end` |
| `EmployeeLeaveUsage` | `app/api/individual-report/route.ts`, `app/api/year-end-leave-report/route.ts` | `/leave-report/individual`, `app/components/leave-admin/YearEndLeaveReport.tsx` |
| `EmployeeLeaveApproval`, `EmployeeApprover` | `app/api/employee-leave-approvals/route.ts`, `app/api/approver-settings/route.ts` | `/approver-settings`, `app/approver-settings/ApprovalQueue.tsx` |
| `LeaveYearEndProcess`, `LeaveYearEndRecord`, `EmployeeCycleBalance` | `app/api/leave-year-end/route.ts` | `/leave-year-end`, `app/components/leave-admin/YearEndLeaveReport.tsx` |

The model-to-page mapping is based on current call sites. Several models (notably `Notification`, `ExtensionActivityPosition`, and some student workflow models) have schema relations or commented code but no active user-facing workflow in the present code.

## Similar columns and whether they should share storage

### Strong candidate: maternity and paternity records

`MaternityLeave` and `PaternityLeave` have the same persisted business fields: `employeeId`, `employeeName`, `noOfDays`, `remarks`, `status`, and timestamps. The pages also expose the same record shape. The differences are the leave kind and policy/default days (maternity 180; paternity 5 in the schema), not the kind of record.

**Recommendation:** store both in one `SpecialLeaveRecord` table, with a required `leaveKind` enum (`MATERNITY` / `PATERNITY`) and a unique key on `(employeeId, leaveKind)`. Preserve `employeeName` as a snapshot during the first migration because the current pages display it and it may preserve the name as recorded at the time. This removes duplicate schema/API persistence logic without merging unlike workflows.

### Possible future candidate: student and employee leave applications

The shared concepts are `startDate`, `endDate`, `reason`, `status`, `remarks`, `appliedAt`, and `reviewedAt`. However, the current models do not have equivalent applicant or workflow columns:

| Concept | `EmployeeLeaveApplication` | `StudentLeaveRequest` | Treatment if consolidated |
|---|---|---|---|
| Applicant | `employeeId: String` FK to `Employee` | `studentId: Int` FK to `Student` | Add one canonical applicant/person FK; do not cast or overload one ID column |
| Leave type | `leaveTypeId: Int` FK to `LeaveType` | `type: LeaveRequestType` enum; optional `paymentType` | Map student types to `LeaveType` rows, or explicitly preserve a request-type field during a staged migration |
| Days | `daysCount` | Not persisted (derived from dates in the current schema) | Add and backfill `daysCount` with the established inclusive/exclusive rule before requiring it |
| Workflow | `currentApprovalLevel`, string `reviewedBy`, and child `EmployeeLeaveApproval` history | `reviewerRole`, integer `reviewedBy` FK to `User`, `reviewerRole`, optional document | Keep an explicit workflow discriminator and preserve the separate approval history/roles |

**Recommendation:** do not force these into one table until applicant identity and approval semantics are unified. In particular, a nullable `employeeId` plus nullable `studentId` on one record is easy to query incorrectly and cannot be expressed as a normal single Prisma relation. The active student router currently returns placeholders, so there is not yet a working student-request UI workflow to validate against.

If a shared table is a firm product requirement, first establish a canonical `LeaveApplicant`/`Person` record linked to the employee or student identity, and enforce exactly one subtype link with a database constraint. Then consolidate into `LeaveApplication` with a single applicant FK, normalized `LeaveType` FK, dates, `daysCount`, reason, status, timestamps, optional document, and a workflow kind. Keep approval actions in a child table keyed by application; do not flatten an approval history into one reviewer column.

### Shared labels which should not be blindly merged

- `Employee.name`, `Student.name`, `Student.firstName/lastName`, and `User.name/firstName/lastName` overlap, but represent different records today. `Employee` uses a string employee key; `Student` uses an integer key and belongs to `User`. If a common identity is needed, introduce a shared person identity and migrate FKs; do not equate `employeeId`, `studentCode`, `Student.id`, and `User.id`.
- `EmployeeLeaveApplication` and `EmployeeLeaveUsage` share dates, days, reason, status, and reviewer fields, but one is an approval workflow and the other is a report/usage ledger. Keep them separate until the source of truth and historical reconciliation are decided. A later efficiency improvement could derive approved usage from finalized applications or expose a database view, instead of dual-writing two records.
- `EmployeeLeaveEligibility.leaveBalance`, `EmployeeLeaveBalance.balance`, `EmployeeCycleBalance.currentBalance`, `LeaveCredit.days`, and `LeaveYearEndRecord` balance columns are not interchangeable. They represent eligibility/current values, category balances, cycle snapshots, credit transactions, and process snapshots. Keep these meanings distinct and document which is authoritative.
- `LeaveType.category` and `LeaveCategoryMaster` are not duplicate columns: one is an enum-valued field, the other a configurable category entity linked by `categoryMasterId`.
- `employeeName` on special-leave and year-end records is denormalized. Decide explicitly whether it is a historical snapshot or a live joined display before removing it.

## Schema and code migration instructions

### A. Recommended first migration: shared special-leave table

1. Add `SpecialLeaveKind` (`MATERNITY`, `PATERNITY`) and `SpecialLeaveRecord` in `prisma/schema.prisma`, with `id`, `employeeId`, `leaveKind`, `employeeName`, `noOfDays`, `remarks`, `status`, `createdAt`, and `updatedAt`; relate `employeeId` to `Employee`.
2. Add `@@unique([employeeId, leaveKind])` and an index for employee lookup. Existing maternity uniqueness becomes this composite uniqueness; paternity writes currently search by employee and should become an upsert against the same key.
3. Create a non-destructive migration that copies all rows from `maternity_leaves` and `paternity_leaves`, setting the corresponding discriminator. Resolve duplicate paternity rows per employee before adding the unique constraint; do not silently discard rows. Compare source and target row counts and values before removing old tables.
4. Change the API persistence calls while preserving each existing response and request shape. The route itself supplies the discriminator, so existing page payload fields need not change.
5. Deploy with old tables retained until both pages and API smoke tests pass. Then remove the old models/tables in a later migration.

**Exact code touchpoints for A**

- Schema: `prisma/schema.prisma`, `MaternityLeave` at line 166 and `PaternityLeave` at line 392; update the `Employee` relation fields around lines 109–110.
- Maternity API: `app/api/maternity-leave/route.ts`, GET query at line 13, upsert at lines 49–60, delete at line 81, plus record serialization around lines 105–114. Replace `prisma.maternityLeave` with a `SpecialLeaveRecord` query filtered by `leaveKind: "MATERNITY"`.
- Paternity API: `app/api/paternity-leave/route.ts`, GET query at line 101, write lookup/update/create at lines 220–242, and deletion at lines 293–298. Replace those operations with the same model filtered by `leaveKind: "PATERNITY"` and use `upsert` keyed by `(employeeId, leaveKind)`.
- Maternity page: `app/maternity-leave/page.tsx`, `MaternityRecord` type at lines 21–26; GET at line 273; POST payload at lines 322–329; delete at lines 345–351.
- Paternity page: `app/paternity-leave/page.tsx`, `PaternityRecord` type at lines 21–26; GET at line 278; POST payload at lines 328–336; delete at lines 353–359.
- Both pages can retain `employeeId`, `employeeName`, `noOfDays`, and `remarks`, as their API contracts stay stable. If extracting a shared UI type, replace the two local record type names and state annotations at `maternity-leave/page.tsx:21,207` and `paternity-leave/page.tsx:21,209`; this is optional and not required for the schema migration.

### B. Larger optional migration: one employee/student application table

Do this only after defining the canonical applicant model and migrating student leave types to canonical `LeaveType` IDs. In a staged migration:

1. Add the applicant identity relation and new `LeaveApplication`/approval-history model alongside current tables; don't drop the old models in the same deployment.
2. Backfill employee applications and student requests into the new table, retaining source IDs in migration/audit columns until reconciliation is complete. Translate student `LeaveRequestType`, `paymentType`, and statuses explicitly; calculate `daysCount` with a verified date rule.
3. Backfill approval history without losing employee levels/backups or student reviewer roles. Preserve document URLs and reviewer identities.
4. Update reads and writes to the new model behind shared API services; compare report totals and approval queues with the old implementation.
5. Switch pages only after comparison succeeds; then retire old tables in a later migration.

**Exact code touchpoints for B**

- Schema models: `Student` and `StudentLeaveRequest` at `prisma/schema.prisma:317,334`; `EmployeeLeaveApplication` and `EmployeeLeaveUsage` at `:407,430`; `EmployeeLeaveApproval` at `:451`. `EmployeeLeaveUsage` is a distinct ledger and should not be automatically copied into the new application table.
- Employee approval route: `app/api/employee-leave-approvals/route.ts`, list at line 14, lookup at line 89, transaction lookup at line 107, update at line 128, and approval-history create later in the transaction. Preserve its level validation and concurrency checks.
- Employee reporting/eligibility: `app/api/employee-status-report/route.ts:86`, `app/api/leave-eligibility/route.ts:31,57`, `app/api/leave-year-end/route.ts:40,57,100,245,329`, and `app/api/year-end-leave-report/route.ts:88`.
- Student/report routes: `app/api/individual-report/route.ts:131,140` and `app/api/leave-status-report/route.ts:43`.
- Student endpoint: `app/student-leave-requests/route.ts:1–35` delegates to handlers in `app/api/rpc/routers/student-leave-requests.ts`; those handlers currently return placeholder results. The older `app/student-leave-requests.ts` Prisma implementation is commented out and is not the active source of truth.
- Pages to update when their response DTO changes: `app/approver-settings/ApprovalQueue.tsx:68,81,153`, `app/leave-report/employee-status/page.tsx:210`, `app/leave-report/individual/page.tsx:315`, `app/leave-reports/leave-status-report/page.tsx:243`, `app/leave-eligibility/page.tsx:162,629`, `app/leave-year-end/page.tsx:219,250,474`, and `app/components/leave-admin/YearEndLeaveReport.tsx:237`.
- Use DTO adapters at the API boundary to retain current UI keys during migration. Only rename page variables/fields after the API response shape is intentionally changed; don't globally replace `employeeId` with `applicantId`, since many employee-only APIs and pages depend on the existing employee key.

## A more efficient approach

Sharing a table is not automatically more efficient. Merging tables solely because they contain `status`, `remarks`, or dates creates nullable columns, weakens foreign keys, and spreads discriminator checks across every page. The lowest-risk improvement here is to share persistence for the two special-leave records while keeping their existing API contracts.

For cross-cutting requests, the more maintainable sequence is:

1. Define canonical identity, leave-type, status, and approval semantics first.
2. Extract shared API/service and validation types so pages use one stable DTO even before a database merge.
3. Implement an additive migration and backfill with explicit duplicate/status/type handling.
4. Keep API compatibility adapters during rollout; migrate one consumer group at a time.
5. Validate row counts, foreign-key integrity, report totals, eligibility balances, and approval transitions before dropping old columns/tables.
6. If employee leave usage is merely a duplicate of approved applications, replace dual-writing with a query/view or a single finalized-application source of truth; do not consolidate it without checking historical data and downstream reports.

This sequence is more efficient than changing the schema and every page at once: it limits simultaneous changes, preserves rollback options, and prevents each page from having to know about legacy table differences.

## Verification checklist before applying a migration

- Run Prisma validation and generate the client after schema changes.
- Confirm each original special-leave row appears exactly once with the correct discriminator and preserved `employeeName`, status, remarks, and dates.
- Confirm one employee can have both maternity and paternity rows; confirm duplicates within one kind are resolved before the unique constraint.
- Smoke-test GET, create/update, and delete on both special-leave pages.
- For any request consolidation, compare pending/approved/rejected counts, date-range reports, leave balance calculations, reviewer history, and document references before and after the migration.
- Keep backups and old tables until reconciliation and production verification are complete.
