"""Story video.
Turns a story page into a narrated video: the title over the hero photo, each section read over one of the
story's own photos with a slow drift, a caption line, and a closing card with the site address.

  python scripts/story_video.py article-stress-doesnt-stay-in-your-head.html --out out/stress.mp4

Voice: the Australian neural voice (edge-tts, free) when it can be reached, otherwise an offline piper voice
(PIPER_MODEL=path/to/voice.onnx), otherwise espeak-ng. Fonts live in scripts/video/fonts."""
import argparse, json, os, re, shutil, subprocess, sys, tempfile, wave
from html import unescape

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
FONTS = os.path.join(HERE, 'video', 'fonts')
W, H, FPS = 1920, 1080, 25  # set to 1080x1920 by --vertical
XF = 0.7  # crossfade seconds
SITE = 'pristinewellness.com.au'
SAGE = (143, 149, 116)


def ffmpeg_bin():
    for c in ('ffmpeg',):
        if shutil.which(c): return c
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


# ---------- read the story ----------
def text_of(el):
    for s in el.find_all('sup'): s.decompose()
    return re.sub(r'\s+', ' ', el.get_text(' ')).strip()


def read_story(path):
    from bs4 import BeautifulSoup
    html = open(path, encoding='utf-8').read()
    soup = BeautifulSoup(html, 'html.parser')
    kind = 'recipe' if soup.select_one('.recipe-hero') else 'article'
    hero_el = soup.select_one('.article-hero, .recipe-hero')
    hero = ''
    if hero_el:
        m = re.search(r"url\(['\"]?([^'\")]+)", hero_el.get('style', ''))
        if m: hero = m.group(1)
        if not hero:
            im = hero_el.find('img')
            if im: hero = im.get('src', '')
    title = text_of(soup.find('h1')) if soup.find('h1') else os.path.basename(path)
    intro_el = soup.select_one('.article-intro')
    intro = text_of(intro_el) if intro_el else ''
    images = []
    for im in soup.select('.article-text img, .recipe-content img, .recipe-body img, figure img'):
        src = im.get('src', '')
        if src and src not in images and '/site/' not in src and 'sig-' not in src: images.append(src)
    sections = []
    if kind == 'article':
        for block in soup.select('.article-text, .pull-quote'):
            if 'pull-quote' in block.get('class', []):
                q = block.find('blockquote')
                if q: sections.append({'heading': '', 'paras': [text_of(q)], 'quote': True})
                continue
            cur = None
            for el in block.children:
                if getattr(el, 'name', None) == 'h2':
                    cur = {'heading': text_of(el), 'paras': []}; sections.append(cur)
                elif getattr(el, 'name', None) in ('p', 'ul', 'ol'):
                    t = text_of(el)
                    if not t: continue
                    if cur is None: cur = {'heading': '', 'paras': []}; sections.append(cur)
                    cur['paras'].append(t)
    else:
        about = [text_of(p) for p in soup.select('.recipe-about p')]
        if about: sections.append({'heading': 'About this recipe', 'paras': about})
        ings = []
        for it in soup.select('.ingredient-item'):
            a = it.select_one('.ing-amount'); n = it.select_one('.ing-name')
            ings.append(((text_of(a) + ' ') if a else '') + (text_of(n) if n else text_of(it)))
        if ings: sections.append({'heading': 'You will need', 'paras': [', '.join(ings) + '.']})
        steps = [text_of(s) for s in soup.select('.method-step .step-text')]
        if steps: sections.append({'heading': 'Method', 'paras': ['Step %d. %s' % (i + 1, s) for i, s in enumerate(steps)]})
        notes = [text_of(p) for p in soup.select('.chef-tip p, .chef-note p, .serving-suggestion p')]
        if notes: sections.append({'heading': 'A note from the kitchen', 'paras': notes})
    desc_el = soup.find('meta', attrs={'name': 'description'})
    return {'kind': kind, 'title': title, 'intro': intro, 'hero': hero, 'images': images, 'sections': sections,
            'description': desc_el.get('content', '') if desc_el else '', 'file': os.path.basename(path)}


# ---------- voice ----------
def say_edge(text, out_wav, voice):
    import asyncio, edge_tts
    mp3 = out_wav + '.mp3'
    async def run():
        await edge_tts.Communicate(text, voice, rate='-6%', proxy=os.environ.get('HTTPS_PROXY')).save(mp3)
    asyncio.run(run())
    subprocess.run([ffmpeg_bin(), '-y', '-loglevel', 'error', '-i', mp3, '-ar', '44100', '-ac', '2', out_wav], check=True)
    os.remove(mp3)


