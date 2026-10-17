import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateLogo,validateLogoBytes} from '../prospects/audit-logos.mjs';
const proposed={src:'/images/prospects/logos/dupont.svg',alt:'Proposition de logo pour Dupont',width:600,height:180,origin:'proposed'};
test('proposed identities cannot masquerade as verified official logos',()=>{
  validateLogo(proposed,'dupont');
  assert.throws(()=>validateLogo({...proposed,sourceUrl:'https://example.com'},'dupont'),/must not imply/);
  assert.throws(()=>validateLogo({...proposed,origin:'official'},'dupont'));
  validateLogo({...proposed,origin:'official',sourceUrl:'https://example.com/',verifiedAt:'2026-10-17T20:00:00Z'},'dupont');
});
test('private fields and remote asset references cannot enter logo metadata',()=>{
  assert.throws(()=>validateLogo({...proposed,phone:'private'},'dupont'),/unexpected/);
  assert.throws(()=>validateLogo({...proposed,src:'https://external.example/logo.svg'},'dupont'),/local bounded/);
  assert.throws(()=>validateLogo({...proposed,src:'/images/prospects/logos/../secret.svg'},'dupont'),/local bounded/);
});
test('downloaded assets cannot carry active SVG content or HTML error pages',()=>{
  const safe='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0h10v10z"/></svg>';
  validateLogoBytes(Buffer.from(safe),'logo.svg');
  for(const insert of ['<script>alert(1)</script>','<image href="https://tracker.example/x"/>','<g onclick="alert(1)"></g>','<style>path{fill:url(https://tracker.example/x)}</style>']) assert.throws(()=>validateLogoBytes(Buffer.from(safe.replace('</svg>',insert+'</svg>')),'logo.svg'),/Active or remote/);
  assert.throws(()=>validateLogoBytes(Buffer.from('<html>'+ 'error'.repeat(20)+'</html>'),'logo.png'),/Invalid PNG/);
});
