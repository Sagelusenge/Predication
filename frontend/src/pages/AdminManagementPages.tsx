import { Archive, BarChart3, FileAudio, FileImage, LoaderCircle, RefreshCw, Save, Send, Trash2, UploadCloud, UserMinus, UserPlus } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useToast } from '../context/ToastContext';

type Row = Record<string, unknown>;

function PageHeading({ title, copy }: { title: string; copy: string }) {
  return <div className="admin-page-heading"><div><span>Administration</span><h1>{title}</h1><p>{copy}</p></div></div>;
}

function Loading() {
  return <div className="management-empty"><LoaderCircle className="spin" size={24} /> Chargement…</div>;
}

export function AdminMediaPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { notify } = useToast();
  const load = () => { setLoading(true); void api.adminMedia().then((response) => setItems(response.data)).catch(() => notify('La médiathèque n’a pas pu être chargée.', 'error')).finally(() => setLoading(false)); };
  useEffect(load, []);
  const upload = async (kind: 'audio' | 'image', file?: File) => {
    if (!file) return;
    setUploading(true);
    try { await api.uploadMedia(kind, file); notify('Fichier envoyé avec succès.'); load(); }
    catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Envoi impossible.', 'error'); }
    finally { setUploading(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm('Supprimer ce média ? Cette action est impossible s’il est utilisé.')) return;
    try { await api.deleteMedia(id); setItems((rows) => rows.filter((row) => row.id !== id)); notify('Média supprimé.'); }
    catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Suppression impossible.', 'error'); }
  };
  const requeue = async (id: string) => {
    try { await api.requeueMedia(id); notify('Traitement relancé.'); load(); }
    catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Relance impossible.', 'error'); }
  };
  return <div><PageHeading title="Bibliothèque audio" copy="Importez les fichiers, suivez le traitement et gérez les couvertures." /><div className="management-actions"><label className="button button--primary"><UploadCloud size={17} /> {uploading ? 'Envoi…' : 'Importer un audio'}<input hidden type="file" accept="audio/*" disabled={uploading} onChange={(event) => void upload('audio', event.target.files?.[0])} /></label><label className="button button--soft"><FileImage size={17} /> Importer une image<input hidden type="file" accept="image/*" disabled={uploading} onChange={(event) => void upload('image', event.target.files?.[0])} /></label></div>{loading ? <Loading /> : <section className="management-grid">{items.map((item) => <article className="management-card" key={String(item.id)}><span className="management-icon">{item.kind === 'audio' ? <FileAudio size={22} /> : <FileImage size={22} />}</span><div><strong>{String(item.originalFilename ?? 'Fichier')}</strong><small>{String(item.kind)} · {(Number(item.fileSizeBytes ?? 0) / 1024 / 1024).toFixed(1)} Mo</small><span className={`status status--${String(item.processingStatus)}`}><i /> {String(item.processingStatus)}</span></div><div className="management-card-actions">{item.processingStatus === 'failed' && <button onClick={() => void requeue(String(item.id))} title="Relancer"><RefreshCw size={16} /></button>}<button onClick={() => void remove(String(item.id))} title="Supprimer"><Trash2 size={16} /></button></div></article>)}{!items.length && <div className="management-empty">Aucun média importé.</div>}</section>}</div>;
}

export function AdminTestimonialsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const { notify } = useToast();
  const load = () => { setLoading(true); void api.adminTestimonials().then((response) => setItems(response.data)).catch(() => notify('Chargement impossible.', 'error')).finally(() => setLoading(false)); };
  useEffect(load, []);
  const status = async (id: string, next: 'published' | 'archived') => {
    try { await api.updateTestimonial(id, { status: next }); notify(next === 'published' ? 'Témoignage publié.' : 'Témoignage archivé.'); load(); }
    catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Mise à jour impossible.', 'error'); }
  };
  const remove = async (id: string) => { if (!window.confirm('Supprimer définitivement ce témoignage ?')) return; try { await api.deleteTestimonial(id); setItems((rows) => rows.filter((row) => row.id !== id)); notify('Témoignage supprimé.'); } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Suppression impossible.', 'error'); } };
  return <div><PageHeading title="Témoignages" copy="Relisez les messages reçus avant de les rendre publics." />{loading ? <Loading /> : <section className="testimonial-admin-grid">{items.map((item) => <article className="dashboard-card testimonial-admin-card" key={String(item.id)}><header><div><strong>{String(item.authorName)}</strong><small>{String(item.authorRole ?? 'Auditeur')}</small></div><span className={`status status--${String(item.status)}`}><i /> {String(item.status)}</span></header><blockquote>« {String(item.quote)} »</blockquote><footer><button className="button button--primary" onClick={() => void status(String(item.id), 'published')} disabled={item.status === 'published'}><Send size={15} /> Publier</button><button className="button button--soft" onClick={() => void status(String(item.id), 'archived')}><Archive size={15} /> Archiver</button><button className="icon-danger" onClick={() => void remove(String(item.id))} aria-label="Supprimer"><Trash2 size={17} /></button></footer></article>)}{!items.length && <div className="management-empty">Aucun témoignage en attente.</div>}</section>}</div>;
}

