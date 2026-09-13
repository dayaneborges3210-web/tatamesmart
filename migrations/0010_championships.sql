create table if not exists championships (
  id text primary key,
  user_id text not null,
  name text not null,
  place text not null default '',
  date date not null,
  time text not null default '',
  participants text not null default '',
  gold integer not null default 0,
  silver integer not null default 0,
  bronze integer not null default 0,
  trophies integer not null default 0
);
create index if not exists championships_user_id_idx on championships (user_id);
