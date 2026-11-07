# gera as duas edições a partir do index.html (edição completa = "pro", básica = "basic")
import sys, os
D=os.path.dirname(os.path.abspath(__file__))+os.sep
src=open(D+'index.html',encoding='utf-8').read()
assert 'var EDITION = "pro";' in src
open(D+'index-pro.html','w',encoding='utf-8').write(src)
open(D+'index-basic.html','w',encoding='utf-8').write(src.replace('var EDITION = "pro";','var EDITION = "basic";'))
open(D+'index-mobile.html','w',encoding='utf-8').write(src.replace('var MOBILE = false;','var MOBILE = true;'))
open(D+'index-demo.html','w',encoding='utf-8').write(src.replace('var MOBILE = false;','var MOBILE = true;').replace('var DEMO = false;','var DEMO = true;'))

base=src.replace('var TUTORIAL = false;','var TUTORIAL = true;')
open(D+'index-tut-pc.html','w',encoding='utf-8').write(base)
open(D+'index-tut-mobile.html','w',encoding='utf-8').write(base.replace('var MOBILE = false;','var MOBILE = true;'))

import base64
def _b(f): return 'data:image/jpeg;base64,'+base64.b64encode(open(D+''+f,'rb').read()).decode()
sp=base.replace('var SPLASH = false;','var SPLASH = true;').replace('var SPLASH_IMG1 = "";','var SPLASH_IMG1 = "'+_b('splash1.jpg')+'";').replace('var SPLASH_IMG2 = "";','var SPLASH_IMG2 = "'+_b('splash2.jpg')+'";')
open(D+'index-splash-pc.html','w',encoding='utf-8').write(sp)
open(D+'index-splash-mobile.html','w',encoding='utf-8').write(sp.replace('var MOBILE = false;','var MOBILE = true;'))
