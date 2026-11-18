const C = 'skjevekker-v3';
const FILES = ['./', 'index.html', 'app.js', 'alarm.js', 'verify.js', 'manifest.webmanifest', 'icon-180.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(FILES))));
self.addEventListener('fetch', e => {
  if (e.request.url.startsWith(self.location.origin))
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
