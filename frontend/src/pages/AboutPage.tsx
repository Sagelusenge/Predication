import { ArrowRight, BookHeart, CalendarDays, Church, HeartHandshake, PlayCircle, Quote, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type AboutContent = {
  heroTitle?: string;
  heroSubtitle?: string;
  biography?: string;
  vision?: string;
  mission?: string;
  portrait?: string;
  familyPhoto?: string;
  timeline?: Array<{ year: string; title: string }>;
};

export function AboutPage() {
  const [content, setContent] = useState<AboutContent | null>(null);
  const [preacherName, setPreacherName] = useState('Pasteur Innocent Kombi Maliro');
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([api.page<AboutContent>('a-propos'), api.appConfig()])
      .then(([page, config]) => {
        setContent(page.data.content);
        if (config.data.primaryPreacher?.displayName) setPreacherName(config.data.primaryPreacher.displayName);
      })
      .catch(() => setError('La biographie n’a pas pu être chargée depuis la base de données.'));
  }, []);

  if (!content && !error) return <main className="home-data-state"><span className="data-loader" /><h1>Chargement</h1><p>Lecture des informations du ministère…</p></main>;

  const page = content ?? {};
  return (
    <>
      <section className="about-hero page-hero">
        <div className="container about-hero-grid">
          <div><h1>{page.heroTitle || preacherName}</h1><p>{page.heroSubtitle || 'Prédication, enseignement biblique et accompagnement spirituel au service de la CBCA.'}</p><Link className="button button--primary" to="/predications"><PlayCircle size={19} /> Découvrir les messages</Link></div>
          <div className="about-photo"><img src={page.portrait || '/pasteur-innocent.jpg'} alt={`Portrait de ${preacherName}`} /><blockquote><Quote size={22} /> Faire connaître la Parole avec fidélité, simplicité et espérance.</blockquote></div>
        </div>
      </section>

      {error && <div className="container form-error" role="alert">{error}</div>}

      <section className="section story-section"><div className="container story-grid"><div><h2>Parcours pastoral</h2></div><div><p>{page.biography}</p></div></div></section>

      {!!page.timeline?.length && <section className="section about-timeline-section"><div className="container"><div className="section-heading section-heading--center"><h2>Quelques repères</h2></div><div className="about-timeline" data-reveal data-stagger>{page.timeline.map((item) => <article key={`${item.year}-${item.title}`}><CalendarDays size={23} /><strong>{item.year}</strong><p>{item.title}</p></article>)}</div></div></section>}

      <section className="section mission-section"><div className="container"><div className="section-heading section-heading--center"><h2>Vision et mission</h2></div><div className="mission-grid"><article><BookHeart size={28} /><h3>Enseigner</h3><p>{page.vision}</p></article><article><HeartHandshake size={28} /><h3>Accompagner</h3><p>{page.mission}</p></article><article><UsersRound size={28} /><h3>Servir</h3><p>Mettre les prédications et les enseignements à la disposition des familles et de toute la communauté.</p></article></div></div></section>

      {page.familyPhoto && <section className="section about-family-section"><div className="container about-family-grid"><img src={page.familyPhoto} alt={`${preacherName} et son épouse`} /><div><Church size={34} /><h2>Une vie consacrée au service</h2><p>Ce site prolonge en ligne un engagement pastoral vécu dans l’Église, auprès des familles et au cœur de la communauté.</p></div></div></section>}

      <section className="ministry-band"><div className="container"><Church size={38} /><div><span>Une initiative pastorale</span><h2>Au service de la mission de l’ECC/3e CBCA</h2></div><Link to="/contact" className="button button--gold">Entrer en contact <ArrowRight size={17} /></Link></div></section>
    </>
  );
}
