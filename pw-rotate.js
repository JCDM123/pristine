/* Gentle photo rotation.
   Homepage explore panels: if a panel holds more than one photo (chosen in the studio), they slowly cross-fade.
   The Source and Ancestral Kitchen featured story: rotates through that story's own photos (hero first, then its body or step photos).
   Nothing rotates for visitors who ask their device for less motion, or while the tab is hidden. */
(function () {
  var MAX = 4, EVERY = 7000;
  var still = false;
  try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function addStyle() {
    if (document.getElementById('pw-rotate-css')) return;
    var s = document.createElement('style');
    s.id = 'pw-rotate-css';
    s.textContent =
      '.explore-panel-img.pw-rot{position:relative;}' +
      '.explore-panel-img.pw-rot img{position:absolute;inset:0;opacity:0;transition:opacity 1.8s ease,transform 0.5s ease;}' +
      '.explore-panel-img.pw-rot img.on{opacity:1;}' +
      '.pw-feat-layer{position:absolute;inset:0;z-index:0;background-size:cover;background-position:center;opacity:0;transition:opacity 1.8s ease;}' +
      '.pw-feat-layer.on{opacity:1;}';
    document.head.appendChild(s);
  }

  // Cycles through items, calling show(i) every EVERY ms after an optional delay
  function cycle(count, show, delay, pauseEl) {
    var i = 0, paused = false;
    if (pauseEl) {
      pauseEl.addEventListener('mouseenter', function () { paused = true; });
      pauseEl.addEventListener('mouseleave', function () { paused = false; });
    }
    setTimeout(function () {
      setInterval(function () {
        if (paused || document.hidden) return;
        i = (i + 1) % count;
        show(i);
      }, EVERY);
    }, delay || 0);
  }

  function explorePanels() {
    var boxes = document.querySelectorAll('.explore-panel-img');
    var n = 0;
    Array.prototype.forEach.call(boxes, function (box) {
      var imgs = Array.prototype.slice.call(box.querySelectorAll('img'), 0, MAX);
      if (imgs.length < 2) return;
      box.classList.add('pw-rot');
      imgs.forEach(function (im, k) {
        if (k === 0) im.classList.add('on');
        else im.removeAttribute('loading'); // load the later photos early so each fade is smooth
      });
      // Offset each panel so they never change at the same moment
      cycle(imgs.length, function (i) {
        imgs.forEach(function (im, k) { im.classList.toggle('on', k === i); });
      }, (n++) * (EVERY / 2), box.closest('.explore-panel'));
    });
  }

  function cleanUrl(u) { return (u || '').trim().replace(/^['"]|['"]$/g, ''); }
  function usable(u) { return u && !/\.svg(\?|$)/i.test(u) && !/(^|\/)(logo|sig-)/i.test(u); }

  // Reads the featured story's own photos: the hero, then body photos (articles) or step photos (recipes)
  function storyPhotos(doc, pageUrl) {
    var list = [];
    var add = function (u) {
      u = cleanUrl(u);
      if (!usable(u)) return;
      try { u = new URL(u, pageUrl).href; } catch (e) { return; }
      if (list.indexOf(u) === -1) list.push(u);
    };
    var hero = doc.querySelector('.article-hero, .recipe-hero');
    if (hero) {
      var m = (hero.getAttribute('style') || '').match(/background(?:-image)?\s*:[^;]*url\(([^)]+)\)/i);
      if (m) add(m[1]);
    }
    Array.prototype.forEach.call(doc.querySelectorAll('.article-text img, .method-section figure img'), function (im) {
      add(im.getAttribute('src'));
    });
    return list;
  }

  function featured() {
    var box = document.querySelector('.featured .feat-img');
    var link = document.querySelector('.featured .read-link');
    if (!box || !link || !window.fetch || !window.DOMParser) return;
    var pageUrl = link.href;
    var m = (box.getAttribute('style') || '').match(/background-image\s*:\s*url\(([^)]+)\)/i);
    var current = '';
    try { current = m ? new URL(cleanUrl(m[1]), location.href).href : ''; } catch (e) {}
    fetch(pageUrl, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (html) {
      if (!html) return;
      var photos = storyPhotos(new DOMParser().parseFromString(html, 'text/html'), pageUrl);
      // The picture already showing always comes first
      if (current) photos = [current].concat(photos.filter(function (u) { return u !== current; }));
      photos = photos.slice(0, MAX);
      if (photos.length < 2) return;
      var layers = [], ready = [];
      photos.forEach(function (u, k) {
        var d = document.createElement('div');
        d.className = 'pw-feat-layer' + (k === 0 ? ' on' : '');
        d.style.backgroundImage = 'url("' + u.replace(/"/g, '%22') + '")';
        box.insertBefore(d, k ? layers[k - 1].nextSibling : box.firstChild); // behind the dark overlay and the title
        layers.push(d);
        // Only show a photo once it has loaded, so a missing file never fades in as a blank
        ready[k] = k === 0;
        if (k) { var pre = new Image(); pre.onload = function () { ready[k] = true; }; pre.src = u; }
      });
      var at = 0;
      cycle(photos.length, function (i) {
        var tries = 0, next = i;
        while (!ready[next] && tries < photos.length) { next = (next + 1) % photos.length; tries++; }
        if (next === at) return;
        layers[at].classList.remove('on');
        layers[next].classList.add('on');
        at = next;
      }, 0, box.closest('.featured'));
    }).catch(function () {});
  }

  function start() {
    if (still) return;
    addStyle();
    explorePanels();
    featured();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
