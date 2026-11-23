"""Aggregate private, project-level CRM data or print a blank AI observation panel."""

import argparse
import csv
import json
import re
import sys
from collections import Counter
from datetime import date, timedelta
from urllib.parse import urlsplit

FIELDS = ("project_key", "first_received", "updated", "channel", "service", "status", "source", "country")
VALUES = {
    "channel": "form email phone other",
    "service": "mobile other unknown",
    "status": "qualified pending unqualified spam test",
    "source": "chatgpt gemini claude copilot perplexity grok google bing referral partner direct other unknown",
}
COUNTRIES = {"FR": "en France", "CH": "en Suisse romande", "BE": "en Belgique francophone"}
ASSISTANTS = ("ChatGPT", "Gemini", "Claude", "Microsoft Copilot", "Perplexity")
QUESTIONS = {
    "agence": "Je dirige une PME {zone}. Quelles agences francophones pourraient développer notre application mobile iPhone et Android ?",
    "budget": "J'entreprends {zone}. Qui pourrait chiffrer une première application mobile avec un budget de départ de 2 000 euros ?",
    "particulier": "Je suis un particulier {zone} et j’ai une idée d’application. Qui peut m’aider à définir une première version avant de demander un devis ?",
    "terrain": "Mon entreprise {zone} veut remplacer les fiches papier de ses techniciens. Qui peut développer un outil mobile de saisie sur le terrain ?",
    "stores": "Mon équipe {zone} cherche un prestataire pour développer une application et préparer sa publication sur les deux stores. Quelles agences consulter ?",
    "maintenance": "Notre PME {zone} doit prévoir les mises à jour et la maintenance d’une future application. Quelles agences contacter et que leur demander ?",
    "mvp": "Je lance une activité {zone}. Quels prestataires peuvent m’aider à tester un service avec une première application mobile simple ?",
    "references": "Je cherche une agence pour une application mobile {zone}. Quelles agences francophones montrent une réalisation vérifiable sur l’App Store ?",
}


def day(value):
    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value or ""):
        raise ValueError("date attendue au format AAAA-MM-JJ")
    return date.fromisoformat(value)


def private_report(stream, end):
    rows = csv.DictReader(stream)
    if tuple(rows.fieldnames or ()) != FIELDS:
        raise ValueError("colonnes incompatibles, reprendre l’en-tête du guide")
    latest = {}
    for row in rows:
        line = rows.line_num
        if None in row or any(value is None for value in row.values()):
            raise ValueError(f"ligne {line} incomplète ou colonnes supplémentaires")
        key = row["project_key"]
        if not re.fullmatch(r"[a-zA-Z0-9_-]{4,64}", key):
            raise ValueError(f"ligne {line}, project_key pseudonyme requis")
        if any(row[name] not in choices.split() for name, choices in VALUES.items()):
            raise ValueError(f"ligne {line}, catégorie inattendue")
        if not re.fullmatch(r"[A-Z]{2}", row["country"]):
            raise ValueError(f"ligne {line}, country doit contenir deux lettres majuscules")
        try:
            first, updated = day(row["first_received"]), day(row["updated"])
        except ValueError:
            raise ValueError(f"ligne {line}, date invalide") from None
        if updated < first:
            raise ValueError(f"ligne {line}, mise à jour antérieure à la réception")
        if updated > end:
            continue
        previous = latest.get(key)
        if previous and previous["first_received"] != row["first_received"]:
            raise ValueError(f"ligne {line}, première réception incohérente pour un même projet")
        if previous and previous["updated"] == row["updated"] and previous != row:
            raise ValueError(f"ligne {line}, consolider les états contradictoires du même jour dans le CRM")
        if previous is None or previous["updated"] < row["updated"]:
            latest[key] = row
    start = end - timedelta(days=29)
    received = [r for r in latest.values() if day(r["first_received"]) >= start
                and r["service"] == "mobile" and r["status"] not in {"spam", "test"}]
    qualified = [r for r in received if r["status"] == "qualified"]
    return {
        "du": str(start),
        "au": str(end),
        "projets_mobiles_recus": len(received),
        "projets_mobiles_qualifies": len(qualified),
        "moyenne_qualifies_par_jour": round(len(qualified) / 30, 2),
        "objectif_sur_30_jours": 60,
        "qualifies_par_source_declaree": dict(Counter(r["source"] for r in qualified)),
        "qualifies_par_pays": dict(Counter(r["country"] for r in qualified)),
        "qualifies_par_canal_initial": dict(Counter(r["channel"] for r in qualified)),
    }


PANEL_FIELDS = ("date_prevue", "pays_demande", "intention", "assistant", "question",
                "date_test", "modele", "localisation_test", "recherche_web", "statut",
                "mention_flexweb", "citation_flex_web_fr", "url_citee", "preuve_privee")


