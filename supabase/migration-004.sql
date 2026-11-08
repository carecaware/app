-- Migração 004 — liberar a entrada SEM SENHA no app, temporariamente (cliente esqueceu a senha).
-- Rode no SQL Editor do Supabase. Seguro para rodar mais de uma vez.

alter table licenses add column if not exists pw_unlock_until timestamptz;

-- COMO USAR (quando o cliente pedir ajuda):
--   Liberar por 2 horas:
--     update licenses set pw_unlock_until = now() + interval '2 hours' where license_key = 'XXXX-XXXX-XXXX-XXXX';
--   Cancelar a liberação:
--     update licenses set pw_unlock_until = null where license_key = 'XXXX-XXXX-XXXX-XXXX';
