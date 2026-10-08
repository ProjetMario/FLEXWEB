// Netlify applies all matching _headers blocks to static responses. Preserve
// repeated X-Robots-Tag values: one restrictive value must still block release.
export function parseStaticHeaders(source = '') {
  const rules = [];
  let current;
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), robots: [] };
      rules.push(current);
      continue;
    }
    const match = /^\s*x-robots-tag\s*:\s*(.*)$/i.exec(line);
    if (match) {
      if (!current) throw new Error('X-Robots-Tag without a _headers path');
      current.robots.push(match[1]);
    }
  }
  return rules;
}

export function staticRobotsForUrl(url, rules) {
  const parsed = new URL(url);
  return rules.filter(({pattern}) => {
    // Header paths support splats and named placeholders. Matching is anchored
    // so a rule for /demarrer/ never leaks into /demarrer-autre/.
    const expression = pattern.split(/(\*|:[A-Za-z_][\w-]*)/).map(part =>
      part === '*' ? '.*' : part.startsWith(':') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    ).join('');
    const target = /^https?:\/\//.test(pattern) ? parsed.origin + parsed.pathname : parsed.pathname;
    return new RegExp('^' + expression + '$').test(target);
  }).flatMap(rule => rule.robots).join(', ');
}
