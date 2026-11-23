import csv
import io
import unittest
from datetime import date

from measure import FIELDS, private_report, write_panel


def report(rows):
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(FIELDS)
    writer.writerows(rows)
    stream.seek(0)
    return private_report(stream, date(2026, 11, 22))


class AcquisitionMeasurement(unittest.TestCase):
    def test_project_first_received_and_status_at_cutoff(self):
        rows = [
            ("old1", "2026-10-23", "2026-11-10", "form", "mobile", "qualified", "bing", "CH"),
            ("new1", "2026-10-24", "2026-10-24", "email", "mobile", "pending", "unknown", "FR"),
            ("new1", "2026-10-24", "2026-11-01", "email", "mobile", "qualified", "chatgpt", "FR"),
            ("new2", "2026-11-22", "2026-11-22", "phone", "mobile", "pending", "unknown", "ZZ"),
            ("new2", "2026-11-22", "2026-11-23", "phone", "mobile", "qualified", "gemini", "BE"),
            ("test", "2026-11-01", "2026-11-01", "form", "mobile", "test", "direct", "FR"),
            ("spam", "2026-11-01", "2026-11-01", "form", "mobile", "spam", "unknown", "FR"),
            ("site", "2026-11-01", "2026-11-01", "form", "other", "qualified", "partner", "BE"),
        ]
        result = report(list(reversed(rows)) + [rows[2]])
        self.assertEqual(result["du"], "2026-10-24")
        self.assertEqual(result["projets_mobiles_recus"], 2)
        self.assertEqual(result["projets_mobiles_qualifies"], 1)
        self.assertEqual(result["qualifies_par_source_declaree"], {"chatgpt": 1})
        self.assertEqual(result["qualifies_par_pays"], {"FR": 1})

    def test_conflicting_project_states(self):
        row = ("new1", "2026-10-24", "2026-10-24", "email", "mobile", "pending", "unknown", "FR")
        with self.assertRaisesRegex(ValueError, "contradictoires"):
            report([row, (*row[:5], "qualified", *row[6:])])

    def test_empty_input_and_missing_export(self):
        self.assertEqual(report([])["projets_mobiles_qualifies"], 0)
        with self.assertRaisesRegex(ValueError, "colonnes"):
            private_report(io.StringIO(""), date(2026, 11, 22))

    def test_neutral_panel(self):
        stream = io.StringIO()
        write_panel(stream, date(2026, 11, 23))
        stream.seek(0)
        rows = list(csv.DictReader(stream))
        self.assertEqual(len(rows), 120)
        self.assertEqual(len({r["question"] for r in rows}), 24)
        self.assertEqual(len({(r["question"], r["assistant"]) for r in rows}), 120)
        self.assertEqual({r["statut"] for r in rows}, {"a_tester"})
        self.assertTrue(all(not r["citation_flex_web_fr"] for r in rows))
