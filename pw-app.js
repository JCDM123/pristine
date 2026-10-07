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
  // after that, the newest story, full screen, tap to read it. Once per session. Skipped for people who prefer less motion.
  try {
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (standalone && !calm && !sessionStorage.getItem('pw_opened')) {
      sessionStorage.setItem('pw_opened', '1');
      var firstEver = !localStorage.getItem('pw_opened_once');
      try { localStorage.setItem('pw_opened_once', '1'); } catch (e) {}
      var st = document.createElement('style');
      st.textContent = '#pw-open{position:fixed;inset:0;z-index:99999;background:#2b3326;overflow:hidden;transition:opacity .6s ease}' +
        '#pw-open.grid{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr)}' +
        '#pw-open.grid img.t{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transform:scale(1.06);animation:pwOpenIn .5s ease forwards}' +
        '#pw-open .m{position:absolute;left:50%;top:50%;width:112px;height:112px;margin:-56px 0 0 -56px;border-radius:50%;box-shadow:0 12px 40px rgba(0,0,0,.28);opacity:0;animation:pwOpenIn .5s .45s ease forwards}' +
        '#pw-open.story img.h{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;animation:pwDrift 2.6s ease-out forwards}' +
        '#pw-open.story .sh{position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,26,18,.1) 0%,rgba(20,26,18,.2) 45%,rgba(20,26,18,.85) 100%)}' +
        '#pw-open.story .m{top:auto;left:28px;bottom:36px;margin:0;width:56px;height:56px;animation-delay:.2s}' +
        '#pw-open.story .tx{position:absolute;left:28px;right:28px;bottom:110px;color:#fff;font-family:Jost,Arial,sans-serif;opacity:0;animation:pwOpenIn .6s .25s ease forwards}' +
        '#pw-open.story .tx small{display:block;font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:#c9d1b2;margin-bottom:12px}' +
        '#pw-open.story .tx b{display:block;font-family:"Cormorant Garamond",Georgia,serif;font-weight:400;font-style:italic;font-size:40px;line-height:1.1}' +
        '#pw-open.story .tx span{display:inline-block;margin-top:16px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;border:1px solid rgba(255,255,255,.7);border-radius:30px;padding:9px 16px}' +
        '@keyframes pwOpenIn{to{opacity:1;transform:none}}@keyframes pwDrift{from{transform:scale(1.08)}to{transform:scale(1)}}';
      var box = document.createElement('div'); box.id = 'pw-open';
      var hold = 1500;
      var mark = document.createElement('img'); mark.className = 'm'; mark.src = '/images/icon-192.png'; mark.alt = 'Pristine Wellness';
      var showGrid = function () {
        box.className = 'grid';
        var order = [6, 11, 1, 16, 7, 10, 4, 13, 2, 15, 9, 12, 3, 14, 5, 8];
        for (var i = 1; i <= 16; i++) {
          var im = document.createElement('img'); im.className = 't';
          im.src = '/images/site/splash/' + i + '.jpg'; im.alt = '';
          im.style.animationDelay = (order.indexOf(i) * 0.045) + 's';
          box.appendChild(im);
        }
        box.appendChild(mark);
      };
      var showStory = function (story) {
        box.className = 'story'; hold = 2200;
        var h = document.createElement('img'); h.className = 'h'; h.src = '/' + String(story.image).replace(/^\/+/, ''); h.alt = '';
        var sh = document.createElement('div'); sh.className = 'sh';
        var tx = document.createElement('div'); tx.className = 'tx';
        var isRecipe = /^\/?recipe-/.test(story.url);
        tx.innerHTML = '<small>' + (isRecipe ? 'New in the kitchen' : 'New this week') + '</small><b></b><span>Read it</span>';
        tx.querySelector('b').textContent = story.title;
        box.appendChild(h); box.appendChild(sh); box.appendChild(tx); box.appendChild(mark);
        box.addEventListener('click', function () { location.href = '/' + String(story.url).replace(/^\/+/, ''); });
      };
      var finish = function () {
        setTimeout(function () { box.style.opacity = '0'; box.style.pointerEvents = 'none'; setTimeout(function () { box.remove(); st.remove(); }, 650); }, hold);
      };
      var mount = function () { document.head.appendChild(st); document.body.appendChild(box); finish(); };
      var go = function (story) {
        if (story) showStory(story); else showGrid();
        if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
      };
      if (firstEver) go(null);
      else fetch('/data/search-index.json').then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
        var top = (Array.isArray(list) ? list : []).filter(function (e) { return e && e.image && e.url && e.title; })[0];
        go(top || null);
      }).catch(function () { go(null); });
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
