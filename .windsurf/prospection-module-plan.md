# Module Admin de Prospection SMS — Architecture complète

## Analyse du projet existant

Le dépôt FLEXWEB contient :

- `/` : site public Astro 6 + React 19 + Tailwind 4, pages statiques, SEO.
- `/apps/saas-platform` : application Next.js 16 avec :
  - Authentification (NextAuth v5 / Auth.js + Prisma adapter)
  - PostgreSQL via Prisma 7
  - Supabase (SSR + auth)
  - Tailwind 4 + shadcn/ui
  - Rôles : `SUPER_ADMIN`, `ADMIN`, `EDITOR`
  - Audit logs, notifications, organisations déjà modélisées

## Recommandation d'architecture

Étendre `apps/saas-platform` pour y intégrer le module admin `/admin/prospection`.
Avantages :

- Authentification, rôles, Prisma, PostgreSQL déjà en place.
- Pas de duplication de la base de données ni de la sécurité.
- Interface admin cohérente avec le reste du SaaS.
- Le site public Astro reste inchangé.

Accès possible :

- Développement : `http://localhost:3001/admin/prospection`
- Production : sous-domaine `admin.flex-web.fr` ou sous-chemin `flex-web.fr/admin` via proxy/reverse proxy.

## Schéma Prisma proposé

Ajouter dans `/apps/saas-platform/prisma/schema.prisma` :

```prisma
enum ProspectionStatus {
  NOUVEAU
  A_CONTACTER
  SMS_ENVOYE
  SANS_REPONSE
  REPONDU
  INTERESSE
  A_RELANCER
  RDV_PLANIFIE
  RDV_EFFECTUE
  DEVIS_ENVOYE
  NEGOCIATION
  CLIENT_SIGNE
  PAS_INTERESSE
  A_RECONTACTER_PLUS_TARD
  PERDU
}

enum InteractionType {
  PROSPECT_AJOUTE
  SMS_ENVOYE
  REPONSE_RECUE
  APPEL
  EMAIL
  NOTE
  RELANCE
  RDV
  DEVIS
  CLIENT_SIGNE
  STATUT_MODIFIE
}

enum FollowUpStatus {
  PENDING
  DONE
  SKIPPED
}

model SmsCampaign {
  id          String   @id @default(uuid())
  name        String
  description String?
  city        String?
  department  String?
  country     String   @default("France")
  businessType String?
  startDate   DateTime @default(now())
  endDate     DateTime?
  status      String   @default("active")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  prospects Prospect[]

  @@index([status])
  @@index([startDate])
}

model SmsTemplate {
  id        String   @id @default(uuid())
  name      String
  body      String   @db.Text
  variables String[] @default([])
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Prospect {
  id                  String            @id @default(uuid())
  companyName         String
  contactName         String?
  phone               String
  email               String?
  website             String?
  googleBusinessUrl   String?
  businessType        String?
  category            String?
  city                String?
  department          String?
  country             String            @default("France")
  source              String?
  googleReviewCount   Int?
  googleRating        Float?
  internalNotes       String?           @db.Text
  status              ProspectionStatus @default(NOUVEAU)

  setupFee            Int?
  monthlyPrice        Int?
  oneTimePrice        Int?
  estimatedValue      Int?
  signedValue         Int?

  campaignId          String?
  campaign            SmsCampaign?      @relation(fields: [campaignId], references: [id], onDelete: SetNull)

  nextFollowUpAt      DateTime?
  firstSmsSentAt      DateTime?
  lastInteractionAt   DateTime?
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  interactions        ProspectInteraction[]
  followUps           FollowUp[]
  appointments        Appointment[]
  notes               ProspectNote[]

  @@index([status])
  @@index([city])
  @@index([businessType])
  @@index([nextFollowUpAt])
  @@index([campaignId])
  @@unique([phone, companyName])
}

model ProspectInteraction {
  id          String          @id @default(uuid())
  prospectId  String
  prospect    Prospect        @relation(fields: [prospectId], references: [id], onDelete: Cascade)
  type        InteractionType
  note        String?         @db.Text
  oldStatus   ProspectionStatus?
  newStatus   ProspectionStatus?
  createdById String?
  createdAt   DateTime        @default(now())

  @@index([prospectId])
  @@index([type])
  @@index([createdAt])
}

model FollowUp {
  id          String         @id @default(uuid())
  prospectId  String
  prospect    Prospect       @relation(fields: [prospectId], references: [id], onDelete: Cascade)
  dueAt       DateTime
  doneAt      DateTime?
  status      FollowUpStatus @default(PENDING)
  note        String?        @db.Text
  createdById String?
  createdAt   DateTime       @default(now())

  @@index([prospectId])
  @@index([dueAt])
  @@index([status])
}

model ProspectNote {
  id          String   @id @default(uuid())
  prospectId  String
  prospect    Prospect @relation(fields: [prospectId], references: [id], onDelete: Cascade)
  content     String   @db.Text
  createdById String?
  createdAt   DateTime @default(now())

  @@index([prospectId])
}
```

Le modèle `Appointment` existe déjà dans le schéma SaaS. On peut l'étendre avec `prospectId` optionnel pour le relier aux prospects :

