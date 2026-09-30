import { useEffect, useState } from 'react';
import { apiFetch } from 'emdash/plugin-utils';
import { EditorialReview } from './review';

type Release = { id: string; state: string; updatedAt: string; previewUrl?: string; deployId?: string; errors?: string[] };
const labels: Record<string, string> = { draft: 'Lot enregistré', checking: 'Contrôles en cours', review_failed: 'Publication bloquée', preview_ready: 'Aperçu vérifié', deployed: 'Déployé sur le site' };
function Publication() {
  const [items, setItems] = useState<Release[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function refresh() {
    setLoading(true); setError('');
    try {
      const response = await apiFetch('/api/flexweb/snapshots');
      if (!response.ok) throw new Error(response.status === 401 ? 'Reconnectez-vous avec le compte administrateur.' : 'Le suivi des publications est indisponible.');
      const data = await response.json() as { items: Release[] };
      setItems(data.items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Impossible de charger les publications.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  return <main style={{ maxWidth: 1000, padding: 24 }}>
    <h1>Publication du site Flex-Web</h1>
    <p>Enregistrer un contenu conserve un brouillon. Le bouton « Publier » de sa fiche EmDash propose la version au prochain contrôle automatique. Il devient visible sur flex-web.fr lorsque son lot porte le statut « Déployé sur le site ».</p>
    <p>Les brouillons et les modifications en attente restent dans le CMS. Le dernier site validé continue de fonctionner en cas d’erreur.</p>
    <button onClick={() => void refresh()} disabled={loading}>{loading ? 'Actualisation…' : 'Actualiser le suivi'}</button>
    {error && <p role="alert">{error}</p>}
    {!items.length && !error && !loading && <p>Aucun lot de publication enregistré. Les contenus peuvent être préparés ; la connexion de publication doit être configurée avant leur mise en ligne.</p>}
    <ul style={{ listStyle: 'none', padding: 0 }}>{items.map((release) => <li key={release.id} style={{ padding: 20, marginTop: 16, border: '1px solid #d9e3f3', borderRadius: 16 }}>
      <h2>{labels[release.state] || release.state}</h2><p>{new Date(release.updatedAt).toLocaleString('fr-FR')}</p>
      <p><small>Lot : {release.id.slice(0, 12)}</small></p>
      {release.previewUrl && <a href={release.previewUrl} target="_blank" rel="noreferrer">Voir l’aperçu</a>}
      {release.state === 'deployed' && <p><a href="https://flex-web.fr/" target="_blank" rel="noreferrer">Voir le site publié</a></p>}
      {release.errors?.length ? <ul>{release.errors.map((message, index) => <li key={index}>{message}</li>)}</ul> : null}
    </li>)}</ul>
    <EditorialReview />
  </main>;
}
export const pages = { '/publication': Publication };
