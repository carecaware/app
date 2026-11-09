# BarFácil

| Pasta | O que é |
|---|---|
| `editions/` | App Final PC e Mobile (Sem Avulsas), já gerados (edições vendidas: pedem chave de assinatura) |
| `app/` | HTML mestre (`index.html`) e `make-editions.py`, que gera as edições (Premium, Básico, Mobile, Demo, Tutorial, Splash) |
| `desktop/` | Projeto Electron do instalador Windows (BarFácil) |
| `splash-demo/` | Instalador Splash Demo BarFácil PC |
| `supabase/` | Esquema SQL, migrações e a função `validate-license` |
| `scripts/` | Scripts de lançamento |

## Fluxo de trabalho
- `main` = sempre estável. Trabalhe em branches (`feat/...`, `fix/...`) e abra Pull Request.
- Versões: `vMAIOR.MENOR.PATCH` (ex.: `v1.0.9`), registradas em `VERSION` e no `CHANGELOG.md`.
- Lançar: `scripts/release.sh 1.0.9` (atualiza `VERSION`, cria a tag e envia).
- Segredos (chaves do Supabase, keystore do Android) **nunca** entram no repositório: use `build/license-config.json` local e *Secrets* do GitHub.

## Publicação de versões (Windows)
1. Anote as mudanças no `CHANGELOG.md` e faça commit.
2. `scripts/release.sh 1.0.9` → cria a tag `v1.0.9`.
3. O GitHub Actions gera o instalador e o publica em `carecaware/releases`.
4. Os apps instalados consultam esse repositório (ao abrir e a cada 12 h), perguntam "Instalar agora / Depois", baixam (conferindo o hash SHA-512) e instalam.

Segredos do repositório `app`: `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `RELEASES_TOKEN` (token com escrita só no repositório `releases`).
