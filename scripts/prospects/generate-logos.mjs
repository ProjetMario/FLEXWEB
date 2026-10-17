#!/usr/bin/env node
/**
 * Reproducible, native SVG identities for Flex-Web prospect mockups.
 * Original design proposals, never assertions about an existing brand.
 * No network, raster images, initials-only boxes, private fields or dependencies.
 * Usage: node generate-logos.mjs [prospects.json] [output-directory]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const input = process.argv[2] || fileURLToPath(new URL('../../src/data/prospects.json', import.meta.url));
const out = process.argv[3] || path.resolve('.cms/logo-proposals');
fs.mkdirSync(out, { recursive: true });
const prospects = JSON.parse(fs.readFileSync(input, 'utf8'));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const norm = s => s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const hash = s => parseInt(crypto.createHash('sha256').update(s).digest('hex').slice(0,8),16);
const n = x => Number(x.toFixed(2));
const palettes = {
  building: { ink:'#242823', paper:'#f5f1e7', colors:['#8d4c22','#704c2f','#7b4134','#566242','#6d5232'], family:'sans' },
  interiors: { ink:'#352c29', paper:'#f8f4ef', colors:['#9a482d','#8b5443','#765348','#6e6040','#815751'], family:'serif' },
  garden: { ink:'#243d2e', paper:'#f6f6ed', colors:['#365d34','#4b643b','#2e6254','#5a5d35','#476b51'], family:'serif' },
  beauty: { ink:'#462e3f', paper:'#fbf6f5', colors:['#7e4663','#83565d','#705168','#8a4f56','#5f4e6c'], family:'serif' },
  care: { ink:'#244944', paper:'#f4f8f6', colors:['#21665e','#3c6655','#396369','#4c6658','#3c6c62'], family:'sans' },
  food: { ink:'#4d2e21', paper:'#f9f2e6', colors:['#a04525','#8b4d24','#874532','#8b582f','#764833'], family:'serif' },
  automotive: { ink:'#20292d', paper:'#f1f2f0', colors:['#9a442a','#7d4534','#33566d','#64503b','#3e5a5e'], family:'sans' },
  creative: { ink:'#2c2654', paper:'#f4f2fc', colors:['#5940b5','#67478f','#6f447b','#4a5a91','#664e98'], family:'serif' },
  services: { ink:'#203851', paper:'#f4f6f8', colors:['#255881','#306273','#3e557a','#465e7b','#315d61'], family:'sans' }
};

// Explicit trade vocabulary takes precedence over the broad visual theme.
// Unknown activities stay abstract unless a clear trade word exists in the name.
function tradeFor(p) {
  const raw = norm(p.activity);
  const name = norm(p.name);
  const s = /activite a preciser/.test(raw) ? name : `${raw} ${name}`;
  const rules = [
    ['pool', /piscin|\bbassin\b/], ['flowers', /fleur|floral|blooms/], ['tree', /\belag|arbor|\barbre/],
    ['garden', /paysag|jardin/], ['bike', /velo|cycle|\bcycling\b/],
    ['car', /automobile|\bauto\b|\bcars\b|garage|mecanique|pneu/],
    ['electric', /electri|electricite|\belec\b|antoineelec|depelec/],
    ['plumbing', /plomb|sanitaire|aqua|all'eau/], ['heating', /chauff|ramon/],
    ['roof', /couvr|couverture|toiture|zingue|etancheite/],
    ['wood', /menuis|charpent|bois|escalier/], ['tile', /carrel|ceram|revetements? de sol/],
    ['paint', /peint|paint/], ['plaster', /platr|plaquist|isolation|ravalement/],
    ['building', /macon|construction|batiment|terrassement|\bbtp\b|bati/],
    ['photo', /photograph/], ['sewing', /coutur|retouche|zigzag/], ['music', /disc-jockey|\bdj\b/],
    ['event', /organisateur de mariages|event/], ['tattoo', /tatou|tattoo|needles/],
    ['piercing', /piercing/], ['nails', /ongle|manucure/], ['makeup', /maquill|make up/],
    ['animal', /animaux|toilett|dog|petsitt|chien|cabot|toutou/],
    ['wellness', /sophrolog|hypnoth|therapeu|medecine alternative|drainage|bien-etre|hypnose/],
    ['sport', /coach|sport|crossfit/], ['personal', /aide a domicile|assistante|administrative/],
    ['clean', /nettoy|debarras|entretien|nuisibles/],
    ['appliance', /electromenager|appareils/], ['phone', /telephone/], ['computer', /ordinateur/],
    ['tech', /reparation/],
    ['bakery', /boulanger/], ['butcher', /boucher/], ['food', /traiteur/],
    ['repair', /bricolage|affut|artisanat/], ['interiors', /decorat|deco\b|home organizer/]
  ];
  const hit = /piercing/.test(name)&&!/tatou|tattoo/.test(name) ? ['piercing'] : rules.find(([,r]) => r.test(s));
  if(hit) return { motif:hit[0], basis:/activite a preciser/.test(raw)?'explicit-name':'activity-and-name' };
  return { motif:({ building:'building', interiors:'interiors', garden:'garden', beauty:'beauty', care:'wellness', food:'food', automotive:'car', creative:'creative', services:'abstract' })[p.theme] || 'abstract', basis:'theme' };
}

function emblem(motif, seed, accent, ink) {
  const v = seed % 5;
  const d = Number(((((seed >>> 8) & 0xffff) / 65535) * 8 - 4).toFixed(3));
  const t = 4.4 + ((seed >>> 16) / 65535) * .96;
  const rotation = ((seed >>> 21)%7)-3;
  const P = (d, fill=accent, rest='') => `<path d="${d}" fill="${fill}" ${rest}/>`;
  const S = (d, color=accent, width=t, rest='') => P(d,'none',`stroke="${color}" stroke-width="${n(width)}" stroke-linecap="round" stroke-linejoin="round" ${rest}`);
  const C = (x,y,r,fill=accent,rest='') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${rest}/>`;
  const R = (x,y,w,h,rx,fill=accent,rest='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${rest}/>`;
  const E = (x,y,rx,ry,fill=accent,rest='') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${rest}/>`;
  const choose = items => items[v % items.length];
  let g='';
  switch(motif) {
    case 'electric': g=choose([
      P(`M${50+d} 13L25 53H44L38 83L72 39H51Z`)+S('M22 27A36 36 0 0 0 14 51',ink,3.2)+S('M74 69A36 36 0 0 0 82 45',ink,3.2),
      S('M28 21V43Q28 57 48 57Q68 57 68 43V21',ink,6)+S('M48 57V79',ink,6)+P(`M${49+d} 29L35 47H47L43 63L62 40H49Z`),
      S('M20 68V32L48 17L76 32V68L48 82Z',ink,3.5)+P(`M${54+d} 24L32 52H45L41 73L65 43H51Z`),
      S('M17 38H34L47 17M79 58H62L49 79',ink,5)+C(17,38,4,ink)+C(79,58,4,ink)+P(`M${51+d} 26L34 51H46L43 69L62 43H50Z`),
      S('M29 16V34M66 16V34M21 36H74V44Q74 65 48 65Q21 65 21 44Z',ink,4.5)+P(`M${52+d} 35L37 50H47L43 65L61 46H51Z`)+S('M48 66V81',accent,5)
    ]);break;
    case 'plumbing': g=choose([
      P(`M48 ${12+d}C43 23 23 43 23 59A25 25 0 0 0 73 59C73 43 53 23 48 ${12+d}ZM48 35C55 46 61 53 61 60A13 13 0 0 1 35 60C35 53 41 46 48 35Z`)+S('M14 78Q30 87 46 79Q63 71 81 78',ink,3.4),
      S('M19 31H43Q57 31 57 45V64',ink,9)+S('M20 21V41M66 64H48',ink,4.5)+P(`M${65+d} 47C60 55 55 59 55 65A10 10 0 0 0 75 65C75 59 70 55 ${65+d} 47Z`)+S('M15 81H79',accent,3.3),
      S('M49 15C37 31 25 43 25 57A24 24 0 0 0 73 57C73 43 61 31 49 15Z',accent,5)+S(`M31 58Q43 ${45+d} 55 58T73 58`,ink,4)+S('M38 68Q48 74 58 68',ink,3),
      P(`M24 33L49 ${12+d}L73 33V62L49 84L24 62Z`,ink)+P('M49 31C43 40 35 48 35 56A14 14 0 0 0 63 56C63 48 55 40 49 31Z',accent)+S('M44 57Q44 63 50 64','#ffffff',2.4),
      S(`M17 66V${44+d}Q17 ${31+d} 30 ${31+d}H48Q61 ${31+d} 61 18`,ink,6)+S(`M17 77V68M39 83V${59+d}Q39 ${46+d} 52 ${46+d}H67Q80 ${46+d} 80 33V18`,accent,6)+C(61,17,4,ink)
    ]);break;
    case 'heating': g=choose([
      P(`M51 ${10+d}C64 34 34 36 46 53C50 46 59 43 63 34C84 59 73 84 48 84C23 84 13 60 29 39C27 57 37 61 39 56C21 35 46 26 51 ${10+d}Z`),
      S('M17 74H79M25 27V61M40 22V61M55 27V61M70 22V61',ink,5)+S(`M23 15Q35 ${4+d} 46 15T71 15`,accent,3),
      S('M21 59A29 29 0 0 1 76 59',ink,5)+P(`M48 ${17+d}C62 38 65 44 58 54C52 62 37 57 38 46C38 36 47 33 48 ${17+d}Z`)+S('M18 73H78M31 83H65',accent,4),
      S('M18 40L48 16L78 40M25 35V78H71V35',ink,4.5)+S(`M39 67C24 ${53+d} 54 46 39 33M57 67C42 ${53+d} 72 46 57 33`,accent,4.5),
      P(`M48 ${12+d}L75 28V65L48 82L21 65V28Z`,ink)+S('M37 62C24 49 48 43 37 30M56 67C43 54 67 48 56 35','#ffffff',4)
    ]);break;
    case 'roof': g=choose([
      P(`M11 49L48 ${13+d}L85 49L77 57L48 29L19 57Z`)+P('M27 54L48 34L69 54V81H55V59H41V81H27Z',ink),
      S(`M11 52L48 ${17+d}L85 52`,accent,7)+S('M22 64H74M31 77H65',ink,5)+S('M65 31V17H75V41',ink,4),
      P(`M12 52L45 ${16+d}H58L25 52Z`)+P(`M43 52L62 31L84 52V67L62 46L43 67Z`,ink)+S('M23 79H75',ink,4),
      S(`M15 68V42L48 ${15+d}L81 42V68`,ink,4)+P('M29 52L48 34L67 52L60 59L48 48L36 59Z')+S('M32 76H65',accent,5),
      P(`M15 49L48 ${14+d}L82 49H66L48 31L30 49Z`)+P('M25 56H40V79H25ZM48 56H71V64H48ZM48 71H71V79H48Z',ink)
    ]);break;
    case 'wood': g=choose([
      S(`M18 75V38L48 ${13+d}L78 38V75`,ink,5)+S('M30 75V44L48 29L66 44V75M48 30V75',accent,4)+S('M18 79H78',ink,4),
      P(`M18 27L39 ${16+d}V61L59 73L43 82L18 67Z`,ink)+P('M49 17L76 32V64L59 74V42L49 36Z')+S('M29 32V61M60 29L66 33V62','#ffffff',1.5),
      S('M18 78V42Q18 14 48 14Q78 14 78 42V78ZM29 78V44Q29 26 48 26Q67 26 67 44V78M39 78V46Q39 38 48 38Q57 38 57 46V78',accent,3.7)+S('M17 80H80',ink,4),
      S(`M19 71L48 ${18+d}L77 71Z`,ink,5)+S('M35 71V43M48 71V25M61 71V43M32 56H64',accent,3.7),
      P('M16 28H35V71H16Z',ink)+P(`M40 ${17+d}H58V59H40Z`)+P('M63 36H81V80H63Z',ink)+S('M16 79H57M40 10H81',accent,3)
    ]);break;
    case 'tile': g=choose([
      P(`M48 ${10+d}L73 35L48 60L23 35Z`)+P('M20 42L43 65L20 88L2 65Z',ink)+P('M76 42L94 65L76 88L53 65Z',ink),
      R(17,17,27,27,2,ink)+R(51,17,27,27,2)+R(17,51,27,27,2)+R(51,51,27,27,2,ink)+S(`M57 56L${72+d} 71`,'#ffffff',2),
      P(`M48 ${13+d}L82 47L48 81L14 47Z`,ink)+S('M31 30L65 64M31 64L65 30','#ffffff',3)+P('M48 23L63 38L48 53L33 38Z'),
      R(17,17,62,62,2,ink)+P(`M17 17H${49+d}V49H17Z`)+P(`M${49+d} 49H79V79H${49+d}Z`)+S(`M17 49H79M${49+d} 17V79`,'#ffffff',3),
      P('M16 25L39 12L62 25L39 38Z')+P('M16 31L39 44V73L16 60Z',ink)+P('M45 44L78 25V60L45 79Z',ink)+S(`M${58+d} 43V67`,'#ffffff',2.5)
    ]);break;
    case 'paint': g=choose([
      R(13,17,62,23,5)+S(`M75 27H82V50H${43+d}V72`,ink,5)+R(35+d,64,16,22,5,ink)+S('M22 23H63','#ffffff',2),
      P(`M21 15H72L65 ${47+d}H28Z`)+S(`M28 ${47+d}H65M37 ${48+d}V61Q48 69 58 61V${48+d}`,ink,4.5)+R(41,61,14,24,6,ink)+S('M29 20L33 37M41 20V40M54 20V40M65 20L61 37','#ffffff',2),
      P(`M15 29Q43 ${6+d} 80 21V35Q41 20 15 43Z`)+P('M15 49Q45 28 80 43V57Q44 43 15 63Z',ink)+P('M15 69Q47 49 80 64V78Q45 63 15 83Z'),
      S('M20 32H72V73H20Z',ink,4)+P(`M20 32L39 ${12+d}H80L62 32Z`)+P('M31 43H61V53H31ZM31 61H50V66H31Z'),
      P(`M23 15L77 ${30+d}L64 74L10 59Z`,ink)+P('M39 23L80 35L67 80L26 68Z')+S('M43 35L65 42M39 46L61 53M36 58L49 62','#ffffff',2.3)
    ]);break;
    case 'plaster': g=choose([
      P(`M14 57L57 ${14+d}L78 35L35 78Z`)+S('M35 57L49 71L69 51',ink,5)+S('M54 60L73 79',ink,9),
      P('M17 22H47V77H17Z',ink)+P(`M53 ${14+d}H80V69H53Z`)+S('M24 32H39M24 41H39M24 50H39','#ffffff',2),
      S('M17 77V29L48 15L79 29V77',ink,5)+S(`M31 28V75M48 ${22+d}V75M65 28V75`,accent,4),
      P(`M15 36L48 ${14+d}L81 36L48 58Z`)+P('M15 46L48 68L81 46V59L48 81L15 59Z',ink),
      R(15,19,65,58,2,ink)+S(`M19 ${38+d}H75M19 ${58+d}H75M42 20V${38+d}M56 ${38+d}V${58+d}M35 ${58+d}V75`,'#ffffff',3)+P('M51 14H83V24H51Z')
    ]);break;
    case 'building': g=choose([
      P(`M16 42L48 ${12+d}L80 42L71 51L48 29L25 51Z`)+P('M25 54H43V81H25ZM52 54H71V65H52ZM52 71H71V81H52Z',ink),
      P(`M17 37L48 ${18+d}L79 37L48 56Z`)+P('M17 45L43 61V82L17 66Z',ink)+P('M53 61L79 45V66L53 82Z',ink),
      S(`M18 78V40L48 ${15+d}L78 40V78`,ink,6)+S('M34 78V55H62V78M18 78H78',accent,5),
      P(`M15 36H35V81H15ZM41 ${15+d}H61V81H41ZM67 45H83V81H67Z`,ink)+S('M15 27H35M67 36H83',accent,5)+R(46,25,10,10,0),
      P(`M14 46L47 ${14+d}L82 46H66L47 28L29 46Z`,ink)+P('M24 53H70V64H24ZM24 70H45V82H24ZM51 70H70V82H51Z')
    ]);break;
    case 'garden': g=choose([
      P(`M48 63C20 66 12 43 17 ${16+d}C47 15 63 34 48 63Z`)+P('M50 76C48 46 65 32 85 35C88 59 72 78 50 76Z',ink)+S('M48 81V56L29 34',ink,3.5)+S('M53 67L72 49','#ffffff',2),
      P(`M48 ${12+d}C78 29 86 57 48 82C10 57 18 29 48 ${12+d}Z`)+S('M48 75V33M48 54L33 40M48 65L64 48','#ffffff',3),
      S('M48 81V21',ink,3.5)+P(`M48 48C19 50 14 34 17 ${17+d}C37 15 49 27 48 48Z`)+P('M48 66C73 67 82 49 79 32C58 32 47 45 48 66Z',ink)+P('M46 78C28 79 20 69 22 56C39 55 47 63 46 78Z'),
      S(`M16 69Q45 ${43+d} 81 68M17 80Q44 56 81 80`,ink,4)+P('M49 55C30 51 24 31 29 15C50 18 59 36 49 55Z')+P('M53 55C53 34 68 24 82 28C81 46 70 57 53 55Z',ink),
      P(`M20 57C9 26 36 ${9+d} 48 16C61 9 88 28 76 57C65 80 30 80 20 57Z`)+S('M49 81V33M49 58L34 44M49 69L64 53','#ffffff',3)
    ]);break;
    case 'tree': g=choose([
      P(`M48 ${10+d}L69 38H58L78 65H54V84H42V65H18L38 38H27Z`,ink)+S('M49 38V65M49 54L61 43',accent,3.5),
      C(35,35,20)+C(61,34,20)+C(26,51,15)+C(69,50,15)+S(`M48 82V${28+d}M48 58L28 43M48 64L67 45`,ink,5),
      S(`M49 82V${17+d}M49 51L26 28M49 62L73 36M49 72L32 58`,ink,5)+C(26,28,9)+C(73,36,10)+C(49,18,10)+C(32,58,7),
      P(`M49 ${12+d}L79 57H60L73 72H54V83H43V72H23L36 57H17Z`)+S('M49 33V68M49 53L61 44','#ffffff',3),
      S('M49 83V56',ink,5)+P(`M49 ${11+d}C26 18 16 41 26 57C36 72 63 73 74 57C84 41 72 19 49 ${11+d}Z`)+S('M49 63V30M49 48L35 38M49 56L64 43','#ffffff',3)
    ]);break;
    case 'pool': g=choose([
      S(`M16 ${51+d}Q32 37 48 51T80 51M16 66Q32 52 48 66T80 66M16 81Q32 67 48 81T80 81`,accent,4.5)+S('M28 37V20Q28 11 37 11M46 37V20Q46 11 55 11M28 26H46',ink,4),
      P(`M48 ${11+d}L81 29V47L48 29L15 47V29Z`,ink)+S('M16 59Q32 47 48 59T80 59M16 74Q32 62 48 74T80 74',accent,4.5),
      C(61,24,11)+S(`M16 48Q31 ${34+d} 47 48T80 48M16 63Q31 49 47 63T80 63M16 78Q31 64 47 78T80 78`,ink,4.5),
      S('M17 55V26Q17 18 25 18H71Q79 18 79 26V55',ink,5)+S(`M18 ${61+d}Q33 48 48 61T78 61M18 76Q33 63 48 76T78 76`,accent,4)+S('M31 20V40M46 20V40M31 31H46',ink,3),
      P(`M48 ${12+d}C40 24 26 40 26 55C26 69 36 79 48 79C60 79 70 69 70 55C70 40 56 24 48 ${12+d}Z`,ink)+S('M30 53Q39 44 48 53T67 53M30 65Q39 56 48 65T67 65','#ffffff',3)
    ]);break;
    case 'flowers': {
      const count=5+v%3;const petal=Array.from({length:count},(_,i)=>`<g transform="rotate(${n(i*360/count)} 48 43)">${E(48,25,9+d*.25,17, i%2?ink:accent)}</g>`).join('');
      g=petal+C(48,43,9,'#ffffff')+C(48,43,5,ink)+S('M48 65V85',ink,3)+P('M47 78C32 80 24 72 24 62C39 62 47 69 47 78Z');break;
    }
    case 'photo': g=choose([
      S(`M16 29H31L37 ${18+d}H59L65 29H80V77H16Z`,ink,4.5)+C(48,52,17,accent)+C(48,52,8,'#ffffff')+C(71,36,3,accent),
      Array.from({length:6},(_,i)=>`<g transform="rotate(${i*60+rotation} 48 48)">${P('M48 16L72 29L53 39L43 34Z',i%2?ink:accent)}</g>`).join('')+C(48,48,6,ink),
      C(48,48,30,'none',`stroke="${ink}" stroke-width="5"`)+C(48,48,18,'none',`stroke="${accent}" stroke-width="7"`)+C(58+d,34,4,accent)+S('M16 22V14H25M71 14H81V24M81 71V81H71M25 81H15V72',ink,2.5),
      R(17,25,62,52,7,ink)+P(`M29 25L36 ${14+d}H61L67 25Z`,ink)+C(48,51,18,accent)+C(48,51,10,'#ffffff')+C(69,34,3,'#ffffff'),
      S('M17 32V18H31M66 18H80V32M80 64V79H65M31 79H17V64',ink,4)+P(`M48 ${24+d}L70 48L48 72L26 48Z`)+C(48,48,10,'#ffffff')
    ]);break;
    case 'sewing': g=choose([
      S(`M23 73L68 ${16+d}Q76 8 80 14Q84 19 77 27L31 83Z`,ink,3.4)+S('M69 24L76 16',accent,2.2)+S('M73 21C40 12 13 22 19 40C24 56 55 44 57 64C59 79 42 85 34 81',accent,3),
      R(28,19,40,58,10,ink)+R(21,15,54,8,3)+R(21,73,54,8,3)+S(`M32 29L64 42M32 40L64 53M32 51L64 ${64+d}`, '#ffffff',2.8),
      S('M15 54L29 28L43 68L57 28L71 68L83 43',accent,4)+S(`M20 ${20+d}H75M20 81H75`,ink,3)+C(20,20+d,3,ink)+C(75,81,3,ink),
      S('M20 22C17 42 41 48 48 48L79 18M19 77C16 56 40 49 48 48L79 79',ink,4)+E(22,24,10,12,'none',`stroke="${accent}" stroke-width="4"`)+E(22,73,10,12,'none',`stroke="${accent}" stroke-width="4"`)+C(48+d,48,4,accent),
      P(`M18 28Q48 ${3+d} 79 28L69 43L61 37V80H36V37L27 43Z`,ink)+S('M36 54Q49 65 61 54M48 19V31',accent,3.5)+S('M40 74H57','#ffffff',2)
    ]);break;
    case 'music': g=S('M26 70V29L69 17V58',ink,6)+E(17,72,12,9)+E(60,60,12,9)+S(`M28 ${39+d}L68 28`,accent,5);break;
    case 'event': g=choose([
      S('M23 70V44Q23 18 48 18Q73 18 73 44V70',ink,3.5)+S('M32 70V45Q32 28 48 28Q64 28 64 45V70',accent,2.6)+S('M16 78H80',ink,3)+P(`M49 ${35+d}L53 46L65 48L53 52L49 65L45 52L33 48L45 46Z`),
      C(37,49,21,'none',`stroke="${ink}" stroke-width="4"`)+C(59,49,21,'none',`stroke="${accent}" stroke-width="4"`)+P(`M48 ${9+d}L53 22L66 26L53 30L48 42L44 30L31 26L44 22Z`),
      P(`M49 ${12+d}L58 35L83 43L58 53L49 79L39 53L14 43L39 35Z`)+C(75,18,4,ink)+C(18,72,3,ink)
    ]);break;
    case 'tattoo': g=choose([
      P(`M48 ${11+d}L56 35L81 43L57 52L48 81L39 53L14 43L39 35Z`,ink)+S('M48 28V62M34 43H62',accent,2.5)+C(20,73,3,accent)+C(77,73,3,accent),
      S(`M48 ${14+d}L78 46L48 81L18 46Z`,ink,3.5)+P('M48 24L55 41L70 46L55 51L48 70L41 51L26 46L41 41Z')+S('M48 4V9M48 86V91',ink,2),
      S('M20 24L73 77M25 19L78 72',ink,3)+P(`M26 19L37 ${30+d}L25 42L14 31Z`)+P('M60 66L71 55L81 76L76 81Z',ink)+S('M19 79L77 21',accent,4),
      P(`M48 ${12+d}C55 31 73 34 75 47C78 62 60 69 48 82C36 69 18 62 21 47C23 34 41 31 48 ${12+d}Z`,ink)+P('M48 31L61 47L48 65L35 47Z')+C(48,47,4,'#ffffff'),
      S('M48 13C32 22 20 31 20 47C20 63 32 73 48 83C64 73 76 63 76 47C76 31 64 22 48 13Z',ink,3.5)+P(`M48 ${25+d}L55 42L68 47L55 52L48 70L41 52L28 47L41 42Z`)
    ]);break;
    case 'piercing': g=C(48,48,26,'none',`stroke="${accent}" stroke-width="5" stroke-dasharray="135 29" transform="rotate(-40 48 48)"`)+C(69,30,6,ink)+C(49,22,6,ink)+P(`M48 ${36+d}L52 45L62 48L52 52L48 62L44 52L34 48L44 45Z`,ink);break;
    case 'nails': g=choose([
      S(`M32 69V35Q32 ${12+d} 49 12Q66 12 66 35V69Q49 83 32 69Z`,ink,3.3)+P('M38 35Q38 20 49 20Q60 20 60 35V55Q49 64 38 55Z')+S('M20 80Q48 89 77 77',accent,2.5),
      S('M24 76V40Q24 17 42 17Q59 17 59 40V70',ink,3.3)+S(`M38 78V${43+d}Q38 29 53 29Q69 29 69 46V78`,accent,3.3)+P('M75 16L78 25L87 28L78 31L75 40L72 31L63 28L72 25Z'),
      P('M32 13H64V32H32Z',ink)+R(22,34,52,47,12)+S(`M31 47Q48 ${33+d} 65 47M31 57H53`,'#ffffff',2.3)
    ]);break;
    case 'makeup': g=S('M24 78L61 28',ink,9)+P(`M54 25L64 ${10+d}Q80 12 84 27L69 39Z`)+S('M15 80H79',accent,2)+P('M22 20L26 31L37 35L26 39L22 50L18 39L7 35L18 31Z');break;
    case 'beauty': g=S(`M48 ${14+d}C16 30 14 66 48 82C82 66 80 30 48 ${14+d}Z`,ink,3)+P('M48 72C25 58 30 38 48 26C66 38 71 58 48 72Z')+S('M48 35V69','#ffffff',2.5);break;
    case 'animal': g=choose([
      E(28,34,8,12,accent,`transform="rotate(-25 28 34)"`)+E(44,23+d,8,12)+E(62,27,8,12,accent,`transform="rotate(12 62 27)"`)+E(76,43,7,11,accent,`transform="rotate(30 76 43)"`)+P('M48 43C35 43 21 59 24 71C27 82 39 76 49 76C59 76 71 82 75 71C79 59 62 43 48 43Z',ink),
      S('M24 24L42 36H58L75 23V59Q75 80 49 80Q23 80 23 59Z',ink,3.5)+P(`M32 34L42 42L31 ${54+d}Z`)+P('M66 35L57 43L68 54Z')+P('M41 60H57L49 69Z',ink)+C(38,52,2,ink)+C(61,52,2,ink),
      S('M20 29L32 17L48 28L64 17L78 29V59Q78 82 49 82Q20 82 20 59Z',ink,4)+P(`M49 ${40+d}C37 31 29 43 35 51L49 65L63 51C69 43 61 31 49 ${40+d}Z`),
      P(`M18 21L36 29L49 ${18+d}L61 29L80 21L74 61Q64 82 49 83Q31 81 23 61Z`,ink)+P('M49 44C35 35 28 48 37 57L49 69L61 57C70 48 62 35 49 44Z'),
      E(34,28,8,11)+E(62,28,8,11)+E(20,46,7,10)+E(76,46,7,10)+P(`M48 ${41+d}C38 41 24 62 27 74C30 84 42 76 48 76C54 76 66 84 69 74C72 62 58 41 48 ${41+d}Z`,ink)
    ]);break;
    case 'wellness': g=choose([
      S(`M48 ${13+d}C32 30 29 48 48 65C67 48 64 30 48 ${13+d}Z`,accent,3)+S('M48 77C23 77 11 58 14 36C34 40 48 52 48 77ZM48 77C73 77 85 58 82 36C62 40 48 52 48 77Z',ink,3),
      S(`M18 62C21 ${23+d} 75 23 78 62M27 68C29 36 67 36 69 68M37 74C38 49 58 49 59 74`,accent,3.4)+C(48,19,5,ink),
      P(`M48 ${13+d}C79 31 86 63 48 82C10 63 17 31 48 ${13+d}Z`,accent)+S('M49 73C26 54 39 32 54 28M35 49Q52 43 63 56','#ffffff',2.8),
      S('M20 57C8 33 24 14 45 19C68 3 90 31 74 52C82 73 58 88 42 77C22 84 10 68 20 57Z',accent,3)+S(`M28 57Q48 ${30+d} 68 57M34 68Q48 52 61 68`,ink,3),
      C(48,48,32,'none',`stroke="${ink}" stroke-width="2.6"`)+S(`M29 61Q48 ${26+d} 68 61M37 68Q48 47 59 68`,accent,3.4)+C(48,30,5,accent)
    ]);break;
    case 'sport': g=choose([
      C(58,18+d,7)+S('M51 33L38 52L58 62L48 82M40 48L27 65L14 67M46 38L67 44L79 29',ink,6)+P('M20 27L40 17L31 36Z'),
      P(`M15 65L39 ${21+d}H54L29 65Z`)+P('M48 65L68 30H82L62 65Z',ink)+S('M16 78H81',ink,4),
      S('M20 48H77M23 30V66M33 37V59M66 37V59M76 30V66',ink,7)+P(`M48 ${10+d}L55 24H41ZM48 85L55 72H41Z`),
      C(50,19,7)+S(`M23 37L48 ${44+d}L75 34M48 44V61L29 81M48 61L67 81`,ink,6)+S('M18 22L31 28M69 24L79 15',accent,3),
      P('M17 67L37 29H53L42 48H58L68 29H83L62 67H47L56 51H41L32 67Z',ink)+S(`M20 ${19+d}H77M20 79H77`,accent,4)
    ]);break;
    case 'personal': g=S(`M17 43L48 ${17+d}L79 43M25 43V78H71V43`,ink,4)+P('M48 47C37 37 29 48 35 56L48 69L61 56C67 48 59 37 48 47Z');break;
    case 'clean': g=choose([
      P(`M48 ${10+d}L57 34L82 43L57 52L48 80L39 52L14 43L39 34Z`)+S('M20 76L28 68M72 19L80 11',ink,3)+C(78,75,4,ink),
      S('M21 76V32L33 20H70V76Z',ink,4)+P(`M48 ${31+d}L53 43L66 48L53 53L48 67L43 53L30 48L43 43Z`)+S('M30 83H65',ink,3),
      S('M17 58Q48 83 79 58M25 72Q48 89 71 72',ink,4)+P(`M49 ${11+d}L56 31L77 38L57 46L49 67L41 47L20 38L41 31Z`),
      P(`M48 ${12+d}C38 27 22 42 22 58A26 26 0 0 0 74 58C74 42 58 27 48 ${12+d}Z`,ink)+P('M48 40L52 51L63 55L52 59L48 70L44 59L33 55L44 51Z'),
      S('M17 78L64 20',ink,6)+P(`M23 56L42 73L26 ${87+d}L9 72Z`)+S('M53 38L71 51',accent,4)+P('M72 13L76 24L87 28L76 32L72 43L68 32L57 28L68 24Z')
    ]);break;
    case 'appliance': g=R(22,14,52,70,6,ink)+C(48,53,19,accent)+C(48,53,11,'none','stroke="#ffffff" stroke-width="2.5"')+C(32,24,2,'#ffffff')+S(`M43 ${24+d}H64`,'#ffffff',2);break;
    case 'phone': g=R(24,13,48,71,7,ink)+R(30,23,36,47,2)+S('M40 77H56','#ffffff',3)+S(`M39 46L46 ${54+d}L59 38`,'#ffffff',3);break;
    case 'computer': g=S('M18 65V21H78V65ZM11 78H85L78 65H18Z',ink,4)+P(`M49 ${29+d}L55 41L68 46L55 51L49 65L43 51L30 46L43 41Z`);break;
    case 'tech': g=choose([
      R(24,13,48,71,7,ink)+R(30,23,36,47,2)+S('M40 77H56','#ffffff',3)+S(`M39 46L46 ${54+d}L59 38`,'#ffffff',3),
      S('M18 65V21H78V65ZM11 78H85L78 65H18Z',ink,4)+P(`M49 ${29+d}L55 41L68 46L55 51L49 65L43 51L30 46L43 41Z`),
      R(22,14,52,70,6,ink)+C(48,53,19,accent)+C(48,53,11,'none','stroke="#ffffff" stroke-width="2.5"')+C(32,24,2,'#ffffff')+S(`M43 ${24+d}H64`,'#ffffff',2),
      S('M27 18H70V78H27ZM16 30H27M16 47H27M16 65H27M70 30H81M70 47H81M70 65H81',ink,4)+P(`M49 ${29+d}L61 48L49 67L37 48Z`),
      S('M20 49A28 28 0 1 1 48 77M20 49V29M20 49H40',ink,4.5)+P(`M49 ${28+d}L55 42L69 48L55 54L49 69L43 54L29 48L43 42Z`)
    ]);break;
    case 'car': g=choose([
      S(`M14 59L20 39L34 ${26+d}H61L76 40L82 59M14 59V69H82V59M23 70V78M73 70V78`,ink,5)+S('M25 42H71',accent,4)+S('M21 56H31M64 56H74',accent,4),
      S('M14 60L26 36H62L81 60',ink,5)+S('M18 61H78M26 78H71',ink,4)+P(`M49 ${13+d}L56 30H42Z`)+C(29,61,8)+C(69,61,8),
      C(48,48,29,'none',`stroke="${ink}" stroke-width="6"`)+C(48,48,7,accent)+S('M23 35L41 43M74 35L55 43M48 56V77',accent,6)+S(`M31 ${14+d}H65`,accent,3),
      S('M16 63L25 38H67L80 63M16 63H80M23 63V78M73 63V78',ink,5)+S(`M31 ${28+d}H60`,accent,4)+S('M25 53H34M63 53H72',accent,4),
      P(`M15 60L33 ${25+d}H63L82 60H67L56 39H40L28 60Z`,ink)+S('M17 73H80',accent,7)+S('M30 84H65',accent,3)
    ]);break;
    case 'bike': g=C(23,63,17,'none',`stroke="${ink}" stroke-width="4"`)+C(75,63,17,'none',`stroke="${ink}" stroke-width="4"`)+S(`M23 63L38 ${33+d}L52 63H23M38 ${33+d}H64L52 63M75 63L61 22H72M31 26H46`,accent,4);break;
    case 'bakery': g=S('M24 78L29 31Q32 13 48 13Q65 13 68 31L73 78Z',ink,4)+S(`M35 37L57 ${27+d}M37 53L61 41M39 69L65 55`,accent,5);break;
    case 'butcher': g=P(`M19 19H71V52Q71 65 57 65H19Z`,ink)+R(63,61,13,24,5)+C(28,28,3,'#ffffff')+S(`M26 ${52+d}H63`,'#ffffff',2.4);break;
    case 'food': g=S('M16 69H80M20 61Q20 30 48 30Q76 30 76 61ZM48 30V21M41 21H55M25 80H71',ink,4)+S(`M35 49Q40 ${39+d} 49 39`,accent,3.5);break;
    case 'repair': g=choose([
      S('M21 78L61 38',ink,11)+S(`M63 ${15+d}C41 14 34 39 50 49C65 60 85 43 79 29L66 40L55 29Z`,accent,5)+C(22,76,3,'#ffffff'),
      S('M21 76L68 23',ink,9)+P(`M42 25L57 ${10+d}L84 35L68 51Z`)+S('M20 21L31 32M68 70L80 82',accent,3),
      P(`M16 35L48 ${13+d}L81 35V67L48 85L16 67Z`,ink)+S('M31 60L48 35L65 60M37 52H59',accent,5)
    ]);break;
    case 'interiors': g=choose([
      S('M20 80V43Q20 15 48 15Q76 15 76 43V80M33 80V44Q33 28 48 28Q63 28 63 44V80',accent,3.5)+S(`M14 ${81+d}H82`,ink,3),
      P(`M19 78V41Q19 ${12+d} 47 12H55V78Z`,ink)+P('M46 78V47Q46 31 64 31H78V78Z')+S('M27 80H83',ink,3),
      R(19,50,58,24,8,ink)+S('M27 50V38Q27 29 37 29H59Q69 29 69 38V50M25 74V83M71 74V83',accent,5)+S(`M16 ${15+d}H80`,accent,2.4),
      S('M17 79V17H79V79M17 79H79',ink,3)+P(`M28 68V44Q28 ${25+d} 47 25Q66 25 66 44V68Z`)+S('M47 27V68','#ffffff',2.5),
      P('M15 31L46 13V79L15 62Z',ink)+P(`M53 ${24+d}L82 41V80L53 63Z`)+S('M29 36V56M66 45V59','#ffffff',2.5)
    ]);break;
    case 'creative':
    case 'abstract': default: g=choose([
      P(`M48 ${12+d}L72 36L48 60L24 36Z`)+P('M24 45L48 69L72 45V62L48 86L24 62Z',ink),
      S(`M19 63V${31+d}L48 14L77 31V64L48 82Z`,ink,4)+S('M32 56L48 31L65 56M39 49H58',accent,5),
      P(`M17 22H43V48H17ZM50 ${15+d}H76V41H50ZM24 55H50V81H24ZM57 48H83V74H57Z`,ink)+P('M24 55H50V81H24Z'),
      S(`M22 64V33Q22 ${15+d} 40 15H64V41Q64 58 47 58H22M42 36H75V63Q75 81 57 81H32V57`,accent,5),
      P(`M16 61L42 ${15+d}H57L31 61Z`,ink)+P('M40 81L66 35H81L55 81Z')+S('M19 74H29M68 22H78',ink,3)
    ]);
  }
  return `<g stroke-miterlimit="10">${g}</g>`;
}

// Explicit, conservative text metrics. SVG textLength makes width deterministic
// across Arial/Georgia-compatible browser fonts; all names remain complete.
function glyphWidth(c, family) {
  if(/[ilI1.,'’!|:;]/.test(c)) return .29;
  if(/[mwMW@%&]/.test(c)) return .86;
  if(c===' ') return .27;
  if(/[A-ZÀ-Ý]/.test(c)) return family==='serif'?.67:.66;
  if(/[0-9]/.test(c)) return .56;
  return family==='serif'?.49:.53;
}
function units(s,family){return [...s].reduce((a,c)=>a+glyphWidth(c,family),0);}
function linesFor(name, family) {
  const ws = name.split(/\s+/).filter(Boolean);
  const count = units(name,family) <= 15.5 ? 1 : units(name,family) <= 31 ? 2 : 3;
  if(count===1) return [name];
  let best=null;
  const evalLines = lines => {
    const lengths=lines.map(s=>units(s,family));
    const longest=Math.max(...lengths);
    const spread=longest-Math.min(...lengths);
    const orphan=lines.some(s=>s.length<3)?12:0;
    const score=longest+spread*.3+orphan;
    if(!best||score<best.score)best={lines,score};
  };
  if(count===2||ws.length<3){for(let i=1;i<ws.length;i++)evalLines([ws.slice(0,i).join(' '),ws.slice(i).join(' ')]);}
  else {for(let i=1;i<ws.length-1;i++)for(let j=i+1;j<ws.length;j++)evalLines([ws.slice(0,i).join(' '),ws.slice(i,j).join(' '),ws.slice(j).join(' ')]);}
  return best?.lines || [name];
}
function build(p){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug))throw Error(`Unsafe slug ${p.slug}`);
  const theme=palettes[p.theme]?p.theme:'services';
  const palette=palettes[theme];
  const seed=hash(`${p.name}\n${p.city}\n${p.activity}`);
  const accent=/^#[0-9a-f]{6}$/i.test(p.accent||'')?p.accent:palette.colors[(seed>>>12)%palette.colors.length];
  const trade=tradeFor(p);
  const family=['tattoo','electric','plumbing','heating','roof','wood','tile','plaster','building','car','bike','sport','tech','appliance','phone','computer','clean','repair'].includes(trade.motif)?'sans':palette.family;
  const font=family==='serif'?"Georgia, 'Times New Roman', serif":"Arial, Helvetica, sans-serif";
  const lines=linesFor(p.name,family);
  const fontSize=lines.length===1?30:lines.length===2?27:22;
  const lineHeight=lines.length===3?25:31;
  const widths=lines.map(s=>n(units(s,family)*fontSize));
  const textWidth=Math.min(Math.max(...widths),354);
  const width=Math.ceil(94+textWidth+8);
  const height=104;
  const mark=emblem(trade.motif,seed,accent,palette.ink);
  const title=`Proposition de logo pour ${p.name}`;
  const y=lines.length===1?61:lines.length===2?45:33;
  const weight=family==='serif'?'500':'700';
  const texts=lines.map((line,i)=>`<text x="94" y="${y+i*lineHeight}" textLength="${n(widths[i]>354?354:widths[i])}" lengthAdjust="spacingAndGlyphs">${esc(line)}</text>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="logo-title"><title id="logo-title">${esc(title)}</title><g transform="translate(0 4) scale(.91)">${mark}</g><g fill="${palette.ink}" font-family="${font}" font-size="${fontSize}" font-weight="${weight}">${texts}</g></svg>\n`;
  const icon=`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-labelledby="logo-title"><title id="logo-title">${esc(title)}</title>${mark}</svg>\n`;
  fs.writeFileSync(path.join(out,`${p.slug}.svg`),svg);
  fs.writeFileSync(path.join(out,`${p.slug}-icon.svg`),icon);
  return {src:`/images/prospects/logos/${p.slug}.svg`,iconSrc:`/images/prospects/logos/${p.slug}-icon.svg`,alt:title,width,height,origin:'proposed',motif:trade.motif,designBasis:trade.basis,theme,accent,textLines:lines.length};
}

const manifest=Object.fromEntries(prospects.map(p=>[p.slug,build(p)]));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const themes=Object.fromEntries(Object.keys(palettes).map(theme=>[theme,prospects.filter(p=>p.theme===theme).length]));
const motifs={};for(const row of Object.values(manifest))motifs[row.motif]=(motifs[row.motif]||0)+1;
const report={version:1,createdAt:'2026-10-17',prospects:prospects.length,assets:prospects.length*2,origin:'proposed',background:'transparent',text:'Full exact public business names; responsive 1–3 lines; bounded textLength.',themes,motifs,sourcePolicy:'Only public name, activity, city, theme and optional accent are read. No CRM identifier, contact detail, qualification or certification is included.',designPolicy:'Original native SVG proposals. Explicit trade vocabulary selects the emblem; name/city/activity determine stable geometric variations. No inference from surnames; unknown trade uses an abstract mark. Authentic verified logos must replace proposals in the integration manifest.',fontPolicy:'System Arial/Helvetica or Georgia/Times; no remote fonts or licensing dependency.'};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');

const picks=[];
for(const theme of Object.keys(palettes)){
  const candidates=prospects.filter(p=>p.theme===theme);
  const first=candidates.find(p=>p.batch==='pilot-10')||candidates[0];
  picks.push(first);
  picks.push(candidates.find(p=>manifest[p.slug].motif!==manifest[first.slug].motif&&p.name.length<45)||candidates.find(p=>p!==first));
}
const cards=picks.filter(Boolean).map(p=>{
  const logo=manifest[p.slug]; const bg=palettes[p.theme].paper;
  return `<article style="--paper:${bg}"><div class="label">${esc(p.theme)} <span>${esc(logo.motif)}</span></div><div class="brand"><img src="generated/${p.slug}.svg" alt="${esc(logo.alt)}"/></div><div class="mobile"><img src="generated/${p.slug}-icon.svg" alt=""/><div><span>À 200 pixels</span><img src="generated/${p.slug}.svg" alt="${esc(logo.alt)}"/></div></div><p>${esc(p.name)}</p><small>${esc(p.activity)}</small></article>`;
}).join('');
const longest=prospects.toSorted((a,b)=>b.name.length-a.name.length).slice(0,6).map(p=>`<article class="long"><div class="brand"><img src="generated/${p.slug}.svg" alt="${esc(p.name)}"/></div><p>${esc(p.name)}</p></article>`).join('');
const html=`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Flex-Web — propositions de logos</title><style>*{box-sizing:border-box}body{margin:0;background:#edece6;color:#202826;font-family:Arial,Helvetica,sans-serif}header{padding:46px 48px 30px}header p{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#52645c}h1{font-family:Georgia,serif;font-weight:400;font-size:38px;margin:12px 0}header small{font-size:14px;color:#58615b}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:0 40px 40px}article{padding:20px;background:var(--paper,#faf9f5);border:1px solid #dadbd3;min-width:0}.label{display:flex;justify-content:space-between;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#647267}.label span{color:#8b918a}.brand{height:128px;display:flex;align-items:center}.brand img{max-width:100%;max-height:92px}.mobile{border-top:1px solid #d9ddd4;padding-top:18px;display:flex;gap:15px;align-items:center}.mobile>img{width:27px;height:27px}.mobile>div>span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.13em;color:#849087;margin-bottom:3px}.mobile>div>img{width:200px;max-height:58px;object-fit:contain;object-position:left}article p{font-size:12px;margin:18px 0 5px}article small{font-size:10px;color:#67756c;line-height:1.5}h2{font-family:Georgia,serif;font-weight:400;font-size:27px;margin:0 42px 24px}.long .brand img{width:220px}.long .brand{height:100px}footer{padding:0 42px 38px;font-size:12px;color:#5a655d}@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.grid{grid-template-columns:1fr;padding:0 20px 20px}header{padding:25px}h1{font-size:30px}}</style><header><p>Flex-Web / identité visuelle</p><h1>Propositions de logos.</h1><small>18 exemples couvrant les 9 univers · SVG transparents · aperçu desktop et mobile · aucun logo présenté comme officiel.</small></header><section class="grid">${cards}</section><h2>Vérification des noms longs</h2><section class="grid">${longest}</section><footer>564 propositions originales · 1 128 fichiers SVG · noms complets · version emblème pour favicon · variantes géométriques stables.</footer></html>`;
fs.writeFileSync(path.join(path.dirname(out),'design-preview.html'),html);
console.log(JSON.stringify({output:out,...report},null,2));
