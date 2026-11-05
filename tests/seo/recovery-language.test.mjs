import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedLanguage} from '../../scripts/seo/recovery-language.mjs';

test('French and Swiss primary project pages use the actual locality language',()=>{
 for(const [route,language] of [
  ['/projets-sites/particuliers/trullikon-ch-40/','de'],
  ['/projets-sites/entreprises/lugano-ch-5192/','it'],
  ['/projets-sites/particuliers/geneve-ch-6621/','fr'],
  ['/en/locations/crm/grenoble-38185/','en'],
  ['/creation-site-internet-savoie/','fr'],
 ])assert.equal(expectedLanguage(route),language,route);
});
