"""Refresh translations from this exact static publication before the Netlify upload."""
import argparse
import json
from pathlib import Path
from capture import ROOT, CACHE, capture
from corpus import compile_corpus,write_json
from routes import compile_routes
from translate import generate

def refresh(directory,cache):
    out=directory/'language-assets/data'
    if not (directory/'index.html').is_file():raise ValueError('Missing built homepage')
    files={'/'+f.relative_to(directory).as_posix():True for f in directory.rglob('index.html')}
    cache.mkdir(parents=True,exist_ok=True)
    write_json(cache/'files.json',files)
    capture(files,cache,'',directory)
    compile_corpus(cache)
    compile_routes(cache,out/'routes')
    generate(cache,out,4)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('dist',type=Path);p.add_argument('--cache',type=Path,default=CACHE/'static-build')
    args=p.parse_args();refresh(args.dist,args.cache)
