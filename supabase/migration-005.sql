-- Migração 005 — chaves PREMIUM (atualizar o app Básico para Premium).
-- Rode no SQL Editor do Supabase. Seguro para rodar mais de uma vez.

create table if not exists premium_keys (
  id uuid primary key default gen_random_uuid(),
  premium_key text unique not null,
  customer_name text,
  license_id uuid references licenses(id) on delete set null,  -- preenchido quando o cliente usa a chave
  redeemed_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
alter table premium_keys enable row level security;
-- sem policy de propósito: só as Edge Functions (service role) acessam.

-- Visão para consultar no painel (Table Editor -> premium_overview).
create or replace view premium_overview as
select p.premium_key, p.customer_name, p.revoked, p.redeemed_at, l.license_key as used_by_license, l.customer_name as license_customer
from premium_keys p left join licenses l on l.id = p.license_id;

-- COMO USAR
--   1) Gerar chaves:    node generate-premium-keys.js 5 "Nome do Cliente"   (cola o SQL impresso aqui)
--   2) Ver o estado:    select * from premium_overview;
--   3) Cancelar uma:    update premium_keys set revoked = true where premium_key = 'XXXX-XXXX-XXXX-XXXX';
--      (o app do cliente volta ao Básico na próxima verificação da licença)
--   4) Liberar a chave para outra licença (cliente trocou de licença):
--      update premium_keys set license_id = null, redeemed_at = null where premium_key = 'XXXX-XXXX-XXXX-XXXX';