_piper = None
def say_piper(text, out_wav, model):
    global _piper
    from piper import PiperVoice
    if _piper is None: _piper = PiperVoice.load(model)
    raw = out_wav + '.raw.wav'
    with wave.open(raw, 'wb') as w: _piper.synthesize_wav(text, w)
    subprocess.run([ffmpeg_bin(), '-y', '-loglevel', 'error', '-i', raw, '-ar', '44100', '-ac', '2', out_wav], check=True)
    os.remove(raw)


def say_espeak(text, out_wav):
    raw = out_wav + '.raw.wav'
    subprocess.run(['espeak-ng', '-v', 'en-gb', '-s', '150', '-w', raw, text], check=True)
    subprocess.run([ffmpeg_bin(), '-y', '-loglevel', 'error', '-i', raw, '-ar', '44100', '-ac', '2', out_wav], check=True)
    os.remove(raw)


class Voice:
    def __init__(self, prefer):
        self.mode = None; self.model = os.environ.get('PIPER_MODEL', '')
        self.voice = os.environ.get('EDGE_VOICE', 'en-AU-NatashaNeural')
        order = [prefer] if prefer else ['edge', 'piper', 'espeak']
        if prefer: order += [m for m in ('edge', 'piper', 'espeak') if m != prefer]
        self.order = order

    def say(self, text, out_wav):
        last = None
        for m in ([self.mode] if self.mode else self.order):
            try:
                if m == 'edge': say_edge(text, out_wav, self.voice)
                elif m == 'piper' and self.model: say_piper(text, out_wav, self.model)
                elif m == 'espeak' and shutil.which('espeak-ng'): say_espeak(text, out_wav)
                else: continue
                if self.mode != m: print('voice:', m, file=sys.stderr)
                self.mode = m
                return
            except Exception as e:
                last = e
        raise RuntimeError('No voice could speak: %r' % (last,))


def wav_seconds(path):
    with wave.open(path, 'rb') as w: return w.getnframes() / float(w.getframerate())


# ---------- pictures ----------
def font(name, size):
    from PIL import ImageFont
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=fnt) <= max_w: cur = t
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines


def overlay(kind, eyebrow, line, out_png, small=''):
    """A transparent layer laid over the moving photo: a soft dark band, an eyebrow, one line of words, the site address."""
    from PIL import Image, ImageDraw
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    V = H > W
    if kind == 'title':
        # whole frame darkens a little, title in the middle
        d.rectangle([0, 0, W, H], fill=(16, 22, 14, 110))
        f_eye = font('Jost-normal-500.ttf', 26); f_t = font('CormorantGaramond-italic-400.ttf', 112 if not V else 100); f_s = font('Jost-normal-300.ttf', 30)
        lines = wrap(d, line, f_t, W - (360 if not V else 160))
        total = len(lines) * 120
        y = H / 2 - total / 2 - 20
        eye = '  '.join(eyebrow.upper())
        d.text((W / 2, y - 70), eye, font=f_eye, fill=SAGE + (255,), anchor='mm')
        for ln in lines:
            d.text((W / 2, y + 60), ln, font=f_t, fill=(255, 255, 255, 255), anchor='mm'); y += 120
        if small: d.text((W / 2, y + 70), small, font=f_s, fill=(255, 255, 255, 220), anchor='mm')
    elif kind == 'closing':
        d.rectangle([0, 0, W, H], fill=(16, 22, 14, 150))
        f_eye = font('Jost-normal-500.ttf', 26); f_t = font('CormorantGaramond-italic-400.ttf', 92); f_u = font('Jost-normal-400.ttf', 40)
        d.text((W / 2, H / 2 - 150), '  '.join(eyebrow.upper()), font=f_eye, fill=SAGE + (255,), anchor='mm')
        d.text((W / 2, H / 2 - 50), line, font=f_t, fill=(255, 255, 255, 255), anchor='mm')
        d.rounded_rectangle([W / 2 - 330, H / 2 + 50, W / 2 + 330, H / 2 + 140], radius=45, outline=(255, 255, 255, 200), width=2)
        d.text((W / 2, H / 2 + 95), '  '.join(SITE.upper()), font=font('Jost-normal-400.ttf', 26), fill=(255, 255, 255, 255), anchor='mm')
    else:
        # bottom band
        bh = int(H * (0.48 if not V else 0.42))
        band = Image.new('RGBA', (W, bh), (0, 0, 0, 0))
        bd = ImageDraw.Draw(band)
        for i in range(bh):
            a = int(235 * (i / bh) ** 0.9)
            bd.line([(0, i), (W, i)], fill=(14, 20, 12, a))
        im.alpha_composite(band, (0, H - bh))
        big = kind in ('quote', 'hook')
        size = (64 if big else 58) if not V else (72 if big else 64)
        f_eye = font('Jost-normal-500.ttf', 24 if not V else 28); f_l = font('CormorantGaramond-italic-400.ttf', size)
        lh = int(size * 1.18)
        maxw = W - (240 if not V else 140)
        lines = wrap(d, line, f_l, maxw)[:(2 if not V else 4)]
        x = 120 if not V else 70
        y = (H - 250) if not V else (H - 420 - (len(lines) - 2) * lh)
        if eyebrow: d.text((x, y - 60), '  '.join(eyebrow.upper()), font=f_eye, fill=SAGE + (255,))
        for ln in lines:
            d.text((x, y), ln, font=f_l, fill=(255, 255, 255, 255)); y += lh
        d.text((W - x, H - 50), SITE, font=font('Jost-normal-400.ttf', 22), fill=(255, 255, 255, 170), anchor='rm')
        d.ellipse([x - 10, H - 66, x + 22, H - 34], fill=SAGE + (255,))
        d.text((x + 40, H - 50), 'Pristine Wellness', font=font('Jost-normal-400.ttf', 22), fill=(255, 255, 255, 170), anchor='lm')
    im.save(out_png)


