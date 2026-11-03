// A voluntary commercial answer, kept separate from measured acquisition.
// Only these labels can be attached to a quote; no prompt or personal text.
export const declaredSources = [
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'copilot', label: 'Copilot' },
  { value: 'grok', label: 'Grok' },
  { value: 'perplexity', label: 'Perplexity' },
  { value: 'search', label: 'Google ou Bing' },
  { value: 'recommendation', label: 'Une recommandation' },
  { value: 'other', label: 'Autre' },
];

const messageLimit = 3000;
export function quoteMessagePrefix({ summary, prospectSlug, declaredSource }) {
  const label = declaredSources.find(source => source.value === declaredSource)?.label;
  return `${summary}\nConditions à confirmer dans une proposition adaptée avant tout paiement.${prospectSlug ? `\nMaquette consultée : https://flex-web.fr/${prospectSlug}/` : ''}${label ? `\nDécouverte déclarée par le client : ${label}.` : ''}\n\nBesoin du client :\n`;
}

export function quoteNeedMaxLength(context) {
  return Math.max(0, Math.min(2400, messageLimit - quoteMessagePrefix(context).length));
}

export function buildQuoteMessage(context, need) {
  const message = quoteMessagePrefix(context) + need;
  if (message.length > messageLimit) {
    throw new Error(`Votre besoin dépasse la longueur disponible (${quoteNeedMaxLength(context)} caractères). Raccourcissez-le avant l’envoi ; aucun texte n’a été supprimé.`);
  }
  return message;
}
