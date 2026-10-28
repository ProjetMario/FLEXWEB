#!/usr/bin/env python3
"""Prepare a deterministic, non-published France/Switzerland location inventory.

Input: the existing sourced French commune inventory and official FSO levels CSV.
This creates data only, not pages, sitemap entries or claims of local presence.
"""
import argparse
import csv
import hashlib
import json
import re
import unicodedata
from pathlib import Path

SWISS_SOURCE = 'https://www.agvchapp.bfs.admin.ch/api/communes/levels?labelLanguages=fr&date=01-01-2026&format=csv'
OFFICIAL_DOC = 'https://www.agvchapp.bfs.admin.ch/fr'
FR_TARGET_LOCATIONS = 15000

def digest(data):
    return hashlib.sha256(data).hexdigest()

def slug(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', text).strip('-')

def prepare(france_file, swiss_file):
    raw_france = france_file.read_bytes()
    raw_swiss = swiss_file.read_bytes()
    france = json.loads(raw_france)
    communes = france['communes']
    swiss = list(csv.DictReader(raw_swiss.decode('utf-8-sig').splitlines()))
    required = {'BfsCode','Name','Canton','CantonId','SPRGEB2020_fr'}
    if not swiss or not required.issubset(swiss[0]):
        raise ValueError('Unexpected Swiss official CSV columns')
    swiss_rows = []
    seen_swiss = set()
    for row in swiss:
        code = row['BfsCode'].strip()
        name = row['Name'].strip()
        if not code.isdigit() or not name or code in seen_swiss:
            raise ValueError(f'Invalid or duplicate Swiss commune: {code}')
        seen_swiss.add(code)
        swiss_rows.append({'country':'CH','code':code,'name':name,'area':row['Canton'].strip(),'areaCode':row['CantonId'].strip(),'languageArea':row['SPRGEB2020_fr'].strip()})
    swiss_rows.sort(key=lambda v:int(v['code']))
    required_fr = FR_TARGET_LOCATIONS - len(swiss_rows)
    if required_fr <= 0:
        raise ValueError('Swiss inventory exceeds target locations')
    fr_rows = []
    seen_fr = set()
    for row in communes:
        code, name = row['code'], row['name']
        if code in seen_fr:
            raise ValueError(f'Duplicate French commune: {code}')
        seen_fr.add(code)
        fr_rows.append({'country':'FR','code':code,'name':name,'area':row['department'],'areaCode':row['departmentCode'],'population':row.get('population')})
    fr_rows.sort(key=lambda v:(-(v['population'] or 0),v['code']))
    if len(fr_rows)<required_fr:
        raise ValueError('Not enough French communes')
    locations = fr_rows[:required_fr]+swiss_rows
    paths = set()
    for place in locations:
        place['slug'] = f"{slug(place['name'])}-{place['country'].lower()}-{place['code'].lower()}"
        if not slug(place['name']) or place['slug'] in paths:
            raise ValueError(f"Invalid or duplicate slug: {place['name']}")
        paths.add(place['slug'])
    return {
      'version':1,
      'status':'draft-not-published',
      'purpose':'Inventory for review; locations do not imply an office, customer, price, language support or service availability.',
      'sourceDate':'2026-01-01',
      'france':{'inventorySource':france.get('source'),'inventorySourceSha256':france.get('sourceSha256'),'inputSha256':digest(raw_france),'cogSources':france.get('cogSources'),'locations':required_fr},
      'switzerland':{'source':SWISS_SOURCE,'documentation':OFFICIAL_DOC,'inputSha256':digest(raw_swiss),'locations':len(swiss_rows)},
      'selection':'All Swiss communes in the official snapshot; French communes sorted by population descending then INSEE code.',
      'audiences':['particuliers','entreprises'],
      'candidateCount':len(locations)*2,
      'locations':locations,
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--france-json',type=Path,required=True)
    parser.add_argument('--swiss-csv',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    data=prepare(args.france_json,args.swiss_csv)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(json.dumps({'status':data['status'],'locations':len(data['locations']),'candidateCount':data['candidateCount'],'france':data['france']['locations'],'switzerland':data['switzerland']['locations']}))
if __name__=='__main__':
    main()
