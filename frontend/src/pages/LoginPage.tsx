import { ArrowLeft, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { api, ApiError } from '../lib/api';

export function LoginPage() {
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (mode === 'forgot') {
        const response = await api.forgotPassword(String(data.get('email')));
        setSuccess(response.message);
      } else {
        await api.login(String(data.get('email')), String(data.get('password')));
        navigate('/admin');
      }
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Le serveur est momentanément inaccessible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-brand-panel"><div className="login-brand-overlay" /><div className="login-panel-content"><Brand /><div><span className="eyebrow eyebrow--light"><i /> Espace sécurisé</span><h1>Publier la Parole.<br />Suivre son impact.</h1><p>Gérez les prédications, les audios et les témoignages depuis un espace conçu pour le ministère.</p></div><blockquote>« Que tout se fasse avec bienséance et avec ordre. »<cite>1 Corinthiens 14:40</cite></blockquote></div></div>
      <div className="login-form-panel"><div className="login-form-wrap"><Link to="/" className="back-link"><ArrowLeft size={16} /> Retour au site</Link><div className="login-mobile-brand"><Brand /></div><span className="login-icon">{mode === 'login' ? <LockKeyhole size={23} /> : <KeyRound size={23} />}</span><h2>{mode === 'login' ? 'Heureux de vous revoir' : 'Réinitialiser le mot de passe'}</h2><p>{mode === 'login' ? 'Connectez-vous pour accéder à l’administration.' : 'Nous enverrons un lien sécurisé si cette adresse existe.'}</p>{error && <div className="form-error">{error}</div>}{success && <div className="form-success">{success}</div>}<form onSubmit={submit}><label>Adresse e-mail<div className="input-with-icon"><Mail size={18} /><input name="email" required type="email" autoComplete="email" placeholder="pasteur@exemple.com" /></div></label>{mode === 'login' && <label>Mot de passe<div className="input-with-icon"><LockKeyhole size={18} /><input name="password" required type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Votre mot de passe" /><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>}{mode === 'login' && <div className="login-options"><span /><button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}>Mot de passe oublié ?</button></div>}<button className="button button--primary button--full" disabled={loading}>{loading ? 'Veuillez patienter…' : mode === 'login' ? 'Se connecter' : 'Envoyer le lien'}</button></form>{mode === 'forgot' && <button className="demo-access" onClick={() => { setMode('login'); setError(''); setSuccess(''); }}><ArrowLeft size={15} /> Retour à la connexion</button>}<div className="login-security"><ShieldCheck size={17} /> Connexion chiffrée et sessions sécurisées</div></div></div>
    </main>
  );
}
