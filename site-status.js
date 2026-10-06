/* QR codes and tracked links: pristinewellness.com.au/go/<name> is counted by the Worker,
   which then sends the visitor on to the right page. This runs first so nothing else gets in the way. */
(function () {
  try {
    var m = location.pathname.match(/^\/go\/([A-Za-z0-9-]{1,60})\/?$/);
    if (m) { window.PW_GOING = true; location.replace('https://pristine-api.jc-a7f.workers.dev/go/' + m[1].toLowerCase()); }
  } catch (e) {}
})();

/* Maintenance switch. The studio sets MAINTENANCE to true or false.
   While it is on, visitors see /maintenance.html. Anyone who has unlocked the studio on this device still sees the full site. */
(function () {
  var MAINTENANCE = false;
  window.PW_MAINTENANCE = MAINTENANCE;
  try {
    if (!MAINTENANCE || window.PW_GOING) return;
    if (/\/(maintenance|studio|preview-site)(\.html)?$/.test(location.pathname)) return;
    if (localStorage.getItem('pw_owner') === '1') return;
    location.replace('/maintenance.html');
  } catch (e) {}
})();

/* Where a visitor came from. A QR code adds ?pw_src=qr:<name> (and an optional welcome message),
   which is remembered for 30 days so a later newsletter signup can be credited to that code. */
(function () {
  var KEY = 'pw_ref', DAYS = 30;
  window.pwGetRef = function () {
    try {
      var r = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (r && r.src && Date.now() - r.t < DAYS * 86400000) return r.src;
    } catch (e) {}
    return '';
  };
  try {
    var p = new URLSearchParams(location.search);
    var src = p.get('pw_src');
    if (!src || !/^qr:[a-z0-9-]{1,60}$/.test(src)) return;
    localStorage.setItem(KEY, JSON.stringify({ src: src, t: Date.now() }));
    var msg = (p.get('pw_l') || '').slice(0, 120);
    p.delete('pw_src'); p.delete('pw_l');
    var q = p.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
    if (!msg) return;
    var show = function () {
      var b = document.createElement('div');
      b.id = 'pw-qr-welcome';
      b.setAttribute('role', 'status');
      b.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;max-width:calc(100% - 32px);background:#F5F0E8;color:#3B4630;border:1px solid #d9d3c4;border-radius:40px;padding:12px 44px 12px 20px;font-family:Jost,Arial,sans-serif;font-size:14px;line-height:1.4;box-shadow:0 6px 24px rgba(0,0,0,0.12);';
      b.textContent = msg;
      var x = document.createElement('button');
      x.setAttribute('aria-label', 'Close');
      x.textContent = '×';
      x.style.cssText = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:20px;line-height:1;color:#8F9574;cursor:pointer;padding:4px;';
      x.onclick = function () { b.remove(); };
      b.appendChild(x);
      document.body.appendChild(b);
      setTimeout(function () { if (b.parentNode) { b.style.transition = 'opacity 0.6s'; b.style.opacity = '0'; setTimeout(function () { b.remove(); }, 700); } }, 9000);
    };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  } catch (e) {}
})();
