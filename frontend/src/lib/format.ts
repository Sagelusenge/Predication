export function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

export function formatDuration(seconds = 0) {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

export function formatCount(value = 0) {
  return new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(value);
}
