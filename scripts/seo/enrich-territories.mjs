import {readFile, stat, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const SOURCE_URL = 'https://geo.api.gouv.fr/communes?fields=nom,code,codesPostaux,codeDepartement,codeRegion,population,departement,region,centre,surface,epci&format=json';
const EARTH_RADIUS_KM = 6371.0088;
const radians = degrees => degrees * Math.PI / 180;
const compareCodes = (a, b) => a.code.localeCompare(b.code, 'en');

export function coordinatesOf(commune) {
  const pair = commune.centre?.type === 'Point' && commune.centre.coordinates;
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const [longitude, latitude] = pair;
  return Number.isFinite(longitude) && Number.isFinite(latitude)
    && Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90
    ? {longitude, latitude} : null;
}

export function normalizedName(name) {
  return String(name ?? '').normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/[’‘]/g, "'").replace(/[‐‑‒–—]/g, '-')
    .trim().toLocaleLowerCase('fr').replace(/\s+/g, ' ');
}

function spherePoint(coordinates) {
  const latitude = radians(coordinates.latitude), longitude = radians(coordinates.longitude);
  const cosLatitude = Math.cos(latitude);
  return [cosLatitude * Math.cos(longitude), cosLatitude * Math.sin(longitude), Math.sin(latitude)];
}

