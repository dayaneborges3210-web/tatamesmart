create table if not exists plans (
  id text primary key,
  user_id text not null,
  name text not null,
  duration_months int not null default 1,
  billing text not null default 'mensal',
  amount int not null default 0,
  weekly_limit int not null default 0,
  due_day int not null default 10
);

alter table students add column if not exists birth date;
alter table students add column if not exists plan_id text not null default '';
alter table students add column if not exists due_day int not null default 10;
alter table students add column if not exists docs text not null default '';
