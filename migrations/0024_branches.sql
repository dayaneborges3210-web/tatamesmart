create table if not exists branches (
  id text primary key,
  user_id text not null,
  name text not null,
  kind text not null default 'filial',
  address text not null default '',
  phone text not null default '',
  active boolean not null default true
);
create index if not exists branches_user_id_idx on branches (user_id);

alter table students add column if not exists branch_id text not null default '';
alter table classes add column if not exists branch_id text not null default '';
alter table staff add column if not exists branch_id text not null default '';
alter table stock_items add column if not exists branch_id text not null default '';
alter table payables add column if not exists branch_id text not null default '';
alter table agenda add column if not exists branch_id text not null default '';
alter table championships add column if not exists branch_id text not null default '';
alter table sales add column if not exists branch_id text not null default '';