def caption_line(t, limit=150):
    """One whole sentence from the paragraph: the first if it fits, else the first short one, else a clean trim."""
    sents = [x.strip() for x in re.split(r'(?<=[.!?])\s+', t) if x.strip()]
    if sents and len(sents[0]) <= limit: return sents[0]
    for x in sents:
        if 25 <= len(x) <= limit: return x
    cut = t[:limit]
    cut = cut[:max(cut.rfind(','), cut.rfind(' '))].rstrip(' ,;:')
    return cut + '...'


# ---------- render ----------
def render_segment(ff, image, audio, over_png, out, zoom_in, dur):
    frames = int(dur * FPS)
    if zoom_in:
        z = "min(1+0.0010*on,1.16)"
    else:
        z = "max(1.16-0.0010*on,1.0)"
    vf = ("scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,"
          "zoompan=z='%s':d=%d:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=%dx%d:fps=%d[v];"
          "[v][1:v]overlay=0:0,format=yuv420p" % (W * 2, H * 2, W * 2, H * 2, z, frames, W, H, FPS))
    cmd = [ff, '-y', '-loglevel', 'error', '-loop', '1', '-i', image, '-i', over_png, '-i', audio,
           '-filter_complex', vf, '-af', 'apad', '-t', '%.2f' % dur,
           '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-r', str(FPS), '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', out]
    subprocess.run(cmd, check=True)


