import { CalendarDays, Check, ChevronLeft, FileAudio, ImagePlus, Info, LoaderCircle, Save, Send, UploadCloud, X } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

type SelectOption = { id: string; name?: string; displayName?: string };

export function AdminPublishPage() {
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [preachers, setPreachers] = useState<SelectOption[]>([]);
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [state, setState] = useState<'idle' | 'uploading' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [sermon, setSermon] = useState<Record<string, unknown> | null>(null);
  const coverPreview = useMemo(() => cover ? URL.createObjectURL(cover) : String(sermon?.coverUrl || ''), [cover, sermon]);

  useEffect(() => {
    void Promise.all([api.adminPreachers(), api.adminCategories(), editId ? api.adminSermon(editId) : Promise.resolve(null)]).then(([people, themes, existing]) => {
      setPreachers(people.data);
      setCategories(themes.data);
      if (existing) setSermon(existing.data);
      if (!people.data.length) setOptionsError('Aucun prédicateur actif n’est configuré dans la base de données.');
    }).catch((reason) => {
      setOptionsError(reason instanceof ApiError ? reason.message : 'Les prédicateurs et les thèmes n’ont pas pu être chargés.');
    }).finally(() => setOptionsLoading(false));
  }, [editId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editId && !audio) { setError('Ajoutez d’abord le fichier audio de la prédication.'); return; }
    if (!preachers.length) { setError('La publication est impossible tant qu’aucun prédicateur n’est disponible dans la base de données.'); return; }
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      setState(audio || cover ? 'uploading' : 'saving');
      const audioMedia = audio ? await api.uploadMedia('audio', audio) : null;
      const coverMedia = cover ? await api.uploadMedia('image', cover) : null;
      setState('saving');
      const payload: Record<string, unknown> = {
        title: form.get('title'),
        excerpt: form.get('excerpt') || null,
        description: form.get('description') || null,
        scriptureReference: form.get('scriptureReference') || null,
        preacherId: form.get('preacherId'),
        categoryId: form.get('categoryId') || null,
        preachedOn: form.get('preachedOn'),
        isFeatured: form.get('isFeatured') === 'on',
        allowDownload: form.get('allowDownload') === 'on',
        tagIds: []
      };
      if (audioMedia) payload.audioMediaId = audioMedia.data.id;
      if (coverMedia) payload.coverMediaId = coverMedia.data.id;
      if (editId) await api.updateSermon(editId, payload);
      else await api.createSermon({ ...payload, audioMediaId: audioMedia!.data.id, coverMediaId: coverMedia?.data.id ?? null });
      setState('done');
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'La publication n’a pas pu être enregistrée.');
      setState('error');
    }
  };

  return (
    <div className="publish-page">
      <div className="admin-page-heading"><div><Link to="/admin/predications" className="back-link"><ChevronLeft size={16} /> Prédications</Link><h1>{editId ? 'Modifier la prédication' : 'Nouvelle prédication'}</h1><p>{editId ? 'Modifiez les informations ou remplacez les fichiers existants.' : 'Ajoutez le message, son fichier audio et les informations de publication.'}</p></div><span className="draft-indicator"><i /> {editId ? 'Modification' : 'Brouillon local'}</span></div>
      {state === 'done' && <div className="publish-success"><Check size={20} /><div><strong>{editId ? 'Modifications enregistrées' : 'Prédication enregistrée'}</strong><p>{audio ? 'Le nouvel audio est envoyé au traitement.' : 'Toutes les informations ont été sauvegardées.'}</p></div><Link to="/admin/predications">Voir la liste</Link></div>}
      {optionsError && <div className="form-error">{optionsError}</div>}
      {error && <div className="form-error">{error}</div>}
      <form key={editId ? `${editId}:${sermon ? 'ready' : 'loading'}` : 'new'} id="publish-sermon-form" onSubmit={submit} className="publish-layout">
        <div className="publish-main">
          <section className="dashboard-card form-card"><header><span>01</span><div><h2>Informations du message</h2><p>Les informations visibles par les auditeurs.</p></div></header><div className="form-card-body"><label>Titre de la prédication<input required minLength={3} name="title" defaultValue={String(sermon?.title || '')} placeholder="Ex. Une espérance qui ne déçoit point" /></label><div className="form-row"><label>Prédicateur<select required name="preacherId" defaultValue={String(sermon?.preacherId || '')} disabled={optionsLoading || !preachers.length}><option value="" disabled>{optionsLoading ? 'Chargement depuis la base…' : preachers.length ? 'Sélectionner' : 'Aucun prédicateur disponible'}</option>{preachers.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label><label>Date de prédication<div className="input-with-icon input-with-icon--right"><input required type="date" name="preachedOn" defaultValue={String(sermon?.preachedOn || new Date().toISOString().slice(0, 10)).slice(0, 10)} /><CalendarDays size={17} /></div></label></div><div className="form-row"><label>Thème<select name="categoryId" defaultValue={String(sermon?.categoryId || '')} disabled={optionsLoading}><option value="">Sans catégorie</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Passage biblique<input name="scriptureReference" defaultValue={String(sermon?.scriptureReference || '')} placeholder="Ex. Romains 5:1–5" /></label></div><label>Courte introduction<textarea name="excerpt" rows={3} maxLength={500} defaultValue={String(sermon?.excerpt || '')} placeholder="Présentez le message en quelques lignes…" /></label><label>Notes de la prédication<textarea name="description" rows={7} defaultValue={String(sermon?.description || '')} placeholder="Résumé, points principaux, applications…" /></label></div></section>

          <section className="dashboard-card form-card"><header><span>02</span><div><h2>Fichier audio</h2><p>MP3, M4A, OGG ou WAV selon la configuration du serveur.</p></div></header><div className="form-card-body"><label className={`upload-zone ${audio || sermon?.audioFilename ? 'has-file' : ''}`}><input type="file" accept="audio/*" onChange={(event) => setAudio(event.target.files?.[0] ?? null)} />{audio ? <><span className="file-icon"><FileAudio size={28} /></span><div><strong>{audio.name}</strong><small>{(audio.size / 1024 / 1024).toFixed(1)} Mo · prêt à envoyer</small></div><button type="button" onClick={(event) => { event.preventDefault(); setAudio(null); }}><X size={18} /></button></> : sermon?.audioFilename ? <><span className="file-icon"><FileAudio size={28} /></span><div><strong>{String(sermon.audioFilename)}</strong><small>Audio actuel · cliquez pour le remplacer</small></div></> : <><UploadCloud size={35} /><strong>Glissez l’audio ici ou cliquez pour choisir</strong><small>Le traitement normalisera automatiquement le volume.</small></>}</label><div className="processing-note"><Info size={18} /><p><strong>Traitement automatique</strong><br />Après l’envoi, le serveur analyse la durée, prépare l’audio et le rend disponible au lecteur.</p></div></div></section>
        </div>

        <aside className="publish-aside">
          <section className="dashboard-card form-card cover-card"><header><span>03</span><div><h2>Image de couverture</h2></div></header><div className="form-card-body"><label className="cover-upload"><input type="file" accept="image/*" onChange={(event) => setCover(event.target.files?.[0] ?? null)} />{coverPreview ? <img src={coverPreview} alt="Aperçu de la couverture" /> : <><ImagePlus size={31} /><strong>Ajouter une image</strong><small>Format paysage recommandé</small></>}</label></div></section>
          <section className="dashboard-card form-card publish-options"><header><span>04</span><div><h2>Options</h2></div></header><div className="form-card-body"><label className="toggle-row"><span><strong>Autoriser le téléchargement</strong><small>L’audio pourra être enregistré.</small></span><input name="allowDownload" type="checkbox" defaultChecked={sermon ? Boolean(sermon.allowDownload) : true} /></label><label className="toggle-row"><span><strong>Mettre à la une</strong><small>Visible en priorité sur l’accueil.</small></span><input name="isFeatured" type="checkbox" defaultChecked={Boolean(sermon?.isFeatured)} /></label></div></section>
          <div className="publish-buttons"><button type="submit" className="button button--soft" disabled={state === 'uploading' || state === 'saving' || optionsLoading || !preachers.length || Boolean(editId && !sermon)}><Save size={17} /> {editId ? 'Enregistrer les modifications' : 'Enregistrer le brouillon'}</button><button type="submit" className="button button--primary" disabled={state === 'uploading' || state === 'saving' || optionsLoading || !preachers.length || Boolean(editId && !sermon)}>{state === 'uploading' || state === 'saving' ? <><LoaderCircle size={17} className="spin" /> {state === 'uploading' ? 'Envoi des fichiers…' : 'Enregistrement…'}</> : <><Send size={17} /> {editId ? 'Mettre à jour' : 'Enregistrer la prédication'}</>}</button></div>
        </aside>
      </form>
    </div>
  );
}
