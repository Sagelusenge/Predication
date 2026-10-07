import { Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatCount } from '../lib/format';
import type { Sermon } from '../types';
import { useToast } from '../context/ToastContext';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function LikeButton({ sermon, compact = false }: { sermon: Sermon; compact?: boolean }) {
  const storageKey = `papaleki-like-${sermon.id}`;
  const [liked, setLiked] = useState(Boolean(sermon.isLiked));
  const [count, setCount] = useState(sermon.likeCount ?? 0);
  const [busy, setBusy] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    setCount(sermon.likeCount ?? 0);
    const stored = localStorage.getItem(storageKey) === '1';
    setLiked(stored || Boolean(sermon.isLiked));
    if (uuidPattern.test(sermon.id)) {
      void api.likeStatus(sermon.id).then((response) => {
        setLiked(response.data.liked);
        setCount(response.data.likeCount);
      }).catch(() => undefined);
    }
  }, [sermon.id, sermon.isLiked, sermon.likeCount, storageKey]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (uuidPattern.test(sermon.id)) {
        const response = await api.toggleLike(sermon.id);
        setLiked(response.data.liked);
        setCount(response.data.likeCount);
        localStorage.setItem(storageKey, response.data.liked ? '1' : '0');
        notify(response.data.liked ? 'Prédication ajoutée à vos coups de cœur.' : 'Like retiré.', 'info');
      } else {
        const next = !liked;
        setLiked(next);
        setCount((value) => Math.max(0, value + (next ? 1 : -1)));
        localStorage.setItem(storageKey, next ? '1' : '0');
        notify(next ? 'Prédication aimée.' : 'Like retiré.', 'info');
      }
    } catch {
      notify('Le like n’a pas pu être enregistré.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return <button className={`like-button ${liked ? 'is-liked' : ''} ${compact ? 'like-button--compact' : ''}`} onClick={toggle} disabled={busy} aria-pressed={liked} aria-label={liked ? 'Retirer le like' : 'Aimer cette prédication'}><Heart size={compact ? 15 : 17} fill={liked ? 'currentColor' : 'none'} /><span>{compact ? formatCount(count) : `${liked ? 'Aimé' : 'J’aime'} · ${formatCount(count)}`}</span></button>;
}
