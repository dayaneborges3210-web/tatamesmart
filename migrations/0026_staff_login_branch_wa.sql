alter table staff add column if not exists email text not null default '';
alter table staff add column if not exists login_user_id text not null default '';

create table if not exists wa_branch_instances (
  branch_id text primary key,
  owner_user_id text not null,
  instance_name text not null unique,
  instance_token text not null,
  provisioned boolean not null default false,
  created_at timestamptz not null default now()
);
