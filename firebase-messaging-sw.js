/* Service worker do Firebase Cloud Messaging — recebe o push com o app fechado */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD0-GBYHLsYc_mqqq3Ymhbq3ynpIdx2sMg",
  authDomain: "album--jussara.firebaseapp.com",
  projectId: "album--jussara",
  storageBucket: "album--jussara.firebasestorage.app",
  messagingSenderId: "732871382789",
  appId: "1:732871382789:web:7d93bce8c431ba80bd496c",
  measurementId: "G-50GSPDT1P9"
});

const messaging = firebase.messaging();

// Mensagem recebida com o app em segundo plano / fechado
messaging.onBackgroundMessage((payload) => {
  // se veio o bloco `notification`, o navegador já exibe sozinho — mostrar
  // de novo aqui duplicaria o aviso
  if (payload && payload.notification) return;
  const d = (payload && payload.data) || {};
  self.registration.showNotification(d.title || '💛 Novidade no álbum!', {
    body: d.body || 'Tem algo novo esperando por você ✦',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || 'cosmo-album',
    renotify: true,
    data: { link: d.link || './' }
  });
});

// Tocar na notificação abre a página certa (link resolvido pelo escopo do SW —
// funciona no Firebase Hosting e no GitHub Pages, que serve num subcaminho)
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || './';
  const url = new URL(link, self.registration.scope).href;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if ('focus' in c) {
          if (c.url !== url && 'navigate' in c) c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
