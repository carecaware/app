#!/usr/bin/env bash
# Uso: scripts/release.sh 1.0.9
set -euo pipefail
V="${1:?informe a versão, ex.: 1.0.9}"
[[ "$V" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "versão inválida"; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "há alterações não commitadas"; exit 1; }
echo "$V" > VERSION
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$V\"/" desktop/package.json
git commit -am "Versão $V"
git tag -a "v$V" -m "Versão $V"
git push origin HEAD "v$V"
echo "Tag v$V enviada. O GitHub Actions gera o instalador."
