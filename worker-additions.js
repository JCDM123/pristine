/* ===================================================
   CLOUDFLARE WORKER ADDITIONS
   Add these to your existing pristine-api worker
   =================================================== */

/* ── CRON TRIGGER (add to wrangler.toml) ──────────────
[triggers]
crons = ["0 21 * * 4"]
# Runs every Thursday at 21:00 UTC = Friday 7:00am AEST
# Change "4" to day of week: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri
# Change "21" to hour UTC (AEST = UTC+10, so 7am AEST = 21:00 UTC previous day)
─────────────────────────────────────────────────── */

// Add this to your existing fetch handler router:
// if (path === '/send-reminder') return handleSendReminder(request, env);
// if (path === '/welcome-sequence') return handleWelcomeSequence(request, env);

// Add this scheduled handler export:
export default {
  async fetch(request, env, ctx) {
    // ... your existing fetch handler code ...
  },

  async scheduled(event, env, ctx) {
    // Fires on cron schedule
    await sendWeeklyReminder(env);
  }
};

/* ── SEND REMINDER ENDPOINT ─────────────────────────── */
async function handleSendReminder(request, env) {
  try {
    const body = await request.json();
    const isTest = body.test === true;
    const toEmail = body.email;
    if (!toEmail) return Response.json({ ok: false, error: 'No email provided' });
    await sendReminderEmail(env, toEmail, isTest);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message });
  }
}

