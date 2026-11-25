"""Generate English/French reading resources offline with OPUS-MT. No visitor text is accepted."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
from urllib.request import urlopen
import shutil

import ctranslate2
import sentencepiece
from capture import CACHE, ROOT
from corpus import MARK, read, write_json

MODELS={'fr-en':'a85209987bcca46b0c206c619e435145da62d193','en-fr':'1bd14ddf7b73d0d5ef2dbe4982e2cfdadec9c0f2'}
TOKENS=['Oslo','Berlin','Tokyo','Toronto','Boston','Sydney','Oxford','Miami','Dallas','Austin','Dublin','Zurich','Madrid','Denver','Lima','Bristol']
def model_at(cache,pair):
    dest=cache/'models'/pair;dest.mkdir(parents=True,exist_ok=True)
    for name in ('model.bin','source.spm','target.spm','config.json','shared_vocabulary.json'):
        target=dest/name
        if target.is_file():continue
        url='https://huggingface.co/craftwise/ct2-opus-mt-'+pair+'-int8/resolve/'+MODELS[pair]+'/'+name
        tmp=dest/(name+'.part')
        with urlopen(url,timeout=150) as src,tmp.open('wb') as out:shutil.copyfileobj(src,out)
        tmp.replace(target)
    return dest
class Engine:
    def __init__(self,cache,pair,threads):
        dest=model_at(cache,pair)
        self.src=sentencepiece.SentencePieceProcessor(model_file=str(dest/'source.spm'))
        self.tgt=sentencepiece.SentencePieceProcessor(model_file=str(dest/'target.spm'))
        self.model=ctranslate2.Translator(str(dest),device='cpu',compute_type='int8',intra_threads=threads,inter_threads=1)
    def translate(self,strs):
        tokens=[self.src.encode(s,out_type=str)+['</s>'] for s in strs]
        result=self.model.translate_batch(tokens,beam_size=1,max_batch_size=32,max_input_length=0,
                                          max_decoding_length=min(490,max(48,max(map(len,tokens))*2+16)),repetition_penalty=1.08)
        return [self.tgt.decode(r.hypotheses[0]).strip() for r in result]
    def segments(self,texts):
        # Split long paragraphs at sentence boundaries; keep each model input below its positional limit.
        pieces=[];index=[]
        for text in texts:
            start=len(pieces)
            for chunk in re.split(r'(?<=[.!?])\s+(?=[A-ZÀ-Ü«])',text):
                words=chunk.split()
                for i in range(0,len(words),120): pieces.append(' '.join(words[i:i+120]))
            index.append((start,len(pieces)))
        translations=self.translate(pieces) if pieces else []
        return [' '.join(translations[a:b]) for a,b in index]
    def batch(self,keys):
        sources=[];substitutions=[]
        for key in keys:
            marks=list(MARK.finditer(key));subs={}
            for m in marks:
                i=int(m[2]); token=TOKENS[i] if m[1]=='p' and i<len(TOKENS) and TOKENS[i] not in key else str(73401+i)
                subs[m[0]]=token
            substitutions.append(subs);sources.append(MARK.sub(lambda m:subs[m[0]],key))
        translated=self.segments(sources)
        outputs=[]
        for key,result,subs in zip(keys,translated,substitutions):
            good=bool(result)
            for mark,token in subs.items():
                variants={'Zurich':r'Z[uü]rich'}.get(token,re.escape(token))
                rg=re.compile(r'(?<!\w)'+variants+r'(?!\w)',re.I)
                if len(rg.findall(result))!=1:good=False;break
                result=rg.sub(mark,result)
            if not good:
                # A model may reorder or omit codes. Translate the words around the placeholders independently.
                parts=re.split(r'(\{[pn]\d+\})',key)
                idx=[i for i,p in enumerate(parts) if not MARK.fullmatch(p) and re.search(r'[A-Za-zÀ-ÿ]',p)]
                values=self.segments([parts[i].strip() for i in idx])
                for i,val in zip(idx,values):
                    p=parts[i];parts[i]=(' ' if p[:1].isspace() else '')+(val or p.strip())+(' ' if p[-1:].isspace() else '')
                result=''.join(parts)
            if sorted(m[0] for m in MARK.finditer(key))!=sorted(m[0] for m in MARK.finditer(result)):
                raise ValueError('Protected factual value lost: '+key)
            outputs.append(result)
        return outputs
def generate(cache,out,threads):
    for pair in MODELS:
        src=cache/(pair+'-corpus.json')
        groups=read(src)
        reviewed=read(Path(__file__).with_name('reviewed.json'))[pair]
        counts=Counter(x for vs in groups.values() for x in vs)
        memory_file=cache/(pair+'-memory.json')
        memory=read(memory_file) if memory_file.exists() else {}
        # Read back distributed dictionaries as a persistent translation memory between releases.
        for file in (out/pair).glob('*.json'):
            memory.update(read(file))
        memory.update(reviewed); keys=sorted((k for k in counts if k not in memory),key=len)
        print(pair,len(counts),'keys,',len(keys),'to translate',flush=True)
        if keys:
            engine=Engine(cache,pair,threads)
            for i in range(0,len(keys),24):
                batch=keys[i:i+24]
                memory.update(zip(batch,engine.batch(batch)))
                if i%240==0:
                    write_json(memory_file,memory); print(pair,i+len(batch),'/',len(keys),flush=True)
        write_json(memory_file,memory)
        common={k:memory[k] for k,n in counts.items() if n>=3}
        common.update(reviewed)
        dest=out/pair;write_json(dest/'common.json',common)
        for group,values in groups.items():
            write_json(dest/(group+'.json'),{k:memory[k] for k in values if k not in common})
        retained={name+'.json' for name in groups}|{'common.json'}
        for stale in dest.glob('*.json'):
            if stale.name not in retained:stale.unlink()
        print(pair,'complete',flush=True)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,default=CACHE);p.add_argument('--out',type=Path,default=ROOT/'public/language-assets/data');p.add_argument('--threads',type=int,default=4)
    a=p.parse_args();generate(a.cache,a.out,a.threads)
