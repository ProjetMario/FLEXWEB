#!/usr/bin/env python3
import copy
import datetime as dt
import importlib.util
import json
import pathlib
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).with_name("generate-prospect-mockups.py")
spec = importlib.util.spec_from_file_location("prospect_generator", SCRIPT)
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)
NOW = dt.date(2026, 10, 17)


def row(name="Atelier Exemple", city="Chambéry", phone="06 12 34 56 78", source="https://maps.google.com/maps?ftid=0x123:0x456", **kw):
    value = {"entreprise": name, "commune": city, "telephone": phone, "activite": "Plombier", "notes": "Aucun site internet renseigné", "preuve_google": "Aucun site", "fiche_google": source, "url_source": source,
             "lien_site_google": "NO_WEBSITE_LINK", "date_verification_google": "2026-09-14", "statut": "NOUVEAU", "non_contact": "", "qualification": "TO_CHECK", "email": "private@example.invalid"}
    value.update(kw)
    return value


class GeneratorTests(unittest.TestCase):
    def test_french_phone_normalization(self):
        for value in ["06 12 34 56 78", "+33 6 12 34 56 78", "0033 6 12 34 56 78", "33612345678"]:
            self.assertEqual(g.normalize_phone(value), "+33612345678")
        self.assertEqual(g.normalize_phone("abc"), "")

    def test_exact_crm_filter(self):
        self.assertTrue(g.google_candidate(row(lien_site_google="TO_CHECK", preuve_google="sans site")))
        self.assertTrue(g.google_candidate(row(lien_site_google="TO_CHECK", preuve_google="", notes="Aucun site internet renseigné")))
        self.assertFalse(g.google_candidate(row(lien_site_google="TO_CHECK", preuve_google="", notes="non vérifié")))

    def test_opposition_engaged_and_identity_exclusion(self):
        for changes in ({"non_contact": "2026-10-01"}, {"statut": "PAS_INTERESSE"}, {"statut": "REPONDU"}, {"statut": "INTERESSE"}, {"notes": "IDENTITY_MISMATCH_ONOFF"}, {"qualification": "CLOSED"}):
            self.assertEqual(g.generate([row(**changes)], set(), NOW)[0], [])

    def test_opposition_propagates_to_alias_phone(self):
        rs = [row(statut="PAS_INTERESSE"), row(name="Atelier Autre", source="https://maps.google.com/maps?ftid=0x999")]
        self.assertEqual(g.generate(rs, set(), NOW)[0], [])

    def test_same_phone_deduplicated(self):
        rs = [row(), row(city="Annecy", source="https://maps.google.com/maps?ftid=0x999", phone="+33 6 12 34 56 78")]
        p, registry, audit, summary = g.generate(rs, set(), NOW)
        self.assertEqual(len(p), 1)
        self.assertEqual(summary["exclusionReasons"]["duplicate_identity"], 1)

    def test_shared_google_conflict_quarantines_both(self):
        rs = [row(), row(name="Société Différente", phone="06 22 22 22 22")]
        self.assertEqual(g.generate(rs, set(), NOW)[0], [])

    def test_name_city_deduplicated(self):
        rs = [row(), row(name="ATELIER EXEMPLE", city="CHAMBERY", phone="06 22 22 22 22", source="https://maps.google.com/maps?ftid=0x999")]
        self.assertEqual(len(g.generate(rs, set(), NOW)[0]), 1)

    def test_reserved_collision_suffix_and_previous_slug(self):
        p, registry, *_ = g.generate([row()], {"atelier-exemple-chambery"}, NOW)
        self.assertNotEqual(p[0]["slug"], "atelier-exemple-chambery")
        self.assertTrue(p[0]["slug"].startswith("atelier-exemple-chambery-"))
        previous = {registry[0]["key"]: registry[0]}
        self.assertEqual(g.generate([row()], set(), NOW, previous)[0][0]["slug"], p[0]["slug"])
        with self.assertRaises(ValueError):
            g.generate([row()], {p[0]["slug"]}, NOW, previous)

    def test_no_private_fields_or_contacts_public(self):
        p, registry, *_ = g.generate([row(notes="Aucun site internet. Secret interne ABC123")], set(), NOW)
        self.assertEqual(set(p[0]), g.PUBLIC_FIELDS)
        rendered = json.dumps(p)
        for secret in ["private@example.invalid", "ABC123", "+33612345678", "06 12 34 56 78", "non_contact", "crmId"]:
            self.assertNotIn(secret, rendered)
        self.assertIn("private@example.invalid", json.dumps(registry))
        contaminated = copy.deepcopy(p)
        contaminated[0]["email"] = "private@example.invalid"
        with self.assertRaises(ValueError):
            g.validate_public(contaminated)

    def test_unsafe_source_and_identity_excluded(self):
        self.assertEqual(g.generate([row(source="javascript:alert(1)")], set(), NOW)[0], [])
        self.assertEqual(g.generate([row(name="Appeler 06 12 34 56 78")], set(), NOW)[0], [])
        self.assertEqual(g.generate([row(city="")], set(), NOW)[0], [])

    def test_source_query_has_no_private_phone(self):
        r = row(source="https://www.google.com/maps/search/?query=+33612345678")
        self.assertEqual(g.source_url(r), "")

    def test_unknown_activity_neutral_and_dates_not_invented(self):
        p, registry, *_ = g.generate([row(activite="", date_verification_google="")], set(), NOW)
        self.assertEqual(p[0]["activity"], "Activité à préciser")
        self.assertIsNone(p[0]["verifiedAt"])
        self.assertIn("restent à compléter", p[0]["intro"])
        self.assertEqual(registry[0]["sourceFreshness"], "undated")
        self.assertIsNone(g.generate([row(date_verification_google="2027-01-01")], set(), NOW)[0][0]["verifiedAt"])

    def test_generation_is_deterministic(self):
        rs = [row(name="ABC", source="https://maps.google.com/maps?ftid=a"), row(name="XYZ", phone="06 22 22 22 22", source="https://maps.google.com/maps?ftid=b")]
        self.assertEqual(g.generate(rs, set(), NOW), g.generate(list(reversed(rs)), set(), NOW))

    def test_explicit_trade_in_name_is_a_labelled_direction_only(self):
        p, registry, *_ = g.generate([row(name="2D Peinture", activite="")], set(), NOW)
        self.assertEqual(p[0]["activity"], "Présentation proposée : peinture")
        self.assertEqual(p[0]["theme"], "interiors")
        self.assertIn("à valider", p[0]["intro"])
        self.assertEqual(registry[0]["inferredActivity"], "peinture")
        self.assertNotIn("inferredActivity", p[0])
        self.assertIsNone(g.suggested_activity("Entreprise Dupont"))
        self.assertIsNone(g.suggested_activity("Carrel Pierre"))

    def test_inferred_direction_does_not_change_slug(self):
        unknown = row(name="3sk carrelage", activite="")
        known = row(name="3sk carrelage", activite="Carreleur")
        self.assertEqual(g.generate([unknown], set(), NOW)[0][0]["slug"], g.generate([known], set(), NOW)[0][0]["slug"])

    def test_external_website_hold_excludes_only_matching_identity(self):
        first = row(name="AT Concept", source="https://maps.google.com/maps?ftid=a")
        second = row(name="Another Garage", phone="06 22 22 22 22", source="https://maps.google.com/maps?ftid=b")
        overrides = {g.stable_key(first): {"exclude": True, "reason": "website_found_matching_identity", "checkedOn": "2026-10-17", "sourceUrl": "https://example.test"}}
        original, previous, *_ = g.generate([first, second], set(), NOW)
        p, registry, audit, summary = g.generate([first, second], set(), NOW, {r["key"]: r for r in previous}, overrides)
        self.assertEqual(len(p), 1)
        self.assertEqual(p[0]["slug"], next(x["slug"] for x in original if x["name"] == "Another Garage"))
        held = next(x for x in audit if x["key"] == g.stable_key(first))
        self.assertIn("external_verification_hold", held["reasons"])
        self.assertEqual(held["externalVerification"]["checkedOn"], "2026-10-17")
        self.assertEqual(summary["externalVerificationOverrides"], 1)

    def test_root_reservations(self):
        with tempfile.TemporaryDirectory() as path:
            root = pathlib.Path(path)
            (root / "src/pages").mkdir(parents=True)
            (root / "src/content/locations").mkdir(parents=True)
            (root / "src/pages/contact.astro").write_text("test")
            (root / "src/content/locations/test.md").write_text("---\nslug: creation-site-internet-annecy\n---")
            (root / "public").mkdir()
            (root / "public/_redirects").write_text("/ancienne /nouvelle/ 301\n")
            reserved = g.reserved_routes(root)
            for value in ["contact", "creation-site-internet-annecy", "creation-application-mobile-annecy", "ancienne", "nouvelle", "sites", "preparation"]:
                self.assertIn(value, reserved)


if __name__ == "__main__":
    unittest.main()
