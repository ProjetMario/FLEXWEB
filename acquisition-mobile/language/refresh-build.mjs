// Run once after all static pages and public contact overlays have been generated.
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cache} from '../scripts/baseline.mjs';
const here=fileURLToPath(new URL('./',import.meta.url)),directory=join(cache,'language','build-python');
mkdirSync(directory,{recursive:true});
const run=(bin,args)=>execFileSync(bin,args,{stdio:'inherit',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
if(!existsSync(join(directory,'bin/python')))run('python3',['-m','venv',directory]);
const python=join(directory,'bin/python');
run(python,['-m','pip','install','--disable-pip-version-check','-r',join(here,'requirements.txt')]);
run(python,[join(here,'build.py'),process.argv[2]||'dist']);
run(process.execPath,[join(here,'inventory-check.mjs'),process.argv[2]||'dist']);
