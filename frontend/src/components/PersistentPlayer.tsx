import { Gauge, Pause, Play, RotateCcw, RotateCw, Volume2, X } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { formatDuration } from '../lib/format';
import { Waveform } from './Waveform';

export function PersistentPlayer() {
  const player = useAudioPlayer();
  if (!player.current) return null;

  return (
    <aside className="persistent-player" aria-label="Lecteur audio">
      <div className="player-progress" style={{ '--progress': `${player.duration ? (player.currentTime / player.duration) * 100 : 0}%` } as React.CSSProperties} />
      <div className="player-inner">
        <img src={player.current.coverUrl || '/brand-mark.svg'} alt="" />
        <div className="player-title">
          <strong>{player.current.title}</strong>
          <span>{player.current.preacherName || 'Ministère pastoral CBCA'}</span>
        </div>
        <div className="player-controls">
          <button onClick={() => player.skip(-10)} aria-label="Reculer de 10 secondes"><RotateCcw size={19} /><small>10</small></button>
          <button className="player-main-button" onClick={player.toggle} aria-label={player.playing ? 'Mettre en pause' : 'Lire'}>
            {player.playing ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}
          </button>
          <button onClick={() => player.skip(10)} aria-label="Avancer de 10 secondes"><RotateCw size={19} /><small>10</small></button>
        </div>
        <div className="player-wave"><Waveform active={player.playing} compact /></div>
        <span className="player-time">{formatDuration(player.currentTime)} / {formatDuration(player.duration)}</span>
        <button className="speed-button" onClick={player.cycleSpeed}><Gauge size={16} /> {player.speed}×</button>
        <label className="volume-control"><Volume2 size={18} /><input type="range" min="0" max="1" step="0.05" value={player.volume} onChange={(event) => player.setVolume(Number(event.target.value))} aria-label="Volume" /></label>
        <button className="player-close" onClick={player.close} aria-label="Fermer le lecteur"><X size={19} /></button>
      </div>
    </aside>
  );
}
