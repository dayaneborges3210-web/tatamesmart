create table if not exists platform_settings (
  id int primary key default 1,
  wa_url text not null default '',
  wa_instance text not null default '',
  wa_token text not null default '',
  owner_user_id text not null default '',
  updated_at timestamptz not null default now()
);

insert into platform_settings (id)
  values (1)
  on conflict (id) do nothing;
