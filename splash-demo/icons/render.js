const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:512,height:512}});
for(const n of ['app','setup']){const svg=fs.readFileSync('/home/claude/splash-exe/icons/'+n+'.svg','utf8');
await pg.setContent('<html><body style="margin:0;background:transparent">'+svg.replace('<svg','<svg width="512" height="512"')+'</body></html>');
await pg.screenshot({path:'/home/claude/splash-exe/icons/'+n+'.png',omitBackground:true});}
await b.close()})();
