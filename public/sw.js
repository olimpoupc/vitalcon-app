// Service Worker for Droguería Vitalcon PWA
const CACHE_NAME = 'vitalcon-cache-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle WhatsApp / Android Share Target file sharing
  if (event.request.method === 'POST' && url.pathname === '/') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('invoiceFile');
          if (file) {
            const cache = await caches.open('vitalcon-shared-file');
            await cache.put('/shared-invoice', new Response(file));
          }
        } catch (err) {
          console.error('Error receiving shared file in SW:', err);
        }
        // Redirect to homepage with query param
        return Response.redirect('/?shared=true', 303);
      })()
    );
    return;
  }

  // Standard fetch handling with network-first strategy
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
