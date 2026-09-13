alter table schools add column if not exists msg_inicio text not null default '';
alter table schools add column if not exists msg_lembrete text not null default '';
alter table schools add column if not exists msg_vencimento text not null default '';
alter table schools add column if not exists msg_atraso text not null default '';
