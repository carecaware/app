-- Migração 006 — tipos de licença (básica / premium), licenças de teste (7 dias) e volta para a versão básica.
-- Rode no SQL Editor do Supabase. Seguro para rodar mais de uma vez.

-- tipo da assinatura que a chave libera. As licenças que já existem continuam PREMIUM (como eram).
alter table licenses add column if not exists tier text not null default 'premium';
alter table licenses drop constraint if exists licenses_tier_check;
alter table licenses add constraint licenses_tier_check check (tier in ('basic', 'premium'));

-- licença de TESTE: quantos dias vale a partir da PRIMEIRA ativação (a data de validade é gravada na ativação).
alter table licenses add column if not exists trial_days int;
-- (expires_at já existe desde a migração 003)

-- quando a volta para a versão básica foi agendada pelo cliente (dia seguinte à data de faturamento)
alter table licenses add column if not exists downgrade_at timestamptz;

-- COMO USAR (gerador: node generate-keys.js ...)
--   Chave de teste de 7 dias (libera tudo por 7 dias):  node generate-keys.js windows 3 "Fulano" --trial 7
--   Chave BÁSICA:                                        node generate-keys.js windows 1 "Fulano" --tier basic
--   Chave PREMIUM:                                       node generate-keys.js windows 1 "Fulano" --tier premium
--   Ver o estado:       select license_key, tier, trial_days, expires_at, downgrade_at, revoked from licenses;
--   Prorrogar um teste: update licenses set expires_at = now() + interval '7 days' where license_key = '...';
--   Cancelar a volta para a básica: update licenses set downgrade_at = null where license_key = '...';
