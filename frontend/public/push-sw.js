self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Pasteur Innocent Kombi Maliro';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'Un nouveau message est disponible.',
    icon: '/pwa-192x192.png',
    badge: '/favicon.png',
    tag: data.kind === 'daily_verse' ? `daily-verse-${data.date || ''}` : `sermon-${data.sermonId || ''}`,
    data: { url: data.url || '/' },
    vibrate: [180, 80, 180],
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
    for (const client of clients) {
      if ('focus' in client) {
        if ('navigate' in client) await client.navigate(targetUrl);
        return client.focus();
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
  }));
});
