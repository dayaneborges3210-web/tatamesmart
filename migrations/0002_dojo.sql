create table if not exists schools (
  user_id text primary key,
  name text not null,
  pix text not null default ''
);

create table if not exists classes (
  id text primary key,
  user_id text not null,
  name text not null,
  modality text not null,
  days text not null,
  time text not null,
  instructor text not null,
  capacity integer not null
);
create index if not exists classes_user_id_idx on classes (user_id);

create table if not exists students (
  id text primary key,
  user_id text not null,
  name text not null,
  phone text not null,
  modality text not null,
  belt text not null,
  class_id text not null,
  status text not null,
  joined date not null
);
create index if not exists students_user_id_idx on students (user_id);

create table if not exists invoices (
  id text primary key,
  user_id text not null,
  student_id text not null,
  month text not null,
  amount integer not null,
  status text not null,
  due date not null
);
create index if not exists invoices_user_id_idx on invoices (user_id);

create table if not exists attendance (
  id text primary key,
  user_id text not null,
  student_id text not null,
  class_id text not null,
  date date not null,
  present boolean not null
);
create index if not exists attendance_user_id_idx on attendance (user_id);

create table if not exists reminders (
  id text primary key,
  user_id text not null,
  invoice_id text not null,
  date date not null,
  phase text not null
);
create index if not exists reminders_user_id_idx on reminders (user_id);
