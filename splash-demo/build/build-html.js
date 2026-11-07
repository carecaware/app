// Gera dist-electron-app/index.html do Splash Demo: minifica/ofusca o app e injeta a tela de licença (igual ao app oficial).
const fs=require("fs"),path=require("path");
const NM="/home/claude/barapp-desktop/node_modules/";
const {minify}=require(NM+"terser");const JSO=require(NM+"javascript-obfuscator");
const cfg=JSON.parse(fs.readFileSync("/home/claude/barapp-desktop/build/license-config.json","utf8"));
const html=fs.readFileSync(process.argv[2],"utf8");
const m=html.match(/<script>([\s\S]*)<\/script>/); if(!m) throw new Error("sem script");
if((html.match(/<script/g)||[]).length!==1) throw new Error("mais de um script");
(async()=>{
 const t0=Date.now();
 const mini=await minify(m[1],{mangle:true,compress:true}); if(!mini.code) throw new Error("terser");
 console.log("minificado",mini.code.length,Date.now()-t0,"ms");
 const obf=JSO.obfuscate(mini.code,{compact:true,controlFlowFlattening:true,controlFlowFlatteningThreshold:0.75,deadCodeInjection:true,deadCodeInjectionThreshold:0.3,stringArray:true,stringArrayEncoding:["base64"],stringArrayThreshold:0.75,identifierNamesGenerator:"hexadecimal",renameGlobals:false,selfDefending:true,disableConsoleOutput:true}).getObfuscatedCode();
 console.log("ofuscado",obf.length,Date.now()-t0,"ms");
 let gate=fs.readFileSync(""+__dirname+"/../../desktop/license-gate/license-gate.template.js","utf8").split("__SUPABASE_URL__").join(cfg.supabaseUrl).split("__SUPABASE_ANON_KEY__").join(cfg.supabaseAnonKey).split("__PLATFORM__").join("windows");
 let out=html.replace(m[0],()=>"<script>\n"+obf+"\n</script>");
 out=out.replace("<body>",()=>"<body>\n<script>\n"+gate+"\n</script>");
 fs.mkdirSync("dist-electron-app",{recursive:true});fs.writeFileSync("dist-electron-app/index.html",out);
 console.log("ok",out.length);
})().catch(e=>{console.error(e);process.exit(1)});
