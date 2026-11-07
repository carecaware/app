-- Migração 002 — rode no Supabase: SQL Editor -> New query -> colar -> Run.
-- Seguro para rodar mais de uma vez.

alter table license_activations add column if not exists last_seen_at timestamptz not null default now();
alter table license_activations add column if not exists platform text;

-- Registro de "liberar aparelho antigo" (limite de trocas por ano é aplicado na função).
create table if not exists license_releases (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses(id) on delete cascade,
  device_id text not null,
  released_at timestamptz not null default now()
);
alter table license_releases enable row level security;

-- Limite de trocas de aparelho por chave nos últimos 365 dias.
alter table licenses add column if not exists max_releases_per_year int not null default 3;

-- Visão para consultar no painel do Supabase (Table Editor -> license_overview).
create or replace view license_overview as
select l.license_key, l.customer_name, l.platform, l.revoked, l.max_activations,
       count(a.id) as devices, max(a.last_seen_at) as last_seen
from licenses l left join license_activations a on a.license_id = l.id
group by l.id;