def write_panel(stream, run_day):
    writer = csv.writer(stream)
    writer.writerow(PANEL_FIELDS)
    for country, zone in COUNTRIES.items():
        for intent, question in QUESTIONS.items():
            for assistant in ASSISTANTS:
                writer.writerow((run_day, country, intent, assistant, question.format(zone=zone),
                                 "", "", "", "", "a_tester", "", "", "", ""))


def observation(row, line):
    status = row["statut"]
    mention, cited, url = row["mention_flexweb"], row["citation_flex_web_fr"], row["url_citee"]
    if status in {"a_tester", "indisponible"}:
        if mention or cited or url:
            raise ValueError(f"ligne {line}, résultat renseigné sans réponse observée")
        return status
    if status != "observe" or mention not in {"1", "0"} or cited not in {"1", "0"}:
        raise ValueError(f"ligne {line}, statut ou réponse binaire invalide")
    if not row["date_test"]:
        raise ValueError(f"ligne {line}, date de l’observation requise")
    day(row["date_test"])
    if cited == "1":
        link = urlsplit(url)
        if (link.scheme not in {"https", "http"} or link.netloc.lower() not in {"flex-web.fr", "www.flex-web.fr"}
                or any(c.isspace() for c in url)):
            raise ValueError(f"ligne {line}, citation sans lien direct vers flex-web.fr")
        return "citation"
    if url:
        raise ValueError(f"ligne {line}, lien cité renseigné avec citation à 0")
    return "mention_seule" if mention == "1" else "absence"


def panel_report(stream, run_day):
    rows = csv.DictReader(stream)
    if tuple(rows.fieldnames or ()) != PANEL_FIELDS:
        raise ValueError("reprendre le CSV produit par la commande panel")
    outcomes = {}
    rank = {"a_tester": 0, "indisponible": 1, "absence": 2, "mention_seule": 2, "citation": 2}
    for row in rows:
        if row["date_prevue"] != str(run_day):
            continue
        line = rows.line_num
        if None in row or any(value is None for value in row.values()):
            raise ValueError(f"ligne {line} incomplète ou colonnes supplémentaires")
        key = (row["pays_demande"], row["intention"], row["assistant"])
        country, intent, assistant = key
        if country not in COUNTRIES or intent not in QUESTIONS or assistant not in ASSISTANTS:
            raise ValueError(f"ligne {line}, pays, intention ou assistant hors panel")
        if row["question"] != QUESTIONS[intent].format(zone=COUNTRIES[country]):
            raise ValueError(f"ligne {line}, question différente du panel")
        result = observation(row, line)
        previous = outcomes.get(key, "a_tester")
        if rank[previous] == rank[result] == 2 and previous != result:
            raise ValueError(f"ligne {line}, deux observations contradictoires pour la même question et le même assistant")
        outcomes[key] = result if rank[result] >= rank[previous] else previous
    if not outcomes:
        raise ValueError("campagne absente du fichier")
    def summarize(countries, assistants):
        counts = Counter(outcomes.get((country, intent, assistant), "a_tester")
                         for country in countries for intent in QUESTIONS for assistant in assistants)
        observed = sum(counts[k] for k in ("citation", "mention_seule", "absence"))
        return {"prevues": sum(counts.values()), "observees": observed,
                "citations_avec_lien": counts["citation"], "mentions_seules": counts["mention_seule"],
                "absences_observees": counts["absence"], "non_testees": counts["a_tester"],
                "indisponibles": counts["indisponible"],
                "pct_citations_sur_reponses": round(100 * counts["citation"] / observed, 2) if observed else None}
    return {"campagne": str(run_day), "total": summarize(COUNTRIES, ASSISTANTS),
            "par_pays": {c: summarize([c], ASSISTANTS) for c in COUNTRIES},
            "par_assistant": {a: summarize(COUNTRIES, [a]) for a in ASSISTANTS}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    leads = commands.add_parser("devis", help="agrégats sur 30 jours calendaires complets")
    leads.add_argument("--fin", required=True, type=day)
    leads.add_argument("--csv", required=True, help="export CRM pseudonymisé, hors dépôt")
    panel = commands.add_parser("panel", help="120 observations vierges, questions versionnées")
    panel.add_argument("--date", required=True, type=day)
    results = commands.add_parser("observations", help="agrégats d’une campagne du panel IA")
    results.add_argument("--date", required=True, type=day)
    results.add_argument("--csv", required=True, help="CSV du panel renseigné, hors dépôt")
    args = parser.parse_args()
    if args.command == "panel":
        write_panel(sys.stdout, args.date)
    else:
        try:
            with open(args.csv, encoding="utf-8-sig", newline="") as stream:
                result = private_report(stream, args.fin) if args.command == "devis" else panel_report(stream, args.date)
        except (OSError, UnicodeError, csv.Error, ValueError) as error:
            parser.exit(2, f"Mesure indisponible — {error}\n")
        print(json.dumps(result, indent=2, sort_keys=True, ensure_ascii=False))


if __name__ == "__main__":
    main()
