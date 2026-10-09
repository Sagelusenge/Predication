import { AlertTriangle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';

type ProcessingSermon = Record<string, unknown>;

const processingState = (item: ProcessingSermon) => String(item.latestJobStatus || item.audioStatus || '');
const isActive = (item: ProcessingSermon) => ['queued', 'processing', 'uploaded'].includes(processingState(item));
const isFailed = (item: ProcessingSermon) => processingState(item) === 'failed' || item.audioStatus === 'failed';

export function AudioProcessingMonitor() {
  const [items, setItems] = useState<ProcessingSermon[]>([]);
  const previous = useRef(new Map<string, string>());
  const initialized = useRef(false);
  const { notify } = useToast();

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await api.adminSermons('page=1&limit=100');
        if (!active) return;
        const next = response.data;
        if (initialized.current) {
          for (const item of next) {
            const id = String(item.id);
            const before = previous.current.get(id);
            const current = processingState(item);
            if (before && ['queued', 'processing', 'uploaded'].includes(before)) {
              if (current === 'completed' || item.audioStatus === 'ready') {
                notify(`Compression terminée : ${String(item.title)}.`, 'success');
              } else if (current === 'failed' || item.audioStatus === 'failed') {
                notify(`La compression de « ${String(item.title)} » a échoué.`, 'error');
              }
            }
          }
        }
        previous.current = new Map(next.map((item) => [String(item.id), processingState(item)]));
        initialized.current = true;
        setItems(next.filter((item) => isActive(item) || isFailed(item)));
      } catch {
        // Le reste de l'administration reste utilisable si ce suivi ponctuel echoue.
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 4_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [notify]);

  const current = items.find(isActive) ?? items.find(isFailed);
  if (!current) return null;
  const failed = isFailed(current);
  const progress = Math.max(0, Math.min(100, Number(current.progressPercent ?? 0)));

  return <aside className={`audio-processing-monitor ${failed ? 'is-failed' : ''}`} aria-live="polite">
    <div className="audio-processing-monitor__heading">
      {failed ? <AlertTriangle size={21} /> : progress >= 100 ? <CheckCircle2 size={21} /> : <LoaderCircle size={21} className="spin" />}
      <span><strong>{failed ? 'Compression interrompue' : 'Compression audio en cours'}</strong><small>{String(current.title)}</small></span>
      <em>{failed ? 'Erreur' : `${progress} %`}</em>
    </div>
    {!failed && <progress max="100" value={progress}>{progress}%</progress>}
    <div className="audio-processing-monitor__footer">
      <span>{failed ? 'Remplacez le fichier audio pour relancer le traitement.' : 'Vous pouvez continuer à utiliser l’administration.'}</span>
      <Link to={failed ? `/admin/publier?edit=${String(current.id)}` : '/admin/predications'}>{failed ? 'Remplacer l’audio' : 'Voir le suivi'}</Link>
    </div>
  </aside>;
}
