import {readFile, writeFile, readdir} from 'node:fs/promises';
import {join, relative, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

import {isPublicContactAsset, publishedAddresses, transformPublicContact} from './public-contact.mjs';

export async function transformPublicDirectory(dist) {
  const pending = [dist];
  let files = 0, changed = 0;
  while (pending.length) {
    const directory = pending.pop();
    const entries = await readdir(directory, {withFileTypes:true});
    for (const entry of entries) if (entry.isDirectory()) pending.push(join(directory, entry.name));
    const assets = entries.filter(entry => entry.isFile() && isPublicContactAsset(entry.name));
    for (let i = 0; i < assets.length; i += 8) await Promise.all(assets.slice(i, i + 8).map(async entry => {
      const filename = join(directory, entry.name);
      const path = '/' + relative(dist,filename).split('\\').join('/');
      const input = await readFile(filename,'utf8');
      const output = transformPublicContact(path, input);
      if (publishedAddresses(output).length) throw new Error('Contact public résiduel : ' + path);
      if (output !== input) { await writeFile(filename,output); changed++; }
      files++;
    }));
  }
  return {files,changed};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  console.log(await transformPublicDirectory(resolve(process.argv[2] || 'dist')));
}
