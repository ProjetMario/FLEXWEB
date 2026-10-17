#!/usr/bin/env python3
"""Generate safe static mockup data from a current, private CRM CSV export.

No network, CRM writes, media downloads or sends. Only public allowlisted fields
enter prospects.json. Keep --private-output outside the web repository/build.
"""
import argparse
import collections
import csv
import datetime as dt
import gzip
import hashlib
import json
import pathlib
import re
import unicodedata
import urllib.parse

PUBLIC_FIELDS = {"slug", "name", "activity", "city", "theme", "headline", "intro", "services", "sourceUrl", "verifiedAt", "batch"}
THEMES = {"building", "interiors", "garden", "beauty", "care", "food", "automotive", "creative", "services"}
BLOCKED_STATUSES = {"PAS_INTERESSE", "REPONDU", "INTERESSE", "CLIENT_SIGNE"}
CRM_HEADERS = {"entreprise", "commune", "telephone", "notes", "lien_site_google", "preuve_google", "statut", "non_contact"}


def norm(value):
    return re.sub(r"[^a-z0-9]+", " ", unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode().lower()).strip()


def slugify(value):
    return norm(value).replace(" ", "-")[:105].strip("-")


def normalize_phone(value):
    digits = re.sub(r"\D", "", value or "")
    if digits.startswith("0033"):
        digits = "33" + digits[4:]
    if len(digits) == 10 and digits.startswith("0"):
        digits = "33" + digits[1:]
    return "+" + digits if len(digits) == 11 and digits.startswith("33") else ""


def public_text(value, phone="", max_length=240):
    value = re.sub(r"\s+", " ", value or "").strip()
    if re.search(r"[\w.+-]+@[\w.-]+\.[a-z]{2,}", value, re.I):
        return ""
    if re.search(r"(?:\+33|0033|0)[ .()-]*[1-9](?:[ .()-]*\d){8}\b", value):
        return ""
    if len(value) > max_length or any(c in value for c in "<>\x00"):
        return ""
    return value


def google_candidate(row):
    return (row.get("lien_site_google") in {"NO_WEBSITE_LINK", "NOT_LISTED"}
            or any(s in row.get("preuve_google", "").lower() for s in ("aucun site", "sans site"))
            or any(s in row.get("notes", "").lower() for s in ("aucun site internet", "sans site internet")))


def source_url(row):
    for raw in (row.get("fiche_google", ""), row.get("url_source", "")):
        try:
            p = urllib.parse.urlsplit(raw)
        except ValueError:
            continue
        if p.scheme != "https" or p.hostname not in {"www.google.com", "maps.google.com", "google.com", "maps.app.goo.gl"} or p.username or p.password:
            continue
        if "@" in urllib.parse.unquote(p.query):
            continue
        # Never embed the CRM's phone in a public query or URL.
        phone = normalize_phone(row.get("telephone"))
        decoded = urllib.parse.unquote(raw)
        if phone and (phone[1:] in re.sub(r"\D", "", decoded) or phone[-9:] in re.sub(r"\D", "", decoded)):
            continue
        kept = [(k, v) for k, v in urllib.parse.parse_qsl(p.query) if k not in {"utm_source", "utm_medium", "utm_campaign", "entry", "hl", "g_ep"}]
        return urllib.parse.urlunsplit(("https", p.netloc.lower(), p.path, urllib.parse.urlencode(kept), ""))
    return ""


def source_key(url):
    if not url:
        return ""
    p = urllib.parse.urlsplit(url)
    decoded = urllib.parse.unquote(url)
    for pattern in (r"ftid=([^&#]+)", r"!1s([^!/?&#]+)", r"!16s([^!?#]+)"):
        m = re.search(pattern, decoded)
        if m:
            return m.group(1)
    return urllib.parse.urlunsplit((p.scheme, p.netloc, p.path.rstrip("/"), p.query, ""))


def date_value(value):
    value = (value or "").strip()
    try:
        return dt.date.fromisoformat(value[:10]).isoformat() if value else None
    except ValueError:
        return None


