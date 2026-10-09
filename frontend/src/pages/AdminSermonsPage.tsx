import { AlertTriangle, Archive, ChevronLeft, ChevronRight, Copy, Eye, MoreHorizontal, Pencil, Plus, Power, PowerOff, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';

type AdminSermon = Record<string, unknown>;

export function AdminSermonsPage() {
  const [items, setItems] = useState<AdminSermon[]>([]);
  const [loading, setLoading] = useState(true);
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [status, setStatus] = useState('all');
  const [menu, setMenu] = useState<string | null>(null);
  const { notify } = useToast();
  const load = (background = false) => { if (!background) setLoading(true); void api.adminSermons().then((response) => setItems(response.data)).catch((reason) => { if (!background) notify(reason instanceof Error ? reason.message : 'Chargement impossible.', 'error'); }).finally(() => { if (!background) setLoading(false); }); };
  useEffect(() => {
    load();
    const interval = window.setInterval(() => load(true), 4_000);
    return () => window.clearInterval(interval);
  }, []);
  const visible = useMemo(() => items.filter((item) => String(item.title).toLowerCase().includes(search.toLowerCase()) && (status === 'all' || item.status === status)), [items, search, status]);

  const action = async (kind: 'publish' | 'unpublish' | 'duplicate' | 'archive' | 'delete', item: AdminSermon) => {
    const id = String(item.id);
    setMenu(null);
    if (!/^[0-9a-f-]{36}$/i.test(id)) { notify('Cette action sera disponible sur les données publiées.', 'info'); return; }
    if (kind === 'delete' && !window.confirm(`Supprimer « ${String(item.title)} » ?`)) return;
    try {
      if (kind === 'publish') await api.publishSermon(id);
      if (kind === 'unpublish') await api.unpublishSermon(id);
      if (kind === 'duplicate') await api.duplicateSermon(id);
      if (kind === 'archive') await api.archiveSermon(id);
      if (kind === 'delete') await api.deleteSermon(id);
      notify({ publish: 'Prédication activée et publiée.', unpublish: 'Prédication désactivée.', duplicate: 'Copie créée.', archive: 'Prédication archivée.', delete: 'Prédication supprimée.' }[kind]);
      load();
    } catch (reason) { notify(reason instanceof Error ? reason.message : 'Action impossible.', 'error'); }
  };

  return <div className="admin-list-page">
    <div className="admin-page-heading"><div><span>Contenus</span><h1>Prédications</h1><p>Gérez les messages, leurs audios et leur publication.</p></div><Link to="/admin/publier" className="button button--primary"><Plus size={18} /> Nouvelle prédication</Link></div>
    <div className="admin-list-stats"><div><strong>{items.length}</strong><span>Total</span></div><div><strong>{items.filter((item) => item.status === 'published').length}</strong><span>Publiées</span></div><div><strong>{items.filter((item) => item.status === 'draft').length}</strong><span>Brouillons</span></div><div><strong>{items.filter((item) => item.status === 'processing').length}</strong><span>En traitement</span></div></div>
    <section className="dashboard-card admin-data-card">
      <div className="admin-list-toolbar"><label className="admin-search admin-search--light"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une prédication…" /></label><label><SlidersHorizontal size={17} /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tous les statuts</option><option value="published">Publiées</option><option value="draft">Brouillons</option><option value="processing">En traitement</option></select></label></div>
      <div className="responsive-table"><table className="sermons-admin-table"><thead><tr><th>Prédication</th><th>Statut</th><th>Publication</th><th>Écoutes</th><th>Durée</th><th /></tr></thead><tbody>{visible.map((item, index) => {
        const failed = item.audioStatus === 'failed' || item.latestJobStatus === 'failed';
        const processing = ['queued', 'processing', 'uploaded'].includes(String(item.latestJobStatus || item.audioStatus || ''));
        const progress = Math.max(0, Math.min(100, Number(item.progressPercent ?? 0)));
        return <tr key={String(item.id ?? index)}><td><img src={String(item.coverUrl || '/logo-pasteur-innocent.png')} alt="" /><span><strong>{String(item.title)}</strong><small>{failed ? <><AlertTriangle size={12} /> Compression échouée · remplacez l’audio</> : processing ? <>Compression {progress} %<i className="sermon-processing-line"><b style={{ width: `${progress}%` }} /></i></> : String(item.scriptureReference ?? item.categoryName ?? 'Prédication')}</small></span></td><td><AdminStatus status={failed ? 'failed' : String(item.status ?? 'published')} /></td><td>{item.preachedOn ? formatDate(String(item.preachedOn)) : '—'}</td><td><Eye size={14} /> {String(item.playCount ?? 0)}</td><td>{Math.floor(Number(item.durationSeconds ?? 0) / 60)} min</td><td className="action-cell"><button aria-label="Actions" onClick={() => setMenu(menu === String(item.id) ? null : String(item.id))}><MoreHorizontal size={18} /></button>{menu === String(item.id) && <div className="row-menu"><Link to={`/admin/publier?edit=${String(item.id)}`}><Pencil size={15} /> {failed ? 'Remplacer l’audio' : 'Modifier'}</Link>{Boolean(item.slug) && item.status === 'published' && <Link to={`/predications/${String(item.slug)}`} target="_blank"><Eye size={15} /> Prévisualiser</Link>}{(item.status === 'ready' || item.status === 'archived') && !failed && <button onClick={() => void action('publish', item)}><Power size={15} /> Activer et publier</button>}{item.status === 'published' && <button onClick={() => void action('unpublish', item)}><PowerOff size={15} /> Désactiver</button>}<button onClick={() => void action('duplicate', item)}><Copy size={15} /> Dupliquer</button>{item.status !== 'archived' && <button onClick={() => void action('archive', item)}><Archive size={15} /> Archiver</button>}<button className="danger" onClick={() => void action('delete', item)}><Trash2 size={15} /> Supprimer</button></div>}</td></tr>;
      })}</tbody></table>{!loading && !visible.length && <div className="management-empty">Aucune prédication enregistrée dans la base de données.</div>}</div>
      <div className="table-footer"><span>{loading ? 'Chargement…' : `${visible.length} résultat${visible.length > 1 ? 's' : ''}`}</span><div><button disabled aria-label="Page précédente"><ChevronLeft size={16} /></button><button className="active">1</button><button disabled aria-label="Page suivante"><ChevronRight size={16} /></button></div></div>
    </section>
  </div>;
}

function AdminStatus({ status }: { status: string }) {
  const names: Record<string, string> = { published: 'Publié', draft: 'Brouillon', processing: 'Traitement', ready: 'Prêt', scheduled: 'Programmé', archived: 'Archivé', failed: 'Échec audio' };
  return <span className={`status status--${status}`}><i /> {names[status] || status}</span>;
}
