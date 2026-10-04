/* Listen button.
   Adds a "Listen" button to the share bar on every story and recipe. The reader's own device reads the page aloud
   using the voice built into the browser, so nothing leaves the page and there is nothing to pay for.
   Pause and resume with the same button, Stop with the small x. The button stays hidden on devices with no voice. */
(function () {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;

  var synth = window.speechSynthesis;
  var chunks = [], at = 0, state = 'idle', btn, stopBtn, label;

  function addStyle() {
    var s = document.createElement('style');
    s.id = 'pw-listen-css';
    s.textContent =
      '.pw-listen{border-color:var(--sage,#8F9574);color:var(--sage,#8F9574);background:transparent;cursor:pointer;flex-shrink:0;}' +
      '.pw-listen:hover{background:var(--sage,#8F9574);color:#fff;}' +
      '.pw-listen.on{background:var(--sage,#8F9574);color:#fff;}' +
      '.pw-listen svg{width:12px;height:12px;fill:currentColor;stroke:none;flex-shrink:0;}' +
      '.pw-listen-stop{display:none;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;border:0.5px solid var(--border,#e8e8e4);' +
      'background:transparent;color:#999;cursor:pointer;flex-shrink:0;font-size:14px;line-height:1;transition:all .3s;}' +
      '.pw-listen-stop:hover{border-color:var(--sage,#8F9574);color:var(--sage,#8F9574);}' +
      '.pw-listen-stop.show{display:flex;}';
    document.head.appendChild(s);
  }

  var PLAY = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';

  function clean(t) { return (t || '').replace(/\s+/g, ' ').trim(); }

  // Gathers the words on the page in reading order. Sources, share buttons and menus are left out.
  function gather() {
    var out = [];
    var h1 = document.querySelector('.article-hero h1, .recipe-hero h1, h1');
    if (h1) out.push(clean(h1.textContent));

    var intro = document.querySelector('.article-intro');
    if (intro) out.push(clean(intro.textContent));

    var body = document.querySelectorAll('.article-text > h2, .article-text > p, .article-text > ul > li, .article-text > ol > li, .pull-quote blockquote');
    for (var i = 0; i < body.length; i++) {
      var el = body[i].cloneNode(true);
      var sups = el.querySelectorAll('sup'); // citation numbers are not read out
      for (var j = 0; j < sups.length; j++) sups[j].parentNode.removeChild(sups[j]);
      var t = clean(el.textContent);
      if (t) out.push(t);
    }

    var about = document.querySelectorAll('.recipe-about p');
    for (i = 0; i < about.length; i++) out.push(clean(about[i].textContent));

    var ings = document.querySelectorAll('.ingredient-item');
    if (ings.length) {
      out.push('You will need.');
      for (i = 0; i < ings.length; i++) {
        var a = ings[i].querySelector('.ing-amount'), n = ings[i].querySelector('.ing-name');
        out.push(clean((a ? a.textContent : '') + ' ' + (n ? n.textContent : ings[i].textContent)) + '.');
      }
    }

    var steps = document.querySelectorAll('.method-step .step-text');
    if (steps.length) {
      out.push('Method.');
      for (i = 0; i < steps.length; i++) out.push('Step ' + (i + 1) + '. ' + clean(steps[i].textContent));
    }

    var notes = document.querySelectorAll('.chef-tip p, .chef-note p, .serving-suggestion p');
    for (i = 0; i < notes.length; i++) out.push(clean(notes[i].textContent));

    return out.filter(Boolean);
  }

  // Picks a natural sounding English voice, Australian first
  function pickVoice() {
    var voices = synth.getVoices() || [];
    if (!voices.length) return null;
    var want = ['en-AU', 'en-GB', 'en-US', 'en'];
    var nice = /natural|neural|premium|enhanced|karen|catherine|lee|google|samantha|daniel|serena|moira/i;
    for (var w = 0; w < want.length; w++) {
      for (var i = 0; i < voices.length; i++) {
        var l = (voices[i].lang || '').replace('_', '-');
        if (l.indexOf(want[w]) === 0 && nice.test(voices[i].name)) return voices[i];
      }
      for (i = 0; i < voices.length; i++) {
        if ((voices[i].lang || '').replace('_', '-').indexOf(want[w]) === 0) return voices[i];
      }
    }
    return voices[0];
  }

  function setUI() {
    if (state === 'playing') { btn.classList.add('on'); btn.innerHTML = PAUSE + '<span>Pause</span>'; stopBtn.classList.add('show'); }
    else if (state === 'paused') { btn.classList.add('on'); btn.innerHTML = PLAY + '<span>Resume</span>'; stopBtn.classList.add('show'); }
    else { btn.classList.remove('on'); btn.innerHTML = PLAY + '<span>Listen</span>'; stopBtn.classList.remove('show'); }
  }

  function speakNext() {
    if (state !== 'playing') return;
    if (at >= chunks.length) { stop(); return; }
    var u = new SpeechSynthesisUtterance(chunks[at]);
    var v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'en-AU'; }
    u.rate = 0.95; u.pitch = 1;
    u.onend = function () { at++; speakNext(); };
    u.onerror = function (e) { if (e && e.error === 'interrupted') return; at++; speakNext(); };
    synth.speak(u);
  }

  function start() {
    chunks = gather();
    if (!chunks.length) return;
    at = 0; state = 'playing'; setUI();
    synth.cancel();
    speakNext();
  }

  function stop() {
    state = 'idle'; at = 0; setUI();
    synth.cancel();
  }

  function toggle() {
    if (state === 'idle') { start(); return; }
    if (state === 'playing') { state = 'paused'; synth.pause(); setUI(); return; }
    if (state === 'paused') { state = 'playing'; synth.resume(); setUI(); }
  }

  function build() {
    var bar = document.querySelector('.share-bar');
    if (!bar) return;
    addStyle();
    btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'share-btn pw-listen'; btn.setAttribute('aria-label', 'Listen to this story');
    btn.addEventListener('click', toggle);
    stopBtn = document.createElement('button');
    stopBtn.type = 'button'; stopBtn.className = 'pw-listen-stop'; stopBtn.setAttribute('aria-label', 'Stop listening'); stopBtn.innerHTML = '&#215;';
    stopBtn.addEventListener('click', stop);
    label = bar.querySelector('.share-label');
    if (label && label.nextSibling) { bar.insertBefore(stopBtn, label.nextSibling); bar.insertBefore(btn, label.nextSibling); }
    else { bar.appendChild(btn); bar.appendChild(stopBtn); }
    setUI();
    // Voices load late on some browsers; nothing to do but let them arrive
    if (typeof synth.onvoiceschanged !== 'undefined') synth.onvoiceschanged = function () {};
    window.addEventListener('pagehide', function () { synth.cancel(); });
    // Safari on iPhone drops the voice if the tab goes to the background mid sentence; pause cleanly instead
    document.addEventListener('visibilitychange', function () { if (document.hidden && state === 'playing') { state = 'paused'; synth.pause(); setUI(); } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
