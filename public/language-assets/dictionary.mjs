const marker = /\{[pn]\d+\}/g;
const norm = text => text.trim().replace(/\s+/gu, ' ');
const esc = text => text.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
const amount = '(?:https?://[^\\s<>]+|2[AB]\\d{3}|(?:\\+33\\s*|0)[1-9](?:[ .-]*[0-9]{2}){4}|\\+?\\d+(?: \\d{3})*(?:[.,:/-]\\d+)*(?:\\s*(?:€|EUR|%))?)';
function originalSpan(raw, from, to) {
  const clean=raw.trim();
  if (!/[^\S ]| {2,}/u.test(clean)) return clean.slice(from,to);
  const boundaries=[0];
  for(const match of clean.matchAll(/\s+|[^\s]/gu)) {
    // Regex indices use UTF-16 offsets, including for astral code points.
    const length=match[0].trim()?match[0].length:1;
    for(let i=1;i<=length;i++)boundaries.push(i===length?match.index+match[0].length:match.index+i);
  }
  return clean.slice(boundaries[from],boundaries[to]);
}
const words = text => text.toLowerCase().match(/[\p{L}]{2,}/gu) || [];

// Only match public phrases shipped with this release. Values such as a town,
// amount or phone number are copied verbatim from the original text.
export function makeDictionary(entries) {
  const direct = new Map(), index = new Map();
  for (const [source, target] of Object.entries(entries)) {
    const tokens = source.match(marker);
    if (!tokens) { direct.set(norm(source),target); continue; }
    const literals = source.split(marker);
    const anchor = words(literals.join(' ')).sort((a,b) => b.length-a.length)[0];
    if (!anchor || tokens.length > 14) continue;
    const regex = new RegExp('^' + literals.map((piece,i) => esc(piece) +
      (i < tokens.length ? (tokens[i][1] === 'n' ? '('+amount+')' : '([^\\n<>]{1,120}?)') : '')).join('') + '$', 'du');
    // City names may span multiple words. Bound ambiguous adjacent slots and prefer
    // the phrase with the most literal context when different templates could fit.
    if (tokens.filter(t=>t[1]==='p').length > 5 && literals.some((s,i)=>i>0 && i<tokens.length && !s.trim())) continue;
    if (!index.has(anchor)) index.set(anchor,[]);
    index.get(anchor).push({regex,tokens,target,weight:literals.join('').length});
  }
  for (const list of index.values()) list.sort((a,b)=>b.weight-a.weight);
  const cache = new Map();
  return input => {
    const key = norm(input);
    if (!key || key.length>9000) return input;
    if (!cache.has(input)) {
      let translated = direct.get(key);
      if (translated === undefined) {
        const candidates = [...new Set(words(key))].flatMap(word=>index.get(word) || []).sort((a,b)=>b.weight-a.weight);
        for (const item of candidates) {
          const match = item.regex.exec(key);
          if (!match) continue;
          const protectedValues = new Map(item.tokens.map((token,i)=>[token,originalSpan(input,...match.indices[i+1])]));
          translated = item.target.replace(marker,token=>protectedValues.get(token) ?? token);
          break;
        }
      }
      cache.set(input,translated ?? null);
    }
    const value = cache.get(input);
    return value === null ? input : input.replace(/^(\s*)[\s\S]*?(\s*)$/u,(_all,before,after)=>before+value+after);
  };
}
