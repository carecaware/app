#!/usr/bin/env node
// Pega o HTML-fonte do app (src/barra-gestao-bar.html), minifica e ofusca o
// JavaScript, injeta a tela de ativação de licença (parametrizada por
// plataforma), e gera dois pacotes finais:
//   dist-electron-app/index.html  -> usado pelo Electron (Windows)
//   dist-mobile/index.html        -> pra você hospedar em qualquer
//                                    hospedagem estática e vender o acesso
//                                    mobile/web
//
// Config necessária: build/license-config.json (veja o README).

const fs = require("fs");
const path = require("path");
const { minify } = require("terser");
const JavaScriptObfuscator = require("javascript-obfuscator");

const ROOT = path.join(__dirname, "..");
// Fonte do app: a edição Premium (PC) = app/index.html do repositório.
// (src/barra-gestao-bar.html é só um reserva antigo, usado se app/ não existir.)
const PREMIUM_SRC = path.join(ROOT, "..", "app", "index.html");
const SRC_HTML = fs.existsSync(PREMIUM_SRC) ? PREMIUM_SRC : path.join(ROOT, "src", "barra-gestao-bar.html");
const GATE_TEMPLATE = path.join(ROOT, "license-gate", "license-gate.template.js");
const CONFIG_PATH = path.join(ROOT, "build", "license-config.json");

const args = process.argv.slice(2);
const mobileOnly = args.includes("--mobile-only");
const windowsOnly = args.includes("--windows-only");

function loadConfig() {
  // No GitHub Actions não existe o arquivo license-config.json (ele fica
  // fora do repositório, no .gitignore) — nesse caso as credenciais vêm
  // das variáveis de ambiente SUPABASE_URL / SUPABASE_ANON_KEY, que o
  // workflow preenche a partir dos Secrets do repositório.
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    };
  }
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(
      "\nFaltando build/license-config.json.\n" +
      "Copie build/license-config.example.json para build/license-config.json\n" +
      "e preencha com a URL e a anon key do seu projeto Supabase.\n"
    );
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function extractScript(html) {
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  if (!match) throw new Error("Não encontrei o <script> principal no HTML fonte.");
  return { full: match[0], body: match[1] };
}

function buildGateScript(config, platform) {
  let src = fs.readFileSync(GATE_TEMPLATE, "utf8");
  // troca TODAS as ocorrências (split/join) — .replace só trocaria a primeira
  src = src
    .split("__SUPABASE_URL__").join(config.supabaseUrl)
    .split("__SUPABASE_ANON_KEY__").join(config.supabaseAnonKey)
    .split("__PLATFORM__").join(platform);
  if (/__[A-Z_]+__/.test(src)) throw new Error("Sobrou um placeholder no portão de licença.");
  return src;
}

async function minifyAndObfuscate(code) {
  const minified = await minify(code, { mangle: true, compress: true });
  if (!minified.code) throw new Error("Terser não retornou código.");
  const obfuscated = JavaScriptObfuscator.obfuscate(minified.code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.3,
    stringArray: true,
    stringArrayEncoding: ["base64"],
    stringArrayThreshold: 0.75,
    identifierNamesGenerator: "hexadecimal",
    renameGlobals: false,
    selfDefending: true,
    disableConsoleOutput: true
  });
  return obfuscated.getObfuscatedCode();
}

async function buildTarget(platform, outDir) {
  const config = loadConfig();
  const html = fs.readFileSync(SRC_HTML, "utf8");
  const { full, body } = extractScript(html);

  console.log(`[${platform}] minificando + ofuscando o app (isso pode levar alguns segundos)...`);
  const appFinal = await minifyAndObfuscate(body);

  console.log(`[${platform}] preparando a tela de ativação de licença...`);
  const gateSrc = buildGateScript(config, platform);
  // a tela de ativação NÃO é ofuscada de propósito: é pequena, não contém
  // lógica de negócio do app, e manter legível ajuda a debugar problemas de
  // conexão com o Supabase caso apareçam.

  // Importante: usamos uma FUNÇÃO como substituto do replace(), não uma
  // string. Se passássemos a string diretamente, o JavaScript trataria
  // sequências como "$'" (que aparecem o tempo todo por causa do "R$",
  // símbolo de moeda usado em todo o app) como padrões especiais de
  // substituição em vez de texto literal, corrompendo o HTML gerado.
  let finalHtml = html.replace(full, function () {
    return `<script>\n${appFinal}\n</script>`;
  });
  finalHtml = finalHtml.replace("<body>", function () {
    return `<body>\n<script>\n${gateSrc}\n</script>`;
  });

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), finalHtml, "utf8");
  console.log(`[${platform}] gerado em ${path.relative(ROOT, outDir)}/index.html`);
}

(async () => {
  if (!windowsOnly) {
    await buildTarget("mobile", path.join(ROOT, "dist-mobile"));
  }
  if (!mobileOnly) {
    await buildTarget("windows", path.join(ROOT, "dist-electron-app"));
  }
  console.log("\nBuild concluído.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
