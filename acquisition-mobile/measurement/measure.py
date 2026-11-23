"""Aggregate private, project-level CRM data or print a blank AI observation panel."""

import argparse
import csv
import json
import re
import sys
from collections import Counter
from datetime import date, timedelta

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


def write_panel(stream, run_day):
    writer = csv.writer(stream)
    writer.writerow(("date_prevue", "pays_demande", "intention", "assistant", "question",
                     "date_test", "modele", "localisation_test", "recherche_web", "statut",
                     "mention_flexweb", "citation_flex_web_fr", "url_citee", "preuve_privee"))
    for country, zone in COUNTRIES.items():
        for intent, question in QUESTIONS.items():
            for assistant in ASSISTANTS:
                writer.writerow((run_day, country, intent, assistant, question.format(zone=zone),
                                 "", "", "", "", "a_tester", "", "", "", ""))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    leads = commands.add_parser("devis", help="agrégats sur 30 jours calendaires complets")
    leads.add_argument("--fin", required=True, type=day)
    leads.add_argument("--csv", required=True, help="export CRM pseudonymisé, hors dépôt")
    panel = commands.add_parser("panel", help="120 observations vierges, questions versionnées")
    panel.add_argument("--date", required=True, type=day)
    args = parser.parse_args()
    if args.command == "panel":
        write_panel(sys.stdout, args.date)
    else:
        try:
            with open(args.csv, encoding="utf-8-sig", newline="") as stream:
                result = private_report(stream, args.fin)
        except (OSError, UnicodeError, csv.Error, ValueError) as error:
            parser.exit(2, f"Mesure indisponible — {error}\n")
        print(json.dumps(result, indent=2, sort_keys=True, ensure_ascii=False))


if __name__ == "__main__":
    main()