export function AdminStatisticsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void api.sermonStatistics().then((response) => setItems(response.data)).finally(() => setLoading(false)); }, []);
  const total = useMemo(() => items.reduce((sum, item) => sum + Number(item.playStarts ?? 0), 0), [items]);
  const max = Math.max(1, ...items.map((item) => Number(item.playStarts ?? 0)));
  return <div><PageHeading title="Statistiques détaillées" copy="Comparez l’écoute, la fidélité et les téléchargements de chaque message." /><div className="admin-list-stats"><div><strong>{total.toLocaleString('fr-FR')}</strong><span>Écoutes sur 30 jours</span></div><div><strong>{items.length}</strong><span>Prédications suivies</span></div><div><strong>{items.reduce((sum, item) => sum + Number(item.uniqueListeners ?? 0), 0).toLocaleString('fr-FR')}</strong><span>Auditeurs uniques</span></div><div><strong>{items.reduce((sum, item) => sum + Number(item.downloads ?? 0), 0)}</strong><span>Téléchargements</span></div></div>{loading ? <Loading /> : <section className="dashboard-card statistics-list">{items.map((item) => <article key={String(item.sermonId ?? item.id)}><div><BarChart3 size={18} /><span><strong>{String(item.title)}</strong><small>{Number(item.uniqueListeners ?? 0)} auditeurs · {Number(item.completions ?? 0)} écoutes terminées</small></span></div><div className="statistics-bar"><i style={{ width: `${Number(item.playStarts ?? 0) / max * 100}%` }} /></div><b>{Number(item.playStarts ?? 0)}</b></article>)}{!items.length && <div className="management-empty">Les statistiques apparaîtront après les premières écoutes.</div>}</section>}</div>;
}

export function AdminUsersPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { notify } = useToast();
  const load = () => { setLoading(true); void api.adminUsers().then((response) => setItems(response.data)).catch(() => notify('Chargement impossible.', 'error')).finally(() => setLoading(false)); };
  useEffect(load, []);
  const invite = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setBusy(true); try { await api.inviteUser({ email: String(data.get('email')), firstName: String(data.get('firstName')), lastName: String(data.get('lastName')), roleCode: String(data.get('roleCode')) }); form.reset(); notify('Invitation envoyée.'); load(); } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Invitation impossible.', 'error'); } finally { setBusy(false); } };
  const deactivate = async (id: string) => { if (!window.confirm('Désactiver cet utilisateur ?')) return; try { await api.deactivateUser(id); notify('Utilisateur désactivé.'); load(); } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Désactivation impossible.', 'error'); } };
  return <div><PageHeading title="Utilisateurs" copy="Invitez les collaborateurs et contrôlez les accès à l’administration." /><form className="dashboard-card invite-form" onSubmit={invite}><h2><UserPlus size={19} /> Inviter un utilisateur</h2><div className="form-row"><label>Prénom<input required name="firstName" /></label><label>Nom<input required name="lastName" /></label></div><div className="form-row"><label>E-mail<input required type="email" name="email" /></label><label>Rôle<select name="roleCode" defaultValue="editor"><option value="administrator">Administrateur</option><option value="editor">Éditeur</option><option value="analyst">Analyste</option></select></label></div><button className="button button--primary" disabled={busy}><Send size={16} /> {busy ? 'Envoi…' : 'Envoyer l’invitation'}</button></form>{loading ? <Loading /> : <section className="dashboard-card user-list">{items.map((item) => <article key={String(item.id)}><span>{String(item.firstName ?? '').charAt(0)}{String(item.lastName ?? '').charAt(0)}</span><div><strong>{String(item.firstName)} {String(item.lastName)}</strong><small>{String(item.email)} · {Array.isArray(item.roles) ? item.roles.join(', ') : ''}</small></div><em className={`status status--${String(item.status)}`}><i /> {String(item.status)}</em>{item.status === 'active' && <button onClick={() => void deactivate(String(item.id))}><UserMinus size={16} /> Désactiver</button>}</article>)}</section>}</div>;
}

export function AdminSettingsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const { notify } = useToast();
  useEffect(() => { void api.adminSettings().then((response) => setItems(response.data)).catch(() => notify('Chargement impossible.', 'error')).finally(() => setLoading(false)); }, []);
  const save = async (event: FormEvent<HTMLFormElement>, item: Row) => { event.preventDefault(); const data = new FormData(event.currentTarget); const raw = String(data.get('value')); let value: unknown = raw; try { value = JSON.parse(raw); } catch { value = raw; } try { await api.saveSetting(String(item.settingKey), { settingGroup: String(item.settingGroup ?? 'general'), value, description: item.description ? String(item.description) : undefined, isPublic: Boolean(item.isPublic) }); notify('Paramètre enregistré.'); } catch (reason) { notify(reason instanceof ApiError ? reason.message : 'Enregistrement impossible.', 'error'); } };
  return <div><PageHeading title="Paramètres" copy="Configurez les informations publiques et le comportement général du site." />{loading ? <Loading /> : <section className="settings-list">{items.map((item) => <form className="dashboard-card setting-row" key={String(item.settingKey)} onSubmit={(event) => void save(event, item)}><div><strong>{String(item.settingKey)}</strong><small>{String(item.description ?? item.settingGroup ?? '')}</small></div><textarea name="value" rows={2} defaultValue={typeof item.value === 'string' ? item.value : JSON.stringify(item.value)} /><button className="button button--primary"><Save size={16} /> Enregistrer</button></form>)}{!items.length && <div className="management-empty">Aucun paramètre disponible.</div>}</section>}</div>;
}
