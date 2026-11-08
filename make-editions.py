# gera as duas edições a partir do index.html (edição completa = "pro", básica = "basic")
import sys
src=open('/home/claude/barapp40/index.html',encoding='utf-8').read()
assert 'var EDITION = "pro";' in src
open('/home/claude/barapp40/index-pro.html','w',encoding='utf-8').write(src)
open('/home/claude/barapp40/index-basic.html','w',encoding='utf-8').write(src.replace('var EDITION = "pro";','var EDITION = "basic";'))
open('/home/claude/barapp40/index-mobile.html','w',encoding='utf-8').write(src.replace('var MOBILE = false;','var MOBILE = true;'))
open('/home/claude/barapp40/index-demo.html','w',encoding='utf-8').write(src.replace('var MOBILE = false;','var MOBILE = true;').replace('var DEMO = false;','var DEMO = true;'))

base=src.replace('var TUTORIAL = false;','var TUTORIAL = true;')
open('/home/claude/barapp40/index-tut-pc.html','w',encoding='utf-8').write(base)
open('/home/claude/barapp40/index-tut-mobile.html','w',encoding='utf-8').write(base.replace('var MOBILE = false;','var MOBILE = true;'))

import base64
def _b(f): return 'data:image/jpeg;base64,'+base64.b64encode(open('/home/claude/barapp40/'+f,'rb').read()).decode()
sp=base.replace('var SPLASH = false;','var SPLASH = true;').replace('var SPLASH_IMG1 = "";','var SPLASH_IMG1 = "'+_b('splash1.jpg')+'";').replace('var SPLASH_IMG2 = "";','var SPLASH_IMG2 = "'+_b('splash2.jpg')+'";')
open('/home/claude/barapp40/index-splash-pc.html','w',encoding='utf-8').write(sp)
open('/home/claude/barapp40/index-splash-mobile.html','w',encoding='utf-8').write(sp.replace('var MOBILE = false;','var MOBILE = true;'))

# edições finais "sem avulsas" (a partir da Premium)
na=src.replace('var NOAVU = false;','var NOAVU = true;')
open('/home/claude/barapp40/index-final-pc.html','w',encoding='utf-8').write(na)
open('/home/claude/barapp40/index-final-mobile.html','w',encoding='utf-8').write(na.replace('var MOBILE = false;','var MOBILE = true;'))
