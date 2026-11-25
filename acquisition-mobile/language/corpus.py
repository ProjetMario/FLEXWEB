"""Build translation keys from public editorial text, masking factual values before inference."""
from collections import defaultdict
from functools import lru_cache
import argparse
import gzip
import json
import re
import subprocess
import zipfile
from pathlib import Path

import ahocorasick
from capture import ROOT, CACHE, BULK, clean_path, compact, is_public, kind

BRANDS = ['Flex-Web','Flex Web','Fleximmo','Flex Immo','FootNation','Foot Nation','Serrurier 73',
          '2 Savoie Immo','Voglans','ChatGPT','Gemini','Claude','Anthropic','Google','Bing','Netlify','WhatsApp',
          'WordPress','OpenAI','App Store','Google Play','Windows','Android','macOS','iPhone','iPad','iOS']
VALUE = re.compile(r'https?://[^\s<>]+|(?:[A-Za-z0-9+_.-]+@[\w.-]+\.[a-zA-Z]{2,})|(?<!\w)(?:2[AB]\d{3}|(?:\+33\s*|0)[1-9](?:[ .-]*[0-9]{2}){4}|\+?\d+(?: \d{3})*(?:[.,:/-]\d+)*(?:\s*(?:€|EUR|%))?)(?!\w)')
MARK = re.compile(r'\{([pn])(\d+)\}')
def write_json(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')));temp.replace(path)
def read(path): return json.loads(path.read_text())
def collect_names(root):
    names=set(BRANDS)
    def visit(v):
        if isinstance(v,list):
            for k in v: visit(k)
        elif isinstance(v,dict):
            for k,x in v.items():
                if k in ('name','department','region','area') and isinstance(x,str) and len(x)>1: names.add(x)
                elif isinstance(x,(list,dict)):visit(x)
    visit(read(root/'src/data/national/communes-france.json')['communes'])
    visit(read(root/'src/data/seo-expansion/fr-ch-candidates.json')['locations'])
    automaton=ahocorasick.Automaton()
    for n in names:
        if n and not n.isnumeric(): automaton.add_word(n,n)
    automaton.make_automaton()
    return automaton
def simple(c):return bool(c and (c.isalnum() or c=='_'))
class Corpus:
    def __init__(self,geography):
        self.names=geography
        self.groups=defaultdict(set)
        self.routes={}
    @lru_cache(maxsize=100000)
    def template(self,text,local):
        text=compact(text)
        if not text or len(text)>9000 or not any(c.isalpha() for c in text):return ''
        if re.search(r'[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}',text):return ''
        if len(text)>3 and text[0] in '{[' and text[-1] in ']}':return ''
        protected=[]
        if local:
            for end,name in self.names.iter(text):
                start=end+1-len(name)
                if (start and simple(text[start-1])) or (end+1<len(text) and simple(text[end+1])):continue
                protected.append((start,end+1,'p'))
        else:
            for name in BRANDS:
                if name not in text:continue
                protected.extend((m.start(),m.end(),'p') for m in re.finditer(r'(?<!\w)'+re.escape(name)+r'(?!\w)',text))
        protected.extend((m.start(),m.end(),'n') for m in VALUE.finditer(text))
        out=[];pos=count=0
        for start,end,t in sorted(protected,key=lambda p:(p[0],-p[1])):
            if start<pos:continue
            out.extend((text[pos:start],'{'+t+str(count)+'}'));pos=end;count+=1
        out.append(text[pos:]);pattern=''.join(out)
        semantic=MARK.sub('',pattern)
        if not any(c.isalpha() for c in semantic):return ''
        # Pure lists of place names, codes and official data are language invariant apart from their labels.
        if count>=2 and not re.search(r'[A-Za-zÀ-ÿ]{2,}',semantic):return ''
        return pattern
    def add(self,path,lang,texts):
        if lang not in ('fr','en') or not is_public(path):return
        group=kind(path); local=not group.startswith('page-')
        pair='fr-en' if lang=='fr' else 'en-fr'
        values=self.groups[(pair,group)]
        for text in texts:
            pat=self.template(text,local)
            if pat: values.add(pat)
def archives(collection,archive,paths):
    # The export is supplementary; nav, tables, forms and post-build overlays come from rendered HTML.
    with zipfile.ZipFile(archive) as z,z.open('.cms/import.ndjson.gz') as compressed,gzip.open(compressed,'rt') as stream:
        for line in stream:
            row=json.loads(line);path=row['path']
            if path not in paths or not BULK.match(path) or path.startswith('/en/'):continue
            if '/projets-sites/' in path:continue
            blocks=[s.get('text','') for b in row['content'] for s in b.get('children',[])]
            collection.add(path,'fr',blocks)
def compile_corpus(cache,archive=None):
    files=read(cache/'files.json')
    paths={clean_path(p) for p in files if p.endswith('/index.html') and is_public(p)}
    collection=Corpus(collect_names(ROOT))
    if archive:archives(collection,archive,paths)
    for f in sorted((cache/'pages').glob('*.json.gz')):
        row=json.load(gzip.open(f,'rt'))
        if row['path'] not in paths:continue
        collection.routes[row['path']]={'lang':row['lang'],'pairs':row['pairs']}
        collection.add(row['path'],row['lang'],row['copy'])
    dynamic=json.loads(subprocess.check_output(['node',str(Path(__file__).with_name('ui-copy.mjs'))],cwd=ROOT,text=True))
    for path in ('/demarrer/','/demarrer/application/'):
        if path in paths:collection.add(path,'fr',dynamic)
    write_json(cache/'routes-captured.json',collection.routes)
    for pair in ('fr-en','en-fr'):
        groups={g:sorted(v) for (d,g),v in collection.groups.items() if d==pair}
        write_json(cache/(pair+'-corpus.json'),groups)
        print(pair,len(groups),'groups,',len(set().union(*map(set,groups.values()))) if groups else 0,'unique texts',flush=True)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,default=CACHE);p.add_argument('--cms-export',type=Path)
    args=p.parse_args(); compile_corpus(args.cache,args.cms_export)
