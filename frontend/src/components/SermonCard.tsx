import { CalendarDays, Headphones, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { formatCount, formatDate, formatDuration } from '../lib/format';
import type { Sermon } from '../types';
import { LikeButton } from './LikeButton';

export function SermonCard({ sermon }: { sermon: Sermon }) {
  const player = useAudioPlayer();
  return (
    <article className="sermon-card">
      <Link to={`/predications/${sermon.slug}`} className="sermon-cover" aria-label={`Voir ${sermon.title}`}>
        <img src={sermon.coverUrl || '/brand-mark.svg'} alt="" loading="lazy" />
        <span className="sermon-category">{sermon.categoryName || 'Prédication'}</span>
      </Link>
      <div className="sermon-card-body">
        <div className="sermon-meta"><CalendarDays size={15} /> {formatDate(sermon.preachedOn)}</div>
        <h3><Link to={`/predications/${sermon.slug}`}>{sermon.title}</Link></h3>
        <p>{sermon.excerpt}</p>
        <div className="sermon-card-footer">
          <button className="play-text" onClick={() => player.play(sermon)}><span><Play size={15} fill="currentColor" /></span> Écouter</button>
          <div className="sermon-card-stats"><LikeButton sermon={sermon} compact /><span className="duration"><Headphones size={14} /> {formatDuration(sermon.durationSeconds ?? 0)} · {formatCount(sermon.playCount)}</span></div>
        </div>
      </div>
    </article>
  );
}
