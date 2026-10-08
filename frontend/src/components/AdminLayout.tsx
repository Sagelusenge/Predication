import { BarChart3, Bell, BookMarked, BookOpenText, CircleHelp, FileAudio, Gauge, LogOut, Menu, MessageSquareQuote, Search, Settings, UploadCloud, UsersRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { User } from '../types';
import { Brand } from './Brand';

const adminLinks = [
  { to: '/admin', label: 'Vue d’ensemble', icon: Gauge, end: true },
  { to: '/admin/predications', label: 'Prédications', icon: BookOpenText },
  { to: '/admin/bible', label: 'Bible', icon: BookMarked },
  { to: '/admin/publier', label: 'Nouvelle publication', icon: UploadCloud },
  { to: '/admin/medias', label: 'Bibliothèque audio', icon: FileAudio },
  { to: '/admin/temoignages', label: 'Témoignages', icon: MessageSquareQuote },
  { to: '/admin/statistiques', label: 'Statistiques', icon: BarChart3 },
  { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: UsersRound }
];

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    void api.me().then((response) => setProfile(response.data)).catch((reason) => {
      if (reason instanceof ApiError && reason.status === 401) navigate('/connexion', { replace: true });
    }).finally(() => setChecking(false));
  }, [navigate]);

  const logout = async () => {
    await api.logout().catch(() => undefined);
    navigate('/connexion');
  };

  if (checking) return <div className="admin-auth-loading">Vérification de la session…</div>;

  const initials = profile?.displayName?.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'PL';
  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${open ? 'is-open' : ''}`}>
        <div className="admin-brand"><Brand /><button onClick={() => setOpen(false)} aria-label="Fermer"><X size={20} /></button></div>
        <div className="admin-profile">
          <div className="avatar">{initials}</div>
          <div><strong>{profile?.displayName || 'Pasteur Leki'}</strong><span>{profile?.role || 'Administrateur'}</span></div>
        </div>
        <nav className="admin-nav" aria-label="Administration">
          <span className="admin-nav-label">Menu principal</span>
          {adminLinks.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={19} /><span>{label}</span>{label === 'Témoignages' && <em>3</em>}
            </NavLink>
          ))}
          <span className="admin-nav-label admin-nav-label--second">Système</span>
          <NavLink to="/admin/parametres"><Settings size={19} /><span>Paramètres</span></NavLink>
          <a href="mailto:contact@parole-esperance.cd?subject=Aide%20administration"><CircleHelp size={19} /><span>Aide & support</span></a>
        </nav>
        <button className="admin-logout" onClick={logout}><LogOut size={18} /> Déconnexion</button>
        <div className="admin-sidebar-footer"><span>Parole & Espérance</span><small>Version 1.0 · PWA</small></div>
      </aside>
      {open && <button className="admin-overlay" onClick={() => setOpen(false)} aria-label="Fermer le menu" />}
      <div className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-toggle" onClick={() => setOpen(true)} aria-label="Ouvrir le menu"><Menu size={22} /></button>
          <label className="admin-search"><Search size={19} /><input placeholder="Rechercher une prédication…" onKeyDown={(event) => { if (event.key === 'Enter') navigate(`/admin/predications?search=${encodeURIComponent(event.currentTarget.value)}`); }} /><kbd>↵</kbd></label>
          <Link to="/admin/temoignages" className="admin-bell" aria-label="Notifications"><Bell size={20} /><i /></Link>
          <a className="view-site" href="/" target="_blank" rel="noreferrer">Voir le site</a>
        </header>
        <main className="admin-content"><Outlet /></main>
      </div>
    </div>
  );
}
