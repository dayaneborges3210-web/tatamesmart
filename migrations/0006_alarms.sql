alter table schools add column if not exists owner_phone text not null default '';
alter table agenda add column if not exists alarm_at text not null default '';
alter table agenda add column if not exists alarm_sent boolean not null default false;
