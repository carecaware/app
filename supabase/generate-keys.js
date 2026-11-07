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

const platform = process.argv[2];
const count = parseInt(process.argv[3] || "1", 10);
const customerName = process.argv[4] || null;

if (!platform || !["windows", "mobile"].includes(platform)) {
  console.error('Uso: node generate-keys.js <windows|mobile> <quantidade> ["Nome do Cliente"]');
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

console.log(`-- ${count} chave(s) para a plataforma "${platform}" — cole no SQL Editor do Supabase:\n`);
for (let i = 0; i < count; i++) {
  const key = makeKey();
  const nameVal = customerName ? `'${customerName.replace(/'/g, "''")}'` : "null";
  console.log(
    `insert into licenses (license_key, platform, customer_name) values ('${key}', '${platform}', ${nameVal});`
  );
}
