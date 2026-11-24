import assert from 'node:assert/strict';
import {test} from 'node:test';
import publicContact from './edge/public-contact.js';

const url = 'https://flex-web.fr/en/locations/websites/toulouse/';
const html = '<!DOCTYPE html><html lang="en"><a href="mailto:contact@flex-web.fr">Email Flex-Web</a></html>';
test('the archived HTML is transformed for a cached, revalidated or range request', async () => {
  const request = new Request(url, {headers:{'if-none-match':'old',range:'bytes=0-100'}});
  let calls = 0;
  const context = {next: req => {
    calls++;
    assert.ok(!req.headers.has('if-none-match'));
    assert.ok(!req.headers.has('range'));
    return new Response(html, {headers:{etag:'old','content-type':'text/html','x-robots-tag':'noindex'}});
  }};
  const response = await publicContact(request,context);
  assert.equal(calls,1);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('x-robots-tag'),'noindex');
  assert.ok(!response.headers.has('etag'));
  assert.match(await response.text(), /href="\/en\/contact\/"/);
});

test('the catalogue handler preserves redirects, error statuses, HEAD and non-HTML assets', async () => {
  const request = new Request(url);
  for (const response of [Response.redirect('https://flex-web.fr/contact/',301), new Response('file',{headers:{'content-type':'text/plain'}})]) {
    assert.equal(await publicContact(request,{next:()=>response}),response);
  }
  const missing = await publicContact(request, {next:()=>new Response(html, {status:404,headers:{'content-type':'text/html'}})});
  assert.equal(missing.status,404);
  assert.doesNotMatch(await missing.text(), /mailto:/);
  const head = await publicContact(new Request(url,{method:'HEAD'}), {next:()=>new Response(null,{headers:{'content-type':'text/html',etag:'old'}})});
  assert.equal(head.body,null);
  assert.ok(!head.headers.has('etag'));
  assert.equal(await publicContact(new Request(url,{method:'POST'}), {next:()=>assert.fail('POST must go directly to Netlify')}),undefined);
});

test('existing CRM responses preserve incoming messages and only redact a public error', async () => {
  const request = new Request('https://flex-web.fr/api/automation/intake', {method:'POST',body:'visitor'});
  const success = Response.json({email:'private@example.test'});
  assert.equal(await publicContact(request, {next:()=>success}),success);
  const error = Response.json({error:'Contactez contact@flex-web.fr',code:'service'}, {status:503,headers:{'Cache-Control':'no-store'}});
  const handled=await publicContact(request,{next:()=>error});
  assert.equal(handled.status,503);
  assert.equal(handled.headers.get('cache-control'),'no-store');
  assert.deepEqual(await handled.json(),{error:'Utilisez le formulaire https://flex-web.fr/contact/',code:'service'});
});
