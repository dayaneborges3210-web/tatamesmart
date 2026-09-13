alter table students add column if not exists cpf text not null default '';
alter table students add column if not exists address text not null default '';
alter table students add column if not exists cep text not null default '';
alter table students add column if not exists has_health boolean not null default false;
alter table students add column if not exists health_note text not null default '';
