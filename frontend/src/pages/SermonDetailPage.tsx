import { ArrowLeft, Bookmark, CalendarDays, Check, ChevronRight, Clock3, Download, Facebook, Headphones, Link2, ListChecks, MessageSquareQuote, Play, Quote, Share2 } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LikeButton } from '../components/LikeButton';
import { SermonCard } from '../components/SermonCard';
import { Waveform } from '../components/Waveform';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { demoSermons, demoTestimonials } from '../data/demo';
import { api } from '../lib/api';
import { formatDate, formatDuration } from '../lib/format';
import type { Sermon } from '../types';
import { useToast } from '../context/ToastContext';

export function SermonDetailPage() {
  const { slug = '' } = useParams();
  const fallback = demoSermons.find((item) => item.slug === slug) || demoSermons[0];
  const [sermon, setSermon] = useState<Sermon>(fallback);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);
  const player = useAudioPlayer();
  const { notify } = useToast();

  useEffect(() => {
    setSermon(fallback);
    void api.sermon(slug).then((response) => setSermon(response.data)).catch(() => undefined);
  }, [fallback, slug]);

  useEffect(() => {
    setSaved(localStorage.getItem(`papaleki-saved-${sermon.id}`) === '1');
  }, [sermon.id]);

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
    const next = !saved;
    setSaved(next);
    localStorage.setItem(`papaleki-saved-${sermon.id}`, next ? '1' : '0');
    notify(next ? 'Prédication enregistrée sur cet appareil.' : 'Prédication retirée des favoris.', 'info');
  };

  const share = async () => {
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
    if (!sermon.audioUrl) { notify('Le fichier audio de démonstration n’est pas téléchargeable.', 'info'); return; }
    const separator = sermon.audioUrl.includes('?') ? '&' : '?';
    window.location.assign(`${sermon.audioUrl}${separator}download=1`);
    if (/^[0-9a-f-]{36}$/i.test(sermon.id)) void api.recordEvent(sermon.id, 'download').catch(() => undefined);
  };

  const related = sermon.related?.length ? sermon.related : demoSermons.filter((item) => item.id !== sermon.id).slice(0, 3);

  return (
    <>
      <section className="detail-hero">
        <div className="container breadcrumb"><Link to="/predications"><ArrowLeft size={15} /> Prédications</Link><ChevronRight size={14} /><span>{sermon.categoryName || 'Message'}</span></div>
        <div className="container detail-hero-grid">
          <div className="detail-cover"><img src={sermon.coverUrl || '/brand-mark.svg'} alt="" /><span>{sermon.categoryName || 'Prédication'}</span></div>
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
            <h2>Dieu demeure fidèle au cœur de nos saisons</h2>
            <p>{sermon.description || 'Ce message nous invite à reconnaître que la fidélité de Dieu ne dépend ni de nos émotions, ni de la facilité du chemin. Elle s’enracine dans sa promesse et nous apprend à persévérer.'}</p>
            <p>La foi biblique ne nie pas les difficultés. Elle choisit de les regarder depuis la présence de Dieu, avec une espérance qui travaille notre caractère et renouvelle notre manière d’aimer.</p>
            <blockquote><Quote size={24} /><p>« L’espérance ne trompe point, parce que l’amour de Dieu est répandu dans nos cœurs par le Saint-Esprit. »</p><cite>{sermon.scriptureReference || 'Romains 5:5'}</cite></blockquote>
            <h3>Trois repères pour la semaine</h3>
            <ul className="lesson-list"><li><Check size={17} /><span><strong>Se souvenir</strong> des fidélités passées de Dieu.</span></li><li><Check size={17} /><span><strong>Confier</strong> ce que nous ne pouvons pas contrôler.</span></li><li><Check size={17} /><span><strong>Poser un acte</strong> de foi concret envers quelqu’un.</span></li></ul>
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
        <div className="container short-testimonies">{demoTestimonials.slice(0, 2).map((item) => <blockquote key={item.id}><Quote size={21} /><p>{item.content}</p><cite>{item.authorName} · {item.authorLocation}</cite></blockquote>)}</div>
      </section>

      <section className="section related-section">
        <div className="container"><div className="section-heading section-heading--row"><div><span className="eyebrow"><i /> Poursuivre l’écoute</span><h2>Messages associés</h2></div><Link className="text-link" to="/predications">Tout afficher <ChevronRight size={17} /></Link></div><div className="sermon-grid">{related.slice(0, 3).map((item) => <SermonCard key={item.id} sermon={item} />)}</div></div>
      </section>
    </>
  );
}
