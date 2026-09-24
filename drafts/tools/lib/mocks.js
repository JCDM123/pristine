// Network sandbox: every request from the browser context goes through here.
// Only http://localhost:8801/* is passed through to the local python server.
// GitHub API, raw.githubusercontent, the Worker and the live site are all mocked.
// Everything else is aborted and logged.
const { aiResponse } = require('./fixtures');

const OWNER_REPO = '/repos/JCDM123/pristine';

function mime(p) {
  const ext = (p.split('.').pop() || '').toLowerCase();
  return ({ html: 'text/html; charset=utf-8', json: 'application/json; charset=utf-8', js: 'application/javascript', css: 'text/css', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', txt: 'text/plain', xml: 'application/xml', mp4: 'video/mp4' })[ext] || 'application/octet-stream';
}

function b64wrap(buf) {
  // GitHub returns base64 wrapped at 60 chars with \n
  return buf.toString('base64').replace(/(.{60})/g, '$1\n');
}

function short(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '...(' + s.length + ' chars)' : s; }

function createSandbox(vrepo, opts) {
  opts = opts || {};
  const log = [];            // every intercepted request
  const external = [];       // writes and side effects the studio attempted
  const aiState = {};
  const failures = [];       // [{match: fn(req) -> bool, respond: {status, body, contentType}, once: true, used: false, label}]
  const workerCalls = [];

  function addFailure(f) { failures.push(Object.assign({ once: true, used: false }, f)); }
  function takeFailure(info) {
    for (const f of failures) {
      if (f.used && f.once) continue;
      if (f.match(info)) { f.used = true; return f; }
    }
    return null;
  }

  async function handle(route) {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    let u;
    try { u = new URL(url); } catch (e) { return route.abort(); }
    const host = u.host;
    const bodyText = req.postData() || '';
    const entry = { t: Date.now(), method, url: short(url, 300), host, body: short(bodyText, 300), auth: (req.headers()['authorization'] || '') };
    const info = { method, url, host, path: u.pathname, body: bodyText };
    const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,PUT,POST,DELETE,HEAD,OPTIONS', 'access-control-expose-headers': '*' };
    const fulfill = (o) => route.fulfill(Object.assign({}, o, { headers: Object.assign({}, CORS, o.contentType ? { 'content-type': o.contentType } : {}) }));
    if (method === 'OPTIONS' && !(host === 'localhost:8801' && !u.pathname.startsWith('/__vrepo/'))) {
      entry.action = 'preflight'; entry.status = 204; log.push(entry);
      return fulfill({ status: 204, body: '' });
    }

    // 1. Local static server (studio.html itself and its assets)
    if (host === 'localhost:8801' && !u.pathname.startsWith('/__vrepo/')) {
      entry.action = 'passthrough';
      log.push(entry);
      return route.continue();
    }
    // 1b. Virtual repo served for post-publish page loads
    if (host === 'localhost:8801' && u.pathname.startsWith('/__vrepo/')) {
      const p = decodeURIComponent(u.pathname.slice('/__vrepo/'.length)) || 'index.html';
      const f = vrepo.get(p);
      entry.action = 'vrepo-serve'; entry.status = f ? 200 : 404; log.push(entry);
      if (!f) return fulfill({ status: 404, body: 'not found' });
      return fulfill({ status: 200, contentType: mime(p), body: f.buf });
    }

    const fail = takeFailure(info);
    if (fail) {
      entry.action = 'injected-failure:' + fail.label; entry.status = fail.respond.status; log.push(entry);
      if (fail.respond.abort) return route.abort('failed');
      return fulfill({ status: fail.respond.status, contentType: fail.respond.contentType || 'application/json', body: fail.respond.body });
    }

    // 2. GitHub REST API
    if (host === 'api.github.com') {
      entry.action = 'mock-github';
      const pth = u.pathname;
      if (pth.startsWith(OWNER_REPO + '/contents/')) {
        const p = decodeURIComponent(pth.slice((OWNER_REPO + '/contents/').length));
        if (method === 'GET' || method === 'HEAD') {
          const f = vrepo.get(p);
          if (f) {
            entry.status = 200; log.push(entry);
            return fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: p.split('/').pop(), path: p, sha: f.sha, size: f.buf.length, type: 'file', encoding: 'base64', content: b64wrap(f.buf) }) });
          }
          if (vrepo.isDir(p)) {
            entry.status = 200; log.push(entry);
            return fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(vrepo.listDir(p)) });
          }
          entry.status = 404; log.push(entry);
          return fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not Found', documentation_url: 'https://docs.github.com/rest' }) });
        }
        if (method === 'PUT') {
          let b = {};
          try { b = JSON.parse(bodyText); } catch (e) {}
          const cur = vrepo.get(p);
          const rec = { method: 'PUT', path: p, message: b.message, branch: b.branch, shaSent: b.sha || null, existed: !!cur, sizeBefore: cur ? cur.buf.length : 0 };
          if (cur && !b.sha) {
            rec.status = 422; rec.error = 'sha missing for existing file';
            vrepo.writes.push(rec); external.push(rec); entry.status = 422; log.push(entry);
            return fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ message: 'Invalid request.\n\n"sha" wasn\'t supplied.' }) });
          }
          if (cur && b.sha !== cur.sha) {
            rec.status = 409; rec.error = 'stale sha';
            vrepo.writes.push(rec); external.push(rec); entry.status = 409; log.push(entry);
            return fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: p + ' does not match ' + b.sha }) });
          }
          if (!cur && b.sha) {
            rec.status = 422; rec.error = 'sha given for new file';
            vrepo.writes.push(rec); external.push(rec); entry.status = 422; log.push(entry);
            return fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ message: 'sha given but file does not exist' }) });
          }
          const buf = Buffer.from(String(b.content || '').replace(/\s/g, ''), 'base64');
          const sha = vrepo.put(p, buf);
          rec.status = cur ? 200 : 201; rec.sizeAfter = buf.length; rec.newSha = sha;
          vrepo.writes.push(rec); external.push(rec); entry.status = rec.status; log.push(entry);
          return fulfill({ status: rec.status, contentType: 'application/json', body: JSON.stringify({ content: { name: p.split('/').pop(), path: p, sha }, commit: { sha: 'c' + sha.slice(0, 39), message: b.message } }) });
        }
        if (method === 'DELETE') {
          let b = {};
          try { b = JSON.parse(bodyText); } catch (e) {}
          const cur = vrepo.get(p);
          const rec = { method: 'DELETE', path: p, message: b.message, shaSent: b.sha || null, existed: !!cur };
          if (!cur) { rec.status = 404; vrepo.writes.push(rec); external.push(rec); entry.status = 404; log.push(entry); return fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not Found' }) }); }
          if (b.sha !== cur.sha) { rec.status = 409; vrepo.writes.push(rec); external.push(rec); entry.status = 409; log.push(entry); return fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'sha mismatch' }) }); }
          vrepo.del(p);
          rec.status = 200; vrepo.writes.push(rec); external.push(rec); entry.status = 200; log.push(entry);
          return fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: null, commit: { sha: 'cdel' } }) });
        }
      }
      if (pth === OWNER_REPO + '/commits') {
        entry.status = 200; log.push(entry);
        const commits = [
          { sha: 'c1', commit: { message: 'Upload image: images/dal-bowl.jpg', committer: { date: '2026-06-20T10:00:00Z' } } },
          { sha: 'c2', commit: { message: 'Upload image: images/dal-overhead.jpg', committer: { date: '2026-06-18T10:00:00Z' } } }
        ];
        return fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(commits) });
      }
      entry.status = 404; entry.action = 'mock-github-unknown'; log.push(entry);
      return fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not Found (mock)' }) });
    }

    // 3. raw.githubusercontent.com: serve current virtual repo state
    if (host === 'raw.githubusercontent.com') {
      entry.action = 'mock-raw';
      const m = u.pathname.match(/^\/JCDM123\/pristine\/main\/(.+)$/);
      const p = m ? decodeURIComponent(m[1]) : null;
      const f = p ? vrepo.get(p) : null;
      entry.status = f ? 200 : 404; log.push(entry);
      if (!f) return fulfill({ status: 404, contentType: 'text/plain', body: '404: Not Found' });
      return fulfill({ status: 200, contentType: mime(p), body: method === 'HEAD' ? '' : f.buf });
    }

    // 4. Cloudflare Worker
    if (host === 'pristine-api.jc-a7f.workers.dev') {
      entry.action = 'mock-worker';
      let b = {};
      try { b = JSON.parse(bodyText || '{}'); } catch (e) {}
      const call = { path: u.pathname, auth: entry.auth, bodyKeys: Object.keys(b) };
      if (u.pathname === '/' || u.pathname === '') {
        const r = aiResponse(b, aiState);
        call.kind = r.kind; call.system = short(b.system, 120); call.user = short(b.messages && b.messages[0] && b.messages[0].content, 400);
        call.tools = b.tools ? b.tools.map(t => t.type + (t.max_uses ? '(max ' + t.max_uses + ')' : '')).join(',') : '';
        call.userFull = b.messages && b.messages[0] && b.messages[0].content;
        workerCalls.push(call);
        external.push({ method: 'POST', path: 'WORKER / (AI: ' + r.kind + ')', status: 200 });
        entry.status = 200; entry.kind = r.kind; log.push(entry);
        return fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.json) });
      }
      let resp = { ok: true };
      if (u.pathname === '/send-campaign') resp = { ok: true, sent: (b.recipients ? b.recipients.length : 2), failed: 0 };
      if (u.pathname === '/send-reminder') resp = { ok: true };
      if (u.pathname === '/campaign-stats') resp = { ok: true, campaigns: [{ subject: 'Mock campaign', date: '2026-09-01', recipients: 2, opens: 1 }] };
      if (u.pathname === '/subscribe') resp = { ok: true };
      call.kind = u.pathname; call.body = short(bodyText, 300);
      workerCalls.push(call);
      external.push({ method, path: 'WORKER ' + u.pathname, status: 200, auth: entry.auth ? entry.auth.replace(/TEST-FAKE-TOKEN/, '<github token>') : '' });
      entry.status = 200; log.push(entry);
      return fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resp) });
    }

    // 5. Live site: serve from the virtual repo (images for email previews, og tags for social feed auto-fetch)
    if (host === 'pristinewellness.com.au' || host === 'www.pristinewellness.com.au') {
      const p = decodeURIComponent(u.pathname.replace(/^\//, '')) || 'index.html';
      const f = vrepo.get(p);
      entry.action = 'mock-live-site'; entry.status = f ? 200 : 404; log.push(entry);
      if (!f) return fulfill({ status: 404, body: 'not found' });
      return fulfill({ status: 200, contentType: mime(p), body: f.buf });
    }

    // 6. Everything else: blocked
    entry.action = 'blocked'; log.push(entry);
    return route.abort('blockedbyclient');
  }

  return { handle, log, external, workerCalls, addFailure, failures };
}

module.exports = { createSandbox };
