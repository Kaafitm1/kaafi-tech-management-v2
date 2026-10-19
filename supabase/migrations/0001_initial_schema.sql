-- Kaafi Tech Student Management System
-- Run this in Supabase SQL Editor on a NEW project.
-- RLS is enabled. Authenticated users can read/write operational data in this starter.
-- Before production, tighten policies to the role-based rules documented in README.md.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'registration_staff'
    check (role in ('admin','registration_staff','finance_staff','teacher')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  course_code text unique,
  name text not null unique,
  description text,
  fee numeric(12,2) not null default 0 check (fee >= 0),
  duration_weeks integer check (duration_weeks is null or duration_weeks > 0),
  class_capacity integer check (class_capacity is null or class_capacity > 0),
  status text not null default 'Active' check (status in ('Active','Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete restrict,
  class_name text not null,
  teacher_id uuid references public.profiles(id) on delete set null,
  classroom text,
  shift text check (shift is null or shift in ('Subax','Galab','Habeen')),
  start_date date,
  expected_end_date date,
  status text not null default 'Active' check (status in ('Active','Completed','Cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_code text unique,
  registered_at timestamptz not null default now(),
  full_name text not null,
  sex text check (sex is null or sex in ('Male','Female')),
  phone text,
  whatsapp text,
  guardian_name text,
  guardian_phone text,
  neighborhood text,
  education_level text,
  course_id uuid references public.courses(id) on delete set null,
  course_name text,
  course_fee numeric(12,2) not null default 0 check (course_fee >= 0),
  learning_mode text not null default 'Full-time' check (learning_mode in ('Full-time','Part-time')),
  shift text check (shift is null or shift in ('Subax','Galab','Habeen')),
  class_start_time time,
  class_end_time time,
  monthly_payment_status text not null default 'Unpaid' check (monthly_payment_status in ('Paid','Partially Paid','Unpaid')),
  book_issued boolean not null default false,
  photo_path text,
  status text not null default 'Active' check (status in ('Active','Completed','Suspended','Withdrawn')),
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.student_code_seq start 1;
create or replace function public.assign_student_code()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.student_code is null or btrim(new.student_code) = '' then
    new.student_code := 'KT-' || lpad(nextval('public.student_code_seq')::text, 5, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists students_assign_code on public.students;
create trigger students_assign_code before insert on public.students
for each row execute function public.assign_student_code();

create table if not exists public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  enrolled_at timestamptz not null default now(),
  status text not null default 'Active' check (status in ('Active','Completed','Withdrawn')),
  unique(student_id,class_id)
);

create table if not exists public.payment_periods (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  period_month date not null,
  amount_due numeric(12,2) not null check (amount_due >= 0),
  created_at timestamptz not null default now(),
  unique(student_id,period_month)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique default ('KTP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  student_id uuid not null references public.students(id) on delete restrict,
  payment_period_id uuid references public.payment_periods(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  payment_date timestamptz not null default now(),
  payment_method text not null check (payment_method in ('Cash','Mobile Money','Bank Transfer','Other')),
  payment_for text not null default 'Tuition' check (payment_for in ('Course Fee','Monthly Tuition','Registration','Book','Other')),
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  schedule_id uuid references public.class_schedules(id) on delete set null,
  attendance_date date not null,
  status text not null check (status in ('Present','Absent','Late','Excused')),
  arrival_time timestamptz,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(student_id,class_id,attendance_date)
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  course_id uuid references public.courses(id) on delete set null,
  quantity integer not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.book_issues (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  issued_at timestamptz not null default now(),
  returned_at timestamptz,
  issued_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index if not exists students_full_name_idx on public.students using gin (to_tsvector('simple', full_name));
create index if not exists students_registered_at_idx on public.students(registered_at desc);
create index if not exists students_status_idx on public.students(status);
create index if not exists payments_student_date_idx on public.payments(student_id,payment_date desc);
create index if not exists payments_date_idx on public.payments(payment_date desc);
create index if not exists attendance_class_date_idx on public.attendance(class_id,attendance_date);
create index if not exists enrollments_class_idx on public.class_enrollments(class_id,status);

-- Enable RLS on every application table.
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.classes enable row level security;
alter table public.class_schedules enable row level security;
alter table public.students enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.payment_periods enable row level security;
alter table public.payments enable row level security;
alter table public.attendance enable row level security;
alter table public.books enable row level security;
alter table public.book_issues enable row level security;
alter table public.audit_logs enable row level security;

-- Starter policies: only authenticated users can use the app tables.
-- Role-specific permissions must be tightened before inviting real staff.
drop policy if exists "profiles read authenticated" on public.profiles;
create policy "profiles read authenticated" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['courses','classes','class_schedules','students','class_enrollments','payment_periods','payments','attendance','books','book_issues'] loop
    execute format('drop policy if exists %I on public.%I', t || ' authenticated access', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t || ' authenticated access', t);
  end loop;
end $$;

drop policy if exists "audit logs read authenticated" on public.audit_logs;
create policy "audit logs read authenticated" on public.audit_logs for select to authenticated using (true);
-- Do not allow authenticated clients to forge audit events. Write audit rows from trusted server code later.

-- Example course catalog, safe to rerun.
insert into public.courses(name,course_code,description,fee,duration_weeks,status) values
 ('Office Programs','OFFICE','Microsoft Office and productivity tools',0,8,'Active'),
 ('Hardware & Networking','NETWORK','Computer hardware and networking',0,8,'Active'),
 ('Graphic Design','DESIGN','Graphic design fundamentals and practice',0,8,'Active'),
 ('Camera & Video Editing','VIDEO','Camera operation and video editing',0,8,'Active'),
 ('Typing Skills','TYPING','Typing accuracy and speed',0,4,'Active'),
 ('Special Course','SPECIAL','Custom or short course',0,4,'Active')
on conflict (name) do nothing;
