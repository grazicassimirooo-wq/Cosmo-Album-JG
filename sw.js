/* Service Worker do Álbum J&G — PWA (instalável + offline) e notificações */
const CACHE = 'cosmo-album-v18';
const SHELL = [
  './', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
  './capitulo1-palavras.html', './capitulo3-toque.html', './capitulo4-servico.html',
  './capitulo5-tempo.html', './capitulo-presentes.html', './carta-amor.html',
  './memory-gallery.html', './quiz-linguagem.html', './mapa-navegacao.html',
  './narrativa-5-linguagens.html', './direcao-de-arte.html',
  './foto-capa-album.jpg', './foto-pacote-capa.jpg', './foto-jussara.jpg',
  './visual-fx.js', './magic.js', './presence.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // cada arquivo entra individualmente: um 404 não derruba o shell inteiro
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // só lida com GET do próprio site; Firebase/Firestore passam direto pela rede
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // páginas: tenta a rede (conteúdo novo) e cai pra PRÓPRIA página no cache se offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() =>
        caches.match(req).then(hit => hit || caches.match('./index.html'))
      )
    );
    return;
  }

  // demais arquivos (ícones, fotos, manifest): cache primeiro
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});

// Tocar na notificação foca/abre o álbum
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      for (const c of cs) { if ('focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
