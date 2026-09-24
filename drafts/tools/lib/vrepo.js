// In-memory virtual GitHub repo seeded from the copied site files.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function gitSha(buf) {
  return crypto.createHash('sha1').update('blob ' + buf.length + '\0').update(buf).digest('hex');
}

class VRepo {
  constructor(rootDir) {
    this.files = new Map(); // path -> {buf, sha}
    this.writes = [];       // {method, path, status, message, sizeBefore, sizeAfter}
    this.commits = [];
    const walk = (dir, rel) => {
      for (const name of fs.readdirSync(dir)) {
        if (name === '.git' || name === 'node_modules') continue;
        const abs = path.join(dir, name);
        const r = rel ? rel + '/' + name : name;
        const st = fs.statSync(abs);
        if (st.isDirectory()) walk(abs, r);
        else if (st.size < 20 * 1024 * 1024) this.put(r, fs.readFileSync(abs), true);
      }
    };
    walk(rootDir, '');
    this.initial = new Map([...this.files].map(([k, v]) => [k, v]));
  }
  put(p, buf, silent) {
    const sha = gitSha(buf);
    this.files.set(p, { buf, sha });
    return sha;
  }
  get(p) { return this.files.get(p) || null; }
  text(p) { const f = this.get(p); return f ? f.buf.toString('utf8') : null; }
  del(p) { return this.files.delete(p); }
  listDir(dir) {
    const out = [];
    const prefix = dir.replace(/\/$/, '') + '/';
    const seenDirs = new Set();
    for (const [p, f] of this.files) {
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      if (rest.includes('/')) {
        const d = rest.split('/')[0];
        if (!seenDirs.has(d)) { seenDirs.add(d); out.push({ name: d, path: prefix + d, sha: 'dir', type: 'dir', size: 0 }); }
        continue;
      }
      out.push({
        name: rest, path: p, sha: f.sha, size: f.buf.length, type: 'file',
        download_url: 'https://raw.githubusercontent.com/JCDM123/pristine/main/' + p
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }
  isDir(p) {
    const prefix = p.replace(/\/$/, '') + '/';
    for (const k of this.files.keys()) if (k.startsWith(prefix)) return true;
    return false;
  }
}

module.exports = { VRepo, gitSha };
