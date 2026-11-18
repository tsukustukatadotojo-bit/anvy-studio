/* Studio (anvy-studio) — service worker: cho phép cài Studio thành app và mở được cả khi mạng chập chờn.
   Luôn lấy bản mới từ mạng trước; mất mạng thì dùng bản đã lưu gần nhất. Không đụng tới Spotify, Instagram… (khác tên miền). */
const CACHE = 'anvy-studio-v2';
const SHELL = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  // chỉ dọn cache cũ của Studio (anvy-studio-…), không đụng cache của app Anrevy House
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('anvy-studio-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && res.type === 'basic'){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? './' : req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(m => m || (req.mode === 'navigate' ? caches.match('./') : Response.error())))
  );
});

/* Thông báo tin nhắn (Web Push từ bot của Anrevy House): hiện thông báo của máy; bấm vào thì mở Studio ở khung tin nhắn.
   Studio đang mở trước mắt thì thôi — Studio tự báo bằng dòng nhỏ và tiếng ting. */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    if (cs.some(c => c.visibilityState === 'visible' && c.url.startsWith(self.registration.scope))) return;
    return self.registration.showNotification(d.title || 'Anh', {
      body: d.body || 'Có tin nhắn mới', tag: d.tag || 'studio-chat', renotify: true,
      icon: './icons/icon-192.png', data: { url: d.url || './?chat=1' }
    });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './?chat=1', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.startsWith(self.registration.scope));
    if (c){ c.postMessage({ type: 'open-chat' }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
