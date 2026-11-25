"""Extract visible PUBLIC source copy. Built output may be streamed from CI or read locally."""
import argparse
import concurrent.futures
import gzip
import hashlib
import json
import os
import re
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from lxml import html

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'acquisition-mobile/.release/language'
ASSET = '/language-assets/'
PRIVATE = re.compile(r'^/(?:api|admin|private|crm|projet|portail|espace-client|espace-projet|sites|maquettes|\.netlify|\.well-known)(?:/|$)')
SKIP = {'script','style','template','noscript','svg','code','pre','kbd','samp','output'}
ATTRIBUTES = ('alt','aria-label','placeholder','title')
AXES = {'sites':'websites','automatisation':'ai-automation','applications':'applications','crm':'crm'}
BULK = re.compile(r'^/(?:territoires/(sites|automatisation|applications|crm)|projets-sites/(?:suisse/(?:de|fr|it)/)?(entreprises|particuliers)|en/locations/([a-z-]+))/[^/]+-[0-9a-zA-Z]{1,5}/$')
def compact(text):
    return ' '.join(text.split())
def clean_path(path):
    return path[:-10] if path.endswith('index.html') else path
def kind(path):
    m = BULK.match(path)
    if m:
        return 'locations-' + next(k for k in m.groups() if k)
    if path.startswith(('/communes-france/','/territoires/','/projets-sites/','/en/locations/')):
        return 'directory'
    return 'page-' + hashlib.sha256(path.encode()).hexdigest()[:16]
def is_public(path):
    return path.startswith('/') and not PRIVATE.match(path) and not path.startswith('//')
def text_chunks(tree):
    texts = set()
    def add(t):
        if t and (v:=compact(t)) and any(c.isalpha() for c in v): texts.add(v)
    def walk(el):
        if not isinstance(el.tag,str) or el.tag in SKIP or el.get('translate')=='no' or 'contenteditable' in el.attrib: return
        for a in ATTRIBUTES: add(el.get(a))
        if el.tag=='textarea':return
        if el.tag=='input' and el.get('type','').lower() in ('submit','reset','button'): add(el.get('value'))
        add(el.text)
        for c in el:
            walk(c)
            add(c.tail)
    body=tree.find('body')
    if body is not None: walk(body)
    add(tree.findtext('head/title'))
    return sorted(texts)
def extract(route,body):
    tree=html.fromstring(body, parser=html.HTMLParser(encoding='utf-8'))
    alternates={a.get('hreflang'):urlsplit(a.get('href')).path for a in tree.xpath('//head/link[@hreflang][@href]') if urlsplit(a.get('href')).netloc in ('','flex-web.fr')}
    return {'path':route,'lang':(tree.get('lang') or 'fr').split('-')[0],'pairs':alternates,'copy':text_chunks(tree)}
def cached_file(cache,path):
    return cache/'pages'/(hashlib.sha256(path.encode()).hexdigest()+'.json.gz')
def read_page(cache,host,route,version):
    dst=cached_file(cache,route)
    if dst.exists():
        with gzip.open(dst,"rt") as prev:
            if json.load(prev).get("source")==version:return
    req=Request(host+route,headers={'User-Agent':'FlexWeb-Localization-Build/1.0','Accept':'text/html','Accept-Encoding':'gzip'})
    for attempt in range(4):
        try:
            with urlopen(req,timeout=45) as response:
                if response.status!=200 or urlsplit(response.geturl()).path!=route: return
                data=response.read()
                if response.headers.get('content-encoding')=='gzip': data=gzip.decompress(data)
                if 'text/html' not in response.headers.get('content-type',''): return
            info=extract(route,data);info["source"]=version
            tmp=dst.with_suffix('.new')
            with gzip.open(tmp,'wt',encoding='utf8',compresslevel=3) as out:json.dump(info,out,ensure_ascii=False)
            tmp.replace(dst)
            return
        except HTTPError as e:
            if e.code in (404,410): return
            if e.code not in (408,429,500,502,503,504) or attempt==3: raise
        except OSError:
            if attempt==3: raise
        time.sleep(2**attempt)
def capture(files,cache,origin,dist=None,full=False):
    routes=sorted(clean_path(p) for p in files if p.endswith('/index.html') and is_public(p))
    (cache/'pages').mkdir(parents=True,exist_ok=True)
    if dist:
        for p in routes:
            path=Path(dist)/p.lstrip('/')/'index.html'
            if path.is_file():
                dest=cached_file(cache,p)
                with gzip.open(dest,'wt',encoding='utf8',compresslevel=2) as out: json.dump(extract(p,path.read_bytes()),out,ensure_ascii=False)
        return
    groups={}
    exact=[]
    for path in routes:
        if not BULK.match(path): exact.append(path);continue
        # Stratify by country, subject, region and Dutch/German/Italian Swiss variants.
        key=(kind(path),path.split('/')[1],'/suisse/' in path,path.split('/')[3] if '/suisse/' in path else '', '-ch-' in path)
        groups.setdefault(key,[]).append(path)
    sample=set(exact)
    for group in groups.values():
        count=min(len(group),40)
        sample.update(group[i*(len(group)-1)//max(1,count-1)] for i in range(count))
        sample.update(p for p in group if re.search(r'/(?:paris|annecy|chambery|geneve|lausanne|bern|lugano|voglans|aix-les-bains|marseille|lyon|ajaccio|saint-denis|mamoudzou)-',p))
    chosen=routes if full else sorted(sample)
    print('Published documents:',len(routes),'capture:',len(chosen),flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for i,_ in enumerate(ex.map(lambda p:read_page(cache,origin,p,origin+"|"+files[p+"index.html"]),chosen),1):
            if i%300==0: print('Captured:',i,flush=True)
if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--manifest',type=Path,default=CACHE/'files.json')
    p.add_argument('--cache',type=Path,default=CACHE)
    p.add_argument('--origin',required=True)
    p.add_argument('--dist')
    p.add_argument('--full',action='store_true')
    a=p.parse_args()
    capture(json.loads(a.manifest.read_text()),a.cache,a.origin,a.dist,a.full)
