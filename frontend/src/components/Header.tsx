import { Menu, Search, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Brand } from './Brand';

const links = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/predications', label: 'Prédications' },
  { to: '/a-propos', label: 'Le ministère' },
  { to: '/contact', label: 'Contact' }
];

export function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <button className="icon-button mobile-menu-button" onClick={() => setOpen(!open)} aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={open}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className={`main-nav ${open ? 'is-open' : ''}`} aria-label="Navigation principale">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => isActive ? 'active' : ''}>
              {link.label}
            </NavLink>
          ))}
          <div className="nav-actions">
            <NavLink className="icon-button search-link" to="/predications" aria-label="Rechercher une prédication"><Search size={20} /></NavLink>
            <NavLink className="button button--nav" to="/connexion"><UserRound size={17} /> Se connecter</NavLink>
          </div>
        </nav>
      </div>
    </header>
  );
}
