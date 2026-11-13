import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {intakeSchema, publicQuoteSchema, offerForIntake, tokenHash, HttpError} from '../apps/saas-platform/lib/automation/core.ts';
const require = createRequire(new URL('../apps/saas-platform/package.json',import.meta.url));
const {z} = require('zod');
const source = readFileSync(new URL('../apps/saas-platform/lib/automation/service.ts', import.meta.url),'utf8');
const sourceFunction = ts.transpile(source.slice(source.indexOf('export async function createIntake('),source.indexOf('export async function submitBrief(')).replace('export ',''), {target:ts.ScriptTarget.ES2022});
const variants = [{label:'source',schema:intakeSchema,fn:sourceFunction}];
if (process.env.FLEXWEB_PATCHED_FUNCTION) {
  const bundle=readFileSync(process.env.FLEXWEB_PATCHED_FUNCTION,'utf8');
  const schemaCode=bundle.slice(bundle.indexOf('const intakeSchema ='),bundle.indexOf('var briefSchema ='));
  const schema=vm.runInNewContext(schemaCode+';intakeSchema', {import_zod2:{z},publicQuoteSchema,text:max=>z.string().trim().min(1).max(max)});
  variants.push({label:'published bundle',schema,fn:bundle.slice(bundle.indexOf('async function createIntake('),bundle.indexOf('async function submitBrief('))});
}
const input = (extras={}) => ({requestKey:randomUUID(),accessToken:'a'.repeat(64),contactName:'Camille Test',email:'test@example.invalid',planId:'essentielle',publicQuote:{version:'2026-09-24-ttc',service:'site',tier:'simple',options:[]},message:'Un site pour présenter un projet personnel.',timeline:'a-definir',privacyConsent:true,professional:false,websiteTrap:'',source:'test',...extras});
function harness(variant) {
  const records=new Map(),events=[],messages=[],prospects=[],followups=[];
  const tx={
    prospect:{upsert:async value=>{prospects.push(value);return{id:'prospect-test'}}},
    salesProject:{create:async({data})=>{const row={id:randomUUID(),...data};records.set(data.requestKey,row);return row}},
    followUp:{create:async value=>followups.push(value)},
    prospectInteraction:{create:async()=>{}},
    automationEvent:{create:async({data})=>events.push(data)},
    automationMessage:{create:async({data})=>messages.push(data)},
  };
  const prisma={salesProject:{findUnique:async({where})=>records.get(where.requestKey)},$transaction:async fn=>fn(tx)};
  const Prisma={PrismaClientKnownRequestError:class extends Error{}};
  const fn=vm.runInNewContext(variant.fn+';createIntake',{prisma,Prisma,import_client2:{Prisma},intakeSchema:variant.schema,offerForIntake,tokenHash,HttpError,day:86400000,marketingUrl:()=> 'https://example.invalid'});
  return{fn,records,events,messages,prospects,followups};
}
for(const variant of variants) {
  test(`${variant.label}: individuals and professionals can omit secondary contact fields`,async()=>{
    for(const professional of [false,true]) {
      const h=harness(variant),data=input({professional});
      const row=await h.fn(data);
      assert.equal(row.phone,'');assert.equal(row.city,'');assert.equal(row.businessType,'');
      assert.equal(row.companyName,data.contactName);
      assert.equal(row.clientType,professional?'PROFESSIONAL':'INDIVIDUAL');
      assert.equal(row.prospectId,null);assert.equal(h.prospects.length,0);
      assert.equal(h.messages.length,1);assert.equal(h.messages[0].to,data.email);
      assert.equal((await h.fn(data)).id,row.id);assert.equal(h.records.size,1);assert.equal(h.messages.length,1);
      assert.equal(h.events.length,1);assert.match(h.events[0].detail,professional?/professionnelle/:/particulier/);
      await assert.rejects(h.fn({...data,accessToken:'b'.repeat(64)}),/existe/);
    }
  });
  test(`${variant.label}: namesakes without a phone remain separate requests`,async()=>{
    const h=harness(variant);
    const a=await h.fn(input()),b=await h.fn(input({email:'second@example.invalid',accessToken:'b'.repeat(64)}));
    assert.notEqual(a.id,b.id);assert.equal(h.records.size,2);assert.equal(h.prospects.length,0);
  });
  test(`${variant.label}: an individual with an organization stays out of professional prospecting`,async()=>{
    const h=harness(variant),row=await h.fn(input({companyName:'Association test',phone:'0600000000'}));
    assert.equal(row.clientType,'INDIVIDUAL');assert.equal(row.prospectId,null);assert.equal(h.prospects.length,0);
  });
  test(`${variant.label}: complete professional requests retain the existing follow-up`,async()=>{
    const h=harness(variant),data=input({professional:true,companyName:'Entreprise test',phone:'0600000000',city:'Chambéry',businessType:'Artisan'});
    const row=await h.fn(data);
    assert.equal(row.prospectId,'prospect-test');assert.equal(h.prospects.length,1);assert.equal(h.followups.length,1);
    assert.equal(row.setupCents,29900);assert.equal(row.monthlyCents,0);
  });
  test(`${variant.label}: required fields, consent, phone validation and spam trap remain enforced`,()=>{
    for(const changes of [{contactName:''},{email:'invalid'},{professional:undefined},{privacyConsent:false},{websiteTrap:'bot'},{phone:'wrong number'},{message:''}]) {
      assert.equal(variant.schema.safeParse(input(changes)).success,false,JSON.stringify(changes));
    }
  });
}
