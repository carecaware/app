-- Migração 003 — acesso "web" (app entregue pelo servidor) + validade das licenças.
-- Rode no SQL Editor do Supabase. Seguro para rodar mais de uma vez.

-- aceita chaves do tipo "web" além de windows e mobile
alter table licenses drop constraint if exists licenses_platform_check;
alter table licenses add constraint licenses_platform_check check (platform in ('windows', 'mobile', 'web'));

-- validade opcional da licença (útil para testes de poucos dias)
alter table licenses add column if not exists expires_at timestamptz;

-- pasta PRIVADA onde fica o app (só a função do servidor consegue ler)
insert into storage.buckets (id, name, public) values ('app-payload', 'app-payload', false)
on conflict (id) do nothing;
