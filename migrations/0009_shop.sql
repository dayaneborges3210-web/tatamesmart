alter table stock_items add column if not exists price integer not null default 0;

create table if not exists sales (
  id text primary key,
  user_id text not null,
  student_id text not null default '',
  item_id text not null,
  item_name text not null,
  qty integer not null,
  unit_price integer not null,
  total integer not null,
  pay_method text not null,
  sold_on date not null
);
create index if not exists sales_user_id_idx on sales (user_id);
