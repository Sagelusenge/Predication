import { Mail, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from './Brand';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-intro">
          <Brand />
          <p>Une parole biblique pour fortifier la foi, relever les familles et servir l’Église au quotidien.</p>
        </div>
        <div>
          <h3>Explorer</h3>
          <Link to="/predications">Toutes les prédications</Link>
          <Link to="/a-propos">Le ministère</Link>
          <Link to="/contact">Nous écrire</Link>
          <Link to="/connexion">Administration</Link>
        </div>
        <div>
          <h3>Thèmes</h3>
          <Link to="/predications?theme=foi">Foi et croissance</Link>
          <Link to="/predications?theme=famille">Vie de famille</Link>
          <Link to="/predications?theme=priere">Prière</Link>
          <Link to="/predications?theme=esperance">Espérance</Link>
        </div>
        <div className="footer-contact">
          <h3>Nous trouver</h3>
          <p><MapPin size={17} /> Communauté Baptiste au Centre de l’Afrique</p>
          <a href="mailto:contact@parole-esperance.cd"><Mail size={17} /> contact@parole-esperance.cd</a>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Parole & Espérance. Tous droits réservés.</span>
        <span>Servir par la Parole, avec simplicité.</span>
      </div>
    </footer>
  );
}
