alter table branches add column if not exists pix text not null default '';
alter table plans add column if not exists branch_id text not null default '';
alter table invoices add column if not exists branch_id text not null default '';
