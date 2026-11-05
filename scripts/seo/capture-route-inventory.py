#!/usr/bin/env python3
"""Capture published sitemap URL inventories; never infer HTTP or indexing status."""
import concurrent.futures
import gzip
import hashlib
import json
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
ARCHIVE = 'https://6ada6fce9a1d4bbb5d4cfa0b--flex-webb.netlify.app'
PUBLIC = 'https://flex-web.fr'
OUTPUT = Path('seo/inventories/published-2026-10-22-and-2026-11-05.json.gz')

def fetch_xml(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        if response.status != 200:
            raise ValueError(f'{url}: HTTP {response.status}')
        return ET.fromstring(response.read())

def capture(origin):
    index = fetch_xml(origin + '/sitemap.xml')
    children = [node.text for node in index.findall('sm:sitemap/sm:loc', NS)]
    if not children or len(children) != len(set(children)):
        raise ValueError(f'{origin}: invalid sitemap index')
    def read_child(child):
        parsed = urllib.parse.urlsplit(child)
        if parsed.scheme != 'https' or parsed.netloc != 'flex-web.fr':
            raise ValueError(f'Unexpected sitemap origin: {child}')
        root = fetch_xml(origin + parsed.path)
        urls = []
        for node in root.findall('sm:url/sm:loc', NS):
            url = urllib.parse.urlsplit(node.text)
            if url.scheme != 'https' or url.netloc != 'flex-web.fr' or url.query or url.fragment:
                raise ValueError(f'Unexpected page URL: {node.text}')
            urls.append(url.path)
        return urls
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        lists = list(pool.map(read_child, children))
    paths = [item for items in lists for item in items]
    if len(paths) != len(set(paths)):
        raise ValueError(f'{origin}: duplicate URL')
    return {'sitemaps': [urllib.parse.urlsplit(x).path for x in children], 'paths': sorted(paths)}

def main():
    historical = capture(ARCHIVE)
    current = capture(PUBLIC)
    actual = (len(historical['paths']), len(current['paths']), len(set(historical['paths']) | set(current['paths'])))
    expected = (121317, 50648, 151473)
    if actual != expected:
        raise ValueError(f'Published inventory changed: expected {expected}, observed {actual}; review before replacing baseline')
    manifest = {'schemaVersion': 1, 'capturedAt': '2026-11-05', 'canonicalOrigin': PUBLIC,
                'historical': {'deploy': ARCHIVE, 'sourceCommit': '29ac7d72958d3ca25250ed378b04c1e4f9178dc6', **historical},
                'current': {'sourceCommit': 'eadac9fc8329b4436e89ca5049ba9db53d6622a7', **current},
                'classification': 'Sitemap membership only: HTTP, canonical, noindex, redirects and retirements require separate verification.'}
    raw = (json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open('wb') as file:
        with gzip.GzipFile(filename='', fileobj=file, mode='wb', mtime=0) as zipped:
            zipped.write(raw)
    print(json.dumps({'historical': actual[0], 'current': actual[1], 'union': actual[2], 'historicalSitemaps': len(historical['sitemaps']), 'currentSitemaps': len(current['sitemaps']), 'sha256': hashlib.sha256(raw).hexdigest()}))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
