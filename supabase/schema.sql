-- Rode este script inteiro no Supabase: painel do projeto -> SQL Editor -> New query -> colar -> Run.

create table if not exists licenses (
  id uuid primary key default gen_random_uuid(),
  license_key text unique not null,
  platform text not null check (platform in ('windows', 'mobile')),
  customer_name text,
  customer_contact text,
  max_activations int not null default 1,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists license_activations (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses(id) on delete cascade,
  device_id text not null,
  activated_at timestamptz not null default now(),
  unique (license_id, device_id)
);

-- Habilita RLS (o app nunca acessa essas tabelas diretamente — só a Edge
-- Function, usando a service role key, que ignora RLS. Isso impede que
-- alguém leia/escreva a tabela direto pela API pública com a anon key.)
alter table licenses enable row level security;
alter table license_activations enable row level security;
-- Nenhuma policy é criada de propósito: sem policy = ninguém acessa via
-- API pública (anon/authenticated), só a service role (usada pela função).
