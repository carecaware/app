#!/usr/bin/env node
// Gera chaves PREMIUM no formato XXXX-XXXX-XXXX-XXXX e imprime o SQL pronto
// para colar no SQL Editor do Supabase.
//
// Uso:
//   node generate-premium-keys.js 5 "Nome do Cliente"
//   node generate-premium-keys.js 1

const crypto = require("crypto");
const count = parseInt(process.argv[2] || "1", 10);
const customerName = process.argv[3] || null;

function makeKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem O/0/I/1
  const groups = [];
  for (let g = 0; g < 4; g++) {
    let group = "";
    for (let i = 0; i < 4; i++) group += alphabet[crypto.randomInt(alphabet.length)];
    groups.push(group);
  }
  return groups.join("-");
}

console.log(`-- ${count} chave(s) PREMIUM — cole no SQL Editor do Supabase:\n`);
for (let i = 0; i < count; i++) {
  const nameVal = customerName ? `'${customerName.replace(/'/g, "''")}'` : "null";
  console.log(`insert into premium_keys (premium_key, customer_name) values ('${makeKey()}', ${nameVal});`);
}
