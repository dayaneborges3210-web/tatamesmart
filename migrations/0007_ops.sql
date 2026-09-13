create table if not exists staff (
  id text primary key,
  user_id text not null,
  name text not null,
  role text not null,
  phone text not null,
  pay integer not null default 0
);
create index if not exists staff_user_id_idx on staff (user_id);

create table if not exists stock_items (
  id text primary key,
  user_id text not null,
  name text not null,
  category text not null,
  qty integer not null default 0,
  min_qty integer not null default 0,
  unit_cost integer not null default 0
);
create index if not exists stock_items_user_id_idx on stock_items (user_id);
