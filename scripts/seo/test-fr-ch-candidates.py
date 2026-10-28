import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('candidates',Path(__file__).with_name('generate-fr-ch-candidates.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class CandidateInventoryTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);module.FR_TARGET_LOCATIONS=3
  self.fr=self.root/'fr.json';self.ch=self.root/'ch.csv'
  self.fr.write_text(json.dumps({'communes':[{'code':'01001','name':'École','department':'Ain','departmentCode':'01','population':10},{'code':'02001','name':'Paris','department':'Aisne','departmentCode':'02','population':200},{'code':'02002','name':'Petit','department':'Aisne','departmentCode':'02','population':1}]}))
  self.ch.write_text('BfsCode,Name,Canton,CantonId,SPRGEB2020_fr\n6621,Genève,Genève,25,Français\n')
 def tearDown(self):self.tmp.cleanup()
 def test_selection_is_deterministic_and_separates_country_codes(self):
  first=module.prepare(self.fr,self.ch);second=module.prepare(self.fr,self.ch)
  self.assertEqual(first,second);self.assertEqual(first['candidateCount'],6)
  self.assertEqual([x['name'] for x in first['locations']],['Paris','École','Genève'])
  self.assertEqual(len({x['slug'] for x in first['locations']}),3)
  self.assertEqual(first['status'],'draft-not-published')
 def test_duplicate_swiss_codes_are_rejected(self):
  self.ch.write_text(self.ch.read_text()+'6621,Autre,Genève,25,Français\n')
  with self.assertRaisesRegex(ValueError,'duplicate Swiss'):module.prepare(self.fr,self.ch)
 def test_missing_swiss_columns_are_rejected(self):
  self.ch.write_text('BfsCode,Name\n6621,Genève\n')
  with self.assertRaisesRegex(ValueError,'CSV columns'):module.prepare(self.fr,self.ch)

if __name__=='__main__':unittest.main()
