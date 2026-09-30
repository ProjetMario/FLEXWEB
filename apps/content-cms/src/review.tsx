import { useState } from 'react';
import { apiFetch } from 'emdash/plugin-utils';
import { editorialReview } from './lib/editorial-review.mjs';

type Fields = { title?: string; seo_title?: string; seo_description?: string; content?: unknown[]; data?: Record<string, unknown> };
type ReviewedItem = { id: string; fields: Fields; revision: string; reviewer: string };
export function EditorialReview() {
  const [sourceId, setSourceId] = useState('');
  const [item, setItem] = useState<ReviewedItem | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function load() {
    setBusy(true); setItem(null); setConfirmed(false); setMessage('');
    try {
      const meResponse = await apiFetch('/_emdash/api/auth/me');
      const me = await meResponse.json() as { data?: { role?: number; id?: string } };
      if (!meResponse.ok || !(Number(me.data?.role) >= 50) || !me.data?.id) throw new Error('Cette attestation nécessite votre compte administrateur.');
      const query = new URLSearchParams({ limit: '2', fieldFilters: JSON.stringify({ source_id: sourceId.trim() }) });
      const listResponse = await apiFetch('/_emdash/api/content/guides?' + query);
      const list = await listResponse.json() as { data?: { items?: { id: string }[] } };
      if (!listResponse.ok || list.data?.items?.length !== 1) throw new Error('Identifiant introuvable ou ambigu dans la collection Guides.');
      const id = list.data.items[0].id;
      const response = await apiFetch('/_emdash/api/content/guides/' + encodeURIComponent(id));
      const result = await response.json() as { data?: { _rev?: string; item?: { data?: Fields } } };
      if (!response.ok || !result.data?._rev || !result.data?.item?.data) throw new Error('Impossible de charger la version actuelle du guide.');
      setItem({ id, fields: result.data.item.data, revision: result.data._rev, reviewer: me.data.id });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Chargement impossible.'); }
    finally { setBusy(false); }
  }
  async function attest() {
    if (!item || !confirmed) return;
    setBusy(true); setMessage('');
    try {
      const review = await editorialReview(item.fields, item.reviewer);
      const response = await apiFetch('/_emdash/api/content/guides/' + encodeURIComponent(item.id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _rev: item.revision, data: { ...item.fields, data: { ...item.fields.data, editorialReview: review } } }) });
      if (!response.ok) throw new Error(response.status === 409 ? 'Le contenu a changé ou est verrouillé. Rechargez-le et relisez sa nouvelle version.' : 'La relecture n’a pas pu être enregistrée. Rechargez le guide avant de réessayer.');
      setItem(null); setConfirmed(false); setMessage('Relecture enregistrée. Publiez ensuite cette version depuis la fiche du guide dans EmDash pour la proposer au déploiement.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  }
  return <section style={{ marginTop: 32, padding: 24, border: '1px solid #d9e3f3', borderRadius: 16 }}>
    <h2>Attester la relecture d’un guide</h2>
    <p>Cette étape s’applique aux guides nationaux. Relisez le contenu ci-dessous, ses faits, ses tarifs TTC et ses liens avant de l’attester. Toute nouvelle modification du texte, du SEO ou des sections ajoutées rend cette attestation caduque.</p>
    <label>Identifiant source du guide <input value={sourceId} onChange={event => { setSourceId(event.target.value); setItem(null); setConfirmed(false); }} placeholder="Valeur du champ source_id" disabled={busy} /></label>{' '}
    <button disabled={busy || !sourceId.trim()} onClick={() => void load()}>Charger la version à relire</button>
    {item && <>
      <h3>{item.fields.title}</h3><p><strong>Titre SEO :</strong> {item.fields.seo_title}</p><p><strong>Description SEO :</strong> {item.fields.seo_description}</p>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 500, overflow: 'auto', padding: 16, background: '#f5f7fb' }}>{JSON.stringify({ content: item.fields.content, additionalSections: item.fields.data?.additionalSections ?? [] }, null, 2)}</pre>
      <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} /> J’ai relu cette version et vérifié les faits, les tarifs et les liens.</label>
      <p><button disabled={!confirmed || busy} onClick={() => void attest()}>Attester la relecture de cette version</button></p>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
