import {makeDictionary} from './dictionary.mjs';

const root = document.documentElement;
const source = root.lang.toLowerCase().split('-')[0] || 'fr';
const path = decodeURI(location.pathname).replace(/\/index\.html?$/i,'/').replace(/\/?$/,'/');
const assets = '/language-assets/data/';
const cookie = 'fw_reading_language';
const officialReceiver = 'https://formulaire-contact--flex-webb.netlify.app';
const options = {fr:'Français', en:'English'};
const safePath = value => typeof value === 'string' && /^\/(?!\/)/.test(value) && !/[\\?#]/.test(value);
const exclusions = 'script,style,noscript,template,svg,code,pre,kbd,samp,output,[contenteditable],astro-island[ssr],.quote-context strong,[translate="no"],[data-fw-language],[data-fw-languages]';
const attributes = ['alt','aria-label','placeholder','title'];
const controls = new Set();
const original = new WeakMap();
const dictionaries = new Map();
let route, language = source, epoch = 0, dirty = false, translation = null;
const frame = () => document.getElementById('flexweb-contact-frame');
const readJson = async url => {
  const response = await fetch(url,{credentials:'same-origin'});
  if (!response.ok || !response.headers.get('content-type')?.includes('json')) throw Error('Reading resource unavailable');
  return response.json();
};
function preference() {
  try {
    const choice = document.cookie.split('; ').find(s=>s.startsWith(cookie+'='))?.split('=')[1];
    if (Object.hasOwn(options,choice)) return choice;
    const saved = JSON.parse(localStorage.getItem(cookie));
    if (saved?.until > Date.now() && Object.hasOwn(options,saved.language)) return saved.language;
  } catch {}
  return null;
}
function remember(lang) {
  const until = new Date();
  until.setMonth(until.getMonth()+6);
  try {
    document.cookie = cookie+'='+lang+'; Path=/; SameSite=Lax; Expires='+until.toUTCString()+(location.protocol==='https:'?'; Secure':'');
    if(document.cookie.split('; ').includes(cookie+'='+lang)){try{localStorage.removeItem(cookie);}catch{} return;}
  } catch {}
  try {localStorage.setItem(cookie,JSON.stringify({language:lang,until:until.valueOf()}));} catch {}
}
async function routeForPath() {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(path));
  const hash = Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  const entries = await readJson(assets+'routes/'+hash.slice(0,2)+'.json');
  const entry = entries[hash.slice(2,18)];
  if (!entry || !/^(?:page-[a-f0-9]{16}|directory|locations-[a-z-]+)$/.test(entry[0])) return null;
  return {group:entry[0],fr:safePath(entry[1])?entry[1]:null,en:safePath(entry[2])?entry[2]:null};
}
function notifyFrame() {
  const node = frame();
  if (!node || !Object.hasOwn(options,language)) return;
  const origin = new URL(node.src,location.href).origin;
  if (origin === officialReceiver || origin === 'https://apercu-formulaire-langues--flex-webb.netlify.app' || /^https:\/\/[0-9a-f]{24}--flex-webb\.netlify\.app$/.test(origin))
    node.contentWindow?.postMessage({type:'flexweb:reader-language',language}, origin);
}
function field(node,key,get,set) {
  const raw = get();
  if (!raw) return;
  let saved = original.get(node);
  if (!saved) { saved=new Map(); original.set(node,saved); }
  const prior = saved.get(key);
  const text = prior && prior.rendered === raw ? prior.text : raw;
  const next = translation ? translation(text) : text;
  if (raw !== next) set(next);
  saved.set(key,{text,rendered:next});
}
function render(node) {
  const el = node.nodeType===Node.ELEMENT_NODE ? node : node.parentElement;
  if (!el || el.closest(exclusions)) return;
  if (node.nodeType===Node.TEXT_NODE) {
    if (!el.closest('textarea') && node.data.trim()) field(node,'#',()=>node.data,value=>{node.data=value;});
    return;
  }
  if (node.nodeType!==Node.ELEMENT_NODE) return;
  for (const key of attributes) if (el.hasAttribute(key))
    field(el,key,()=>el.getAttribute(key),value=>el.setAttribute(key,value));
  if (el.matches('input[type=submit],input[type=reset],input[type=button]') && el.hasAttribute('value'))
    field(el,'value',()=>el.getAttribute('value'),value=>el.setAttribute('value',value));
  if (!el.matches('textarea')) for (const child of el.childNodes) render(child);
}
const observer = new MutationObserver(records=>{
  observer.disconnect();
  try {
    for (const r of records) {
      if (r.type==='childList') {for (const n of r.addedNodes) render(n);}
      else render(r.target);
    }
  } finally { observe(); }
});
function observe() {
  if (!translation) return;
  const settings={subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:[...attributes,'ssr']};
  observer.observe(document.body,settings);
  const title=document.querySelector('head title');if(title)observer.observe(title,settings);
}
function register(link,lang) {
  if (link.dataset.fwLanguage) return;
  link.dataset.fwLanguage=lang;
  link.setAttribute('lang',lang);
  link.setAttribute('aria-label',lang==='fr'?'Lire cette page en français':'Read this page in English');
  const target=route[lang];
  const href=new URL(location.href);
  if(target)href.pathname=target;
  link.setAttribute('href',href.pathname+href.search+href.hash);
  if (!target && lang!==source) link.removeAttribute('hreflang');
  controls.add(link);
  link.addEventListener('click',e=>{
    if (e.button!==0 || e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
    e.preventDefault();remember(lang);apply(lang,true).catch(()=>{});
  });
}
function updateControls() {
  for (const link of controls) {
    if(link.dataset.fwLanguage===language) link.setAttribute('aria-current','true');
    else link.removeAttribute('aria-current');
  }
  document.dispatchEvent(new CustomEvent('flexweb:language',{detail:{language}}));
}
function installControls() {
  const first = document.querySelector('header, body nav');
  let inHeader = 0;
  for (const link of document.querySelectorAll('header a,nav a,footer a')) {
    const text = link.textContent.trim();
    const lang = /^(?:FR|Français|French(?: website)?)$/i.test(text)?'fr':/^(?:EN|English(?: website)?)$/i.test(text)?'en':null;
    if (!lang || !link.href || ![location.origin,'https://flex-web.fr','https://www.flex-web.fr'].includes(new URL(link.href).origin)) continue;
    register(link,lang);
    if (first?.contains(link)) inHeader++;
  }
  if (inHeader<2) {
    // A single native link can act as a toggle if and only if both destinations exist.
    if (!(inHeader===1 && route[source==='fr'?'en':'fr'] && !document.querySelector('form, #flexweb-contact-frame'))) {
      const row=document.createElement('div');row.className='fw-language-row';row.dataset.fwLanguages='';
      const nav=document.createElement('nav');nav.className='fw-language';nav.setAttribute('aria-label','Français / English');
      for(const lang of ['fr','en']) {
        const a=document.createElement('a');a.textContent=lang.toUpperCase();a.hreflang=lang;register(a,lang);nav.append(a);
      }
      row.append(nav);
      const header=first?.closest('header') || first;
      if(header && !header.closest('main,footer'))header.after(row);else (document.querySelector('main')||document.body).prepend(row);
    }
  }
  updateControls();
}
async function inPlace(lang,ticket) {
  let fn=null;
  if(lang!==source) {
    if(!Object.hasOwn(options,source))return;
    const pair=source+'-'+lang;
    if(!dictionaries.has(pair)) {
      const base=assets+pair+'/';
      const [common,page]=await Promise.all([readJson(base+'common.json'),readJson(base+route.group+'.json')]);
      dictionaries.set(pair,makeDictionary({...common,...page}));
    }
    fn=dictionaries.get(pair);
  }
  if(ticket!==epoch)return;
  observer.disconnect();
  translation=fn;
  render(document.body);
  const title=document.querySelector('title');if(title)render(title);
  language=lang;
  root.lang=lang===source?originalLang:lang;
  notifyFrame();updateControls();observe();
}
function navigate(to,manual) {
  const url=new URL(location.href);url.pathname=to;
  if(manual)location.assign(url);else location.replace(url);
}
const originalLang=root.lang;
async function apply(lang,manual=false) {
  const ticket=++epoch;
  if(!Object.hasOwn(options,lang))return;
  // Use the same iframe/fields once someone may have started typing.
  const active=document.activeElement;
  const draft=dirty || (frame() && active===frame()) || active?.matches('form input, form textarea, form select') ||
    Array.from(document.querySelectorAll('form textarea,form input[type=email],form input[type=text],form input:not([type])')).some(f=>f.value && f.value!==f.defaultValue);
  if(route[lang] && !draft) {
    navigate(route[lang],manual);return;
  }
  if (!Object.hasOwn(options,source)) {
    if (lang==='en' && route.fr) {
      try {sessionStorage.setItem('fw-reading-once',JSON.stringify([route.fr,'en']));} catch {}
      navigate(route.fr,manual);
    } else if(route[lang])navigate(route[lang],manual);
    return;
  }
  if(lang===language){notifyFrame();return;}
  await inPlace(lang,ticket);
}
async function start() {
  route=await routeForPath();if(!route)return;
  installControls();frame()?.addEventListener('load',notifyFrame);
  let once;
  try {
    const stored=JSON.parse(sessionStorage.getItem('fw-reading-once'));
    sessionStorage.removeItem('fw-reading-once');
    if(stored?.[0]===path)once=stored[1];
  } catch {}
  if (once) {await apply(once);return;}
  const saved=preference();
  if (/^\/(?:de\/|it\/|projets-sites\/suisse\/(?:de|it)\/)/.test(path))return;
  if (source==='en') {
    if(saved==='fr' && !route.fr)await apply(saved);
    return;
  }
  if (saved) {await apply(saved);return;}
  // An automatic language choice applies to a visitor's reading session. Let search
  // renderers follow the stable source document and its normal language links.
  if(/Googlebot|GoogleOther|AdsBot-Google|bingbot|Applebot|DuckDuckBot|OAI-SearchBot|ChatGPT-User|GPTBot|Claude(?:Bot|-SearchBot|-User)|Perplexity(?:Bot|-User)/i.test(navigator.userAgent))return;
  const initial=epoch;
  const choice=await readJson('/api/langue/');
  if(initial===epoch && (choice.language==='en'||choice.language==='fr'))await apply(choice.language);
}
addEventListener('input',e=>{if(e.target.closest?.('form'))dirty=true;},true);
addEventListener('message',e=>{
  const el=frame();if(!el || e.source!==el.contentWindow || e.origin!==new URL(el.src).origin)return;
  if(e.data?.type==='flexweb:contact-edited')dirty=true;
  if(e.data?.type==='flexweb:contact-ready')notifyFrame();
});
start().catch(()=>{});
