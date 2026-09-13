create table if not exists payables (
  id text primary key,
  user_id text not null,
  title text not null,
  vendor text not null default '',
  category text not null,
  amount integer not null,
  due date not null,
  status text not null
);
create index if not exists payables_user_id_idx on payables (user_id);

create table if not exists agenda (
  id text primary key,
  user_id text not null,
  title text not null,
  note text not null default '',
  due date not null,
  done boolean not null default false
);
create index if not exists agenda_user_id_idx on agenda (user_id);
