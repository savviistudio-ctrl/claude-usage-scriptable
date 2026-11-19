// ClaudeUsage.js — Scriptable (iOS)
// Tracks your Claude subscription limits (Pro/Max): 5-hour and weekly usage.
// No API key needed. Run it once in the app to sign in to claude.ai inside Scriptable
// (use EMAIL + code — Google sign-in is blocked inside apps).
// Widgets: Home Screen (Small / Medium / Large) and Lock Screen (inline / circle / rectangle).
// Note: reads the same data as claude.ai Settings > Usage. Unofficial endpoint — may change.

const CACHE_FILE = "claude_usage_cache.json";
const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), CACHE_FILE);

// Runs inside claude.ai, using your signed-in session.
// Results go back as a JSON string, and the script ends on a plain value,
// because Scriptable can't return a Promise or a complex object.
const FETCH_JS = `
(function () {
  const done = (o) => completion(JSON.stringify(o));
  (async () => {
    try {
      const r = await fetch('/api/organizations', { credentials: 'include' });
      if (!r.ok) { done({ error: 'signin', status: r.status }); return; }
      const orgs = await r.json();
      for (const o of orgs) {
        const u = await fetch('/api/organizations/' + o.uuid + '/usage', { credentials: 'include' });
        if (!u.ok) continue;
        const data = await u.json();
        if (data && (data.five_hour || data.seven_day)) { done({ org: o.name, data: data }); return; }
      }
      done({ error: 'nousage' });
    } catch (e) { done({ error: 'js', message: String(e) }); }
  })();
})();
0;
`;