def crossfade_join(ff, parts, durs, out):
    """Joins the slides with a soft dissolve between each, and a fade from and to black at the ends."""
    if len(parts) == 1:
        shutil.copy(parts[0], out); return
    inputs = []
    for p in parts: inputs += ['-i', p]
    fc = []
    off = 0.0
    vprev, aprev = '[0:v]', '[0:a]'
    for i in range(1, len(parts)):
        off += durs[i - 1] - XF
        vo, ao = '[v%d]' % i, '[a%d]' % i
        fc.append('%s[%d:v]xfade=transition=fade:duration=%.2f:offset=%.3f%s' % (vprev, i, XF, off, vo))
        fc.append('%s[%d:a]acrossfade=d=%.2f%s' % (aprev, i, XF, ao))
        vprev, aprev = vo, ao
    total = off + durs[-1]
    fc.append('%sfade=t=in:st=0:d=0.8,fade=t=out:st=%.2f:d=1.0,format=yuv420p[vout]' % (vprev, total - 1.0))
    fc.append('%safade=t=out:st=%.2f:d=1.0[aout]' % (aprev, total - 1.0))
    subprocess.run([ff, '-y', '-loglevel', 'error'] + inputs + ['-filter_complex', ';'.join(fc), '-map', '[vout]', '-map', '[aout]',
                    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-r', str(FPS), '-c:a', 'aac', '-b:a', '160k', out], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('story'); ap.add_argument('--out', default=''); ap.add_argument('--voice', default='', help='edge, piper or espeak')
    ap.add_argument('--music', default=os.environ.get('VIDEO_MUSIC', ''), help='optional mp3 mixed quietly under the voice')
    ap.add_argument('--script', default='', help='beats JSON (data/video/<story>.json); without it the whole story is read')
    ap.add_argument('--vertical', action='store_true', help='1080x1920 for Shorts and Reels')
    a = ap.parse_args()
    global W, H
    if a.vertical: W, H = 1080, 1920
    ff = ffmpeg_bin()
    story = read_story(a.story)
    if a.script and 'opener' in os.path.basename(a.script): story['title'] = 'Pristine Wellness'; story['file'] = 'brand-opener.html'
    out = a.out or os.path.join(ROOT, 'out', os.path.splitext(story['file'])[0] + '.mp4')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    voice = Voice(a.voice)
    pics = [p for p in [story['hero']] + story['images'] if p]
    pics = [p if os.path.isabs(p) else os.path.join(ROOT, p.lstrip('/')) for p in pics]
    pics = [p for p in pics if os.path.exists(p)]
    if not pics and not (a.script and os.path.exists(a.script)): raise SystemExit('No pictures found for this story')
    if not pics: pics = [os.path.join(ROOT, 'images', 'home-slide-tarkine-falls-water-hero-2.jpg')]

    # The script, one spoken block per slide
    slides = []
    script = None
    if a.script and os.path.exists(a.script): script = json.load(open(a.script, encoding='utf-8'))
    if script:
        for b in script['beats']:
            pic = (b.get('pic_tall') if (a.vertical and b.get('pic_tall')) else b.get('pic')) or story['hero']
            pic = pic if os.path.isabs(pic) else os.path.join(ROOT, pic.lstrip('/'))
            if not os.path.exists(pic): pic = pics[0]
            slides.append({'kind': b.get('kind', 'section'), 'eyebrow': b.get('eyebrow', ''), 'line': b.get('caption', ''), 'say': b['say'], 'pic': pic, 'small': ''})
    if not script: slides.append({'kind': 'title', 'eyebrow': 'Pristine Wellness', 'line': story['title'], 'small': '',
                   'say': story['title'] + '. ' + (story['intro'] or ''), 'pic': pics[0]})
    pi = 1
    for s in (story['sections'] if not script else []):
        if s.get('quote'):
            slides.append({'kind': 'quote', 'eyebrow': '', 'line': s['paras'][0], 'say': s['paras'][0], 'pic': pics[0]})
            continue
        paras = s['paras'] or [s['heading']]
        # short paragraphs share a slide so the picture does not flick past too fast
        groups, cur = [], ''
        for ptxt in paras:
            if cur and len(cur) + len(ptxt) > 600: groups.append(cur); cur = ptxt
            else: cur = (cur + ' ' + ptxt).strip()
        if cur: groups.append(cur)
        for gi, g in enumerate(groups):
            pic = pics[pi % len(pics)] if len(pics) > 1 else pics[0]; pi += 1
            slides.append({'kind': 'section', 'eyebrow': s['heading'] if gi == 0 else '', 'line': caption_line(g),
                           'say': ((s['heading'] + '. ') if (gi == 0 and s['heading']) else '') + g, 'pic': pic})
    if not script: slides.append({'kind': 'closing', 'eyebrow': 'The Source', 'line': 'Read the full story', 'say': 'Read the full story, and many more, at pristine wellness dot com dot a u.', 'pic': pics[0]})

    tmp = tempfile.mkdtemp(prefix='pwvideo-')
    parts, durs = [], []
    for i, sl in enumerate(slides):
        wavp = os.path.join(tmp, 'v%02d.wav' % i); png = os.path.join(tmp, 'o%02d.png' % i); mp4 = os.path.join(tmp, 's%02d.mp4' % i)
        voice.say(sl['say'], wavp)
        dur = wav_seconds(wavp) + (1.8 if sl['kind'] in ('title', 'closing') else 1.3) + XF
        overlay(sl['kind'], sl['eyebrow'], sl['line'], png, sl.get('small', ''))
        render_segment(ff, sl['pic'], wavp, png, mp4, zoom_in=(i % 2 == 0), dur=dur)
        parts.append(mp4); durs.append(dur)
        print('slide %d/%d  %.1fs  %s' % (i + 1, len(slides), dur, sl['kind']), file=sys.stderr)
    joined = os.path.join(tmp, 'joined.mp4')
    crossfade_join(ff, parts, durs, joined)
    if a.music and os.path.exists(a.music):
        subprocess.run([ff, '-y', '-loglevel', 'error', '-i', joined, '-stream_loop', '-1', '-i', a.music,
                        '-filter_complex', '[1:a]volume=0.12[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=3[a]',
                        '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', out], check=True)
    else:
        shutil.move(joined, out)
    shutil.rmtree(tmp, ignore_errors=True)

    # YouTube words, ready to paste
    url = 'https://' + SITE + '/' + story['file']
    meta = {'title': story['title'] + ' | Pristine Wellness', 'description': (story['description'] or story['intro']) +
            '\n\nRead the full story: ' + url + '\n\nPristine Wellness is a home for families who want to live the way they were designed to. Real food, pure water, light, sleep and movement, with the science explained in plain words.\nhttps://' + SITE +
            '\n\nThis video is a narrated version of our written story. The voice is computer generated; the words and photographs are our own.',
            'tags': ['Pristine Wellness', 'wellness', 'family health', 'ancestral health', 'wholefood']}
    open(os.path.splitext(out)[0] + '.youtube.json', 'w', encoding='utf-8').write(json.dumps(meta, indent=2, ensure_ascii=False))
    print(out)


if __name__ == '__main__':
    main()
