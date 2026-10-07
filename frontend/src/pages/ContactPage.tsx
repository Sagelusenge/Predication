import { CheckCircle2, Clock3, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { api, ApiError } from '../lib/api';

export function ContactPage() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus('sending');
    setError('');
    try {
      await api.contact({
        fullName: String(data.get('name')),
        email: String(data.get('email')),
        subject: String(data.get('subject')),
        message: String(data.get('message'))
      });
      setStatus('sent');
      form.reset();
    } catch (reason) {
      if (reason instanceof ApiError) setError(reason.message);
      else setError('Le service est momentanément indisponible. Réessayez dans un instant.');
      setStatus('error');
    }
  };

  return (
    <>
      <section className="page-hero contact-hero"><div className="container page-heading"><span className="eyebrow"><i /> Restons en lien</span><h1>Nous sommes à <em>votre écoute.</em></h1><p>Une question, un besoin de prière ou un témoignage ? Écrivez au ministère pastoral.</p></div></section>
      <section className="section contact-section"><div className="container contact-grid">
        <div className="contact-info"><span className="eyebrow"><i /> Contact</span><h2>Parlons simplement</h2><p>Votre message sera reçu par l’équipe du ministère. Nous vous répondrons dès que possible avec discrétion et bienveillance.</p><div className="contact-cards"><article><span><Mail size={20} /></span><div><small>Adresse e-mail</small><a href="mailto:contact@parole-esperance.cd">contact@parole-esperance.cd</a></div></article><article><span><Phone size={20} /></span><div><small>Téléphone</small><a href="tel:+243000000000">+243 000 000 000</a></div></article><article><span><MapPin size={20} /></span><div><small>Localisation</small><p>CBCA · République démocratique du Congo</p></div></article><article><span><Clock3 size={20} /></span><div><small>Délai de réponse</small><p>Habituellement sous 48 heures</p></div></article></div><div className="prayer-note"><MessageCircle size={23} /><p><strong>Demande de prière</strong><br />Indiquez « Prière » comme sujet. Votre demande restera confidentielle.</p></div></div>
        <form className="contact-form" onSubmit={submit}><div><span>Écrivez-nous</span><h2>Envoyer un message</h2></div>{status === 'sent' && <div className="form-success"><CheckCircle2 size={18} /> Votre message a bien été envoyé.</div>}{status === 'error' && <div className="form-error">{error}</div>}<div className="form-row"><label>Nom complet<input required name="name" placeholder="Votre nom" /></label><label>Adresse e-mail<input required type="email" name="email" placeholder="vous@exemple.com" /></label></div><label>Sujet<select required name="subject" defaultValue=""><option value="" disabled>Choisir un sujet</option><option>Demande de prière</option><option>Question pastorale</option><option>Témoignage</option><option>Problème technique</option><option>Autre</option></select></label><label>Votre message<textarea required minLength={10} name="message" rows={7} placeholder="Comment pouvons-nous vous accompagner ?" /></label><button className="button button--primary" disabled={status === 'sending'}>{status === 'sending' ? 'Envoi en cours…' : <>Envoyer le message <Send size={17} /></>}</button><small>En envoyant ce formulaire, vous acceptez que nous utilisions vos coordonnées pour vous répondre.</small></form>
      </div></section>
    </>
  );
}
