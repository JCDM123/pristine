"""Scheduled release.
Opens the studio in a headless browser and presses Go live on every private preview whose release time has passed.
Run with --check to only say whether anything is due (prints due=yes or due=no for the workflow).
Needs GH_TOKEN with permission to write to the repository."""
import functools, http.server, json, os, socketserver, sys, threading
from datetime import datetime, timezone

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))


def due_items():
    try:
        with open(os.path.join(ROOT, 'data', 'previews.json'), encoding='utf-8') as f:
            items = json.load(f)
    except (OSError, ValueError):
        return []
    now = datetime.now(timezone.utc)
    out = []
    for r in items:
        when = r.get('release')
        if not when:
            continue
        try:
            t = datetime.fromisoformat(when.replace('Z', '+00:00'))
        except ValueError:
            continue
        if t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        if t <= now:
            out.append(r)
    return out


def main():
    if '--check' in sys.argv:
        print('due=' + ('yes' if due_items() else 'no'))
        return 0
    token = os.environ.get('GH_TOKEN', '')
    if not token:
        print('GH_TOKEN is not set', file=sys.stderr)
        return 2
    from playwright.sync_api import sync_playwright

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', 8765), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    result = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            ctx = browser.new_context(timezone_id=os.environ.get('PW_TZ', 'Australia/Sydney'), locale='en-AU')
            page = ctx.new_page()
            page.set_default_timeout(600000)
            page.on('dialog', lambda d: d.accept())
            page.on('console', lambda m: print('[studio]', m.text) if m.type == 'error' else None)
            page.goto('http://127.0.0.1:8765/studio.html')
            page.evaluate("t => { sessionStorage.setItem('studio_auth', '1'); localStorage.setItem('gh_token', t); }", token)
            page.goto('http://127.0.0.1:8765/studio.html')
            page.wait_for_function("typeof pwReleaseDue === 'function'")
            result = page.evaluate('() => pwReleaseDue()')
            browser.close()
    finally:
        srv.shutdown()
    for r in result:
        print(('LIVE   ' if r.get('ok') else 'FAILED ') + r.get('title', '') + '  ' + r.get('status', ''))
    if not result:
        print('Nothing was due.')
    return 0 if all(r.get('ok') for r in result) else 1


if __name__ == '__main__':
    sys.exit(main())
