"""Index only published equivalents. Unpaired documents stay at their canonical URL."""
import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
from capture import AXES, CACHE, ROOT, clean_path, is_public, kind
from corpus import read, write_json

def compile_routes(cache, dest):
    files=read(cache/'files.json')
    paths={clean_path(p) for p in files if p.endswith('/index.html') and is_public(p)}
    captured=read(cache/'routes-captured.json')
    axes={v:k for k,v in AXES.items()}
    shards=defaultdict(dict)
    counts=Counter()
    def alternate(row,lang):
        return next((p for code,p in row.get('pairs',{}).items() if code.split('-')[0]==lang and p in paths),None)
    # The French service redesign removed some head alternates. These English pages
    # explicitly identify their actual French counterpart on the same topic.
    confirmed={}
    for english,info in captured.items():
        french=alternate(info,'fr')
        if english.startswith('/en/') and french and not french.startswith('/en/') and (french!='/' or english=='/en/'):
            if french in confirmed and confirmed[french]!=english:raise ValueError('Ambiguous native pair '+french)
            confirmed[french]=english
    if '/en/locations/' in paths and '/territoires/' in paths:confirmed['/territoires/']='/en/locations/'
    reverse={en:fr for fr,en in confirmed.items()}
    for path in sorted(paths):
        row=captured.get(path,{})
        lang=row.get('lang','en' if path.startswith('/en/') else 'fr')
        fr=alternate(row,'fr')
        en=alternate(row,'en')
        # Ignore an unrelated home or an editorial link with no return alternate.
        if en and ((en=='/en/' and path not in ('/','/en/')) or (lang=='fr' and alternate(captured.get(en,{}),'fr')!=path)): en=None
        if fr and ((fr=='/' and path not in ('/','/en/')) or (lang=='en' and alternate(captured.get(fr,{}),'en')!=path)): fr=None
        if path in confirmed:en=confirmed[path]
        if path in reverse:fr=reverse[path]
        parts=path.strip('/').split('/')
        if len(parts)>=2 and parts[0]=='territoires' and parts[1] in AXES:
            other='/en/locations/'+AXES[parts[1]]+'/'+ '/'.join(parts[2:])+('/' if parts[2:] else '')
            if other in paths: en=other
        if len(parts)>=3 and parts[:2]==['en','locations'] and parts[2] in axes:
            other='/territoires/'+axes[parts[2]]+'/'+ '/'.join(parts[3:])+('/' if parts[3:] else '')
            if other in paths: fr=other
        if parts[0]=='projets-sites' and '-ch-' in parts[-1]:
            if parts[1]=='suisse': lang=parts[2]
            else: lang=next((l for l in ('de','it','fr') if '/projets-sites/suisse/'+l+'/'+parts[-2]+'/'+parts[-1]+'/' not in paths),lang)
            swiss='/projets-sites/suisse/fr/'+parts[-2]+'/'+parts[-1]+'/'
            fr=swiss if swiss in paths else '/projets-sites/'+parts[-2]+'/'+parts[-1]+'/'
        if lang=='fr': fr=path
        if lang=='en': en=path
        digest=hashlib.sha256(path.encode()).hexdigest()
        shard=shards[digest[:2]];key=digest[2:18]
        if key in shard:raise ValueError('Duplicate route digest for '+path)
        if (fr and fr not in paths) or (en and en not in paths): raise ValueError('Unpublished route for '+path)
        shard[key]=[kind(path),fr if fr!=path else None,en if en!=path else None]
        counts['public']+=1
        if lang=='fr' and en:counts['frWithNativeEnglish']+=1
        if lang=='fr' and not en: counts['frInPlace']+=1
    for name,entries in shards.items():write_json(dest/(name+'.json'),entries)
    for stale in dest.glob('*.json'):
        if stale.stem not in shards:stale.unlink()
    print(dict(counts))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,default=CACHE);p.add_argument('--out',type=Path,default=ROOT/'public/language-assets/data/routes')
    a=p.parse_args();compile_routes(a.cache,a.out)
