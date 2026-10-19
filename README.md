# Kaafi Tech and Media Center — Student Management System

A new Next.js + TypeScript + Tailwind starter using Supabase PostgreSQL/Auth. Interface language is Somali with common English technical terms. Brand palette: navy and orange.

## Current state — read this carefully

Included in this starter:
- Responsive dashboard layout and navigation
- Student registration form
- Supabase student-list read and student-create insert
- Automatic student codes (`KT-00001`, etc.) from PostgreSQL trigger
- Search, basic student table, CSV export (opens in Excel)
- Initial database schema for profiles, students, courses, classes, schedules, enrollments, payment periods, payments, attendance, books, book issues, and audit logs
- RLS enabled and an initial authenticated-user policy set

Not yet implemented end-to-end:
- Supabase Auth login screen / account provisioning
- Role-specific policies and enforcement for admin, registration staff, finance staff, and teachers
- Real payment workflow and receipts, monthly due calculations and audit-safe correction RPC
- Schedule conflict checks, attendance workflow and class enrollment UI
- PDF export, student ID cards, photo upload, reports/charts powered by real aggregates
- Automated tests and production security review

The dashboard's bar chart is a visual placeholder, not real analytics. No fake students are inserted into the database. A demo record is intentionally not used in production.

## Requirements

- Node.js 20.9 or later
- A Supabase project
- Git (recommended)

## Run locally on Windows

1. Extract the ZIP to a folder, e.g. `C:\kaafi-student-management`.
2. Open that folder in VS Code.
3. Open Terminal > New Terminal and run:

```powershell
npm install
Copy-Item .env.example .env.local
```

4. Open `.env.local` and fill in the Project URL and publishable/anon key from Supabase Dashboard > Project Settings > API. Do not use a `service_role` key in any `NEXT_PUBLIC_` variable.
5. In Supabase Dashboard > SQL Editor, run `supabase/migrations/0001_initial_schema.sql` against a **new development project**.
6. Create an auth user in Supabase Authentication. The starter tables require authentication for database operations. Create a matching `profiles` row with the same auth user UUID and a role.
7. Restart the dev server after changing `.env.local`:

```powershell
npm run dev
```

8. Open http://localhost:3000.

> The first UI iteration does not yet include the login page, so use it only in a private development environment until authentication routes and role-specific policies are implemented. Do not put real student data in it yet.

## Supabase schema notes

- Student ID is generated in PostgreSQL, not in the browser.
- Payment rows are immutable-style records with `voided_at`/`void_reason` fields; the final app should use a server-validated RPC for corrections instead of allowing arbitrary edits.
- Attendance is unique per student/class/date. Before production, add schedule-membership validation and prevent marking students absent from classes they were not scheduled to attend.
- The migration turns on RLS. Its starter policies allow any authenticated user to access operational tables. Replace them with role-aware policies before real use; RLS being enabled does not by itself mean the permissions are sufficiently restricted.
- Course seed rows use fee 0 because course prices were not supplied. Configure actual prices in Settings/Courses.

## Planned delivery stages

1. Project base, responsive design, dashboard and Supabase connection.
2. Authentication, role-based access and least-privilege RLS.
3. Student profiles, editing, duplicate prevention, archive, printable form and ID card.
4. Course/class enrollment, configurable schedules and overlap prevention.
5. Financial RPCs, payment periods, receipt printing and audit trail.
6. Schedule-linked attendance and corrections.
7. Real reports, CSV/Excel, PDF, books and photos.
8. Tests, deployment, backup and security review.

## Deployment outline

- Push code to a private GitHub repository.
- Import the repository into Vercel.
- Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as Vercel environment variables.
- Apply database migrations to the correct Supabase project.
- Implement and test authentication and role-specific RLS before putting real student records online.
- Use a custom domain only when ready.

## Privacy and security

Student names, phone numbers, guardian details, photos and payment history are sensitive. Use a private Supabase project, collect only necessary information, limit staff access, and keep backups. Never share `.env.local`, passwords, or secret/service-role keys.
