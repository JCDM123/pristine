// ═══════════════════════════════════════════════════════════════
// PRISTINE WELLNESS - Cloudflare Worker v2
// Anthropic proxy + Newsletter engine
// (subscribe, unsubscribe, open tracking, campaign sending)
//
// SETUP - Settings -> Variables on this worker:
//   ANTHROPIC_API_KEY  (existing secret - keep)
//   GITHUB_TOKEN       (secret - repo write access)
//   RESEND_API_KEY     (secret - from resend.com, free tier)
//   FROM_EMAIL         (plain var - e.g. hello@pristinewellness.com.au
//                       domain must be verified in Resend first)
// ═══════════════════════════════════════════════════════════════

const GITHUB_OWNER = 'JCDM123';
const GITHUB_REPO = 'pristine';
const SUBSCRIBERS_PATH = 'data/subscribers.json';
const CAMPAIGNS_PATH = 'data/campaigns.json';
const SITE = 'https://pristinewellness.com.au';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 1x1 transparent gif
const PIXEL = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);

    try {
      if (url.pathname === '/subscribe' && request.method === 'POST') return await subscribe(request, env);
      if (url.pathname === '/unsubscribe') return await unsubscribe(url, env);
      if (url.pathname === '/open') return await trackOpen(url, env);
      if (url.pathname === '/send-campaign' && request.method === 'POST') return await sendCampaign(request, env);
      if (url.pathname === '/campaign-stats' && request.method === 'POST') return await campaignStats(request, env);
    } catch (err) {
      return json({ ok: false, error: 'Server error' }, 500);
    }

    // ── ANTHROPIC PROXY (existing behaviour) ──
    if (request.method === 'POST') {
      const body = await request.text();
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body,
      });
      return new Response(await resp.text(), {
        status: resp.status,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }
    return new Response('Pristine Wellness API', { headers: CORS });
  },
};

