create table if not exists wa_dispatch_claims (
  user_id text not null,
  kind text not null,
  item_id text not null,
  dispatch_day text not null,
  status text not null default 'attempting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, item_id, dispatch_day)
);
