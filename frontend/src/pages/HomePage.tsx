import { ArrowRight, BookOpen, Headphones, HeartHandshake, MessageCircleHeart, Play, Quote, Radio, ShieldCheck, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SermonCard } from '../components/SermonCard';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { demoSermons, demoTestimonials, pastorPhoto } from '../data/demo';
import { api } from '../lib/api';
import type { Sermon, Testimonial } from '../types';

export function HomePage() {
  const [sermons, setSermons] = useState<Sermon[]>(demoSermons.slice(0, 3));
  const [testimonials, setTestimonials] = useState<Testimonial[]>(demoTestimonials);
  const player = useAudioPlayer();

  useEffect(() => {
    void api.appConfig().then((response) => {
      if (response.data.latestSermons.length) setSermons(response.data.latestSermons);
    }).catch(() => undefined);
    void api.testimonials().then((response) => {
      if (response.data.length) setTestimonials(response.data.slice(0, 3));
    }).catch(() => undefined);
  }, []);

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy reveal">
            <span className="eyebrow"><i /> Méditer · Grandir · Servir</span>
            <h1>Une parole qui éclaire <em>chaque pas.</em></h1>
            <p>Retrouvez les prédications du Pasteur Leki et des serviteurs de la CBCA. Des messages bibliques à écouter partout, pour nourrir la foi et accompagner la vie.</p>
            <div className="hero-actions">
              <Link to="/predications" className="button button--primary"><Headphones size={19} /> Écouter les prédications</Link>
              <Link to="/a-propos" className="button button--ghost">Découvrir le ministère <ArrowRight size={18} /></Link>
            </div>
            <div className="hero-note"><span><Radio size={16} /></span><p><strong>Nouveau chaque semaine</strong> — retrouvez le message du dimanche dès sa publication.</p></div>
          </div>
          <div className="hero-visual reveal reveal--delay">
            <div className="hero-image-wrap">
              <img src={pastorPhoto} alt="Pasteur partageant la Parole" />
              <div className="hero-image-shade" />
              <blockquote><Quote size={25} /><p>La foi grandit lorsque la Parole trouve une place dans notre quotidien.</p><cite>— Pasteur Leki</cite></blockquote>
            </div>
            <div className="hero-accent" />
          </div>
        </div>
        <div className="container hero-stats">
          <div><strong>120+</strong><span>Prédications disponibles</span></div>
          <div><strong>42 h</strong><span>De messages bibliques</span></div>
          <div><strong>3,4 k</strong><span>Auditeurs accompagnés</span></div>
          <div><strong>24/7</strong><span>Accessible sur tout appareil</span></div>
        </div>
      </section>

      <section className="section values-section">
        <div className="container">
          <div className="section-heading section-heading--center">
            <span className="eyebrow eyebrow--center"><i /> Notre engagement <i /></span>
            <h2>La Parole au cœur de la vie</h2>
            <p>Une plateforme simple, pensée pour transmettre l’Évangile et rester proche de la communauté.</p>
          </div>
          <div className="values-grid">
            <article><span><BookOpen size={25} /></span><h3>Un enseignement biblique</h3><p>Des messages enracinés dans les Écritures, accessibles et applicables au quotidien.</p></article>
            <article><span><HeartHandshake size={25} /></span><h3>Une présence pastorale</h3><p>Des paroles de consolation, de discernement et d’encouragement pour chaque saison.</p></article>
            <article><span><UsersRound size={25} /></span><h3>Une foi partagée</h3><p>Une ressource ouverte aux familles, aux cellules et à tous ceux qui cherchent Dieu.</p></article>
            <article><span><ShieldCheck size={25} /></span><h3>Une écoute sans distraction</h3><p>Un lecteur sobre et continu, également installable sur téléphone grâce à la PWA.</p></article>
          </div>
        </div>
      </section>

      <section className="section latest-section">
        <div className="container">
          <div className="section-heading section-heading--row">
            <div><span className="eyebrow"><i /> À écouter maintenant</span><h2>Dernières prédications</h2></div>
            <Link to="/predications" className="text-link">Voir toute la médiathèque <ArrowRight size={17} /></Link>
          </div>
          <div className="sermon-grid">{sermons.map((sermon) => <SermonCard key={sermon.id} sermon={sermon} />)}</div>
        </div>
      </section>

      <section className="scripture-section">
        <div className="scripture-pattern" />
        <div className="container scripture-content">
          <BookOpen size={32} />
          <blockquote>« Ainsi la foi vient de ce qu’on entend, et ce qu’on entend vient de la parole de Christ. »</blockquote>
          <cite>Romains 10:17</cite>
        </div>
      </section>

      <section className="section testimonies-section">
        <div className="container">
          <div className="section-heading section-heading--center">
            <span className="eyebrow eyebrow--center"><i /> La communauté témoigne <i /></span>
            <h2>Des vies encouragées</h2>
          </div>
          <div className="testimony-grid">
            {testimonials.map((item, index) => (
              <article className={index === 1 ? 'featured' : ''} key={item.id}>
                <Quote size={27} />
                <p>{item.content}</p>
                <div><span>{item.authorName.charAt(0)}</span><strong>{item.authorName}<small>{item.authorLocation}</small></strong></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section home-cta-section">
        <div className="container home-cta">
          <div className="home-cta-copy">
            <span className="eyebrow eyebrow--light"><i /> Message à la une</span>
            <h2>Emportez la Parole avec vous.</h2>
            <p>Commencez par le message de cette semaine, puis poursuivez votre écoute même lorsque vous changez de page.</p>
            <button className="button button--gold" onClick={() => player.play(sermons[0] || demoSermons[0])}><Play size={18} fill="currentColor" /> Lancer l’écoute</button>
          </div>
          <div className="cta-card">
            <img src={(sermons[0] || demoSermons[0]).coverUrl || '/brand-mark.svg'} alt="" />
            <div><small>Prédication recommandée</small><h3>{(sermons[0] || demoSermons[0]).title}</h3><span>Pasteur Leki · CBCA</span></div>
            <button onClick={() => player.play(sermons[0] || demoSermons[0])} aria-label="Écouter"><Play size={22} fill="currentColor" /></button>
          </div>
        </div>
      </section>

      <section className="contact-strip">
        <div className="container"><MessageCircleHeart size={29} /><div><strong>Besoin de prière ou d’un accompagnement ?</strong><span>Le ministère pastoral reste à votre écoute.</span></div><Link to="/contact" className="button button--outline-light">Nous écrire <ArrowRight size={17} /></Link></div>
      </section>
    </>
  );
}