def reserved_routes(repo):
    reserved = {"api", "assets", "crm", "admin", "studio", "_astro", ".netlify", "robots.txt", "sitemap.xml", "sitemaps", "favicon.ico", "offres", "404", "index", "sites", "_next", "preparation", "territoires", "ressources", "journal", "realisations", "specialites", "outils", ".well-known", "images", "fonts", "llms.txt", "ai-overview.txt"}
    pages = repo / "src/pages"
    for p in pages.rglob("*"):
        if p.is_file():
            first = p.relative_to(pages).parts[0]
            if "[" not in first:
                reserved.add(re.sub(r"\.(astro|ts|js|md|mdx)$", "", first))
    for p in (repo / "src/content/locations").glob("*.md"):
        text = p.read_text(encoding="utf8")
        m = re.search(r"^slug:\s*['\"]?([^\s'\"]+)", text, re.M)
        slug = m.group(1) if m else p.stem
        reserved.add(slug)
        if slug.startswith("creation-site-internet-"):
            reserved.add(slug.replace("creation-site-internet-", "creation-application-mobile-", 1))
    # Root-level public assets and explicit redirect source paths also reserve names.
    public = repo / "public"
    if public.exists():
        reserved.update(p.name for p in public.iterdir())
    for p in (repo / "public/_redirects", repo / "netlify.toml"):
        if p.exists():
            for match in re.finditer(r'(?<![a-zA-Z0-9])(/[a-zA-Z0-9_.-]+)(?:/|\s|["\'])', p.read_text(encoding="utf8"), re.M):
                reserved.add(match.group(1).strip("/"))
    baseline = repo / "cms/baseline.json.gz"
    if baseline.exists():
        def scan(value):
            if isinstance(value, dict):
                for k, v in value.items():
                    if k in {"path", "pathname", "url", "slug"} and isinstance(v, str):
                        path = urllib.parse.urlsplit(v).path if v.startswith("http") else v
                        first = path.strip("/").split("/")[0]
                        if first:
                            reserved.add(first)
                    scan(v)
            elif isinstance(value, list):
                for item in value:
                    scan(item)
        scan(json.loads(gzip.decompress(baseline.read_bytes())))
    return reserved


