from pathlib import Path
import xml.etree.ElementTree as ET
from urllib.parse import urlsplit
ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
root = Path('dist')
index = ET.parse(root / 'sitemap.xml').getroot()
assert index.tag == '{%s}sitemapindex' % ns['s']
children = [node.text for node in index.findall('s:sitemap/s:loc', ns)]
urls = []
for url in children:
    parts = urlsplit(url)
    assert parts.netloc == 'flex-web.fr'
    content = ET.parse(root / parts.path.lstrip('/')).getroot()
    assert content.tag == '{%s}urlset' % ns['s']
    entries = [node.text for node in content.findall('s:url/s:loc', ns)]
    assert 0 < len(entries) <= 50000
    urls.extend(entries)
assert len(urls) == len(set(urls))
print({'xml': 'valid', 'childSitemaps': len(children), 'uniqueUrls': len(urls)})
