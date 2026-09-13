alter table schools add column if not exists wa_phone_id text not null default '';
alter table schools add column if not exists wa_token text not null default '';
alter table schools add column if not exists wa_auto boolean not null default false;