def activity_profile(activity):
    """Texts describe a proposed visitor journey, never undocumented services."""
    a = norm(activity)
    choices = [
        ("automotive", ("automobile", "garage", "mecanique", "velo", "lavage"), "Votre véhicule. Un besoin précis. Un contact simple.", [("Décrire le véhicule", "Modèle, usage et besoin : les informations utiles pour commencer l’échange."), ("Préciser la demande", "Expliquez le problème rencontré ou le projet envisagé avant de convenir d’une suite."), ("Organiser la prochaine étape", "Les prestations, disponibilités et tarifs sont à confirmer directement avec l’entreprise.")]),
        ("garden", ("paysag", "jardin", "elag", "piscin", "floral", "fleuriste"), "Vos espaces extérieurs méritent un projet bien pensé.", [("Définir vos envies", "Décrivez l’espace concerné et ce que vous souhaitez améliorer."), ("Partager le contexte", "Photos, dimensions et localisation permettent de préciser le projet."), ("Construire la suite", "Les possibilités et le périmètre d’intervention restent à confirmer avec l’entreprise.")]),
        ("beauty", ("manucure", "ongul", "maquill", "tatou", "beaute", "coiff"), "Votre style commence par une idée.", [("Parler de votre envie", "Présentez le style ou le résultat recherché pour préparer un échange."), ("Partager vos inspirations", "Une sélection d’idées aide à préciser vos préférences, sans garantir un résultat."), ("Préparer un rendez-vous", "Prestations, tarifs et disponibilités seront confirmés avec l’entreprise.")]),
        ("care", ("hypno", "sophro", "massother", "medecine", "bien etre", "coach", "domicile", "animaux", "toilett", "chien"), "Un premier échange pour comprendre votre besoin.", [("Exprimer votre attente", "Quelques mots sur votre situation permettent de préparer le premier contact."), ("Poser vos questions", "L’approche, le déroulement et les conditions sont à préciser avec le professionnel."), ("Convenir d’une suite", "L’accompagnement et les disponibilités sont à confirmer ; aucun résultat n’est promis.")]),
        ("food", ("boulanger", "boucher", "traiteur", "restaur", "aliment"), "Des envies à partager, une demande à préparer.", [("Présenter votre occasion", "Précisez votre besoin, la date envisagée et le nombre de personnes si nécessaire."), ("Exprimer vos préférences", "Quantités, goûts et contraintes peuvent être transmis avant confirmation."), ("Confirmer ensemble", "L’offre, les disponibilités et les tarifs restent à valider avec l’entreprise.")]),
        ("creative", ("photograph", "disc jockey", "mariage", "couture", "couturier", "retouche", "affutage"), "Votre idée, mise en forme avec attention.", [("Décrire votre projet", "Présentez le contexte, vos inspirations et le résultat que vous imaginez."), ("Préciser les détails", "Dates, dimensions ou usages aident à définir une demande concrète."), ("Échanger sur les possibilités", "La réalisation, les délais et les conditions seront confirmés avec l’entreprise.")]),
        ("interiors", ("peint", "carrel", "platr", "revetement", "isolation", "menuis", "escalier", "decoration", "agencement"), "Donnez une nouvelle place à vos envies d’intérieur.", [("Imaginer le projet", "Décrivez les pièces ou les surfaces concernées et l’ambiance recherchée."), ("Rassembler les informations", "Photos, mesures et contraintes d’usage permettent de préparer un échange utile."), ("Définir le périmètre", "Matériaux, travaux et calendrier restent à confirmer avant toute proposition.")]),
        ("building", ("plomb", "chauff", "electri", "couv", "charpent", "macon", "terrasse", "batiment", "construction", "travaux", "ramon", "ravalement", "bricolage", "materiaux"), "Un projet bien expliqué. Une première étape plus simple.", [("Expliquer votre besoin", "Présentez l’installation, le bâtiment ou la partie du projet concernée."), ("Préparer les éléments utiles", "Localisation, photos et contraintes aident à organiser le premier échange."), ("Cadrer la prochaine étape", "Le périmètre, les délais et les conditions seront à confirmer avec l’entreprise.")]),
    ]
    for theme, terms, headline, services in choices:
        if any(term in a for term in terms):
            return theme, headline, services
    if not a:
        return "services", "Votre entreprise mérite une présentation à son image.", [("Votre activité", "Cet espace sera complété avec vos prestations après validation avec votre entreprise."), ("Votre savoir-faire", "Les exemples et informations utiles seront ajoutés à partir des éléments que vous aurez approuvés."), ("Un contact simple", "Le parcours et les coordonnées seront configurés selon votre organisation.")]
    return "services", "Votre besoin, au cœur du premier échange.", [("Présenter votre demande", "Expliquez le besoin et le contexte pour préparer un échange concret."), ("Préciser les attentes", "Délais souhaités et contraintes permettent de cadrer la demande."), ("Convenir de la suite", "Prestations, tarifs et disponibilités sont à confirmer directement avec l’entreprise.")]


