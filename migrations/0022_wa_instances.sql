create table if not exists wa_school_instances (
  user_id text primary key,
  instance_name text not null unique,
  instance_token text not null,
  provisioned boolean not null default false,
  created_at timestamptz not null default now()
);
