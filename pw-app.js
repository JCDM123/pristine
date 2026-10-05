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
