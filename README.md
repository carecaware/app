# BarFácil

| Pasta | O que é |
|---|---|
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
