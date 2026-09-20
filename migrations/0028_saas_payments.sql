alter table schools add column if not exists paid_until date;
alter table schools add column if not exists mp_preapproval_id text;

create table if not exists saas_payments (
  id text primary key,
  user_id text not null,
  plan text not null,
  method text not null,
  amount_cents integer not null,
  status text not null default 'PENDING',
  preference_id text,
  checkout_url text,
  mp_payment_id text unique,
  mp_status text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists saas_payments_user_created on saas_payments (user_id, created_at desc);
