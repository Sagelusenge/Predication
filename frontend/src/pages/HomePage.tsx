import { ArrowRight, BookOpen, Headphones, HeartHandshake, MessageCircleHeart, Play, Quote, Radio, RefreshCw, ShieldCheck, ThumbsUp, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SermonCard } from '../components/SermonCard';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { api } from '../lib/api';
import type { HomeAppConfig } from '../types';

const valueIcons = [BookOpen, HeartHandshake, UsersRound, ShieldCheck];

const compactNumber = (value: number) => new Intl.NumberFormat('fr-FR', {
  notation: value >= 1_000 ? 'compact' : 'standard',
  maximumFractionDigits: 1,
}).format(value);

const hours = (seconds: number) => {
  const value = seconds / 3600;
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: value >= 10 ? 0 : 1 }).format(value)} h`;
};

export function HomePage() {
  const [config, setConfig] = useState<HomeAppConfig | null>(null);
  const [error, setError] = useState('');
  const [request, setRequest] = useState(0);
  const player = useAudioPlayer();

  const retry = useCallback(() => setRequest((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setError('');
    void api.appConfig()
      .then((response) => { if (active) setConfig(response.data); })
      .catch(() => { if (active) setError('Les informations de l’accueil n’ont pas pu être chargées depuis la base de données.'); });
    return () => { active = false; };
  }, [request]);

  if (!config && !error) {
    return <main className="home-data-state" aria-live="polite"><span className="data-loader" /><h1>Chargement de l’accueil</h1><p>Connexion à la base de données…</p></main>;
  }

  if (!config || !config.page) {
    return <main className="home-data-state" role="alert"><RefreshCw size={34} /><h1>Accueil indisponible</h1><p>{error || 'La page « accueil » n’est pas publiée dans la base de données.'}</p><button className="button button--primary" onClick={retry}><RefreshCw size={17} /> Réessayer</button></main>;
  }

  const { page, latestSermons: sermons, testimonials, statistics, primaryPreacher } = config;
  const content = page.content;
  const heroImage = primaryPreacher?.photoUrl || page.coverUrl || '/brand-mark.svg';
  const featured = sermons[0];
  const statisticItems = [
    { value: compactNumber(statistics.publishedSermons), label: 'Prédications publiées', icon: Headphones },
    { value: hours(statistics.totalDurationSeconds), label: 'De messages bibliques', icon: Radio },
    { value: compactNumber(statistics.totalPlays), label: 'Écoutes enregistrées', icon: UsersRound },
    { value: compactNumber(statistics.totalLikes), label: 'Mentions J’aime', icon: ThumbsUp },
  ];

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy" data-reveal>
            <span className="eyebrow"><i /> {content.hero.eyebrow}</span>
            <h1>{content.hero.title} {content.hero.highlight && <em>{content.hero.highlight}</em>}</h1>
            <p>{content.hero.subtitle}</p>
            <div className="hero-actions">
              <Link to="/predications" className="button button--primary"><Headphones size={19} /> {content.hero.primaryAction}</Link>
              <Link to="/a-propos" className="button button--ghost">{content.hero.secondaryAction} <ArrowRight size={18} /></Link>
            </div>
            <div className="hero-note"><span><Radio size={16} /></span><p><strong>{content.hero.noteTitle}</strong> — {content.hero.note}</p></div>
          </div>
          <div className="hero-visual" data-reveal>
            <div className={`hero-image-wrap ${heroImage === '/brand-mark.svg' ? 'is-placeholder' : ''}`}>
              <img src={heroImage} alt={primaryPreacher ? `Portrait de ${primaryPreacher.displayName}` : 'Identité visuelle CBCA'} />
              <div className="hero-image-shade" />
              <blockquote><Quote size={25} /><p>{content.hero.quote}</p><cite>— {primaryPreacher?.displayName || String(config.settings['site.name'] || 'Ministère CBCA')}</cite></blockquote>
            </div>
            <div className="hero-accent" />
          </div>
        </div>
        <div className="container hero-stats" data-reveal data-stagger>
          {statisticItems.map(({ value, label, icon: Icon }) => <div key={label}><Icon size={18} /><strong>{value}</strong><span>{label}</span></div>)}
        </div>
      </section>

      <section className="section values-section">
        <div className="container">
          <div className="section-heading section-heading--center" data-reveal>
            <span className="eyebrow eyebrow--center"><i /> {content.values.eyebrow} <i /></span>
            <h2>{content.values.title}</h2>
            <p>{content.values.introduction}</p>
          </div>
          <div className="values-grid" data-reveal data-stagger>
            {content.values.items.map((item, index) => {
              const Icon = valueIcons[index % valueIcons.length];
              return <article key={item.title}><span><Icon size={25} /></span><h3>{item.title}</h3><p>{item.description}</p></article>;
            })}
          </div>
        </div>
      </section>

      <section className="section latest-section">
        <div className="container">
          <div className="section-heading section-heading--row" data-reveal>
            <div><span className="eyebrow"><i /> {content.latest.eyebrow}</span><h2>{content.latest.title}</h2></div>
            <Link to="/predications" className="text-link">Voir toute la médiathèque <ArrowRight size={17} /></Link>
          </div>
          {sermons.length
            ? <div className="sermon-grid" data-reveal data-stagger>{sermons.map((sermon) => <SermonCard key={sermon.id} sermon={sermon} />)}</div>
            : <div className="empty-state home-empty" data-reveal><Headphones size={34} /><h3>Aucune prédication publiée</h3><p>Les audios ajoutés et publiés dans l’administration apparaîtront ici automatiquement.</p></div>}
        </div>
      </section>

      <section className="scripture-section" data-reveal>
        <div className="scripture-pattern" />
        <div className="container scripture-content">
          <BookOpen size={32} />
          <blockquote>« {content.scripture.quote} »</blockquote>
          <cite>{content.scripture.reference}</cite>
        </div>
      </section>

      <section className="section testimonies-section">
        <div className="container">
          <div className="section-heading section-heading--center" data-reveal>
            <span className="eyebrow eyebrow--center"><i /> {content.testimonials.eyebrow} <i /></span>
            <h2>{content.testimonials.title}</h2>
          </div>
          {testimonials.length
            ? <div className="testimony-grid" data-reveal data-stagger>{testimonials.map((item, index) => (
              <article className={index === 1 ? 'featured' : ''} key={item.id}>
                <Quote size={27} />
                <p>{item.content}</p>
                <div>{item.photoUrl ? <img src={item.photoUrl} alt="" /> : <span>{item.authorName.charAt(0)}</span>}<strong>{item.authorName}<small>{item.authorLocation}</small></strong></div>
              </article>
            ))}</div>
            : <div className="empty-state home-empty" data-reveal><MessageCircleHeart size={34} /><h3>Aucun témoignage publié</h3><p>Les témoignages validés depuis l’administration seront affichés dans cet espace.</p></div>}
        </div>
      </section>

      {featured && <section className="section home-cta-section">
        <div className="container home-cta" data-reveal>
          <div className="home-cta-copy">
            <span className="eyebrow eyebrow--light"><i /> {content.featured.eyebrow}</span>
            <h2>{content.featured.title}</h2>
            <p>{content.featured.description}</p>
            <button className="button button--gold" onClick={() => player.play(featured)}><Play size={18} fill="currentColor" /> Lancer l’écoute</button>
          </div>
          <div className="cta-card">
            <img src={featured.coverUrl || '/brand-mark.svg'} alt="" />
            <div><small>Prédication recommandée</small><h3>{featured.title}</h3><span>{featured.preacherName || primaryPreacher?.displayName || 'CBCA'}</span></div>
            <button onClick={() => player.play(featured)} aria-label="Écouter"><Play size={22} fill="currentColor" /></button>
          </div>
        </div>
      </section>}

      <section className="contact-strip" data-reveal>
        <div className="container"><MessageCircleHeart size={29} /><div><strong>{content.contact.title}</strong><span>{content.contact.subtitle}</span></div><Link to="/contact" className="button button--outline-light">{content.contact.action} <ArrowRight size={17} /></Link></div>
      </section>
    </>
  );
}
