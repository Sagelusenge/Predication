export function Waveform({ active = false, compact = false }: { active?: boolean; compact?: boolean }) {
  const bars = [34, 58, 41, 76, 49, 86, 63, 38, 70, 92, 52, 79, 46, 65, 31, 73, 55, 88, 62, 43, 75, 50, 82, 36, 68, 57, 90, 48, 72, 40, 78, 59, 85, 45, 69, 53, 80, 37, 64, 74];
  return (
    <div className={`waveform ${compact ? 'waveform--compact' : ''} ${active ? 'is-active' : ''}`} aria-hidden="true">
      {bars.map((height, index) => <i key={index} style={{ height: `${height}%`, animationDelay: `${index * 32}ms` }} />)}
    </div>
  );
}
