import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { Sermon } from '../types';

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

type AudioPlayerValue = {
  current: Sermon | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  speed: number;
  play: (sermon: Sermon) => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  skip: (seconds: number) => void;
  setVolume: (volume: number) => void;
  cycleSpeed: () => void;
  close: () => void;
};

const AudioPlayerContext = createContext<AudioPlayerValue | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentRef = useRef<Sermon | null>(null);
  const [current, setCurrent] = useState<Sermon | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = volume;
    audioRef.current = audio;

    const syncTime = () => setCurrentTime(audio.currentTime || 0);
    const syncDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => {
      setPlaying(false);
      const sermon = currentRef.current;
      if (sermon && isUuid(sermon.id)) void api.recordEvent(sermon.id, 'complete', Math.round(audio.duration || 0)).catch(() => undefined);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    audio.addEventListener('timeupdate', syncTime);
    audio.addEventListener('loadedmetadata', syncDuration);
    audio.addEventListener('durationchange', syncDuration);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', syncTime);
      audio.removeEventListener('loadedmetadata', syncDuration);
      audio.removeEventListener('durationchange', syncDuration);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
    };
  }, []);

  const value = useMemo<AudioPlayerValue>(() => ({
    current,
    playing,
    currentTime,
    duration: duration || current?.durationSeconds || 0,
    volume,
    speed,
    play(sermon) {
      const audio = audioRef.current;
      if (!audio) return;
      if (current?.id !== sermon.id) {
        setCurrent(sermon);
        currentRef.current = sermon;
        setCurrentTime(0);
        setDuration(sermon.durationSeconds ?? 0);
        if (sermon.audioUrl) {
          audio.src = sermon.audioUrl;
          audio.load();
          void audio.play().catch(() => setPlaying(false));
        } else {
          audio.removeAttribute('src');
          setPlaying(true);
        }
        if (isUuid(sermon.id)) void api.recordEvent(sermon.id, 'play_start').catch(() => undefined);
      } else if (audio.src) {
        if (audio.paused) void audio.play().catch(() => setPlaying(false));
        else audio.pause();
      } else {
        setPlaying((state) => !state);
      }
    },
    toggle() {
      if (!current) return;
      const audio = audioRef.current;
      if (audio?.src) {
        if (audio.paused) void audio.play().catch(() => setPlaying(false));
        else audio.pause();
      } else {
        setPlaying((state) => !state);
      }
    },
    seek(seconds) {
      const audio = audioRef.current;
      const max = duration || current?.durationSeconds || 0;
      const target = Math.max(0, Math.min(seconds, max));
      if (audio?.src) audio.currentTime = target;
      setCurrentTime(target);
    },
    skip(seconds) {
      const audio = audioRef.current;
      const now = audio?.src ? audio.currentTime : currentTime;
      const max = duration || current?.durationSeconds || 0;
      const target = Math.max(0, Math.min(now + seconds, max));
      if (audio?.src) audio.currentTime = target;
      setCurrentTime(target);
    },
    setVolume(next) {
      const safe = Math.max(0, Math.min(next, 1));
      if (audioRef.current) audioRef.current.volume = safe;
      setVolumeState(safe);
    },
    cycleSpeed() {
      const speeds = [1, 1.25, 1.5, 2];
      const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
      if (audioRef.current) audioRef.current.playbackRate = next;
      setSpeed(next);
    },
    close() {
      audioRef.current?.pause();
      setCurrent(null);
      currentRef.current = null;
      setCurrentTime(0);
      setPlaying(false);
    }
  }), [current, currentTime, duration, playing, speed, volume]);

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) throw new Error('useAudioPlayer doit être utilisé dans AudioPlayerProvider.');
  return context;
}
