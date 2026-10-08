import { Link } from 'react-router-dom';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`brand ${compact ? 'brand--compact' : ''}`} to="/" aria-label="Pasteur Innocent Kombi Maliro, accueil">
      <img src="/logo-pasteur-innocent.png" alt="" />
      <span>
        <strong>Pasteur Innocent</strong>
        {!compact && <small>Prédication · Enseignement biblique</small>}
      </span>
    </Link>
  );
}