```prisma
model Appointment {
  ...
  prospectId String?
  prospect   Prospect? @relation(fields: [prospectId], references: [id], onDelete: SetNull)
  ...
}
```

## Routes proposées

Toutes les routes sont dans `apps/saas-platform/app/(admin)/admin/prospection/**` avec vérification côté serveur du rôle `ADMIN` ou `SUPER_ADMIN`.

| Route | Description |
|-------|-------------|
| `/admin/prospection` | Dashboard avec KPI et filtres temporels |
| `/admin/prospection/prospects` | Liste des prospects avec recherche, filtres, pagination |
| `/admin/prospection/prospects/[id]` | Fiche détaillée d'un prospect |
| `/admin/prospection/prospects/new` | Ajout manuel d'un prospect |
| `/admin/prospection/prospects/import` | Import CSV |
| `/admin/prospection/campaigns` | Liste des campagnes |
| `/admin/prospection/campaigns/[id]` | Détail d'une campagne + stats |
| `/admin/prospection/campaigns/new` | Création de campagne |
| `/admin/prospection/templates` | Modèles de SMS |
| `/admin/prospection/follow-ups` | Relances du jour / retard / semaine |
| `/admin/prospection/appointments` | Rendez-vous |
| `/admin/prospection/statistics` | Statistiques avancées |
| `/admin/prospection/settings` | Paramètres du module |

## API routes (server actions / Route Handlers)

- `POST /api/prospection/prospects` — CRUD prospects
- `GET /api/prospection/prospects/search` — recherche globale
- `POST /api/prospection/prospects/:id/interactions` — ajout d'interaction
- `POST /api/prospection/prospects/:id/status` — changement de statut
- `POST /api/prospection/prospects/import` — import CSV
- `GET /api/prospection/prospects/export` — export CSV
- `POST /api/prospection/follow-ups` — planifier une relance
- `POST /api/prospection/appointments` — planifier un RDV
- `GET /api/prospection/dashboard` — agrégations KPI
- `GET /api/prospection/campaigns/:id/stats` — stats par campagne

## Composants proposés

```
apps/saas-platform/components/prospection/
├── ProspectTable.tsx
├── ProspectCard.tsx
├── ProspectStatusBadge.tsx
├── ProspectTimeline.tsx
├── ProspectKanban.tsx
├── CampaignCard.tsx
├── CampaignStats.tsx
├── SmsTemplateEditor.tsx
├── SmsPreview.tsx
├── FollowUpList.tsx
├── ProspectionDashboard.tsx
├── ImportCSV.tsx
├── ExportCSV.tsx
├── ProspectForm.tsx
├── StatusUpdateModal.tsx
├── AppointmentModal.tsx
├── NoteEditor.tsx
└── CommandPalette.tsx (optionnel)
```

## Sécurité

- Middleware Next.js vérifie `ADMIN`/`SUPER_ADMIN` sur `/admin/prospection/*`.
- Vérification côté serveur refaite dans chaque Server Action / Route Handler.
- Validation Zod systématique.
- Requêtes via Prisma (ORM = requêtes préparées).
- Aucun token/base de données exposé côté client.
- Journalisation des changements de statut et actions importantes via `AuditLog`.

## Plan de développement par phases

### Phase 1 — Base de données + prospects
1. Étendre `schema.prisma` avec les nouveaux modèles.
2. Créer et appliquer la migration.
3. Générer le client Prisma.
4. Créer le layout admin protégé `/admin/prospection`.
5. Créer la page liste prospects avec recherche, filtres, pagination.
6. Créer la page ajout/édition prospect.
7. Vérifier TypeScript + tests manuels.

### Phase 2 — Dashboard + statuts
1. Page dashboard avec KPI de base.
2. Fiche prospect détaillée.
3. Badges de statut + boutons rapides.
4. Historique des interactions simple.
5. Vérifier responsive.

### Phase 3 — SMS templates + copie
1. Modèles de SMS CRUD.
2. Variables `{{companyName}}`, `{{contactName}}`, `{{city}}`, `{{businessType}}`, `{{firstName}}`.
3. Prévisualisation live.
4. Bouton "Copier le SMS".

### Phase 4 — Relances
1. Système de follow-ups.
2. Page `/follow-ups` (dues / retard / semaine).
3. Notifications sur le dashboard.

### Phase 5 — Campagnes
1. CRUD campagnes.
2. Association prospect ↔ campagne.
3. Stats par campagne.

### Phase 6 — Statistiques
1. Page statistiques détaillées.
2. Taux de réponse, RDV, conversion, MRR, CA.

### Phase 7 — Kanban
1. Vue kanban par statut.
2. Drag & drop pour changer le statut.
3. Création automatique d'interaction au déplacement.

### Phase 8 — Import / export CSV
1. Import CSV avec prévisualisation et détection de doublons.
2. Export CSV (tous, campagne, clients signés, relances).

### Phase 9 — Optimisation UX
1. Command palette, toasts, raccourcis clavier.
2. Dark mode si pertinent.
3. Tests E2E ciblés sur les flux critiques.

## Prochaine étape

Valide cette architecture, puis on passe à la Phase 1.
