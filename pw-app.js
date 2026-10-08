/* The Pristine app.
   Registers the service worker so phones treat the site as an installable app, catches the install
   prompt on Android so one button installs it, and tells the Library page whether the app is already on
   this phone. Nothing here runs in the studio. */
(function () {
  if (/\/(studio|preview-site)(\.html)?$/.test(location.pathname)) return;

  var deferred = null;
  window.pwAppInstallReady = false;

  try {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
    }
  } catch (e) {}

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    window.pwAppInstallReady = true;
    document.dispatchEvent(new CustomEvent('pw-install-ready'));
  });

  window.addEventListener('appinstalled', function () {
    deferred = null;
    try { localStorage.setItem('pw_app', '1'); } catch (e) {}
    document.dispatchEvent(new CustomEvent('pw-installed'));
  });

  // Opening moment. When the app is opened from the home screen: the very first time, a wall of our photos;
  // after that, a small card slides up over the page with the newest story, tap to read it. Once per session.
  // Skipped for people who prefer less motion.
  try {
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (standalone && !calm && !sessionStorage.getItem('pw_opened')) {
      sessionStorage.setItem('pw_opened', '1');
      var firstEver = !localStorage.getItem('pw_opened_once');
      try { localStorage.setItem('pw_opened_once', '1'); } catch (e) {}
      var st = document.createElement('style');
      st.textContent = '#pw-open{position:fixed;inset:0;z-index:99999;background:#2b3326;overflow:hidden;transition:opacity .6s ease;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr)}' +
        '#pw-open img.t{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transform:scale(1.06);animation:pwOpenIn .5s ease forwards}' +
        '#pw-open .m{position:absolute;left:50%;top:50%;width:112px;height:112px;margin:-56px 0 0 -56px;border-radius:50%;box-shadow:0 12px 40px rgba(0,0,0,.28);opacity:0;animation:pwOpenIn .5s .45s ease forwards}' +
        '#pw-new{position:fixed;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:99998;background:#F5F0E8;color:#1a1a1a;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.28);display:flex;align-items:center;gap:14px;padding:12px 14px 12px 12px;font-family:Jost,Arial,sans-serif;transform:translateY(130%);transition:transform .55s cubic-bezier(.2,.8,.2,1),opacity .4s;cursor:pointer}' +
        '#pw-new.in{transform:none}#pw-new.out{transform:translateY(130%);opacity:0}' +
        '#pw-new img{width:64px;height:64px;border-radius:10px;object-fit:cover;flex-shrink:0}' +
        '#pw-new small{display:block;font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#8F9574;margin-bottom:4px}' +
        '#pw-new b{display:block;font-family:"Cormorant Garamond",Georgia,serif;font-weight:500;font-size:20px;line-height:1.15}' +
        '#pw-new .r{margin-left:auto;flex-shrink:0;font-size:10px;letter-spacing:.2em;text-transform:uppercase;background:#8F9574;color:#fff;border-radius:30px;padding:9px 14px}' +
        '@keyframes pwOpenIn{to{opacity:1;transform:none}}';
      document.head.appendChild(st);
      var showGrid = function () {
        var box = document.createElement('div'); box.id = 'pw-open';
        var order = [6, 11, 1, 16, 7, 10, 4, 13, 2, 15, 9, 12, 3, 14, 5, 8];
        for (var i = 1; i <= 16; i++) {
          var im = document.createElement('img'); im.className = 't';
          im.src = '/images/site/splash/' + i + '.jpg'; im.alt = '';
          im.style.animationDelay = (order.indexOf(i) * 0.045) + 's';
          box.appendChild(im);
        }
        var mark = document.createElement('img'); mark.className = 'm'; mark.src = '/images/icon-192.png'; mark.alt = 'Pristine Wellness';
        box.appendChild(mark);
        document.body.appendChild(box);
        setTimeout(function () { box.style.opacity = '0'; box.style.pointerEvents = 'none'; setTimeout(function () { box.remove(); }, 650); }, 1500);
      };
      var showCard = function (story) {
        if (/^\/?(article|recipe)-/.test(location.pathname.replace(/^\//, '')) ) return; // already reading something
        var card = document.createElement('div'); card.id = 'pw-new';
        var isRecipe = /^\/?recipe-/.test(story.url);
        card.innerHTML = '<img alt=""><div><small>' + (isRecipe ? 'New in the kitchen' : 'New this week') + '</small><b></b></div><span class="r">Read</span>';
        card.querySelector('img').src = '/' + String(story.image).replace(/^\/+/, '');
        card.querySelector('b').textContent = story.title;
        var gone = false, hide = function () { if (gone) return; gone = true; card.classList.add('out'); setTimeout(function () { card.remove(); }, 500); };
        card.addEventListener('click', function () { location.href = '/' + String(story.url).replace(/^\/+/, ''); });
        document.body.appendChild(card);
        requestAnimationFrame(function () { requestAnimationFrame(function () { card.classList.add('in'); }); });
        setTimeout(hide, 6000);
        window.addEventListener('scroll', hide, { once: true, passive: true });
      };
      var go = function (story) {
        var run = function () { if (story) showCard(story); else showGrid(); };
        if (document.body) run(); else document.addEventListener('DOMContentLoaded', run);
      };
      if (firstEver) go(null);
      else fetch('/data/search-index.json').then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
        var top = (Array.isArray(list) ? list : []).filter(function (e) { return e && e.image && e.url && e.title; })[0];
        if (top) go(top);
      }).catch(function () {});
    }
  } catch (e) {}

  // True when the site is open from the home screen icon
  window.pwAppInstalled = function () {
    try {
      if (window.matchMedia('(display-mode: standalone)').matches) return true;
      if (navigator.standalone === true) return true;
      return localStorage.getItem('pw_app') === '1';
    } catch (e) { return false; }
  };

  window.pwAppPlatform = function () {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'desktop';
  };

  // Android: opens the phone's own install sheet. Resolves true when installed.
  window.pwAppInstall = function () {
    if (!deferred) return Promise.resolve(false);
    var p = deferred; deferred = null;
    return p.prompt().then(function () { return p.userChoice; }).then(function (c) {
      var yes = c && c.outcome === 'accepted';
      if (!yes) window.pwAppInstallReady = false;
      return yes;
    }).catch(function () { return false; });
  };
})();
