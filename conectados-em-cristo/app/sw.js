// Service worker: guarda o app no aparelho para abrir sem internet.
const CACHE = 'repertorio-v10.4'; // mesmo número de version.json
const ARQUIVOS = [
  './', 'index.html', 'styles.css', 'app.js', 'store.js', 'config.js', 'seed.js',
  'manifest.webmanifest', 'version.json', 'img/logo.png', 'img/logo-igreja.png', 'img/icon-192.png', 'img/icon-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' busca direto no servidor (ignora o cache do navegador), para nunca
  // guardar um arquivo antigo junto com a versão nova
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
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
  // A página em si (index.html) e os arquivos do app vêm primeiro da internet, para
  // ninguém ficar com uma versão misturada; o que está salvo só é usado sem conexão.
  const doApp = url.origin === location.origin && (req.mode === 'navigate' || /\.(html|js|css|json|webmanifest)$/.test(url.pathname));
  if (doApp) {
    e.respondWith(caches.open(CACHE).then((c) => fetch(req, { cache: 'no-cache' })
      .then((r) => { if (r.ok) c.put(req, r.clone()); return r; })
      .catch(() => c.match(req, { ignoreSearch: true }).then((s) => s || c.match('./')))));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const salvo = await c.match(req, { ignoreSearch: url.origin === location.origin });
    const rede = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => salvo);
    return salvo || rede;
  }));
});
