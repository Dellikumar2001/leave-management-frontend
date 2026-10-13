# Leave Admin database and integration guide

This guide covers Block Leave, Credit Leave, Individual Leave Report, their API routes, and the employee balance data they use.

## Connect the pages to the database

The application uses PostgreSQL through Prisma. Set `DATABASE_URL` in the repository root `.env` file, then generate the client and apply migrations:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Use a development database when running `npm run db:migrate`. Before migrating a database with existing data, check its migration state with `npx prisma migrate status` and reconcile any missing or edited migration files first. Do not reset a database to work around drift.

`npm run db:seed` adds sample categories and employee records. In Leave Groups, associate active leave types with the Annual or Medical category where available. Credit Leave always updates `employee_leave_balances`; when a matching active leave type exists, it also updates that type's eligibility balance. Annual credits can be recorded without an Annual leave type, which supports databases that do not yet classify their types. Medical credits still require a matching active Medical type.

Streams and departments are read from the existing `employees.stream` and `employees.department` columns. They are not separate tables in this application. Update or import employee records in `employees` to change the available filter choices. For leave-request blocking, the student's `studentCode` must equal the corresponding employee's `employeeId`.

## Tables and balance behavior

- `employees`: employee ID, name, stream, and department. This schema does not currently contain designation or mobile fields.
- `Student`, `User`, and `StudentLeaveRequest`: employee-linked leave request history and available contact email. Link the report employee ID to `Student.studentCode`; otherwise the report has no linked request history.
- `employee_leave_balances`: the annual/medical category balance used by the leave administration APIs.
- `blocked_leaves`: one row per employee and blocked calendar date.
- `leave_credits`: credit history, including employee, category, amount, and matching leave type.
- `employee_leave_eligibilities`: existing employee/leave-type balance records, with `credited_days` tracking the added amount separately.
- `employee_notifications`: in-app notices created for every affected employee.
- `LeaveType`, `LeaveGroup`, `LeaveGroupItem`, and `LeaveCategoryDefinition`: active leave types and their annual/medical categorization.

Credit transactions update `employee_leave_balances`, update `employee_leave_eligibilities.credited_days` and `leave_balance` when a matching leave type exists, and write a matching `leave_credits` record in one database transaction. The Leave Eligibility and Leave Refresh APIs include type-linked credited days when calculating and displaying balances. Credits without a type remain in the category balance ledger and are shown separately in Individual Report.

The Individual Report reads employee details from `employees`, email and request history through `Student.studentCode` and `StudentLeaveRequest`, and reviewer names from `User`. The current schema has no employee designation or mobile-number fields, so those report fields show “Not recorded”. Academic years currently use a July-to-June range; Odd semester is July–December and Even semester is January–June. Allocations are prorated against the selected academic year. Update these conventions if the institution uses a different academic calendar.

Deleting or reducing a credit reverses the recorded amount. The API rejects a reversal that would take the credited amount below zero. All credit records use the same `/api/leave-credit` endpoint and category-specific balance source.

## API routes

- `GET|POST|PATCH|DELETE /api/block-leave`: blocked-date history, database-backed employees/stream/department filter values, and create/edit/delete operations. Pass `?category=ANNUAL` or `?category=MEDICAL` for the employee balance shown on the credit page. A missing end date is treated as the start date.
- `GET|POST|PATCH|DELETE /api/leave-credit`: category credit history and create/edit/delete operations.
- `GET /api/individual-report`: an employee's leave allocation, leave-request history, approver details, absenteeism, utilization, and usage analytics for a selected period.
- `GET /api/leave-eligibility` and `GET|POST /api/leave-refresh`: display or refresh balances including credited days.

Blocking or crediting creates an in-app notification for each selected employee. A multi-select filter does not silently apply changes to every matching employee; choose the matching rows with the table's select-all checkbox to make them part of the action.

## Reject leave requests on blocked dates

The student leave-request POST route checks for blocked dates before forwarding a request. It checks every date from `startDate` through `endDate` for the employee identified by `employeeId` or the student's `studentCode`. On a match it returns HTTP 409 with exactly:

> Can't take leave on this date, contact admin

The request API must retain this server-side check; client-side validation alone can be bypassed. Any separate request-submission service or deployment that does not use `app/student-leave-requests/route.ts` must call the same `findBlockedDate` check before creating a request.

## Troubleshooting

### Prisma `EPERM` while generating on Windows

The Windows Prisma engine DLL may be locked by a running Next.js process. Stop the specific development server process that owns the client, then run:

```bash
npm run db:generate
npm run dev
```

Do not delete Prisma engine files while the server is running.

### Missing migrations or schema drift

Run `npx prisma migrate status` and compare the reported migration history with `prisma/migrations`. The configured development database currently contains an applied migration named `20261007105113_apply_existing_schema` that is absent from this checkout. Restore its original SQL from the project revision that created it, then apply pending migrations normally. Do not invent a replacement for that already-applied migration, use `migrate reset`, or mark unknown migrations as applied.

### Empty employee, stream, or department lists

Check that `DATABASE_URL` points to the intended database and run `npm run db:seed` for the bundled sample data. In production, import real employee rows instead. Streams and departments are derived from employee rows, so empty employee data also produces empty filter choices.

### Leave types or leave groups fail to load

Check the server logs and database connection, then confirm the leave-type, leave-group, group-item, and leave-category migrations are applied. Medical credits need an active type classified as Medical. Annual credits can use the category balance ledger when the database does not have a classified Annual leave type; type-specific eligibility balances are updated only when such a type exists.

### Invalid date errors

The APIs accept dates in `YYYY-MM-DD` format and validate calendar dates and date ranges. Use the date input controls; ensure the end date is on or after the start date. For a block that is intended to last one day, submit the same start and end date.
