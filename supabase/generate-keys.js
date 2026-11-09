#!/usr/bin/env node
// Gera chaves de licença no formato XXXX-XXXX-XXXX-XXXX e imprime os
// comandos SQL prontos pra colar no SQL Editor do Supabase.
//
// Uso:
//   node generate-keys.js windows 5 "Nome do Cliente"
//   node generate-keys.js mobile 1
//
// Se o nome do cliente não for passado, gera chaves "avulsas" (sem nome
// associado ainda) que você pode preencher depois na própria tabela.

const crypto = require("crypto");

const args = process.argv.slice(2);
function flag(name) { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; }
const tier = flag("--tier") || "premium";           // basic | premium
const trial = flag("--trial");                       // dias de teste (ex.: 7)
const platform = args[0];
const count = parseInt(args[1] || "1", 10);
const customerName = args[2] || null;

if (!platform || !["windows", "mobile", "web"].includes(platform) || !["basic", "premium"].includes(tier) || (trial && !(parseInt(trial, 10) > 0))) {
  console.error('Uso: node generate-keys.js <windows|mobile|web> <quantidade> ["Nome do Cliente"] [--tier basic|premium] [--trial 7]');
  process.exit(1);
}

function makeKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem O/0/I/1 pra evitar confusão
  const groups = [];
  for (let g = 0; g < 4; g++) {
    let group = "";
    for (let i = 0; i < 4; i++) {
      group += alphabet[crypto.randomInt(alphabet.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}

console.log(`-- ${count} chave(s) "${platform}" ${trial ? "de TESTE de " + trial + " dias" : "tipo " + tier} — cole no SQL Editor do Supabase:\n`);
for (let i = 0; i < count; i++) {
  const key = makeKey();
  const nameVal = customerName ? `'${customerName.replace(/'/g, "''")}'` : "null";
  console.log(
    `insert into licenses (license_key, platform, customer_name, tier, trial_days) values ('${key}', '${platform}', ${nameVal}, '${tier}', ${trial ? parseInt(trial, 10) : "null"});`
  );
}
