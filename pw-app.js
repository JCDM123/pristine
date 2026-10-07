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

  // Opening moment. When the app is opened from the home screen, a one second medley of our photos
  // fades in over the page and settles, once per session. Skipped for people who prefer less motion.
  try {
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (standalone && !calm && !sessionStorage.getItem('pw_opened')) {
      sessionStorage.setItem('pw_opened', '1');
      var css = '#pw-open{position:fixed;inset:0;z-index:99999;background:#2b3326;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);gap:0;padding:0;transition:opacity .6s ease}' +
        '#pw-open img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transform:scale(1.06);animation:pwOpenIn .5s ease forwards}' +
        '#pw-open .m{position:absolute;left:50%;top:50%;width:112px;height:112px;margin:-56px 0 0 -56px;border-radius:50%;box-shadow:0 12px 40px rgba(0,0,0,.28);opacity:0;animation:pwOpenIn .5s .45s ease forwards}' +
        '@keyframes pwOpenIn{to{opacity:1;transform:scale(1)}}';
      var st = document.createElement('style'); st.textContent = css;
      var box = document.createElement('div'); box.id = 'pw-open';
      var order = [6, 11, 1, 16, 7, 10, 4, 13, 2, 15, 9, 12, 3, 14, 5, 8];
      for (var i = 1; i <= 16; i++) {
        var im = document.createElement('img');
        im.src = '/images/site/splash/' + i + '.jpg'; im.alt = '';
        im.style.animationDelay = (order.indexOf(i) * 0.045) + 's';
        box.appendChild(im);
      }
      var mark = document.createElement('img'); mark.className = 'm'; mark.src = '/images/icon-192.png'; mark.alt = 'Pristine Wellness';
      box.appendChild(mark);
      var mount = function () {
        document.head.appendChild(st); document.body.appendChild(box);
        setTimeout(function () { box.style.opacity = '0'; setTimeout(function () { box.remove(); st.remove(); }, 650); }, 1500);
      };
      if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
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
