/* Pristine QR codes: branded vector QR codes and print-ready cards for the studio.
   Needs pw-qrcode-lib.js loaded first. Everything here runs in the browser. */
(function () {
  var FG = '#3B4630';       // deep olive, dark enough for every phone camera
  var BG = '#F5F0E8';       // Pristine cream
  var SAGE = '#8F9574';
  var MM = 300 / 25.4;      // pixels per millimetre at 300dpi

  function matrix(url) {
    var q = qrcode(0, 'H'); // highest error correction so the logo and a scuff never matter
    q.addData(url);
    q.make();
    return q;
  }

  // Vector QR code. logoInner is the inside of images/site/logo.svg (viewBox 0 0 800 800).
  function svg(url, logoInner, opts) {
    opts = opts || {};
    var fg = opts.fg || FG, bg = opts.bg || BG;
    var q = matrix(url), n = q.getModuleCount(), quiet = 4, size = n + quiet * 2;
    var mid = n / 2, logoD = logoInner ? Math.round(n * 0.26) : 0, clearR = logoD / 2 + 0.9;
    var finder = function (r, c) { return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7); };
    var parts = [];
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!q.isDark(r, c) || finder(r, c)) continue;
        if (logoD && Math.hypot(r + 0.5 - mid, c + 0.5 - mid) < clearR) continue;
        parts.push('<rect x="' + (c + quiet + 0.06) + '" y="' + (r + quiet + 0.06) + '" width="0.88" height="0.88" rx="0.3"/>');
      }
    }
    var eye = function (r, c) {
      var x = c + quiet, y = r + quiet;
      return '<path fill-rule="evenodd" d="M' + (x + 1.6) + ' ' + y + 'h3.8a1.6 1.6 0 0 1 1.6 1.6v3.8a1.6 1.6 0 0 1 -1.6 1.6h-3.8a1.6 1.6 0 0 1 -1.6 -1.6v-3.8a1.6 1.6 0 0 1 1.6 -1.6z' +
        'M' + (x + 2) + ' ' + (y + 1) + 'h3a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1z"/>' +
        '<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3" rx="0.9"/>';
    };
    var logo = '';
    if (logoD) {
      var lx = quiet + mid - logoD / 2;
      logo = '<circle cx="' + (quiet + mid) + '" cy="' + (quiet + mid) + '" r="' + (logoD / 2 + 0.5) + '" fill="' + bg + '"/>' +
        '<svg x="' + lx + '" y="' + lx + '" width="' + logoD + '" height="' + logoD + '" viewBox="0 0 800 800">' + logoInner + '</svg>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" width="' + (opts.px || size * 10) + '" height="' + (opts.px || size * 10) + '" shape-rendering="geometricPrecision">' +
      '<rect width="' + size + '" height="' + size + '" fill="' + bg + '"/>' +
      '<g fill="' + fg + '">' + parts.join('') + eye(0, 0) + eye(0, n - 7) + eye(n - 7, 0) + '</g>' + logo + '</svg>';
  }

  function svgImage(svgText) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error('Could not draw the QR code')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    });
  }

  function wrap(ctx, text, maxW) {
    var words = String(text || '').split(/\s+/), lines = [], line = '';
    words.forEach(function (w) {
      var t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    return lines;
  }

  function spaced(ctx, text, x, y, spacing, align) {
    var chars = String(text).split(''), w = chars.reduce(function (a, ch) { return a + ctx.measureText(ch).width + spacing; }, -spacing);
    var cx = align === 'center' ? x - w / 2 : x;
    ctx.textAlign = 'left';
    chars.forEach(function (ch) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; });
  }

  async function fontsReady() {
    try {
      await Promise.all([
        document.fonts.load('italic 400 40px "Cormorant Garamond"'),
        document.fonts.load('500 20px "Jost"'), document.fonts.load('400 20px "Jost"')]);
    } catch (e) {}
  }

  // Draws one card onto ctx at (ox, oy) in pixels. kind: 'card' 90x55mm or 'half' 45x55mm
  async function drawCard(ctx, ox, oy, kind, code, logoInner, shortUrl) {
    var img = await svgImage(svg(shortUrl, logoInner, { px: 1200 }));
    var W = (kind === 'card' ? 90 : 45) * MM, H = 55 * MM;
    ctx.fillStyle = BG; ctx.fillRect(ox, oy, W, H);
    var text = code.card_text || 'Scan to follow along';
    var urlText = shortUrl.replace(/^https?:\/\//, '');
    if (kind === 'card') {
      var qs = 43 * MM;
      ctx.drawImage(img, ox + 4 * MM, oy + (H - qs) / 2, qs, qs);
      var tx = ox + 50 * MM, tw = 36 * MM;
      ctx.fillStyle = SAGE; ctx.font = '500 ' + Math.round(6.2 * 300 / 72) + 'px Jost, Arial, sans-serif';
      spaced(ctx, 'PRISTINE WELLNESS', tx, oy + 13 * MM, 0.9 * MM * 0.35, 'left');
      ctx.fillStyle = '#1a1a1a'; ctx.font = 'italic 400 ' + Math.round(15 * 300 / 72) + 'px "Cormorant Garamond", Georgia, serif';
      var lines = wrap(ctx, text, tw), ly = oy + 24 * MM;
      lines.slice(0, 3).forEach(function (l) { ctx.textAlign = 'left'; ctx.fillText(l, tx, ly); ly += 6.4 * MM; });
      ctx.fillStyle = SAGE; ctx.fillRect(tx, ly - 2 * MM, 10 * MM, 0.35 * MM);
      ctx.fillStyle = '#6b6b6b'; ctx.font = '400 ' + Math.round(5.6 * 300 / 72) + 'px Jost, Arial, sans-serif';
      var uw = wrap(ctx, urlText, tw); var uy = oy + 48 * MM - (uw.length - 1) * 2.6 * MM;
      uw.forEach(function (l) { ctx.textAlign = 'left'; ctx.fillText(l, tx, uy); uy += 2.6 * MM; });
    } else {
      var q2 = 35 * MM;
      ctx.drawImage(img, ox + (W - q2) / 2, oy + 3.5 * MM, q2, q2);
      ctx.fillStyle = '#1a1a1a'; ctx.font = 'italic 400 ' + Math.round(11 * 300 / 72) + 'px "Cormorant Garamond", Georgia, serif';
      var l2 = wrap(ctx, text, W - 6 * MM).slice(0, 2), y2 = oy + 44 * MM - (l2.length - 1) * 2.4 * MM;
      l2.forEach(function (l) { ctx.textAlign = 'center'; ctx.fillText(l, ox + W / 2, y2); y2 += 4.8 * MM; });
      ctx.fillStyle = '#6b6b6b'; ctx.font = '400 ' + Math.round(4.6 * 300 / 72) + 'px Jost, Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.fillText(urlText, ox + W / 2, oy + 52 * MM);
    }
  }

  async function cardCanvas(kind, code, logoInner, shortUrl) {
    await fontsReady();
    var c = document.createElement('canvas');
    c.width = Math.round((kind === 'card' ? 90 : 45) * MM); c.height = Math.round(55 * MM);
    await drawCard(c.getContext('2d'), 0, 0, kind, code, logoInner, shortUrl);
    return c;
  }

  // A4 sheet of half cards (4 across, 5 down) with light cut lines, 300dpi
  async function sheetCanvas(codes, logoInner, urlFor) {
    await fontsReady();
    var c = document.createElement('canvas');
    c.width = Math.round(210 * MM); c.height = Math.round(297 * MM);
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    var ox = 15 * MM, oy = 11 * MM, cw = 45 * MM, ch = 55 * MM;
    for (var i = 0; i < Math.min(codes.length, 20); i++) {
      await drawCard(ctx, ox + (i % 4) * cw, oy + Math.floor(i / 4) * ch, 'half', codes[i], logoInner, urlFor(codes[i]));
    }
    ctx.strokeStyle = '#c9c9c3'; ctx.lineWidth = 1;
    for (var k = 0; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(ox + k * cw, oy - 4 * MM); ctx.lineTo(ox + k * cw, oy + 5 * ch + 4 * MM); ctx.stroke(); }
    for (var j = 0; j <= 5; j++) { ctx.beginPath(); ctx.moveTo(ox - 4 * MM, oy + j * ch); ctx.lineTo(ox + 4 * cw + 4 * MM, oy + j * ch); ctx.stroke(); }
    return c;
  }

  async function qrPngCanvas(url, logoInner, px) {
    var img = await svgImage(svg(url, logoInner, { px: px || 2000 }));
    var c = document.createElement('canvas'); c.width = c.height = px || 2000;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  window.PWQR = { svg: svg, cardCanvas: cardCanvas, sheetCanvas: sheetCanvas, qrPngCanvas: qrPngCanvas, matrix: matrix };
})();
