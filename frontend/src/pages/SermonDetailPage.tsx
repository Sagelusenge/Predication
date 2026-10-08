import { ArrowLeft, Bookmark, CalendarDays, Check, ChevronRight, Clock3, Download, Facebook, Headphones, Link2, ListChecks, MessageSquareQuote, Play, Quote, Share2 } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LikeButton } from '../components/LikeButton';
import { SermonCard } from '../components/SermonCard';
import { Waveform } from '../components/Waveform';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { api } from '../lib/api';
import { formatDate, formatDuration } from '../lib/format';
import type { Sermon, Testimonial } from '../types';
import { useToast } from '../context/ToastContext';

export function SermonDetailPage() {
  const { slug = '' } = useParams();
  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loadError, setLoadError] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);
  const player = useAudioPlayer();
  const { notify } = useToast();

  useEffect(() => {
    setSermon(null);
    setLoadError('');
    void api.sermon(slug).then((response) => setSermon(response.data)).catch(() => setLoadError('Cette prédication est introuvable ou n’est pas encore publiée.'));
    void api.testimonials().then((response) => setTestimonials(response.data.slice(0, 2))).catch(() => setTestimonials([]));
  }, [slug]);

  useEffect(() => {
    if (sermon) setSaved(localStorage.getItem(`papaleki-saved-${sermon.id}`) === '1');
  }, [sermon]);

  const submitTestimony = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSending(true);
    try {
      await api.submitTestimonial({ authorName: String(data.get('name')), authorLocation: String(data.get('city') || '') || undefined, quote: String(data.get('message')), consent: true });
      setSent(true);
      form.reset();
    } catch {
      notify('Le témoignage n’a pas pu être envoyé.', 'error');
    } finally {
      setSending(false);
    }
  };

  const toggleSaved = () => {
    if (!sermon) return;
    const next = !saved;
    setSaved(next);
    localStorage.setItem(`papaleki-saved-${sermon.id}`, next ? '1' : '0');
    notify(next ? 'Prédication enregistrée sur cet appareil.' : 'Prédication retirée des favoris.', 'info');
  };

  const share = async () => {
    if (!sermon) return;
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: sermon.title, text: sermon.excerpt ?? '', url });
      else { await navigator.clipboard.writeText(url); notify('Lien copié dans le presse-papiers.'); }
      if (/^[0-9a-f-]{36}$/i.test(sermon.id)) void api.recordEvent(sermon.id, 'share').catch(() => undefined);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') notify('Le partage n’a pas pu être lancé.', 'error');
    }
  };

  const download = () => {
    if (!sermon?.audioUrl) { notify('Aucun fichier audio téléchargeable n’est disponible.', 'info'); return; }
    const separator = sermon.audioUrl.includes('?') ? '&' : '?';
    window.location.assign(`${sermon.audioUrl}${separator}download=1`);
    if (/^[0-9a-f-]{36}$/i.test(sermon.id)) void api.recordEvent(sermon.id, 'download').catch(() => undefined);
  };

  if (!sermon) {
    return <main className="home-data-state" role={loadError ? 'alert' : undefined}><Headphones size={34} /><h1>{loadError ? 'Prédication indisponible' : 'Chargement de la prédication'}</h1><p>{loadError || 'Lecture des informations depuis la base de données…'}</p>{loadError && <Link className="button button--primary" to="/predications">Retour aux prédications</Link>}</main>;
  }

  const related = sermon.related ?? [];

  return (
    <>
      <section className="detail-hero">
        <div className="container breadcrumb"><Link to="/predications"><ArrowLeft size={15} /> Prédications</Link><ChevronRight size={14} /><span>{sermon.categoryName || 'Message'}</span></div>
        <div className="container detail-hero-grid">
          <div className="detail-cover"><img src={sermon.coverUrl || '/logo-pasteur-innocent.png'} alt="" /><span>{sermon.categoryName || 'Prédication'}</span></div>
          <div className="detail-copy">
            <span className="eyebrow"><i /> Prédication audio</span>
            <h1>{sermon.title}</h1>
            <p>{sermon.excerpt}</p>
            <div className="detail-meta"><span><CalendarDays size={16} /> {formatDate(sermon.preachedOn)}</span><span><Clock3 size={16} /> {formatDuration(sermon.durationSeconds ?? 0)}</span><span><Headphones size={16} /> {(sermon.playCount ?? 0).toLocaleString('fr-FR')} écoutes</span></div>
            <div className="inline-player">
              <button onClick={() => player.play(sermon)}>{player.current?.id === sermon.id && player.playing ? <span className="pause-bars"><i /><i /></span> : <Play size={24} fill="currentColor" />}</button>
              <div><Waveform active={player.current?.id === sermon.id && player.playing} /><span><b>0:00</b><b>{formatDuration(sermon.durationSeconds ?? 0)}</b></span></div>
            </div>
            <div className="detail-actions"><LikeButton sermon={sermon} /><button className={saved ? 'is-active' : ''} onClick={toggleSaved}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Enregistrée' : 'Enregistrer'}</button><button onClick={download}><Download size={17} /> Télécharger</button><button onClick={share}><Share2 size={17} /> Partager</button></div>
          </div>
        </div>
      </section>

      <section className="section sermon-content-section">
        <div className="container sermon-content-grid">
          <article className="sermon-notes">
            <span className="eyebrow"><i /> Notes du message</span>
            <h2>{sermon.title}</h2>
            {sermon.description ? <p>{sermon.description}</p> : <p>Les notes de cette prédication n’ont pas encore été ajoutées.</p>}
            {sermon.scriptureReference && <blockquote><Quote size={24} /><p>Passage biblique du message</p><cite>{sermon.scriptureReference}</cite></blockquote>}
          </article>
          <aside className="sermon-sidebar">
            <div className="info-card"><span><ListChecks size={21} /></span><h3>À propos du message</h3><dl><div><dt>Prédicateur</dt><dd>{sermon.preacherName || 'Pasteur Leki'}</dd></div><div><dt>Passage</dt><dd>{sermon.scriptureReference || 'Romains 5:1–5'}</dd></div><div><dt>Thème</dt><dd>{sermon.categoryName || 'Espérance'}</dd></div><div><dt>Date</dt><dd>{formatDate(sermon.preachedOn)}</dd></div></dl></div>
            <div className="share-card"><h3>Partager ce message</h3><p>Une parole peut rejoindre quelqu’un au bon moment.</p><div><button onClick={share} aria-label="Partager sur Facebook"><Facebook size={18} /></button><button onClick={share} aria-label="Copier le lien"><Link2 size={18} /></button><LikeButton sermon={sermon} compact /></div></div>
          </aside>
        </div>
      </section>

      <section className="section testimony-detail-section">
        <div className="container testimony-detail-grid">
          <div className="testimony-form-copy"><span className="eyebrow"><i /> Votre histoire compte</span><h2>Ce message vous a-t-il encouragé ?</h2><p>Partagez en quelques mots ce que Dieu a déposé dans votre cœur. Après modération, votre témoignage pourra encourager d’autres personnes.</p><MessageSquareQuote size={58} /></div>
          <form className="testimony-form" onSubmit={submitTestimony}>
            {sent && <div className="form-success"><Check size={17} /> Merci, votre témoignage a bien été reçu.</div>}
            <div className="form-row"><label>Votre nom<input required name="name" placeholder="Ex. Grâce M." /></label><label>Votre ville<input name="city" placeholder="Ex. Goma" /></label></div>
            <label>Votre témoignage<textarea required name="message" rows={5} placeholder="Écrivez votre témoignage ici…" /></label>
            <label className="check-field"><input type="checkbox" required /><span>J’accepte que ce témoignage soit publié après validation.</span></label>
            <button className="button button--primary" disabled={sending}>{sending ? 'Envoi…' : <>Envoyer mon témoignage <ChevronRight size={17} /></>}</button>
          </form>
        </div>
        {testimonials.length > 0 && <div className="container short-testimonies">{testimonials.map((item) => <blockquote key={item.id}><Quote size={21} /><p>{item.content}</p><cite>{item.authorName}{item.authorLocation ? ` · ${item.authorLocation}` : ''}</cite></blockquote>)}</div>}
      </section>

      {related.length > 0 && <section className="section related-section">
        <div className="container"><div className="section-heading section-heading--row"><div><span className="eyebrow"><i /> Poursuivre l’écoute</span><h2>Messages associés</h2></div><Link className="text-link" to="/predications">Tout afficher <ChevronRight size={17} /></Link></div><div className="sermon-grid">{related.slice(0, 3).map((item) => <SermonCard key={item.id} sermon={item} />)}</div></div>
      </section>}
    </>
  );
}
