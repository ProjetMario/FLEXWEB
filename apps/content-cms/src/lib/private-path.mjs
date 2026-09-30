export function normalizePrivatePath(path) {
  let result = path;
  for (let depth = 0; depth < 3; depth++) {
    const decoded = decodeURIComponent(result);
    if (decoded === result) return result;
    result = decoded;
  }
  if (/%[0-9a-f]{2}/i.test(result)) throw new Error('INVALID_PATH');
  return result;
}

export function privateMediaPath(path) {
  const normalized = normalizePrivatePath(path);
  return normalized.startsWith('/_emdash/api/media/file/flexweb/') || normalized.startsWith('/_emdash/api/media/file/backups/');
}
