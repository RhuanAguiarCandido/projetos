// Service worker: guarda o app no aparelho para abrir sem internet.
const CACHE = 'hinario-v5';
const ARQUIVOS = [
  './', 'index.html', 'styles.css', 'app.js', 'store.js', 'config.js', 'seed.js',
  'manifest.webmanifest', 'img/logo.png', 'img/icon-192.png', 'img/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Arquivos do app, fontes e o SDK do Firebase: usa o que está salvo e atualiza em segundo plano.
// YouTube e o banco de dados (Firestore) passam direto — o Firestore tem o próprio cache offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cacheavel = url.origin === location.origin
    || url.href.startsWith('https://www.gstatic.com/firebasejs/')
    || url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com';
  if (!cacheavel) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const salvo = await c.match(req, { ignoreSearch: url.origin === location.origin });
    const rede = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => salvo);
    return salvo || rede;
  }));
});
