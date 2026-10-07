import { Link } from 'react-router-dom';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`brand ${compact ? 'brand--compact' : ''}`} to="/" aria-label="Parole et Espérance, accueil">
      <img src="/brand-mark.svg" alt="" />
      <span>
        <strong>Parole & Espérance</strong>
        {!compact && <small>Ministère pastoral · CBCA</small>}
      </span>
    </Link>
  );
}
