create table if not exists password_reset_attempts (
  id text primary key,
  email text not null,
  at timestamptz not null default now()
);
create index if not exists password_reset_attempts_email_idx on password_reset_attempts (email);