def specialize_services(activity, fallback):
    """Useful questions scoped to a verified category, not promised deliverables."""
    a = norm(activity)
    subjects = [
        (("plomb",), "Votre besoin en plomberie", "Quel équipement ou réseau est concerné ? Une photo et une description du besoin aident à préparer l’échange."),
        (("electri",), "Votre installation électrique", "Précisez le bâtiment, l’équipement concerné et la nature de votre demande. Les travaux possibles restent à confirmer."),
        (("chauff",), "Votre demande de chauffage", "Indiquez l’équipement utilisé, les pièces concernées et les attentes à discuter avec le professionnel."),
        (("couv", "charpent", "ramon"), "Votre toiture ou votre charpente", "Décrivez la partie du bâtiment concernée et joignez, si possible, des vues prises sans vous mettre en danger."),
        (("macon", "terrasse"), "Votre projet de construction", "Localisation, dimensions approximatives et contraintes d’accès permettent de cadrer une première demande."),
        (("peint", "raval"), "Vos surfaces et vos envies", "Précisez les pièces ou façades, leur état apparent et les couleurs envisagées pour préparer le projet."),
        (("carrel", "revetement"), "Vos sols et vos murs", "Décrivez les surfaces, les usages et les matières envisagées ; les solutions techniques restent à valider."),
        (("platr", "isolation"), "Vos volumes et votre confort", "Indiquez les zones concernées, le projet d’aménagement et les contraintes à prendre en compte."),
        (("menuis", "escalier"), "Vos dimensions, votre usage", "Photos, dimensions indicatives et préférences de finition aident à lancer l’échange sur votre projet."),
        (("piscin",), "Votre bassin et votre projet", "Précisez la configuration du bassin ou l’espace envisagé et les points que vous souhaitez aborder."),
        (("paysag", "jardin", "elag"), "Votre extérieur en quelques repères", "Surface, végétation, accès et envies d’aménagement permettent de préciser le besoin."),
        (("photograph",), "L’histoire que vous voulez raconter", "Présentez l’occasion, le lieu, la date souhaitée et l’usage des images avant d’échanger sur une séance."),
        (("coutur", "retouche"), "Votre vêtement, votre idée", "Indiquez la pièce concernée et les changements envisagés ; la faisabilité sera confirmée après échange."),
        (("ongul", "manucure"), "Votre prochaine envie de style", "Partagez vos inspirations, vos préférences et la date envisagée ; les prestations restent à confirmer."),
        (("tatou",), "Votre motif, votre intention", "Décrivez le motif envisagé, le style et l’emplacement souhaité pour préparer un premier échange."),
        (("maquill",), "Votre occasion et votre style", "Précisez l’événement, la date et vos inspirations pour préparer une demande personnalisée."),
        (("toilett", "animaux", "chien"), "Votre compagnon et ses habitudes", "Présentez votre animal, ses habitudes et votre besoin pour vérifier les possibilités avec le professionnel."),
        (("hypno", "sophro", "medecine", "massother"), "Vos attentes et vos questions", "Laissez uniquement les informations utiles au premier échange ; aucune donnée médicale n’est nécessaire dans cette maquette."),
        (("nettoyage", "debarras", "nuisibles"), "Votre lieu et votre besoin", "Indiquez le type de lieu, la surface approximative et les contraintes d’accès pour préparer la demande."),
        (("secretair", "administrative", "organis"), "Votre organisation au quotidien", "Décrivez la tâche ou la situation qui mobilise votre temps afin de préciser le besoin d’accompagnement."),
        (("ordinateur", "telephone", "electromenager"), "Votre appareil et le problème rencontré", "Précisez le type d’appareil, le modèle et les symptômes observés, sans transmettre de mot de passe."),
        (("velo",), "Votre vélo et votre usage", "Type de vélo, usage et problème rencontré permettent de préparer un échange sur les possibilités."),
        (("automobile", "garage", "mecanique"), "Votre véhicule en quelques mots", "Précisez le modèle, l’usage et les signes observés pour orienter le premier échange."),
        (("boulanger", "boucher", "traiteur", "restaurant"), "Votre occasion à préparer", "Date, quantités et préférences permettent de préciser la demande avant confirmation de l’offre."),
        (("floral", "fleuriste"), "Votre événement, votre ambiance", "Partagez la date, le lieu et les couleurs envisagées ; la composition et les disponibilités restent à confirmer."),
        (("disc jockey", "mariage"), "Le rythme de votre événement", "Date, lieu, ambiance et nombre de participants donnent un premier cadre à la demande."),
    ]
    for terms, title, text in subjects:
        if any(term in a for term in terms):
            return [(title, text)] + list(fallback[1:])
    return fallback


