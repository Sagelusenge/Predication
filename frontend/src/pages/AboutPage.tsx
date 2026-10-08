import { ArrowRight, BookHeart, Church, HeartHandshake, Mic2, PlayCircle, Quote, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { pastorPhoto } from '../data/visuals';

export function AboutPage() {
  return (
    <>
      <section className="about-hero page-hero">
        <div className="container about-hero-grid">
          <div><span className="eyebrow"><i /> Le ministère</span><h1>Servir l’Église, <em>une parole à la fois.</em></h1><p>Parole & Espérance prolonge le ministère pastoral au-delà du culte : une médiathèque simple pour écouter, méditer et partager des enseignements bibliques.</p><Link className="button button--primary" to="/predications"><PlayCircle size={19} /> Découvrir les messages</Link></div>
          <div className="about-photo"><img src={pastorPhoto} alt="Le Pasteur Leki pendant un enseignement" /><blockquote><Quote size={22} /> Notre désir est de rendre la Parole proche, fidèle et vivante.</blockquote></div>
        </div>
      </section>
      <section className="section story-section"><div className="container story-grid"><div><span className="eyebrow"><i /> Notre histoire</span><h2>Une présence pastorale qui continue en ligne</h2></div><div><p>Cette plateforme est née d’un constat simple : un message entendu le dimanche peut encore porter du fruit le lundi, dans un foyer, sur la route ou au travail.</p><p>Elle rassemble les prédications du Pasteur Leki et des invités du ministère, dans le respect de l’identité et de la mission de la Communauté Baptiste au Centre de l’Afrique.</p></div></div></section>
      <section className="section mission-section"><div className="container"><div className="section-heading section-heading--center"><span className="eyebrow eyebrow--center"><i /> Notre mission <i /></span><h2>Transmettre, accompagner, rassembler</h2></div><div className="mission-grid"><article><BookHeart size={28} /><h3>Transmettre fidèlement</h3><p>Mettre à disposition un enseignement centré sur les Écritures et compréhensible.</p></article><article><HeartHandshake size={28} /><h3>Accompagner avec soin</h3><p>Offrir des ressources adaptées aux réalités spirituelles et familiales de la communauté.</p></article><article><UsersRound size={28} /><h3>Rassembler largement</h3><p>Créer un pont entre les générations et les lieux grâce à l’écoute numérique.</p></article></div></div></section>
      <section className="ministry-band"><div className="container"><Church size={38} /><div><span>Une initiative pastorale</span><h2>Au service de la mission de la CBCA</h2></div><Link to="/contact" className="button button--gold">Entrer en contact <ArrowRight size={17} /></Link></div></section>
      <section className="section about-cta"><div className="container"><Mic2 size={30} /><h2>La prochaine écoute peut commencer ici.</h2><p>Choisissez un thème, installez-vous et laissez la Parole accompagner votre semaine.</p><Link className="button button--primary" to="/predications">Parcourir les prédications <ArrowRight size={17} /></Link></div></section>
    </>
  );
}