// ─────────────────────────────────────────────
async function gh(env, path, method = 'GET', body = null) {
  const resp = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`, {
    method,
    headers: {
      'Authorization': 'token ' + env.GITHUB_TOKEN,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'pristine-worker',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!resp.ok && method === 'GET') return null;
  return resp.json();
}

async function loadJson(env, path) {
  const data = await gh(env, path);
  if (!data) return { list: [], sha: null };
  return { list: JSON.parse(atob(data.content.replace(/\n/g, ''))), sha: data.sha };
}

async function saveJson(env, path, list, sha, msg) {
  const body = {
    message: msg,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(list, null, 2)))),
    branch: 'main',
  };
  if (sha) body.sha = sha;
  return gh(env, path, 'PUT', body);
}

async function emailToken(email, env) {
  const data = new TextEncoder().encode(email + '|' + env.GITHUB_TOKEN.slice(0, 12));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

// ── SUBSCRIBE ──
async function subscribe(request, env) {
  const body = await request.json();
  if (body.website) return json({ ok: true });   // honeypot

  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) {
    return json({ ok: false, error: 'Please enter a valid email address.' }, 400);
  }
  const { list, sha } = await loadJson(env, SUBSCRIBERS_PATH);
  const existing = list.find(s => s.email === email);
  if (existing) {
    if (existing.status === 'unsubscribed') {
      existing.status = 'active';
      existing.date = new Date().toISOString().slice(0, 10);
      await saveJson(env, SUBSCRIBERS_PATH, list, sha, 'Resubscribe');
    }
    return json({ ok: true, message: 'You are on the list.' });
  }
  list.push({ email, date: new Date().toISOString().slice(0, 10), source: String(body.source || 'site').slice(0, 40), status: 'active' });
  await saveJson(env, SUBSCRIBERS_PATH, list, sha, 'New subscriber');
  return json({ ok: true, message: 'Welcome aboard.' });
}

// ── UNSUBSCRIBE (link in every email) ──
async function unsubscribe(url, env) {
  const email = (url.searchParams.get('e') || '').toLowerCase();
  const token = url.searchParams.get('t') || '';
  const page = (msg) => new Response(
    `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pristine Wellness</title></head>
     <body style="font-family:Georgia,serif;background:#F5F0E8;margin:0;padding:60px 20px;text-align:center;">
     <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:50px 40px;">
     <div style="font-size:11px;letter-spacing:3px;color:#8A9B6E;margin-bottom:18px;font-family:Arial,sans-serif;">PRISTINE WELLNESS</div>
     <h1 style="font-style:italic;font-weight:400;color:#2C4A2E;font-size:30px;margin:0 0 14px;">${msg}</h1>
     <p style="color:#777;font-size:15px;line-height:1.7;font-family:Arial,sans-serif;">Changed your mind? You can rejoin any time from <a href="${SITE}" style="color:#8A9B6E;">pristinewellness.com.au</a></p>
     </div></body></html>`,
    { headers: { 'Content-Type': 'text/html' } });

  if (!email || token !== await emailToken(email, env)) return page('That link looks expired');
  const { list, sha } = await loadJson(env, SUBSCRIBERS_PATH);
  const sub = list.find(s => s.email === email);
  if (sub && sub.status !== 'unsubscribed') {
    sub.status = 'unsubscribed';
    sub.unsubscribed = new Date().toISOString().slice(0, 10);
    await saveJson(env, SUBSCRIBERS_PATH, list, sha, 'Unsubscribe');
  }
  return page('You are unsubscribed');
}

// ── OPEN TRACKING PIXEL ──
async function trackOpen(url, env) {
  const cid = url.searchParams.get('c') || '';
  const eh = url.searchParams.get('e') || '';
  if (cid && eh) {
    try {
      const { list, sha } = await loadJson(env, CAMPAIGNS_PATH);
      const camp = list.find(c => c.id === cid);
      if (camp) {
        camp.opens = camp.opens || {};
        if (!camp.opens[eh]) {
          camp.opens[eh] = new Date().toISOString().slice(0, 16);
          await saveJson(env, CAMPAIGNS_PATH, list, sha, 'Open tracked');
        }
      }
    } catch (e) { /* never block the pixel */ }
  }
  return new Response(PIXEL, { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' } });
}

// ── SEND CAMPAIGN (auth: studio sends the GitHub token) ──
async function sendCampaign(request, env) {
  const auth = (request.headers.get('Authorization') || '').replace('Bearer ', '');
  if (auth !== env.GITHUB_TOKEN) return json({ ok: false, error: 'Not authorised' }, 401);

  const body = await request.json();
  const subject = String(body.subject || '').slice(0, 150);
  const html = String(body.html || '');
  if (!subject || !html) return json({ ok: false, error: 'Subject and content required' }, 400);

  const { list: subs } = await loadJson(env, SUBSCRIBERS_PATH);
  const active = subs.filter(s => s.status !== 'unsubscribed');
  if (!active.length) return json({ ok: false, error: 'No active subscribers' }, 400);

  // Register campaign
  const cid = 'c' + Date.now();
  const { list: camps, sha: campSha } = await loadJson(env, CAMPAIGNS_PATH);
  camps.push({ id: cid, subject, date: new Date().toISOString().slice(0, 16), recipients: active.length, opens: {} });
  await saveJson(env, CAMPAIGNS_PATH, camps, campSha, 'Campaign: ' + subject);

  let sent = 0, failed = 0;
  for (const sub of active) {
    const token = await emailToken(sub.email, env);
    const unsubUrl = url0(env) + '/unsubscribe?e=' + encodeURIComponent(sub.email) + '&t=' + token;
    const pixelUrl = url0(env) + '/open?c=' + cid + '&e=' + token;
    const personalHtml = html
      .replace(/UNSUB_URL/g, unsubUrl)
      .replace('</body>', '<img src="' + pixelUrl + '" width="1" height="1" alt="" style="display:block;"/></body>');

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Pristine Wellness <' + env.FROM_EMAIL + '>',
        to: [sub.email],
        subject,
        html: personalHtml,
        headers: { 'List-Unsubscribe': '<' + unsubUrl + '>' },
      }),
    });
    if (resp.ok) sent++; else failed++;
    await new Promise(r => setTimeout(r, 600)); // stay under Resend rate limits
  }
  return json({ ok: true, sent, failed, campaignId: cid });
}

function url0(env) { return 'https://pristine-api.jc-a7f.workers.dev'; }

// ── CAMPAIGN STATS (for the studio) ──
async function campaignStats(request, env) {
  const auth = (request.headers.get('Authorization') || '').replace('Bearer ', '');
  if (auth !== env.GITHUB_TOKEN) return json({ ok: false, error: 'Not authorised' }, 401);
  const { list } = await loadJson(env, CAMPAIGNS_PATH);
  return json({ ok: true, campaigns: list.map(c => ({ id: c.id, subject: c.subject, date: c.date, recipients: c.recipients, opens: Object.keys(c.opens || {}).length })) });
}