def suggested_activity(name):
    """An explicitly labelled design direction, inferred only from trade words."""
    n = norm(name)
    directions = [
        (r"\b(?:plomberie|plombier|plombiers)\b", "plomberie", "la plomberie"),
        (r"\b(?:electricite|electricien|electriciens|elec)\b", "électricité", "l’électricité"),
        (r"\b(?:chauffage|chauffagiste|chauffagistes)\b", "chauffage", "le chauffage"),
        (r"\b(?:carrelage|carrelages|carreleur|carreleurs)\b", "carrelage", "le carrelage"),
        (r"\b(?:peinture|peintures|peintre|peintres)\b", "peinture", "la peinture"),
        (r"\b(?:menuiserie|menuiseries|menuisier|menuisiers)\b", "menuiserie", "la menuiserie"),
        (r"\b(?:platrier|platriers|platrerie|plaquiste|plaquistes)\b", "plâtrerie", "la plâtrerie"),
        (r"\b(?:macon|macons|maconnerie|terrassement)\b", "maçonnerie", "la maçonnerie"),
        (r"\b(?:couvreur|couvreurs|couverture|toiture|toitures)\b", "couverture", "la toiture"),
        (r"\b(?:charpentier|charpentiers|charpente|charpentes)\b", "charpente", "la charpente"),
        (r"\b(?:isolation|facade|facades)\b", "isolation", "l’isolation"),
        (r"\b(?:paysage|paysages|paysagiste|paysagistes|jardin|jardins|jardinier|elagage)\b", "paysagisme", "les espaces extérieurs"),
        (r"\b(?:piscine|piscines|pisciniste)\b", "piscines", "la piscine"),
        (r"\b(?:coiffure|coiffeur|coiffeuse|coiff)\b", "coiffure", "la coiffure"),
        (r"\b(?:ongle|ongles|nails|onglerie|manucure)\b", "manucure", "la manucure"),
        (r"\b(?:maquillage|make up|makeup)\b", "maquillage", "le maquillage"),
        (r"\b(?:tattoo|tatouage|tatoueur)\b", "tatouage", "le tatouage"),
        (r"\b(?:toilettage|toiletteur)\b", "toilettage", "le toilettage"),
        (r"\b(?:photographe|photographie|photo|photos)\b", "photographie", "la photographie"),
        (r"\b(?:couture|couturier|couturiere|retouche|retouches)\b", "couture", "la couture"),
        (r"\b(?:garage|auto|automobile|automobiles|mecanique)\b", "automobile", "l’automobile"),
        (r"\b(?:velo|velos|cycles)\b", "réparation de vélos", "le vélo"),
        (r"\b(?:boulangerie|boulanger)\b", "boulangerie", "la boulangerie"),
        (r"\b(?:boucherie|boucher)\b", "boucherie", "la boucherie"),
        (r"\b(?:traiteur|restaurant|restauration)\b", "restauration", "la restauration"),
        (r"\b(?:nettoyage|nettoyages|debarras)\b", "nettoyage", "le nettoyage"),
        (r"\b(?:secretariat|secretaire)\b", "secrétariat", "le secrétariat"),
        (r"\b(?:fleuriste|floral|fleurs)\b", "fleuriste", "les créations florales"),
        (r"\b(?:hypnose|hypnotherapie|sophrologie|sophrologue)\b", "sophrologie et bien-être", "le bien-être"),
        (r"\b(?:batiment|renovation|construction)\b", "bâtiment", "les projets de bâtiment"),
    ]
    for pattern, activity, wording in directions:
        if re.search(pattern, n):
            return activity, wording
    return None


def allocate_slug(name, city, key, reserved, taken, previous=None):
    # Retain published slugs on future generations; never silently move a live URL.
    if previous:
        if previous in reserved or previous in taken or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", previous):
            raise ValueError("Previous slug collides with a reserved/current route")
        taken.add(previous)
        return previous
    base = slugify(name + " " + city)
    candidate = base
    if candidate in reserved or candidate in taken:
        candidate = base + "-" + key[:8]
    length = 10
    while candidate in reserved or candidate in taken:
        candidate = base + "-" + key[:length]
        length += 2
        if length > len(key):
            raise ValueError("Cannot allocate unique slug")
    taken.add(candidate)
    return candidate


