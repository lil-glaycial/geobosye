"""Archive public BOSYE source pages and first-party images, with provenance."""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urljoin, urlparse, unquote
from html.parser import HTMLParser
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json, re, shutil, zipfile, xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=ROOT/'source-materials'/'website'
ARCHIVE.mkdir(parents=True,exist_ok=True)
BASE='http://www.bosye.com/'
class Collector(HTMLParser):
 def __init__(self): super().__init__();self.links=[];self.assets=[];self.text=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='a' and a.get('href'):self.links.append(a['href'])
  for name in ('src','poster'):
   if a.get(name):self.assets.append(a[name])
  if tag=='link' and a.get('href'):self.assets.append(a['href'])
 def handle_data(self,data):
  if data.strip():self.text.append(data.strip())
def fetch(url):
 try:
  with urlopen(Request(url,headers={'User-Agent':'BOSYE website redesign source archive'}),timeout=25) as r:return (url,r.read(),r.headers.get('Content-Type',''),None)
 except Exception as e:return (url,None,'',str(e))
def safe_name(url):
 name=unquote(Path(urlparse(url).path).name)
 return re.sub(r'[^A-Za-z0-9_.-]','_',name) or 'index.html'
queue=[urljoin(BASE,p) for p in ['','ppyx.html','ky23.html','mdfw.html','mdls.html','zfls.html','mfxy.html','zshz.html']]
seen=set(); assets=set(); manifests=[]
while queue and len(seen)<70:
 batch=list(dict.fromkeys(queue));queue=[]
 for url,data,mime,error in ThreadPoolExecutor(max_workers=8).map(fetch,batch):
  if url in seen:continue
  seen.add(url)
  if error:manifests.append({'url':url,'error':error});continue
  name=safe_name(url);(ARCHIVE/name).write_bytes(data)
  text=data.decode('utf-8-sig',errors='replace');parser=Collector();parser.feed(re.sub(r'<!--[\s\S]*?-->','',text))
  (ARCHIVE/(name+'.txt')).write_text('\n'.join(parser.text))
  manifests.append({'url':url,'path':str((ARCHIVE/name).relative_to(ROOT)),'bytes':len(data),'sha256':sha256(data).hexdigest(),'mime':mime})
  for link in parser.links:
   full=urljoin(url,link).split('#')[0];u=urlparse(full)
   if u.hostname in ['bosye.com','www.bosye.com'] and u.path.endswith('.html') and not u.query and full not in seen:queue.append(full)
  for asset in parser.assets+re.findall(r'url\([\'\"]?([^\)\'\"]+)',text):
   full=urljoin(url,asset).split('?')[0];u=urlparse(full)
   if u.hostname in ['www.bosye.com','bosye.com'] and re.search(r'\.(?:png|jpg|jpeg|webp|gif|ico|svg|css|js|pdf|mp4)$',u.path,re.I):assets.add(full)
# CSS and JS may contain image references, including footer, QR codes and shared nav assets.
codeurls=[u for u in assets if u.endswith(('.css','.js'))]
for url,data,mime,error in ThreadPoolExecutor(max_workers=8).map(fetch,codeurls):
 if error:continue
 (ARCHIVE/safe_name(url)).write_bytes(data)
 text=data.decode('utf-8',errors='replace')
 refs=re.findall(r'url\([\'\"]?([^\)\'\"]+)',text)+re.findall(r'[\'\"]([^\'\"]+\.(?:png|jpg|jpeg|gif|webp|ico))[\'\"]',text)
 for ref in refs:
  full=urljoin(BASE if url.endswith('.js') else url,ref).split('?')[0]
  if urlparse(full).hostname in ['bosye.com','www.bosye.com']:assets.add(full)
assets.add(BASE+'images/logo.png')
asset_manifest=[]
for url,data,mime,error in ThreadPoolExecutor(max_workers=8).map(fetch,sorted(assets)):
 name=safe_name(url)
 target=ROOT/'assets'/('bosye-'+name) if re.search(r'\.(?:png|jpg|jpeg|gif|webp|ico|svg)$',name,re.I) else ARCHIVE/name
 item={'url':url,'path':str(target.relative_to(ROOT))}
 if error:item['error']=error
 else:
  target.write_bytes(data);item.update({'bytes':len(data),'sha256':sha256(data).hexdigest(),'mime':mime})
 asset_manifest.append(item)
# Keep the original document private within the source archive, and extract readable knowledge.
DOC=Path('/Users/peaklin/Documents/北京博士园/医和你-服务合同.docx')
DEST=ROOT/'source-materials'/'knowledge';DEST.mkdir(exist_ok=True)
shutil.copy2(DOC,DEST/DOC.name)
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with zipfile.ZipFile(DOC) as archive:
 tree=ET.fromstring(archive.read('word/document.xml'))
 paragraphs=[''.join(p.itertext()) for p in []]
 paragraphs=[''.join(t.text or '' for t in p.findall('.//w:t',ns)).strip() for p in tree.findall('.//w:p',ns)]
 paragraphs=[p for p in paragraphs if p]
 (DEST/'knowledge-extracted.md').write_text('# 北京博士园资料原文提取\n\n'+'\n\n'.join(paragraphs)+'\n')
 (DEST/'knowledge-extracted.json').write_text(json.dumps({'source':str(DOC),'paragraphs':paragraphs},ensure_ascii=False,indent=2))
 media=[n for n in archive.namelist() if n.startswith('word/media/')]
 for item in media:(DEST/Path(item).name).write_bytes(archive.read(item))
manifest={'retrieved':'2026-10-13','pages':manifests,'assets':asset_manifest,'document':{'source':str(DOC),'archive':str((DEST/DOC.name).relative_to(ROOT)),'paragraphs':len(paragraphs),'images':len(media)}}
(ARCHIVE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(json.dumps({'pages':len(manifests),'assets':len(asset_manifest),'downloaded':sum('error'not in a for a in asset_manifest),'failed':[a for a in asset_manifest if 'error'in a],'documentParagraphs':len(paragraphs),'documentImages':len(media)},ensure_ascii=False,indent=2))