/* ── WEEKLY REMINDER CRON ───────────────────────────── */
async function sendWeeklyReminder(env) {
  const GITHUB_OWNER = 'JCDM123';
  const GITHUB_REPO = 'pristine';
  const token = env.GITHUB_TOKEN;

  // Load reminder settings
  const settingsResp = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data/email-reminder.json`,
    { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' } }
  );
  if (!settingsResp.ok) return;
  const settingsData = await settingsResp.json();
  const settings = JSON.parse(atob(settingsData.content.replace(/\n/g, '')));
  if (!settings.email) return;

  await sendReminderEmail(env, settings.email, false, settings.prefix);
}

async function sendReminderEmail(env, toEmail, isTest = false, prefix = 'Pristine Weekly') {
  const GITHUB_OWNER = 'JCDM123';
  const GITHUB_REPO = 'pristine';
  const token = env.GITHUB_TOKEN;

  // Fetch recent articles from The Source
  const sourceResp = await fetch(
    `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/the-source.html?cb=${Date.now()}`
  );
  const sourceHtml = await sourceResp.text();

  // Extract article cards
  const articleMatches = [...sourceHtml.matchAll(/<div class="article-card"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>[\s\S]*?window\.location='([^']+)'/g)];
  const articles = articleMatches.slice(0, 5).map(m => ({
    title: m[1].trim(),
    url: `https://pristinewellness.com.au/${m[2]}`
  }));

  // Fetch recent recipes from AK
  const akResp = await fetch(
    `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/ancestral-kitchen.html?cb=${Date.now()}`
  );
  const akHtml = await akResp.text();
  const recipeMatches = [...akHtml.matchAll(/<div class="card[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>[\s\S]*?window\.location='([^']+)'/g)];
  const recipes = recipeMatches.slice(0, 3).map(m => ({
    title: m[1].trim(),
    url: `https://pristinewellness.com.au/${m[2]}`
  }));

  // Subscriber count
  let subCount = '?';
  try {
    const subResp = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data/subscribers.json`,
      { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' } }
    );
    if (subResp.ok) {
      const subData = await subResp.json();
      const subs = JSON.parse(atob(subData.content.replace(/\n/g, '')));
      subCount = Array.isArray(subs) ? subs.filter(s => s.active !== false).length : '?';
    }
  } catch (e) {}

  const subject = isTest
    ? `[TEST] ${prefix} Reminder`
    : `${prefix}: Time to send this week's email`;

  const articleList = articles.length
    ? articles.map(a => `<tr><td style="padding:6px 0;border-bottom:0.5px solid #eee;"><a href="${a.url}" style="color:#2C4A2E;font-size:14px;">${a.title}</a></td></tr>`).join('')
    : '<tr><td style="padding:6px 0;color:#888;font-size:13px;">No articles found</td></tr>';

  const recipeList = recipes.length
    ? recipes.map(r => `<tr><td style="padding:6px 0;border-bottom:0.5px solid #eee;"><a href="${r.url}" style="color:#2C4A2E;font-size:14px;">${r.title}</a></td></tr>`).join('')
    : '<tr><td style="padding:6px 0;color:#888;font-size:13px;">No recipes found</td></tr>';

  const day = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F5F0E8;font-family:Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F5F0E8;"><tr><td align="center" style="padding:30px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#fff;border-radius:4px;overflow:hidden;">
  <tr><td style="padding:28px 40px 20px;background:#2C4A2E;">
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#a8bb8a;">Pristine Wellness Studio</div>
    <div style="font-size:22px;color:#fff;font-weight:400;margin-top:6px;">Your weekly email reminder</div>
    <div style="font-size:13px;color:#a8bb8a;margin-top:4px;">${day} &middot; ${subCount} active subscribers</div>
  </td></tr>
  <tr><td style="padding:28px 40px 10px;">
    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 20px;">Time to send this week's email. Here's what's published and ready to feature:</p>
    <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8A9B6E;margin-bottom:8px;">Articles</div>
    <table width="100%" cellpadding="0" cellspacing="0">${articleList}</table>
    <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8A9B6E;margin-top:20px;margin-bottom:8px;">Recipes</div>
    <table width="100%" cellpadding="0" cellspacing="0">${recipeList}</table>
  </td></tr>
  <tr><td style="padding:24px 40px 32px;">
    <p style="font-size:13px;color:#888;margin:0 0 16px;">Suggested subject line: <strong style="color:#333;">${prefix}: ${articles[0] ? articles[0].title.split(':')[0] : 'This week from Pristine'}</strong></p>
    <a href="https://pristinewellness.com.au/studio.html" style="background:#8A9B6E;color:#fff;text-decoration:none;font-size:11px;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;border-radius:4px;display:inline-block;">Open Studio &rarr;</a>
  </td></tr>
</table></td></tr></table></body></html>`;

  // Send via Resend
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Pristine Studio <hello@pristinewellness.com.au>',
      to: [toEmail],
      subject,
      html
    })
  });
}

/* ── WELCOME SEQUENCE ENDPOINT ───────────────────────── */
// This fires when a new subscriber is added
// Call it from your existing subscribe endpoint after saving the subscriber

async function sendWelcomeSequence(env, subscriberEmail, subscriberName) {
  const GITHUB_OWNER = 'JCDM123';
  const GITHUB_REPO = 'pristine';
  const token = env.GITHUB_TOKEN;

  // Load welcome sequence
  const resp = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data/welcome-sequence.json`,
    { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' } }
  );
  if (!resp.ok) return; // No sequence configured, skip silently

  const data = await resp.json();
  const seq = JSON.parse(atob(data.content.replace(/\n/g, '')));

  // Send Email 1 immediately
  if (seq.email1 && seq.email1.subject) {
    await sendWelcomeEmail(env, subscriberEmail, seq.email1);
  }

  // Emails 2 and 3: store in a queue (simplified - use Cloudflare Queues or D1 for production)
  // For now: send Email 2 and 3 on a delay using waitUntil (max 30 seconds in free plan)
  // In production you'd use Cloudflare Queues or a D1 scheduled table
  // Simple approach: log to a pending-emails.json file in GitHub (checked by cron)
}

async function sendWelcomeEmail(env, toEmail, emailConfig) {
  const paras = (emailConfig.body || '').split(/\n\s*\n/).map(p =>
    `<p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#555;">${p.trim().replace(/\n/g,'<br>')}</p>`
  ).join('');

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F5F0E8;font-family:Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F5F0E8;"><tr><td align="center" style="padding:30px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#fff;border-radius:4px;overflow:hidden;">
  <tr><td style="padding:28px 40px 20px;border-bottom:0.5px solid #e8e4dc;">
    <img src="https://pristinewellness.com.au/images/pw-logo-email.png" alt="Pristine Wellness" width="60" height="60" style="border-radius:50%;">
  </td></tr>
  <tr><td style="padding:36px 40px 10px;">
    <h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:30px;font-weight:400;font-style:italic;color:#111;">${emailConfig.heading || ''}</h1>
    ${paras}
  </td></tr>
  ${emailConfig.btn_text && emailConfig.btn_link ? `<tr><td style="padding:10px 40px 36px;"><a href="${emailConfig.btn_link}" style="background:#8A9B6E;color:#fff;text-decoration:none;font-size:11px;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;border-radius:4px;display:inline-block;">${emailConfig.btn_text}</a></td></tr>` : ''}
  <tr><td style="padding:18px 40px;background:#2C4A2E;text-align:center;">
    <p style="margin:0;font-size:12px;color:#a8bb8a;">Pristine Wellness &middot; Australia</p>
    <p style="margin:4px 0 0;font-size:11px;"><a href="UNSUB_URL" style="color:#8aa07a;">Unsubscribe</a></p>
  </td></tr>
</table></td></tr></table></body></html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Pristine Wellness <hello@pristinewellness.com.au>',
      to: [toEmail],
      subject: emailConfig.subject,
      html
    })
  });
}

/* ── WRANGLER.TOML ADDITION ─────────────────────────────
Add this to your wrangler.toml to enable the cron:

[triggers]
crons = ["0 21 * * 4"]

This fires Thursday 9pm UTC = Friday 7am AEST.
Change "4" for different day (0=Sun through 6=Sat).
Change "21" for different UTC hour.
─────────────────────────────────────────────────────── */