def stable_key(row):
    return hashlib.sha256((norm(row.get("entreprise")) + "|" + norm(row.get("commune")) + "|" + normalize_phone(row.get("telephone"))).encode()).hexdigest()[:24]


def validate_public(data):
    for row in data:
        if set(row) != PUBLIC_FIELDS or row["theme"] not in THEMES:
            raise ValueError("Public allowlist violation")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", row["slug"]):
            raise ValueError("Invalid slug")
        if any(set(s) != {"title", "text"} for s in row["services"]):
            raise ValueError("Service allowlist violation")
        texts = [str(row[k]) for k in ("name", "activity", "city", "headline", "intro")] + [s[k] for s in row["services"] for k in ("title", "text")]
        if not all(public_text(text, max_length=1200) for text in texts):
            raise ValueError("Unsafe public text")


def generate(rows, reserved, as_of, previous=None, verification_overrides=None):
    previous = previous or {}
    verification_overrides = verification_overrides or {}
    audit, eligible = [], []
    candidates = [r for r in rows if google_candidate(r)]
    for r in sorted(candidates, key=lambda r: (norm(r["entreprise"]), norm(r["commune"]), normalize_phone(r["telephone"]))):
        key = stable_key(r)
        reasons = []
        external_verification = verification_overrides.get(key)
        if external_verification and external_verification.get("exclude") is True:
            reasons.append("external_verification_hold")
        if r.get("non_contact"):
            reasons.append("do_not_contact")
        if r.get("statut") in BLOCKED_STATUSES:
            reasons.append("existing_relationship_or_opposition")
        evidence = norm(r.get("notes", "") + " " + r.get("preuve_google", ""))
        if any(term in evidence for term in ("identity mismatch", "identite conflictuelle", "conflit d identite", "mauvaise identite", "ne correspond pas a", "identite a verifier")):
            reasons.append("identity_conflict")
        name, city = public_text(r.get("entreprise")), public_text(r.get("commune"))
        if not name or not slugify(name) or not city or not slugify(city):
            reasons.append("missing_safe_identity_or_city")
        source = source_url(r)
        if not source:
            reasons.append("missing_safe_public_source")
        if not normalize_phone(r.get("telephone")):
            reasons.append("invalid_phone")
        if r.get("qualification") in {"HAS_WEBSITE", "CLOSED"}:
            reasons.append("no_longer_eligible")
        audit.append({"key": key, "company": r["entreprise"], "city": r.get("commune"), "reasons": reasons, "sourceRow": r})
        if external_verification:
            audit[-1]["externalVerification"] = external_verification
            audit[-1]["previousSlug"] = previous.get(key, {}).get("slug") or external_verification.get("previousSlug")
        if not reasons:
            eligible.append((r, audit[-1], name, city, source))

    # Propagate opposition to every matching identity, including previously eligible aliases.
    suppressed_phones = {normalize_phone(a["sourceRow"].get("telephone")) for a in audit if any(x in a["reasons"] for x in ("do_not_contact", "existing_relationship_or_opposition", "identity_conflict"))}
    groups = collections.defaultdict(list)
    for item in eligible:
        groups[source_key(item[4])].append(item)
    source_conflicts = {k for k, items in groups.items() if len({norm(i[2]) for i in items}) > 1}
    deduped, phone_seen, name_seen, source_seen = [], {}, {}, {}
    for item in eligible:
        r, a, name, city, source = item
        phone, name_key = normalize_phone(r["telephone"]), norm(name) + "|" + norm(city)
        if phone in suppressed_phones:
            a["reasons"].append("same_identity_as_excluded_contact")
        if source_key(source) in source_conflicts:
            a["reasons"].append("shared_google_identity_conflict")
        if a["reasons"]:
            continue
        duplicate = phone_seen.get(phone) or name_seen.get(name_key) or source_seen.get(source_key(source))
        if duplicate:
            a["reasons"].append("duplicate_identity")
            a["duplicateOf"] = duplicate
            continue
        phone_seen[phone] = a["key"]
        name_seen[name_key] = a["key"]
        source_seen[source_key(source)] = a["key"]
        deduped.append(item)

    public, registry, taken = [], [], set()
    for r, a, name, city, source in deduped:
        activity = public_text(r.get("activite"))
        direction = suggested_activity(name) if not activity else None
        proposed_activity = direction[0] if direction else ""
        theme, headline, service_pairs = activity_profile(activity or proposed_activity)
        service_pairs = specialize_services(activity or proposed_activity, service_pairs)
        verified = date_value(r.get("date_verification_google"))
        age = (as_of - dt.date.fromisoformat(verified)).days if verified else None
        if age is not None and age < 0:
            verified, age = None, None
            a.setdefault("warnings", []).append("future_source_date_not_published")
        slug = allocate_slug(name, city, a["key"], reserved, taken, previous.get(a["key"], {}).get("slug"))
        intro = (f"Votre projet commence par un échange. Présentez vos besoins à {name}, à {city}." if activity else
                 f"Une direction de site autour de {direction[1]}, à valider avec {name}, à {city}." if direction else
                 f"Une proposition de présence en ligne pour {name}, à {city}. L’activité et les prestations restent à compléter avec l’entreprise.")
        page = {"slug": slug, "name": name, "activity": activity or ("Présentation proposée : " + proposed_activity if direction else "Activité à préciser"), "city": city, "theme": theme, "headline": headline, "intro": intro,
                "services": [{"title": title, "text": text} for title, text in service_pairs], "sourceUrl": source, "verifiedAt": verified, "batch": ""}
        public.append(page)
        registry.append({"key": a["key"], "slug": slug, "url": f"https://flex-web.fr/{slug}/", "company": name, "city": city,
                         "phone": normalize_phone(r["telephone"]), "email": r.get("email", ""), "crmStatus": r.get("statut"), "crmId": None,
                         "googleSource": source, "googleVerifiedAt": verified, "sourceAgeDays": age, "sourceFreshness": "undated" if age is None else "older_than_30_days" if age > 30 else "within_30_days",
                         "missingActivity": not bool(activity), "inferredActivity": proposed_activity or None, "inferenceBasis": "explicit_trade_word_in_name" if direction else None, "logoStatus": "not_provided_or_verified", "status": "generated_unpublished", "batch": "", "sourceExportOnly": True,
                         "reviewNote": "Source CRM exportée ; aucune relecture externe actuelle ni autorisation de logo n’est affirmée.",
                         "smsDraft": f"Bonjour, je suis Flex-Web. J’ai préparé une maquette de site pour {name} : https://flex-web.fr/{slug}/ . Le pack Standard est à 299 € TTC. Si cela vous intéresse, nous pouvons en parler. Pour ne plus être contacté, répondez STOP.",
                         "sourceRow": r})
    # Ten pilots: one per design family, then a second building example. Stable order.
    pilot_slugs = []
    for theme in sorted(THEMES):
        matches = [p for p in public if p["theme"] == theme and p["activity"] != "Activité à préciser" and not p["activity"].startswith("Présentation proposée")]
        if matches:
            pilot_slugs.append(matches[0]["slug"])
    for p in public:
        if len(pilot_slugs) >= min(10, len(public)):
            break
        if p["slug"] not in pilot_slugs and p["activity"] != "Activité à préciser" and not p["activity"].startswith("Présentation proposée"):
            pilot_slugs.append(p["slug"])
    remaining = [p["slug"] for p in public if p["slug"] not in pilot_slugs]
    batches = {slug: "pilot-10" for slug in pilot_slugs}
    batches.update({slug: f"batch-{i // 50 + 1:02d}" for i, slug in enumerate(remaining)})
    for obj in public + registry:
        obj["batch"] = batches[obj["slug"]]
    validate_public(public)
    counts = collections.Counter(reason for a in audit for reason in a["reasons"])
    summary = {"sourceRows": len(rows), "googleNoWebsiteCandidates": len(candidates), "generated": len(public), "excluded": len(candidates) - len(public),
               "exclusionReasons": dict(sorted(counts.items())), "themes": dict(sorted(collections.Counter(p["theme"] for p in public).items())),
               "batches": dict(sorted(collections.Counter(p["batch"] for p in public).items())), "missingActivity": sum(r["missingActivity"] for r in registry),
               "neutralActivityCount": sum(p["activity"] == "Activité à préciser" for p in public), "inferredActivityCount": sum(bool(r["inferredActivity"]) for r in registry),
               "freshness": dict(sorted(collections.Counter(r["sourceFreshness"] for r in registry).items())), "publicLogoCount": 0,
               "currentExternalVerification": False, "crmReconciled": False, "messagesSent": 0, "productionPublished": False,
               "externalVerificationOverrides": len(verification_overrides),
               "asOf": as_of.isoformat(), "reservedRoutes": len(reserved), "pilotSlugs": pilot_slugs}
    return public, registry, audit, summary


