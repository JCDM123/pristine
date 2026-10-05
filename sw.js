/* Pristine service worker.
   Makes the site installable as an app, and keeps a copy of the pages and photos you have already opened
   so they still read with no signal. Pages are always fetched fresh when there is a connection, so a new
   story or a fix shows straight away; the saved copy is only used when the network fails.
   The studio, the Worker and the tracked /go/ links are never touched. */
var VERSION = 'pw-v1';
var PAGES = VERSION + '-pages', FILES = VERSION + '-files';
var MAX_PAGES = 60, MAX_FILES = 300;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(PAGES).then(function (c) { return c.addAll(['/', '/the-source.html', '/ancestral-kitchen.html', '/the-library.html']).catch(function () {}); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('pw-') === 0 && k.indexOf(VERSION) !== 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function trim(name, max) {
  caches.open(name).then(function (c) {
    c.keys().then(function (keys) { if (keys.length > max) c.delete(keys[0]).then(function () { trim(name, max); }); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/^\/(studio|preview-site)(\.html)?$/.test(url.pathname) || url.pathname.indexOf('/go/') === 0 || url.pathname === '/sw.js') return;

  var isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1;
  if (isPage) {
    // Network first, saved copy if offline
    e.respondWith(fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(PAGES).then(function (c) { c.put(req, copy); trim(PAGES, MAX_PAGES); }); }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match('/the-library.html'); });
    }));
    return;
  }

  if (/\.(jpg|jpeg|png|webp|svg|gif|css|js|woff2?|json|pdf)$/i.test(url.pathname) || url.pathname.indexOf('/images/') === 0) {
    // Saved copy first for speed, refreshed quietly in the background
    e.respondWith(caches.match(req).then(function (hit) {
      var fresh = fetch(req).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(FILES).then(function (c) { c.put(req, copy); trim(FILES, MAX_FILES); }); }
        return res;
      }).catch(function () { return hit; });
      return hit || fresh;
    }));
  }
});
