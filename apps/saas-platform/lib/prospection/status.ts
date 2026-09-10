import { ProspectionStatus } from "@prisma/client";

export const PROSPECTION_STATUSES: ProspectionStatus[] = [
  "NOUVEAU",
  "A_CONTACTER",
  "SMS_ENVOYE",
  "SANS_REPONSE",
  "REPONDU",
  "INTERESSE",
  "A_RELANCER",
  "RDV_PLANIFIE",
  "RDV_EFFECTUE",
  "DEVIS_ENVOYE",
  "NEGOCIATION",
  "CLIENT_SIGNE",
  "PAS_INTERESSE",
  "A_RECONTACTER_PLUS_TARD",
  "PERDU",
];

export const STATUS_LABELS: Record<ProspectionStatus, string> = {
  NOUVEAU: "À qualifier",
  A_CONTACTER: "À contacter",
  SMS_ENVOYE: "SMS envoyé",
  SANS_REPONSE: "Sans réponse",
  REPONDU: "Répondu",
  INTERESSE: "Intéressé",
  A_RELANCER: "À relancer",
  RDV_PLANIFIE: "RDV planifié",
  RDV_EFFECTUE: "RDV effectué",
  DEVIS_ENVOYE: "Devis envoyé",
  NEGOCIATION: "Négociation",
  CLIENT_SIGNE: "Client signé",
  PAS_INTERESSE: "Pas intéressé",
  A_RECONTACTER_PLUS_TARD: "À recontacter plus tard",
  PERDU: "Perdu",
};

export const STATUS_VARIANTS: Record<
  ProspectionStatus,
  "default" | "secondary" | "success" | "warning" | "danger" | "info"
> = {
  NOUVEAU: "secondary",
  A_CONTACTER: "info",
  SMS_ENVOYE: "info",
  SANS_REPONSE: "warning",
  REPONDU: "info",
  INTERESSE: "success",
  A_RELANCER: "warning",
  RDV_PLANIFIE: "success",
  RDV_EFFECTUE: "success",
  DEVIS_ENVOYE: "info",
  NEGOCIATION: "warning",
  CLIENT_SIGNE: "success",
  PAS_INTERESSE: "danger",
  A_RECONTACTER_PLUS_TARD: "secondary",
  PERDU: "danger",
};