def write_json(path, value, private=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    if private:
        path.chmod(0o600)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", type=pathlib.Path, required=True)
    p.add_argument("--repo", type=pathlib.Path, required=True)
    p.add_argument("--public-output", type=pathlib.Path, required=True)
    p.add_argument("--private-output", type=pathlib.Path, required=True)
    p.add_argument("--as-of", type=dt.date.fromisoformat, required=True)
    p.add_argument("--previous-registry", type=pathlib.Path)
    p.add_argument("--verification-overrides", type=pathlib.Path, help="Private JSON keyed by stable key; {exclude:true,reason,checkedOn,sourceUrl} holds a record out of public generation.")
    args = p.parse_args()
    private_path = args.private_output.resolve()
    repo = args.repo.resolve()
    if private_path.is_relative_to(repo) or private_path == args.public_output.resolve().parent:
        p.error("Private audit/registry must be outside the repository and public output directory")
    with args.source.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        if not CRM_HEADERS.issubset(reader.fieldnames or []):
            p.error("CRM export headers are missing")
        rows = list(reader)
    previous = {}
    if args.previous_registry:
        previous = {r["key"]: r for r in json.loads(args.previous_registry.read_text(encoding="utf8"))}
    overrides = {}
    if args.verification_overrides:
        overrides = json.loads(args.verification_overrides.read_text(encoding="utf8"))
        if not isinstance(overrides, dict) or any(not re.fullmatch(r"[0-9a-f]{24}", k) or not isinstance(v, dict) or not isinstance(v.get("exclude"), bool) for k, v in overrides.items()):
            p.error("Verification overrides must be an object keyed by stable record key with a boolean exclude field")
    public, registry, audit, summary = generate(rows, reserved_routes(repo), args.as_of, previous, overrides)
    summary["sourceSha256"] = hashlib.sha256(args.source.read_bytes()).hexdigest()
    write_json(args.public_output, public)
    write_json(args.private_output / "registry.json", registry, private=True)
    write_json(args.private_output / "audit.json", audit, private=True)
    holds = [{"key": a["key"], "company": a["company"], "city": a["city"], "previousSlug": a.get("previousSlug"), "status": "held_unpublished", "verification": a["externalVerification"], "sourceRow": a["sourceRow"]}
             for a in audit if "external_verification_hold" in a["reasons"]]
    write_json(args.private_output / "review-holds.json", holds, private=True)
    write_json(args.private_output / "summary.json", summary, private=True)
    with (args.private_output / "sms-drafts.csv").open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["key", "company", "city", "phone", "url", "batch", "status", "smsDraft"], delimiter=";")
        writer.writeheader()
        for r in registry:
            writer.writerow({k: ("'" + str(r[k]) if str(r[k]).startswith(("=", "+", "-", "@")) else r[k]) for k in writer.fieldnames})
    (args.private_output / "sms-drafts.csv").chmod(0o600)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
