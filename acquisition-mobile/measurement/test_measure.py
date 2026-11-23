import csv
import io
import unittest
from datetime import date

from measure import FIELDS, PANEL_FIELDS, panel_report, private_report, write_panel


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

    def test_observation_summary_and_duplicate_handling(self):
        run_day = date(2026, 11, 23)
        buffer = io.StringIO()
        write_panel(buffer, run_day)
        buffer.seek(0)
        rows = list(csv.DictReader(buffer))

        def summary(data):
            buffer = io.StringIO()
            writer = csv.DictWriter(buffer, PANEL_FIELDS)
            writer.writeheader()
            writer.writerows(data)
            buffer.seek(0)
            return panel_report(buffer, run_day)

        self.assertIsNone(summary(rows)["total"]["pct_citations_sur_reponses"])
        copies = [dict(r, statut="observe", date_test=str(run_day),
                       mention_flexweb="0", citation_flex_web_fr="0") for r in rows[:3]]
        copies[0].update(citation_flex_web_fr="1", url_citee="https://flex-web.fr/applications/")
        copies[1]["mention_flexweb"] = "1"
        rows[3]["statut"] = "indisponible"
        report = summary(copies + rows + copies)
        self.assertEqual(report["total"], {"prevues": 120, "observees": 3, "citations_avec_lien": 1,
                         "mentions_seules": 1, "absences_observees": 1, "non_testees": 116,
                         "indisponibles": 1, "pct_citations_sur_reponses": 33.33})
        self.assertEqual(report["par_pays"]["FR"]["observees"], 3)
        self.assertEqual(report["par_assistant"]["ChatGPT"]["citations_avec_lien"], 1)
        with self.assertRaisesRegex(ValueError, "contradictoires"):
            summary(copies + [dict(copies[1], mention_flexweb="0")])
        with self.assertRaisesRegex(ValueError, "sans lien direct"):
            summary([dict(copies[0], url_citee="https://flex-web.fr.exemple.com/")])