export function haversineKm(a, b) {
  const latitudeA = radians(a.latitude), latitudeB = radians(b.latitude);
  const halfLat = Math.sin((latitudeB - latitudeA) / 2);
  const halfLon = Math.sin(radians(b.longitude - a.longitude) / 2);
  const haversine = Math.min(1, Math.max(0,
    halfLat * halfLat + Math.cos(latitudeA) * Math.cos(latitudeB) * halfLon * halfLon));
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

// Chord distance on the unit sphere increases with spherical distance. A 3D
// kd-tree therefore finds the same nearest centres without a pairwise scan.
export function makeTree(entries, depth = 0) {
  if (!entries.length) return null;
  const axis = depth % 3;
  entries.sort((a, b) => a.point[axis] - b.point[axis] || compareCodes(a, b));
  const middle = Math.floor(entries.length / 2);
  return {
    entry: entries[middle], axis,
    left: makeTree(entries.slice(0, middle), depth + 1),
    right: makeTree(entries.slice(middle + 1), depth + 1),
  };
}

export function nearestEntries(tree, target, count = 3) {
  const best = [];
  function visit(node) {
    if (!node) return;
    const delta = target.point[node.axis] - node.entry.point[node.axis];
    const near = delta <= 0 ? node.left : node.right;
    const far = delta <= 0 ? node.right : node.left;
    visit(near);
    if (node.entry.code !== target.code) {
      const distanceSquared = node.entry.point.reduce((sum, value, axis) =>
        sum + (value - target.point[axis]) ** 2, 0);
      best.push({entry: node.entry, distanceSquared});
      best.sort((a, b) => a.distanceSquared - b.distanceSquared || compareCodes(a.entry, b.entry));
      if (best.length > count) best.pop();
    }
    if (best.length < count || delta * delta <= best.at(-1).distanceSquared) visit(far);
  }
  visit(tree);
  return best.map(item => item.entry);
}

function communeReference(commune) {
  return {
    code: commune.code,
    name: commune.nom,
    departmentCode: commune.codeDepartement ?? commune.departement?.code ?? null,
    department: commune.departement?.nom ?? null,
    postalCodes: Array.isArray(commune.codesPostaux) ? [...new Set(commune.codesPostaux)].sort() : [],
  };
}

export function enrichTerritories(raw, selected) {
  if (!Array.isArray(raw) || !raw.length || !Array.isArray(selected) || !selected.length)
    throw new Error('Both official source and selected communes must be non-empty arrays');
  const byCode = new Map(), postalIndex = new Map(), nameIndex = new Map();
  const points = [];
  for (const commune of raw) {
    if (!/^[0-9AB]{5}$/.test(commune.code) || typeof commune.nom !== 'string')
      throw new Error('Invalid official commune identity');
    if (byCode.has(commune.code)) throw new Error(`Duplicate official code: ${commune.code}`);
    byCode.set(commune.code, commune);
    for (const postalCode of new Set(commune.codesPostaux ?? [])) {
      if (!postalIndex.has(postalCode)) postalIndex.set(postalCode, []);
      postalIndex.get(postalCode).push(commune);
    }
    const name = normalizedName(commune.nom);
    if (!nameIndex.has(name)) nameIndex.set(name, []);
    nameIndex.get(name).push(commune);
    const coordinates = coordinatesOf(commune);
    if (coordinates) points.push({code: commune.code, commune, coordinates, point: spherePoint(coordinates)});
  }
  if (new Set(selected.map(commune => commune.code)).size !== selected.length)
    throw new Error('Duplicate selected commune code');
  for (const group of [...postalIndex.values(), ...nameIndex.values()]) group.sort(compareCodes);
  const tree = makeTree([...points]);
  const pointIndex = new Map(points.map(point => [point.code, point]));
  const communes = selected.map(selection => {
    const source = byCode.get(selection.code);
    if (!source) throw new Error(`Selected commune absent from official source: ${selection.code}`);
    const coordinates = coordinatesOf(source);
    const point = pointIndex.get(selection.code);
    const epci = typeof source.epci?.code === 'string' && typeof source.epci?.nom === 'string'
      ? {code: source.epci.code, name: source.epci.nom} : null;
    return {
      code: selection.code,
      coordinates,
      surfaceKm2: Number.isFinite(source.surface) && source.surface > 0
        ? Number((source.surface / 100).toFixed(6)) : null,
      epci,
      postalGroups: [...new Set(source.codesPostaux ?? [])].sort().map(postalCode => {
        const group = postalIndex.get(postalCode) ?? [];
        return {
          postalCode,
          totalCommunes: group.length,
          others: group.filter(commune => commune.code !== source.code).slice(0, 5).map(communeReference),
        };
      }),
      homonyms: (nameIndex.get(normalizedName(source.nom)) ?? [])
        .filter(commune => commune.code !== source.code).map(communeReference),
      nearby: point ? nearestEntries(tree, point, 3).map(neighbour => ({
        ...communeReference(neighbour.commune),
        distanceKm: Number(haversineKm(coordinates, neighbour.coordinates).toFixed(2)),
      })) : [],
    };
  });
  return {communes, points, pointIndex, tree};
}

export function validateNearestSamples({communes, points, pointIndex, tree}) {
  // Independent exhaustive haversine reference, including mainland, Corsica and
  // overseas entries when those locations belong to the selected catalogue.
  const codes = new Set(communes.filter((_, index) => index % 997 === 0).map(commune => commune.code));
  for (const prefix of ['2A', '2B', '971', '972', '973', '974', '976']) {
    const commune = communes.find(item => item.code.startsWith(prefix));
    if (commune) codes.add(commune.code);
  }
  let checked = 0;
  for (const code of codes) {
    const target = pointIndex.get(code);
    if (!target) continue;
    const brute = points.filter(point => point.code !== code).map(point => ({
      code: point.code,
      distance: haversineKm(target.coordinates, point.coordinates),
    })).sort((a, b) => a.distance - b.distance || compareCodes(a, b)).slice(0, 3).map(point => point.code);
    const indexed = nearestEntries(tree, target, 3).map(point => point.code);
    if (brute.join(',') !== indexed.join(','))
      throw new Error(`Nearest-centre validation failed for ${code}: ${indexed} vs ${brute}`);
    checked++;
  }
  return checked;
}

async function main() {
  const sourcePath = process.argv[2];
  if (!sourcePath) throw new Error('Provide the official geo.api.gouv.fr communes enrichment snapshot');
  const sourceBytes = await readFile(sourcePath);
  const raw = JSON.parse(sourceBytes);
  const catalogue = JSON.parse(await readFile('src/data/national/territorial-drafts.json', 'utf8'));
  const started = performance.now();
  const enriched = enrichTerritories(raw, catalogue.communes);
  const validatedSamples = validateNearestSamples(enriched);
  const {communes} = enriched;
  if (communes.length !== 9994 || communes.some((commune, index) => commune.code !== catalogue.communes[index].code))
    throw new Error('The existing catalogue must retain its exact 9,994 codes and order');
  const coverage = {
    sourceCommunes: raw.length,
    sourceWithCoordinates: enriched.points.length,
    selectedCommunes: communes.length,
    coordinates: communes.filter(c => c.coordinates).length,
    surfaceKm2: communes.filter(c => c.surfaceKm2 !== null).length,
    epci: communes.filter(c => c.epci).length,
    postalGroups: communes.filter(c => c.postalGroups.length).length,
    sharedPostalCodes: communes.filter(c => c.postalGroups.some(group => group.totalCommunes > 1)).length,
    withHomonyms: communes.filter(c => c.homonyms.length).length,
    withThreeNearby: communes.filter(c => c.nearby.length === 3).length,
    nearestBruteForceSamples: validatedSamples,
  };
  const result = {
    version: 1,
    retrievedAt: (await stat(sourcePath)).mtime.toISOString().slice(0, 10),
    source: SOURCE_URL,
    sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
    publicationStatus: 'draft-enrichment-only',
    method: {
      selection: 'Exact same INSEE codes and order as territorial-drafts.json; no new page or URL selection.',
      nearest: 'Exact 3-nearest-centre search using a kd-tree on unit-sphere Cartesian coordinates. Final distances use the haversine formula, mean Earth radius 6371.0088 km, rounded to 0.01 km. Source coordinates have limited precision.',
      validation: `${validatedSamples} selected communes independently compared with an exhaustive haversine scan of all source communes with coordinates.`,
      postal: 'Group all source communes by every declared postal code. Counts include the current commune; examples exclude it and show at most five other communes sorted by INSEE code.',
      homonyms: 'Exact name equality after Unicode NFKD decomposition, accent removal, lowercase conversion, normalized typographic apostrophes/hyphens and whitespace. Other commune codes are preserved.',
      missing: 'Absent or invalid coordinates, area or complete EPCI identity remain null. Missing postal or neighbour lists remain empty. No value is inferred.',
    },
    definitions: {
      coordinates: 'Centre returned by geo.api.gouv.fr, longitude and latitude in decimal degrees; not the company address.',
      surfaceKm2: 'Official source surface, supplied in hectares, divided by 100. No population-density or commercial-demand inference.',
      epci: 'Intercommunal public body reported by the source; does not establish any commercial relationship.',
      postalGroups: 'Postal-code sharing is distinct from administrative identity or territorial adjacency.',
      homonyms: 'Other official communes with the same normalized name; not duplicate records of the current commune.',
      nearby: 'Three nearest returned commune centres in the entire source. Great-circle centre-to-centre distances are not road distances and do not imply shared borders, travel time or a local office.',
      editorialStatus: 'Factual data enrichment only; not an editorial review, search-demand measure, ranking promise or confirmation of indexation.',
    },
    coverage,
    communes,
  };
  const output = 'src/data/national/territorial-enrichment.json';
  await writeFile(output, JSON.stringify(result) + '\n');
  console.log(JSON.stringify({output, sourceSha256: result.sourceSha256, coverage, elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(2))}, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