async function fetchUsage() {
  const wv = new WebView();
  await wv.loadURL("https://claude.ai/");
  const raw = await wv.evaluateJavaScript(FETCH_JS, true);
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

async function signIn() {
  const wv = new WebView();
  await wv.loadURL("https://claude.ai/login");
  await wv.present(true); // close the sheet when you're signed in
}

function saveCache(obj) { fm.writeString(cachePath, JSON.stringify(obj)); }
function loadCache() { return fm.fileExists(cachePath) ? JSON.parse(fm.readString(cachePath)) : null; }

function pct(w) { return w && typeof w.utilization === "number" ? Math.round(w.utilization) : null; }

function resetText(w) {
  if (!w || !w.resets_at) return "";
  const ms = new Date(w.resets_at) - new Date();
  if (ms <= 0) return "resetting";
  const h = Math.floor(ms / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4);
  return h >= 24 ? "resets in " + Math.floor(h / 24) + "d " + (h % 24) + "h" : "resets in " + h + "h " + m + "m";
}

function colorFor(p) {
  if (p === null) return Color.gray();
  if (p >= 90) return Color.red();
  if (p >= 70) return Color.orange();
  return new Color("#30D158");
}

// ---------- Home Screen widget ----------
function addBar(w, label, win, barWidth, compact) {
  const p = pct(win);
  const row = w.addStack();
  row.layoutHorizontally();
  const l = row.addText(label);
  l.font = Font.systemFont(compact ? 11 : 12);
  l.textColor = Color.gray();
  row.addSpacer();
  const v = row.addText(p === null ? "–" : p + "%");
  v.font = Font.semiboldSystemFont(compact ? 13 : 14);
  v.textColor = colorFor(p);

  w.addSpacer(3);
  const ctx = new DrawContext();
  ctx.size = new Size(barWidth, 6);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const bg = new Path(); bg.addRoundedRect(new Rect(0, 0, barWidth, 6), 3, 3);
  ctx.addPath(bg); ctx.setFillColor(new Color("#3A3A3C")); ctx.fillPath();
  if (p) {
    const fg = new Path(); fg.addRoundedRect(new Rect(0, 0, Math.max(6, barWidth * Math.min(p, 100) / 100), 6), 3, 3);
    ctx.addPath(fg); ctx.setFillColor(colorFor(p)); ctx.fillPath();
  }
  const img = w.addImage(ctx.getImage());
  img.imageSize = new Size(barWidth, 6);

  const r = w.addText(resetText(win));
  r.font = Font.systemFont(9);
  r.textColor = Color.gray();
}

function buildWidget(c, stale) {
  const fam = config.widgetFamily || "medium";
  if (fam.startsWith("accessory")) return buildAccessory(fam, c);
  const small = fam === "small", large = fam === "large";
  const barWidth = small ? 128 : 300;

  const w = new ListWidget();
  w.backgroundColor = new Color("#1C1C1E");
  w.setPadding(12, 14, 12, 14);
  w.url = "https://claude.ai/settings/usage";
  const t = w.addText("Claude usage");
  t.font = Font.semiboldSystemFont(13);
  t.textColor = new Color("#D97757");
  w.addSpacer(6);
  if (!c) {
    const m = w.addText("Open Scriptable and run this script to sign in.");
    m.font = Font.systemFont(11);
    m.textColor = Color.white();
    return w;
  }
  const d = c.data;
  addBar(w, "5-hour", d.five_hour, barWidth, small);
  w.addSpacer(6);
  addBar(w, "Weekly", d.seven_day, barWidth, small);
  if (large && d.seven_day_opus) { w.addSpacer(6); addBar(w, "Weekly Opus", d.seven_day_opus, barWidth, false); }
  if (large && d.seven_day_sonnet) { w.addSpacer(6); addBar(w, "Weekly Sonnet", d.seven_day_sonnet, barWidth, false); }
  w.addSpacer();
  const u = w.addText((stale ? "Cached " : "Updated ") +
    new Date(c.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
  u.font = Font.systemFont(9);
  u.textColor = stale ? Color.orange() : Color.gray();
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  return w;
}

// ---------- Lock Screen widgets ----------
function drawRing(p) {
  const s = 120, lw = 12, ctx = new DrawContext();
  ctx.size = new Size(s, s); ctx.opaque = false; ctx.respectScreenScale = true;
  const cx = s / 2, cy = s / 2, r = s / 2 - lw / 2;
  const arc = (to, alpha) => {
    const steps = Math.max(2, Math.ceil(to * 60));
    for (let i = 0; i <= steps; i++) {
      const a = (to * i / steps) * 2 * Math.PI - Math.PI / 2;
      ctx.setFillColor(new Color("#FFFFFF", alpha));
      ctx.fillEllipse(new Rect(cx + r * Math.cos(a) - lw / 2, cy + r * Math.sin(a) - lw / 2, lw, lw));
    }
  };
  arc(1, 0.25);
  if (p) arc(Math.min(p, 100) / 100, 1);
  return ctx.getImage();
}

function buildAccessory(fam, cache) {
  const w = new ListWidget();
  w.url = "https://claude.ai/settings/usage";
  const d = cache ? cache.data : null;
  const s = d ? pct(d.five_hour) : null, wk = d ? pct(d.seven_day) : null;
  const show = (p) => p === null ? "–" : p + "%";

  if (fam === "accessoryInline") {
    w.addText("✳︎ " + (d ? "5h " + show(s) + " · Week " + show(wk) : "Run script to sign in"));
    return w;
  }

  if (fam === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    w.backgroundImage = drawRing(s);
    w.addSpacer();
    const t = w.addText(show(s)); t.font = Font.boldSystemFont(14); t.centerAlignText();
    const l = w.addText("5h"); l.font = Font.systemFont(9); l.centerAlignText(); l.textOpacity = 0.7;
    w.addSpacer();
    return w;
  }

  // accessoryRectangular
  if (!d) { w.addText("✳︎ Run script to sign in").font = Font.systemFont(12); return w; }
  const line = (label, win) => {
    const p = pct(win);
    const top = w.addStack(); top.layoutHorizontally();
    const a = top.addText(label); a.font = Font.semiboldSystemFont(11);
    top.addSpacer();
    const b = top.addText(show(p)); b.font = Font.boldSystemFont(11);
    const ctx = new DrawContext(); ctx.size = new Size(150, 4); ctx.opaque = false; ctx.respectScreenScale = true;
    const tr = new Path(); tr.addRoundedRect(new Rect(0, 0, 150, 4), 2, 2);
    ctx.addPath(tr); ctx.setFillColor(new Color("#FFFFFF", 0.3)); ctx.fillPath();
    if (p) { const f = new Path(); f.addRoundedRect(new Rect(0, 0, Math.max(4, 1.5 * Math.min(p, 100)), 4), 2, 2); ctx.addPath(f); ctx.setFillColor(Color.white()); ctx.fillPath(); }
    const img = w.addImage(ctx.getImage()); img.imageSize = new Size(150, 4);
  };
  line("✳︎ 5-hour", d.five_hour);
  w.addSpacer(4);
  line("Weekly", d.seven_day);
  const r = w.addText(resetText(d.five_hour)); r.font = Font.systemFont(9); r.textOpacity = 0.7;
  return w;
}

async function alertMsg(title, msg) {
  const a = new Alert(); a.title = title; a.message = msg; a.addAction("OK"); await a.present();
}

// ---------- main ----------
(async () => {
  let res = null;
  try { res = await fetchUsage(); } catch (e) { res = { error: "load", message: String(e) }; }

  // In the app: if not signed in, show claude.ai login, then try again.
  if (!config.runsInWidget && res && res.error === "signin") {
    await alertMsg("Sign in to Claude", "A claude.ai sign-in page will open. Use your EMAIL (not Google), enter the code from your inbox, then tap Close.");
    await signIn();
    try { res = await fetchUsage(); } catch (e) { res = { error: "load", message: String(e) }; }
  }

  if (res && res.data) saveCache({ t: Date.now(), org: res.org, data: res.data });
  const cache = loadCache();
  const stale = !(res && res.data);

  if (config.runsInWidget) {
    Script.setWidget(buildWidget(cache, stale));
  } else if (res && res.data) {
    const d = res.data;
    let msg = "5-hour: " + (pct(d.five_hour) ?? "–") + "%  " + resetText(d.five_hour) +
      "\nWeekly: " + (pct(d.seven_day) ?? "–") + "%  " + resetText(d.seven_day);
    if (d.seven_day_opus) msg += "\nWeekly Opus: " + (pct(d.seven_day_opus) ?? "–") + "%";
    if (d.seven_day_sonnet) msg += "\nWeekly Sonnet: " + (pct(d.seven_day_sonnet) ?? "–") + "%";
    await alertMsg("Claude usage" + (res.org ? " — " + res.org : ""), msg);
    await buildWidget(cache, false).presentMedium();
  } else {
    await alertMsg("Couldn't read usage", JSON.stringify(res));
  }
  Script.complete();
})();
