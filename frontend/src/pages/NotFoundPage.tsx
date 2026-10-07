import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return <section className="not-found"><span>404</span><h1>Cette page reste à écrire.</h1><p>Le contenu demandé n’existe pas ou a été déplacé.</p><Link to="/" className="button button--primary"><ArrowLeft size={17} /> Revenir à l’accueil</Link></section>;
}
