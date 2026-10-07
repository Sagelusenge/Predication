import { CheckCircle2, Eye, KeyRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { api, ApiError } from '../lib/api';

export function PasswordActionPage({ invitation = false }: { invitation?: boolean }) {
  const [params] = useSearchParams();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const token = params.get('token') ?? '';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    if (password !== String(form.get('confirmation'))) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    setBusy(true); setError('');
    try {
      if (invitation) await api.acceptInvitation(token, password);
      else await api.resetPassword(token, password);
      setDone(true);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Le lien est invalide ou a expiré.');
    } finally { setBusy(false); }
  };

  return <main className="auth-action-page"><section className="auth-action-card"><Brand /><span className="login-icon">{done ? <CheckCircle2 size={24} /> : <KeyRound size={24} />}</span>{done ? <><h1>{invitation ? 'Compte activé' : 'Mot de passe modifié'}</h1><p>Vous pouvez maintenant vous connecter à l’espace d’administration.</p><Link className="button button--primary button--full" to="/connexion">Aller à la connexion</Link></> : <><h1>{invitation ? 'Activer votre compte' : 'Choisir un nouveau mot de passe'}</h1><p>Utilisez au moins 10 caractères, une majuscule, une minuscule et un chiffre.</p>{!token && <div className="form-error">Le jeton de sécurité est absent du lien.</div>}{error && <div className="form-error">{error}</div>}<form onSubmit={submit}><label>Nouveau mot de passe<div className="input-with-icon"><KeyRound size={18} /><input name="password" required minLength={10} type={show ? 'text' : 'password'} autoComplete="new-password" /><button type="button" onClick={() => setShow(!show)} aria-label="Afficher ou masquer"><Eye size={18} /></button></div></label><label>Confirmer le mot de passe<div className="input-with-icon"><KeyRound size={18} /><input name="confirmation" required minLength={10} type={show ? 'text' : 'password'} autoComplete="new-password" /></div></label><button className="button button--primary button--full" disabled={!token || busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></form></>}</section></main>;
}
