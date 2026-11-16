/* Journal de backtest – interface. Données : GET/PUT /api/db (journal.json). */
(function () {
  'use strict';
  if (window.__OAUTH_FRAME__) return;


  const S = window.Stats;
  const $ = s => document.querySelector(s);
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (x, d = 2) => x === null || x === undefined || Number.isNaN(x) ? '–' : x === Infinity ? '∞' : Number(x).toFixed(d);
  const sgn = (x, d = 2) => x === null || x === undefined ? '–' : (x > 0 ? '+' : '') + Number(x).toFixed(d);
  const pct = (x, d = 0) => x === null || x === undefined ? '–' : (x * 100).toFixed(d) + ' %';
  const cls = x => x > 0 ? 'pos' : x < 0 ? 'neg' : '';
  const SLOTS = [['htf', 'HTF'], ['mtf1h', 'MTF (1h)'], ['mtf15', 'MTF (15mn)'], ['ltf', 'LTF']];

  let DB = null, view = 'dashboard';
  const ui = {
    dash: { from: '', to: '', instrument: '', session: '', window: 20, excl: false },
    jr: { q: '', instrument: '', session: '', result: '', direction: '', entry: '', from: '', to: '', aggOnly: false, sort: 'n', desc: true },
    rev: { type: 'weekly', start: null },
  };

  /* ---------- persistance ---------- */
  function banner(msg) { const b = $('#banner'); b.hidden = !msg; b.textContent = msg || ''; }
  function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, ms || 2200); }
  var FILE_NAME = 'journal-backtest.json';
  var EMPTY_JOURNAL = {
  meta: { name: 'Journal de Backtest \u2013 Market Mechanics', version: 2 },
  lists: { instruments: ['EURUSD','GBPUSD','GBPJPY','USDJPY','XAUUSD','AUDUSD','USDCHF','NZDUSD'], sessions: ['London','NY','London Close','MMM','Asian','Out of Session'], entries: ['SZ EM','DZ EM','FZ EM','No Entry'], aggEntries: ['Engulfing','Piercing','Tweezer','Strar','No Entry','Agressive'], sl: ['Structural Swing','FZ Structure','SZ Structure','Candle + 1p','Candle + 2p'], tp: ['SZ','DZ','Target','Structural Swing','Imbalance','Fixed','FVG','MTF DZ','Next structure','Structure','Swing Low','Liquidity'] },
  trades: [], reviews: [],
  tradingPlan: { sections: [{ title: 'Pre-market routine', items: ['Economical calendar','Review trade plan','Analyse chart','Meditate'] }, { title: 'Chart processing', items: ['Mark HTF 4h range + premium and discount','Mark liquidity (PDH/L, EQH/L)','Mark MTF 1H, 15mn Structure and POI','LTF when hit MTF POI','Build a narrative: continuation vs pullback vs reversal','Take profit (structure or imbalance)','Define invalidation'] }, { title: 'Entry criteria', items: ['Bias alignement','High probability POI','During Killzone','LQ sweep + Market shift','Asymmetrical RR'] }, { title: 'Trade management', items: ['Predifine risk before entry','Set and forget','If invalidation hits, you are done. Exit and reassess, no ONE MORE TRADE TO MAKE IT BACK'] }, { title: 'Exit criteria', items: ['TP next structure or imbalance (LTF)','SL = zone + Buffer 1,5 pip pour SND, 2,5 pips pour FZ'] }], notes: ['Bias is a plan + invalidation not a prediction','If you can\'t say your bias in one sentence, you don\'t have one','If invalidation hits, reset. No coping, no revenge TRADE','You don\'t build trust in your system with affirmations. You build it with data','Conviction \u2192 confidence \u2192 comp\u00e9tence \u2192 consistency'] },
  notebook: {"folders": ["Ideas", "Drafts", "Playbook", "Mindset"], "notes": [{"id": "seed1", "title": "2026 goals", "icon": "\ud83c\udfaf", "folder": "Mindset", "pinned": true, "body": "# Objectifs 2026\n\n- 200 trades A+ minimum\n- Max daily loss: 2R\n- Weekly review tous les dimanches\n- Discipline score > 85%\n\n## Process over outcome\n- [ ] Pre-market routine tous les jours\n- [ ] Journal chaque trade dans l'heure\n- [ ] Review hebdo sans exception", "created": "2025-12-08T17:40:26.039255", "updated": "2026-10-04T15:40:26.039255"}, {"id": "seed2", "title": "Pre-Market Thesis", "icon": "\ud83d\udccb", "folder": "Playbook", "pinned": false, "body": "# Pre-Market Thesis Template\n\n## 1. HTF Plan\n- Pre 4H Trend:\n- Mark out HTF POIs (4H):\n- Buy in 4H Discount / Sell in 4H Premium\n- Define 4H POI\n- SBD Zones, Flip Zones, Order Blocks\n\n## 2. LTF Execution\n- 4H POI Mitigation\n- 15m LQ Sweep (V Shape Reaction)\n- Market Shift\n- Set entry limit order on edge of POI\n\n## 3. Invalidation\n- Si structure cass\u00e9e dans le sens oppos\u00e9\n- Si pas de r\u00e9action au POI dans 2 bougies", "created": "2026-03-18T17:40:26.039255", "updated": "2026-09-29T17:40:26.039255"}, {"id": "seed3", "title": "Entry Model", "icon": "\ud83c\udfaf", "folder": "Playbook", "pinned": false, "body": "# Entry Model\n\n## Conditions obligatoires\n- [ ] Bias alignement HTF\n- [ ] High probability POI\n- [ ] Pendant une killzone active\n- [ ] LQ sweep + Market shift\n- [ ] RR asym\u00e9trique (min 1:3)\n\n## Confirmation\n1. Prix atteint le POI\n2. Sweep de liquidit\u00e9 (wick)\n3. Market structure shift sur LTF\n4. Entr\u00e9e sur retest", "created": "2026-04-07T17:40:26.039255", "updated": "2026-09-22T17:40:26.039255"}, {"id": "seed4", "title": "Emotional Mapping", "icon": "\ud83e\udde0", "folder": "Mindset", "pinned": false, "body": "# Emotional Mapping Journal\n\n## Avant le trade\nQue je ressens : \nNiveau de conviction (1-10) : \n\n## Pendant\nEnvie de d\u00e9placer le SL ? \nEnvie de prendre les profits t\u00f4t ? \n\n## Apr\u00e8s\nSatisfait du process ? \nQu'est-ce que je referais diff\u00e9remment ? \n\n---\n**Rappel** : Les \u00e9motions sont des donn\u00e9es, pas des ordres.", "created": "2026-05-07T17:40:26.039255", "updated": "2026-09-14T17:40:26.039255"}, {"id": "seed5", "title": "Process", "icon": "\u2699\ufe0f", "folder": "Ideas", "pinned": false, "body": "Nouvelle r\u00e8gle : \u00e9crire la th\u00e8se avant l'ouverture du march\u00e9, pas d'intraday improvis\u00e9.\n\nSi je n'ai pas \u00e9crit mon plan avant 8h, je ne trade pas aujourd'hui.", "created": "2026-10-02T17:40:26.039255", "updated": "2026-10-04T14:40:26.039255"}]},
  calculator: { accountSize: 5000, riskPercent: 0.06, instruments: [{ name: 'NAS', pipValue: 20 },{ name: 'US500', pipValue: 1 },{ name: 'EURUSD', pipValue: 10 },{ name: 'GBPUSD', pipValue: 10 },{ name: 'XAUUSD', pipValue: 1 },{ name: 'US30', pipValue: 10 }] }
};
  function mergeDefaults(db) {
    // Complete any key missing from an older file saved on Drive
    db.lists = db.lists || {}; db.trades = db.trades || []; db.reviews = db.reviews || [];
    var E = EMPTY_JOURNAL;
    Object.keys(E.lists || {}).forEach(function(k) { if (!db.lists[k] || !db.lists[k].length) db.lists[k] = E.lists[k]; });
    if (!db.tradingPlan || !db.tradingPlan.sections || !db.tradingPlan.sections.length) db.tradingPlan = E.tradingPlan;
    if (!db.calculator) db.calculator = E.calculator;
    if (!db.tradingPlans && db.tradingPlan) { /* migrated lazily by plansData() */ }
    if (!db.notebook) db.notebook = E.notebook;
    if (!db.notebook.folders || !db.notebook.folders.length) db.notebook.folders = E.notebook.folders;
    if (!db.notebook.notes) db.notebook.notes = E.notebook.notes;
    return db;
  }
  async function load() {
    // Initialize Google Drive connection
    Drive.init({
      clientId: '581487785097-euvn52u9tlbduie8mpsmmf6sanbcfsk2.apps.googleusercontent.com',
      fileName: FILE_NAME,
      onAuthChange: function(ok, err) {
        updateAuthUI();
        if (ok) retrySync();
        if (ok) load().then(render);
        if (err) banner('Erreur de connexion : ' + err);
      }
    });
    try {
      // 1. Try Google Drive if signed in
      if (Drive.isSignedIn()) {
        var result = await Drive.load(EMPTY_JOURNAL);
        if (result.db) {
          DB = result.db;
          mergeDefaults(DB);
          banner(''); LAST_GOOD = JSON.stringify(DB);
          if (result.source === 'created') toast('Fichier cr\u00e9\u00e9 sur Google Drive');
          if (result.source === 'local-pushed') toast('Modifications locales synchronis\u00e9es \u2601', 6000);
          updateAuthUI();
          return;
        }
      }
      // 2. Try local cache
      var cached = Drive.getCached();
      if (cached && cached.trades && cached.trades.length) {
        DB = cached;
        mergeDefaults(DB);
        banner(Drive.isSignedIn() ? '' : 'Mode hors connexion. Connectez-vous avec Google pour synchroniser.');
        LAST_GOOD = JSON.stringify(DB);
        updateAuthUI();
        return;
      }
      // 3. Fetch the embedded journal.json from the same folder
      try {
        var r = await fetch('journal.json');
        if (r.ok) {
          DB = await r.json();
          mergeDefaults(DB);
          LAST_GOOD = JSON.stringify(DB);
          // Cache it locally
          try { localStorage.setItem('drive_cache_' + FILE_NAME, JSON.stringify(DB)); } catch(e2) {}
          banner(Drive.isSignedIn() ? '' : 'Donn\u00e9es charg\u00e9es. Connectez-vous avec Google pour sauvegarder vos modifications.');
          updateAuthUI();
          return;
        }
      } catch(e) {}
      // 4. Empty fallback
      DB = { meta: {}, lists: {}, trades: [], reviews: [] };
      banner('Connectez-vous avec Google pour charger vos donn\u00e9es.');
    } catch (e) {
      banner('Erreur : ' + e.message);
      DB = Drive.getCached() || EMPTY_JOURNAL;
      mergeDefaults(DB);
    }
    updateAuthUI(); updateStatusBar(); initNewsAlerts(); requestNotifPermission(); themeSwitcher(); setInterval(() => { updateStatusBar(); reviewAlertsOnce(); }, 30 * 60 * 1000);
  }
  function updateAuthUI() {
    var btn = document.getElementById('auth-btn');
    var info = document.getElementById('auth-info');
    if (!btn) return;
    var re = Drive.takeReturnError && Drive.takeReturnError();
    if (re) banner('Erreur de connexion : ' + re);
    if (Drive.isDirty && !Drive.isSignedIn() && Drive.isDirty()) { PENDING_SYNC = true; updateStatusBar(); }
    if (Drive.isSignedIn()) {
      btn.textContent = 'D\u00e9connexion';
      btn.onclick = function() { Drive.signOut(); };
      btn.className = 'btn';
      if (info) info.textContent = '\u2601 Google Drive';
    } else {
      btn.textContent = 'Connexion Google';
      btn.onclick = function() { Drive.signIn(); };
      btn.className = 'btn primary';
      if (info) info.textContent = '';
    }
  }
  let LAST_GOOD = null;
  var PENDING_SYNC = false;
  async function save(okMsg) {
    try {
      await Drive.save(DB);
      LAST_GOOD = JSON.stringify(DB);
      PENDING_SYNC = false;
      banner('');
      toast(okMsg || 'Enregistr\u00e9 \u2601'); updateStatusBar();
      return true;
    } catch (e) {
      var m = e && e.message ? e.message : String(e);
      // Auth or network problem: the change is already in the local cache, so keep it
      var recoverable = /Connexion Google|expir|Non connect|Reconnexion|AUTH_REQUIRED|SILENT_FAILED|interaction_required|login_required|Google Drive a r|Failed to fetch|NetworkError|network/i.test(m);
      if (recoverable) {
        PENDING_SYNC = true;
        updateStatusBar();
        banner('\u26a0 Non synchronis\u00e9 : ' + m + ' Votre modification est conserv\u00e9e sur cet appareil.');
        return true;    // the edit stands; it will sync on the next successful save
      }
      if (LAST_GOOD) DB = JSON.parse(LAST_GOOD);
      banner('\u00c9chec : ' + m + ' \u2014 modification ANNUL\u00c9E.');
      return false;
    }
  }
  async function retrySync() {
    if (!PENDING_SYNC) return;
    try {
      await Drive.save(DB);
      PENDING_SYNC = false; LAST_GOOD = JSON.stringify(DB);
      banner(''); toast('Synchronis\u00e9 \u2601'); updateStatusBar();
    } catch (e) {}
  }
  window.addEventListener('online', function() { retrySync(); });

  /* ---------- helpers ---------- */
  const list = k => (DB.lists[k] && DB.lists[k].length) ? DB.lists[k] : (DEF_LISTS[k] || []);
  const FIELD = { instruments: t => [t.instrument], sessions: t => [t.session], entries: t => [t.entry], aggEntries: t => [t.agg && t.agg.entry], sl: t => [t.sl, t.agg && t.agg.sl], tp: t => [t.tp, t.agg && t.agg.tp] };
  const uniq = k => [...new Set([...(DB.lists[k] || []), ...DB.trades.flatMap(FIELD[k] || (() => [])).filter(Boolean)])];
  const opts = (arr, sel, blank) => (blank !== undefined ? `<option value="">${esc(blank)}</option>` : '') + arr.map(v => `<option ${v === sel ? 'selected' : ''} value="${esc(v)}">${esc(v)}</option>`).join('');
  const enriched = () => S.enrich(DB.trades);
  const byN = n => enriched().find(t => t.n === n);

  /* ---------- graphiques SVG ---------- */
  function lineChart(o) {
    const W = 720, H = o.h || 230, m = { l: 46, r: 12, t: 12, b: 28 };
    const pts = o.series.flatMap(s => s.pts);
    if (!pts.length) return '<p class="muted">Pas de données.</p>';
    let xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = o.yMin !== undefined ? o.yMin : Math.min(...ys), y1 = o.yMax !== undefined ? o.yMax : Math.max(...ys);
    if (x0 === x1) x1 = x0 + 1; if (y0 === y1) y1 = y0 + 1;
    const pad = o.yMin === undefined ? (y1 - y0) * .08 : 0; y0 -= pad; if (o.yMax === undefined) y1 += pad;
    const X = x => m.l + (x - x0) / (x1 - x0) * (W - m.l - m.r), Y = y => H - m.b - (y - y0) / (y1 - y0) * (H - m.t - m.b);
    let g = '';
    for (let i = 0; i <= 4; i++) { const v = y0 + (y1 - y0) * i / 4; g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${o.yFmt ? o.yFmt(v) : v.toFixed(1)}</text>`; }
    const step = Math.max(1, Math.ceil((x1 - x0) / 12));
    for (let x = Math.ceil(x0); x <= x1; x += step) g += `<text x="${X(x)}" y="${H - 8}" text-anchor="middle">${x}</text>`;
    if (y0 < 0 && y1 > 0) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--muted)" stroke-dasharray="4 3"/>`;
    const body = o.series.map(s => {
      const d = s.pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('');
      const area = s.area ? `<path d="${d}L${X(s.pts[s.pts.length - 1][0])} ${Y(0)}L${X(s.pts[0][0])} ${Y(0)}Z" fill="${s.color}" opacity=".18"/>` : '';
      const dots = s.pts.length <= 80 ? s.pts.map(p => `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3" fill="${s.color}"><title>${esc(s.name)} · trade ${p[0]} : ${o.yFmt ? o.yFmt(p[1]) : p[1].toFixed(2)}</title></circle>`).join('') : '';
      return area + `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2"/>` + dots;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}">${g}${body}</svg>`;
  }
  function histChart(bins) {
    if (!bins.length) return '<p class="muted">Pas de données.</p>';
    const W = 720, H = 230, m = { l: 36, r: 10, t: 12, b: 40 }, mx = Math.max(...bins.map(b => b.count)), bw = (W - m.l - m.r) / bins.length;
    let s = '';
    for (let i = 0; i <= mx; i++) { const y = H - m.b - i / mx * (H - m.t - m.b); s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${m.l - 6}" y="${y + 4}" text-anchor="end">${i}</text>`; if (mx > 12) i += Math.ceil(mx / 6) - 1; }
    bins.forEach((b, i) => {
      const h = b.count / mx * (H - m.t - m.b), x = m.l + i * bw;
      s += `<rect x="${x + 2}" y="${H - m.b - h}" width="${bw - 4}" height="${h}" fill="${b.to <= 0 ? 'var(--loss)' : b.from >= 0 ? 'var(--win)' : 'var(--be)'}" rx="2"><title>[${b.from} ; ${b.to}[ R : ${b.count} trade(s)</title></rect>`;
      s += `<text x="${x + bw / 2}" y="${H - m.b + 14}" text-anchor="middle">${b.from}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}">${s}<text x="${W / 2}" y="${H - 4}" text-anchor="middle">Tranche de R (borne basse)</text></svg>`;
  }

  /* ---------- tableaux de groupes ---------- */
  function groupTable(title, rows) {
    if (!rows.length) return '';
    return `<div class="card"><h3>${esc(title)}</h3><div class="twrap" style="max-height:none"><table><thead><tr><th>Groupe</th><th class="num">n</th><th class="num">Win rate</th><th class="num">Net R</th><th class="num">Espérance</th><th class="num">PF</th><th class="num">Gain moy.</th><th class="num">Perte moy.</th></tr></thead><tbody>` +
      rows.map(r => `<tr class="${r.n < 10 ? 'low' : ''}"><td>${esc(r.key)}</td><td class="num">${r.n}</td><td class="num">${pct(r.winRate)}</td><td class="num ${cls(r.net)}">${sgn(r.net)}</td><td class="num ${cls(r.exp)}">${sgn(r.exp)}</td><td class="num">${num(r.profitFactor)}</td><td class="num">${num(r.avgWin)}</td><td class="num">${num(r.avgLoss)}</td></tr>`).join('') +
      `</tbody></table></div></div>`;
  }

  /* ---------- DASHBOARD (performance de l'entrée CONSERVATIVE = colonnes Return d'origine) ---------- */


  /* ---------- STATUS BAR (guardrails + news alerts) ---------- */

  /* ---------- FOCUS PILLS: yesterday's improvement + this week's priority ---------- */
  function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '\u2026' : s; }
  function fmtDayFR(iso) { return new Date(iso + 'T00:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }); }
  // Improvements written on the most recent day BEFORE today (within a week, so weekends and days off are covered)
  function improvementsForToday() {
    if (!DB || !DB.trades) return { day: null, items: [] };
    var today = todayISO(), floor = addDaysISO(today, -7), seen = {};
    var list = DB.trades.filter(function(t) { return t.improvement && String(t.improvement).trim(); }).map(function(t) {
      // Reference day = the day of the TRADE (an improvement noted the next morning still belongs to that trading day).
      // Backtest trades carry old dates (e.g. 2024): for those, the day the improvement was WRITTEN is used instead.
      var recentTrade = t.date && t.date >= floor && t.date <= today;
      return { n: t.n, text: String(t.improvement).trim(), day: recentTrade ? t.date : (t.improvementAt || t.date), instrument: t.instrument };
    });
    var days = list.map(function(x) { return x.day; }).filter(function(d) { return d && d < today && d >= floor; }).sort();
    if (!days.length) return { day: null, items: [] };
    var day = days[days.length - 1];
    var items = list.filter(function(x) {
      if (x.day !== day || seen[x.text.toLowerCase()]) return false;
      seen[x.text.toLowerCase()] = true; return true;
    });
    return { day: day, items: items };
  }
  function chosenImprovement() {
    var f = improvementsForToday();
    if (!f.items.length) return null;
    var pick = (DB && DB.focusPick) || {};
    var it = pick.day === f.day ? f.items.filter(function(x) { return x.n === pick.n; })[0] : null;
    return { day: f.day, items: f.items, current: it || f.items[0], index: it ? f.items.indexOf(it) : 0 };
  }
  // The weekly review's "single focus for next week", shown during the following week
  function weeklyPriority() {
    if (!DB || !DB.reviews) return null;
    var thisMon = weekStartISO(), lastMon = addDaysISO(thisMon, -7);
    var wk = DB.reviews.filter(function(r) { return r.type === 'weekly' && r.answers && String(r.answers.q4 || '').trim(); });
    // 1) the review of last week (live journal)
    var byPeriod = wk.filter(function(r) { return r.start === lastMon; })[0];
    // 2) otherwise a review WRITTEN last week, whatever week it covers (backtest of past weeks)
    var written = wk.filter(function(r) { return r.savedAt && r.savedAt >= lastMon && r.savedAt < thisMon; })
      .sort(function(a, b) { return a.savedAt < b.savedAt ? 1 : -1; })[0];
    var r = byPeriod || written;
    return r ? { text: String(r.answers.q4).trim(), start: r.start } : null;
  }
  function focusPills() {
    var h = '', ci = chosenImprovement(), wp = weeklyPriority();
    if (ci) {
      h += '<span class="gr-pill gr-pill-focus" id="focus-pill" role="button" tabindex="0" title="' + esc(ci.current.text) + '">\ud83d\udd27 ' +
        esc(trunc(ci.current.text, 40)) + (ci.items.length > 1 ? ' <b>' + (ci.index + 1) + '/' + ci.items.length + ' \u25be</b>' : '') + '</span>';
    }
    if (wp) {
      h += '<span class="gr-pill gr-pill-prio" id="prio-pill" role="button" tabindex="0" title="' + esc(wp.text) + '">\ud83d\udccc ' + esc(trunc(wp.text, 40)) + '</span>';
    }
    return h;
  }
  function closeFocusPop() { var p = document.getElementById('focus-pop'); if (p) p.parentNode.removeChild(p); }
  function openFocusPop(anchor, kind) {
    closeFocusPop();
    var pop = document.createElement('div');
    pop.id = 'focus-pop'; pop.className = 'focus-pop';
    if (kind === 'prio') {
      var wp = weeklyPriority(); if (!wp) return;
      pop.innerHTML = '<div class="fp-head">\ud83d\udccc Priorit\u00e9 unique de la semaine</div><div class="fp-text">' + esc(wp.text) + '</div>' +
        '<div class="fp-foot">Tir\u00e9e de la revue de la semaine du ' + esc(fmtDayFR(wp.start)) + '</div>';
    } else {
      var ci = chosenImprovement(); if (!ci) return;
      pop.innerHTML = '<div class="fp-head">\ud83d\udd27 Am\u00e9lioration pour aujourd\u2019hui</div>' +
        '<div class="fp-foot">Issue de la journ\u00e9e du ' + esc(fmtDayFR(ci.day)) + (ci.items.length > 1 ? ' \u2014 choisissez celle \u00e0 afficher' : '') + '</div>' +
        ci.items.map(function(it) {
          return '<label class="fp-opt"><input type="radio" name="fp-pick" value="' + it.n + '"' + (it.n === ci.current.n ? ' checked' : '') + '>' +
            '<span>' + esc(it.text) + '<small>' + (it.n < 0 ? 'post-market' : 'trade #' + it.n) + (it.instrument ? ' \u00b7 ' + esc(it.instrument) : '') + '</small></span></label>';
        }).join('');
    }
    document.body.appendChild(pop);
    var r = anchor.getBoundingClientRect();
    pop.style.top = (r.bottom + window.scrollY + 6) + 'px';
    pop.style.left = Math.max(8, Math.min(r.left + window.scrollX, window.innerWidth - pop.offsetWidth - 8)) + 'px';
    Array.prototype.forEach.call(pop.querySelectorAll('input[name=fp-pick]'), function(inp) {
      inp.onchange = async function() {
        var cur = chosenImprovement();
        DB.focusPick = { day: cur.day, n: +inp.value };
        closeFocusPop(); updateStatusBar();
        await save('Am\u00e9lioration du jour choisie');
      };
    });
  }
  document.addEventListener('click', function(e) {
    var fp = e.target.closest && e.target.closest('#focus-pill');
    var pp = e.target.closest && e.target.closest('#prio-pill');
    if (fp || pp) { e.stopPropagation(); var open = document.getElementById('focus-pop');
      if (open && open.dataset.kind === (fp ? 'impr' : 'prio')) { closeFocusPop(); return; }
      openFocusPop(fp || pp, fp ? 'impr' : 'prio');
      var np = document.getElementById('focus-pop'); if (np) np.dataset.kind = fp ? 'impr' : 'prio';
      return; }
    if (!(e.target.closest && e.target.closest('#focus-pop'))) closeFocusPop();
  });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeFocusPop(); });

  function updateStatusBar() {
    var bar = document.getElementById('gr-status-bar');
    if (!bar || !DB) return;
    if (typeof PENDING_SYNC !== 'undefined' && PENDING_SYNC) {
      bar.innerHTML = '<span class="gr-pill gr-pill-danger" title="Reconnectez-vous pour synchroniser">\u26a0 Non synchronis\u00e9</span>' + statusPills();
      return;
    }
    bar.innerHTML = statusPills();
    clearTimeout(updateStatusBar.rv); updateStatusBar.rv = setTimeout(reviewAlertsOnce, 1500);
    return;
  }
  function statusPills() {
    var g = getGuardrails();
    if (!g.enabled) return focusPills() + newsBlockPill() + reviewPills() + e20Pill();
    var st = todayStats();
    var kz = g.killzones || {};
    var activeKz = (kz.sessions || []).filter(function(s) { return s.active; });

    var tradesCls = st.n >= g.maxTrades ? 'gr-pill-danger' : st.n >= g.maxTrades - 1 ? 'gr-pill-warn' : 'gr-pill-ok';
    var lossCls = st.losses <= g.maxLossR ? 'gr-pill-danger' : (g.maxLossR !== 0 && st.losses <= g.maxLossR * 0.7) ? 'gr-pill-warn' : 'gr-pill-ok';
    var netCls = st.net >= g.dailyTargetR ? 'gr-pill-target' : st.net > 0 ? 'gr-pill-ok' : st.net < 0 ? 'gr-pill-warn' : '';

    var html = '<span class="gr-pill ' + tradesCls + '" title="Trades / Max">\ud83d\udcca ' + st.n + '/' + g.maxTrades + '</span>';
    html += '<span class="gr-pill ' + netCls + '" title="Net R du jour">Net ' + sgn(st.net) + 'R</span>';
    html += '<span class="gr-pill ' + lossCls + '" title="Pertes / Max loss">Loss ' + sgn(st.losses) + '/' + sgn(g.maxLossR) + '</span>';
    if (st.net >= g.dailyTargetR) html += '<span class="gr-pill gr-pill-target" title="Daily target atteint">\ud83c\udfaf</span>';
    var wk = periodStats('week'), mo = periodStats('month');
    if (g.weeklyTargetR > 0) {
      var wkHit = wk.net >= g.weeklyTargetR;
      html += '<span class="gr-pill ' + (wkHit ? 'gr-pill-target' : wk.net < 0 ? 'gr-pill-warn' : 'gr-pill-ok') + '" title="Semaine ' + esc(wk.label) + '">' +
        (wkHit ? '\ud83d\udcc5\u2713 ' : 'S ') + sgn(wk.net) + '/' + num(g.weeklyTargetR) + 'R</span>';
    }
    if (g.monthlyTargetR > 0) {
      var moHit = mo.net >= g.monthlyTargetR;
      html += '<span class="gr-pill ' + (moHit ? 'gr-pill-target' : mo.net < 0 ? 'gr-pill-warn' : 'gr-pill-ok') + '" title="Mois ' + esc(mo.label) + '">' +
        (moHit ? '\ud83c\udfc6\u2713 ' : 'M ') + sgn(mo.net) + '/' + num(g.monthlyTargetR) + 'R</span>';
    }
    if (st.losses <= g.maxLossR) html += '<span class="gr-pill gr-pill-danger" title="Max loss atteint">\ud83d\udd34</span>';

    var newsAlert = document.getElementById('news-alert-pill');
    if (newsAlert) html += newsAlert.outerHTML;
    return focusPills() + newsBlockPill() + reviewPills() + e20Pill() + html;
  }

  /* ---------- NEWS ALERTS (10mn before High Impact) ---------- */
  var _newsTimers = [];
  var _newsAlertMsg = '';

  function initNewsAlertsLegacy() {
    if (!DB) return;
    // Clear existing timers
    _newsTimers.forEach(function(t) { clearTimeout(t); });
    _newsTimers = [];

    var saved = DB.newsFilter || {};
    var currencies = saved.currencies || ['USD','EUR','GBP','JPY','CHF','AUD','NZD','CAD'];

    // Try to fetch calendar data
    var apiUrl = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
    var proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(apiUrl);

    loadNewsEvents()
      .then(function(events) { updateStatusBar();
        if (!Array.isArray(events)) return;
        var now = Date.now();
        var ALERT_BEFORE = 10 * 60 * 1000; // 10 minutes

        events.forEach(function(ev) {
          if (!ev.date || (ev.impact || '').toLowerCase() !== 'high') return;
          var ccy = (ev.country || ev.currency || '').toUpperCase();
          if (currencies.indexOf(ccy) < 0) return;

          var eventTime = new Date(ev.date).getTime();
          if (isNaN(eventTime)) return;
          var alertTime = eventTime - ALERT_BEFORE;
          var delay = alertTime - now;

          if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
            _newsTimers.push(setTimeout(function() {
              showNewsAlert(ev, ccy, eventTime);
            }, delay));
          }
          // Also check if we're currently within the 10-minute window
          if (now >= alertTime && now < eventTime) {
            showNewsAlert(ev, ccy, eventTime);
          }
        });
      }).catch(function() {});
  }

  function showNewsAlert(ev, ccy, eventTime) {
    var mins = Math.max(0, Math.round((eventTime - Date.now()) / 60000));
    var title = ev.title || ev.event || 'High Impact News';
    _newsAlertMsg = '\ud83d\udea8 ' + ccy + ' ' + title + ' dans ' + mins + 'mn';

    // Update status bar
    var bar = document.getElementById('gr-status-bar');
    if (bar) {
      var pill = bar.querySelector('#news-alert-pill');
      if (!pill) {
        pill = document.createElement('span');
        pill.id = 'news-alert-pill';
        pill.className = 'gr-pill gr-pill-news';
        bar.appendChild(pill);
      }
      pill.textContent = _newsAlertMsg;
      pill.title = title + ' (' + ccy + ') - ' + new Date(eventTime).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
    }

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') try {
      new Notification('\ud83d\udea8 High Impact News dans ' + mins + 'mn', {
        body: ccy + ' - ' + title,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">\ud83d\udea8</text></svg>',
        tag: 'news-' + ccy + '-' + eventTime
      });
    } catch (e) { /* Android : Notification() interdit hors service worker */ }

    // Also show a toast in the app
    if (typeof toast === 'function') toast('\ud83d\udea8 ' + ccy + ': ' + title + ' dans ' + mins + 'mn', 8000);
  }

  // Request notification permission on first interaction
  function requestNotifPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }



  /* ---------- GUARDRAILS ---------- */
  function defaultGuardrails() { return { maxTrades: 3, maxLossR: -3, maxRiskR: 1, dailyTargetR: 3, weeklyTargetR: 10, monthlyTargetR: 30, enabled: true, killzones: {
      enabled: true,
      sessions: [
        { name: 'Asian', from: '03:00', to: '07:00', active: false },
        { name: 'London', from: '09:00', to: '12:30', active: true },
        { name: 'NY', from: '14:00', to: '17:00', active: true },
        { name: 'London Close', from: '17:00', to: '19:00', active: false }
      ]
    }}; }
  function getGuardrails() { return Object.assign(defaultGuardrails(), (DB && DB.guardrails) || {}); }
  // All calendar maths in UTC on 'YYYY-MM-DD' strings: no timezone can shift a day (Antananarivo is UTC+3)
  // 'today' in the USER's local calendar (a trade at 01:00 in Antananarivo belongs to that day, not to UTC's yesterday)
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function addDaysISO(iso, n) { var x = new Date(iso + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function weekStartISO(d) {
    var x = new Date((d || todayISO()) + 'T00:00:00Z');
    var day = x.getUTCDay();
    x.setUTCDate(x.getUTCDate() - day + (day === 0 ? -6 : 1));
    return x.toISOString().slice(0, 10);
  }
  function periodStats(kind, dateStr) {
    // kind: 'week' | 'month' ; returns { net, n, from, to, label }
    var ref = dateStr || todayISO();
    var from, to, label;
    if (kind === 'week') {
      from = weekStartISO(ref);
      to = addDaysISO(from, 6);
      label = 'semaine du ' + new Date(from + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
    } else {
      from = ref.slice(0, 8) + '01';
      var d2 = new Date(ref.slice(0, 7) + '-01T00:00:00Z');
      d2.setUTCMonth(d2.getUTCMonth() + 1); d2.setUTCDate(0);
      to = d2.toISOString().slice(0, 10);
      label = new Date(from + 'T00:00:00Z').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    }
    var ts = ((DB && DB.trades) || []).filter(function(t) {
      return t.date && t.date >= from && t.date <= to && S.filled(t.ret);
    });
    var net = 0;
    ts.forEach(function(t) { net += Number(t.ret); });
    return { net: net, n: ts.length, from: from, to: to, label: label };
  }
  function todayStats(dateStr) {
    var d = dateStr || todayISO();
    var ts = ((DB && DB.trades) || []).filter(function(t) { return t.date === d && S.filled(t.ret); });
    var n = ts.length;
    var net = 0, losses = 0;
    ts.forEach(function(t) { net += Number(t.ret); if (t.ret < 0) losses += Number(t.ret); });
    return { date: d, n: n, net: net, losses: losses };
  }
  function guardrailAlerts(dateStr, addOne) {
    var g = getGuardrails(), st = todayStats(dateStr);
    if (addOne) { st = { date: st.date, n: st.n + 1, net: st.net, losses: st.losses }; }
    if (!g.enabled) return { alerts: [], st: st, g: g };
    var alerts = [];
    if (st.n >= g.maxTrades) alerts.push({ level: 'danger', msg: 'Limite de trades atteinte : ' + st.n + '/' + g.maxTrades + ' trades aujourd\'hui', icon: '\ud83d\udeab' });
    if (st.losses <= g.maxLossR) alerts.push({ level: 'danger', msg: 'Max loss atteint : ' + sgn(st.losses) + ' R (limite : ' + sgn(g.maxLossR) + ' R)', icon: '\ud83d\udd34' });
    else if (g.maxLossR !== 0 && st.losses <= g.maxLossR * 0.7) alerts.push({ level: 'warn', msg: 'Attention : ' + sgn(st.losses) + ' R de pertes (limite : ' + sgn(g.maxLossR) + ' R)', icon: '\u26a0\ufe0f' });
    if (st.net >= g.dailyTargetR) alerts.push({ level: 'ok', msg: 'Daily target atteint : ' + sgn(st.net) + ' R (objectif : +' + num(g.dailyTargetR) + ' R)', icon: '\ud83c\udfaf' });
    var wk = periodStats('week', dateStr), mo = periodStats('month', dateStr);
    if (g.weeklyTargetR > 0 && wk.net >= g.weeklyTargetR) alerts.push({ level: 'ok', msg: 'Objectif hebdomadaire atteint : ' + sgn(wk.net) + ' R (objectif : +' + num(g.weeklyTargetR) + ' R)', icon: '\ud83d\udcc5' });
    if (g.monthlyTargetR > 0 && mo.net >= g.monthlyTargetR) alerts.push({ level: 'ok', msg: 'Objectif mensuel atteint : ' + sgn(mo.net) + ' R (objectif : +' + num(g.monthlyTargetR) + ' R)', icon: '\ud83c\udfc6' });
    return { alerts: alerts, st: st, g: g, wk: wk, mo: mo };
  }
  function guardrailBanner() {
    var r = guardrailAlerts();
    if (!r.g.enabled || !r.alerts.length) return '';
    var html = '<div class="guardrails">';
    r.alerts.forEach(function(a) { html += '<div class="gr-alert gr-' + a.level + '"><span class="gr-icon">' + a.icon + '</span> ' + esc(a.msg) + '</div>'; });
    html += '<div class="gr-summary">' + r.st.n + ' trade(s) \u00b7 Net ' + sgn(r.st.net) + ' R \u00b7 Pertes ' + sgn(r.st.losses) + ' R</div></div>';
    return html;
  }
  function checkKillzone(session, time) {
    var g = getGuardrails();
    if (!g.enabled || !g.killzones || !g.killzones.enabled) return null;
    var byTime = killzoneAt(time);
    if (byTime) return byTime.inKz ? null : 'Heure d\u2019entr\u00e9e ' + time + ' en dehors des killzones actives (' + (g.killzones.sessions || []).filter(function(s) { return s.active; }).map(function(s) { return s.name + ' ' + s.from + '-' + s.to; }).join(', ') + ')';
    var allKz = g.killzones.sessions || [];
    var activeSessions = allKz.filter(function(s) { return s.active; });
    if (!activeSessions.length) return null;
    var sessionLower = (session || '').toLowerCase().trim();
    if (!sessionLower) return '\u23f0 Session non renseign\u00e9e (killzones actives : ' + activeSessions.map(function(s) { return s.name; }).join(', ') + ')';
    // Exact match only: session must exactly match one active killzone name
    var matched = activeSessions.some(function(kz) {
      return sessionLower === kz.name.toLowerCase();
    });
    if (matched) return null;
    return '\u23f0 Trade en dehors des killzones actives (' + activeSessions.map(function(s) { return s.name + ' ' + s.from + '-' + s.to; }).join(', ') + '). Session du trade : \u00ab ' + session + ' \u00bb';
  }
  function isSessionInKillzone(session) {
    // Returns true if session is in an active killzone, false otherwise
    return checkKillzone(session) === null;
  }
  function guardrailConfirm(dateStr, session, time) {
    var r = guardrailAlerts(dateStr, true);
    var danger = r.alerts.filter(function(a) { return a.level === 'danger'; });
    var kzWarn = checkKillzone(session, time);
    if (!danger.length && !kzWarn) return true;
    var msg = '\u26a0\ufe0f GUARDRAIL \u26a0\ufe0f\n\n';
    danger.forEach(function(a) { msg += '\ud83d\udeab ' + a.msg + '\n'; });
    if (kzWarn) msg += '\u23f0 ' + kzWarn + '\n';
    msg += '\nVoulez-vous quand m\u00eame enregistrer ce trade ?';
    return confirm(msg);
  }
  function renderGuardrails() {
    var g = getGuardrails(), st = todayStats();
    var wkS = periodStats('week'), moS = periodStats('month');
    var kz = g.killzones || defaultGuardrails().killzones;
    var kzSessions = kz.sessions || defaultGuardrails().killzones.sessions;
    var r = guardrailAlerts();
    var bannerHTML = guardrailBanner();
    if (!bannerHTML) bannerHTML = '<div class="note">Aucune alerte pour aujourd\'hui.</div>';
    var days = [];
    var allDates = {};
    DB.trades.forEach(function(t) { if (S.filled(t.ret)) allDates[t.date] = true; });
    Object.keys(allDates).sort().reverse().slice(0, 7).forEach(function(d) {
      var ds = todayStats(d);
      var wins = DB.trades.filter(function(t) { return t.date === d && S.filled(t.ret) && t.ret > 0; }).length;
      var losses = DB.trades.filter(function(t) { return t.date === d && S.filled(t.ret) && t.ret < 0; }).length;
      var flags = [];
      if (ds.n > g.maxTrades) flags.push('\ud83d\udeab Max trades');
      if (ds.losses <= g.maxLossR) flags.push('\ud83d\udd34 Max loss');
      if (ds.net >= g.dailyTargetR) flags.push('\ud83c\udfaf Target');
      // Check killzone violations for this day
      if (kz.enabled !== false) {
        var dayTrades = DB.trades.filter(function(t) { return t.date === d && S.filled(t.ret); });
        var oosCount = dayTrades.filter(function(t) { return !tradeInKz(t); }).length;
        if (oosCount > 0) flags.push('\u23f0 ' + oosCount + ' hors killzone');
      }
      days.push('<tr><td>' + esc(d) + ' (' + S.dayName(d) + ')</td><td class="num">' + ds.n + '</td><td class="num">' + wins + '</td><td class="num">' + losses + '</td><td class="num ' + cls(ds.net) + '">' + sgn(ds.net) + '</td><td class="num ' + cls(ds.losses) + '">' + sgn(ds.losses) + '</td><td>' + (flags.join(' ') || '\u2705') + '</td></tr>');
    });
    $('#main').innerHTML =
      '<h1>\u26a1 Guardrails</h1>' +
      '<div class="gr-settings"><h3>Limites journali\u00e8res</h3>' +
      '<p class="muted small">Ces seuils sont v\u00e9rifi\u00e9s en temps r\u00e9el. L\u2019application vous avertit quand une limite est atteinte et demande confirmation avant d\u2019enregistrer un trade qui d\u00e9passe un seuil.</p>' +
      '<div class="gr-row">' +
      '<label style="flex-direction:row;align-items:center;gap:6px;padding-bottom:7px"><input type="checkbox" id="gr-enabled" ' + (g.enabled ? 'checked' : '') + '> Activer les guardrails</label>' +
      '<label>Max trades / jour<input type="number" id="gr-maxTrades" min="1" value="' + g.maxTrades + '"></label>' +
      '<label>Max loss / jour (R)<input type="number" id="gr-maxLoss" step="0.5" value="' + g.maxLossR + '"></label>' +
      '<label>Max risque / trade (R)<input type="number" id="gr-maxRisk" step="0.05" min="0.01" value="' + g.maxRiskR + '"></label>' +
      '<label>Daily target (R)<input type="number" id="gr-target" step="0.5" min="0" value="' + g.dailyTargetR + '"></label>' +
      '<label>Objectif hebdo (R)<input type="number" id="gr-weekly" step="0.5" min="0" value="' + g.weeklyTargetR + '"></label>' +
      '<label>Objectif mensuel (R)<input type="number" id="gr-monthly" step="0.5" min="0" value="' + g.monthlyTargetR + '"></label>' +
      '</div></div>' +
      '<div class="gr-settings" style="margin-top:14px"><h3>\u23f0 Killzones (fen\u00eatres de trading)</h3>' +
      '<p class="muted small">S\u00e9lectionnez les sessions pendant lesquelles vous tradez. Un avertissement s\u2019affiche si vous enregistrez un trade en dehors de ces fen\u00eatres.</p>' +
      '<div style="margin:10px 0"><label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="kz-enabled" ' + (kz.enabled !== false ? 'checked' : '') + '> Activer le contr\u00f4le des killzones</label></div>' +
      '<div id="kz-sessions">' + kzSessions.map(function(sess, i) {
        return '<div class="gr-row" style="margin-bottom:8px;padding:8px;border-radius:6px;background:' + (sess.active ? 'rgba(59,130,246,.08)' : 'transparent') + '">' +
          '<label style="flex-direction:row;align-items:center;gap:6px;min-width:160px"><input type="checkbox" class="kz-active" data-i="' + i + '"' + (sess.active ? ' checked' : '') + '> <b>' + esc(sess.name) + '</b></label>' +
          '<label>From<input type="text" class="kz-from" data-i="' + i + '" value="' + esc(sess.from) + '" style="width:70px" placeholder="09:00"></label>' +
          '<label>To<input type="text" class="kz-to" data-i="' + i + '" value="' + esc(sess.to) + '" style="width:70px" placeholder="12:30"></label>' +
          '</div>';
      }).join('') + '</div>' +
      '<div class="actions" style="margin-top:10px"><button class="btn primary" id="gr-save">Enregistrer</button></div></div>' +
      '<h2>Statut du jour (' + st.date + ')</h2>' + bannerHTML +
      '<div class="kpis"><div class="kpi"><div class="l">Trades aujourd\u2019hui</div><div class="v ' + (st.n >= g.maxTrades ? 'neg' : '') + '">' + st.n + ' / ' + g.maxTrades + '</div></div>' +
      '<div class="kpi"><div class="l">Pertes du jour</div><div class="v ' + (st.losses <= g.maxLossR ? 'neg' : '') + '">' + sgn(st.losses) + ' R</div></div>' +
      '<div class="kpi"><div class="l">Net du jour</div><div class="v ' + cls(st.net) + '">' + sgn(st.net) + ' R</div></div>' +
      '<div class="kpi"><div class="l">Semaine (' + wkS.label + ')</div><div class="v ' + (g.weeklyTargetR > 0 && wkS.net >= g.weeklyTargetR ? 'pos' : cls(wkS.net)) + '">' + sgn(wkS.net) + ' / ' + (g.weeklyTargetR > 0 ? '+' + num(g.weeklyTargetR) : '\u2014') + ' R</div></div>' +
      '<div class="kpi"><div class="l">Mois (' + moS.label + ')</div><div class="v ' + (g.monthlyTargetR > 0 && moS.net >= g.monthlyTargetR ? 'pos' : cls(moS.net)) + '">' + sgn(moS.net) + ' / ' + (g.monthlyTargetR > 0 ? '+' + num(g.monthlyTargetR) : '\u2014') + ' R</div></div>' +
      '<div class="kpi"><div class="l">Killzones actives</div><div class="v">' + (kz.enabled !== false ? kzSessions.filter(function(s){return s.active}).map(function(s){return s.name}).join(', ') || 'Aucune' : 'D\u00e9sactiv\u00e9') + '</div></div>' +
      '<div class="kpi"><div class="l">Daily target</div><div class="v ' + (st.net >= g.dailyTargetR ? 'pos' : '') + '">+' + num(g.dailyTargetR) + ' R</div></div></div>' +
      '<h2>Historique des 7 derniers jours de trading</h2>' +
      '<div class="twrap" style="max-height:none"><table><thead><tr><th>Date</th><th class="num">Trades</th><th class="num">Wins</th><th class="num">Losses</th><th class="num">Net R</th><th class="num">Pertes R</th><th>Statut</th></tr></thead><tbody>' + days.join('') + '</tbody></table></div>';
    $('#gr-save').onclick = async function() {
      var kzSess = [];
      document.querySelectorAll('.kz-active').forEach(function(cb, i) {
        kzSess.push({ name: kzSessions[i].name, from: document.querySelectorAll('.kz-from')[i].value || kzSessions[i].from, to: document.querySelectorAll('.kz-to')[i].value || kzSessions[i].to, active: cb.checked });
      });
      DB.guardrails = { enabled: $('#gr-enabled').checked, maxTrades: +$('#gr-maxTrades').value || 3, maxLossR: +$('#gr-maxLoss').value || -3, maxRiskR: +$('#gr-maxRisk').value || 1, dailyTargetR: +$('#gr-target').value || 3, weeklyTargetR: +$('#gr-weekly').value || 0, monthlyTargetR: +$('#gr-monthly').value || 0, killzones: { enabled: $('#kz-enabled').checked, sessions: kzSess } };
      if (await save('Guardrails enregistr\u00e9s')) renderGuardrails();
    };
  }



  /* ---------- DISCIPLINE SCORE ---------- */
  function calcDiscipline(trades) {
    if (!trades.length) return null;
    var g = getGuardrails();
    var kz = g.killzones || {};
    var activeKz = (kz.sessions || []).filter(function(s) { return s.active; });
    var kzNames = activeKz.map(function(s) { return s.name.toLowerCase(); });
    var kzEnabled = g.enabled && kz.enabled !== false && kzNames.length > 0;

    // 1. Plan-follow rate (25%)
    var pfTotal = 0, pfYes = 0;
    trades.forEach(function(t) {
      if (t.planFollow === 'Yes' || t.planFollow === 'No') {
        pfTotal++;
        if (t.planFollow === 'Yes') pfYes++;
      }
    });
    var pfRate = pfTotal > 0 ? pfYes / pfTotal : 1;

    // 2. Non-FOMO rate (15%)
    var fomoTotal = 0, fomoNo = 0;
    trades.forEach(function(t) {
      if (t.fomo === 'Yes' || t.fomo === 'No') {
        fomoTotal++;
        if (t.fomo === 'No') fomoNo++;
      }
    });
    var fomoRate = fomoTotal > 0 ? fomoNo / fomoTotal : 1;

    // 3. Setup grade A+ ou A (20%)
    var gradeTotal = 0, gradeOk = 0;
    trades.forEach(function(t) {
      if (t._grade) {
        gradeTotal++;
        if (t._grade === 'A+' || t._grade === 'A') gradeOk++;
      }
    });
    var gradeRate = gradeTotal > 0 ? gradeOk / gradeTotal : 1;

    // 4. Killzone compliance (15%)
    var kzTotal = 0, kzOk = 0;
    if (kzEnabled) {
      trades.forEach(function(t) {
        var kt = killzoneAt(t.entryTime);
        if (kt) { kzTotal++; if (kt.inKz) kzOk++; }
        else if (t.session) {
          kzTotal++;
          if (kzNames.indexOf(t.session.toLowerCase()) >= 0) kzOk++;
        }
      });
    }
    var kzRate = kzEnabled ? (kzTotal > 0 ? kzOk / kzTotal : 1) : -1;

    // 5. Max trades/day compliance (12.5%)
    var dayMap = {};
    trades.forEach(function(t) {
      if (t.date && S.filled(t.ret)) {
        if (!dayMap[t.date]) dayMap[t.date] = 0;
        dayMap[t.date]++;
      }
    });
    var days = Object.keys(dayMap);
    var mtOk = 0;
    days.forEach(function(d) { if (dayMap[d] <= g.maxTrades) mtOk++; });
    var mtRate = days.length > 0 ? mtOk / days.length : 1;

    // 6. Max loss/day compliance (12.5%)
    var mlOk = 0;
    days.forEach(function(d) {
      var dayLosses = 0;
      trades.forEach(function(t) {
        if (t.date === d && S.filled(t.ret) && t.ret < 0) dayLosses += Number(t.ret);
      });
      if (dayLosses > g.maxLossR) mlOk++;
    });
    var mlRate = days.length > 0 ? mlOk / days.length : 1;

    // Weighted score
    var components;
    if (kzRate >= 0) {
      components = [
        { name: 'Plan-follow', rate: pfRate, w: 0.25, detail: pfYes + '/' + pfTotal, icon: '\ud83d\udccb' },
        { name: 'Setup grade (A/A+)', rate: gradeRate, w: 0.20, detail: gradeOk + '/' + gradeTotal, icon: '\u2b50' },
        { name: 'Non-FOMO', rate: fomoRate, w: 0.15, detail: fomoNo + '/' + fomoTotal, icon: '\ud83e\udde0' },
        { name: 'Killzones', rate: kzRate, w: 0.15, detail: kzOk + '/' + kzTotal, icon: '\u23f0' },
        { name: 'Max trades/jour', rate: mtRate, w: 0.125, detail: mtOk + '/' + days.length + ' j', icon: '\ud83d\udcca' },
        { name: 'Max loss/jour', rate: mlRate, w: 0.125, detail: mlOk + '/' + days.length + ' j', icon: '\ud83d\udee1' }
      ];
    } else {
      components = [
        { name: 'Plan-follow', rate: pfRate, w: 0.30, detail: pfYes + '/' + pfTotal, icon: '\ud83d\udccb' },
        { name: 'Setup grade (A/A+)', rate: gradeRate, w: 0.25, detail: gradeOk + '/' + gradeTotal, icon: '\u2b50' },
        { name: 'Non-FOMO', rate: fomoRate, w: 0.20, detail: fomoNo + '/' + fomoTotal, icon: '\ud83e\udde0' },
        { name: 'Max trades/jour', rate: mtRate, w: 0.125, detail: mtOk + '/' + days.length + ' j', icon: '\ud83d\udcca' },
        { name: 'Max loss/jour', rate: mlRate, w: 0.125, detail: mlOk + '/' + days.length + ' j', icon: '\ud83d\udee1' }
      ];
    }

    var score = 0;
    components.forEach(function(c) { score += c.rate * c.w; });

    var grade;
    if (score >= 0.90) grade = { letter: 'A+', color: '#22c55e' };
    else if (score >= 0.80) grade = { letter: 'A', color: '#22c55e' };
    else if (score >= 0.70) grade = { letter: 'B', color: '#3b82f6' };
    else if (score >= 0.60) grade = { letter: 'C', color: '#f59e0b' };
    else if (score >= 0.50) grade = { letter: 'D', color: '#f97316' };
    else grade = { letter: 'F', color: '#ef4444' };

    return { score: score, grade: grade, components: components, days: days.length };
  }

  function disciplineHTML(trades, label) {
    var d = calcDiscipline(trades);
    if (!d) return '';
    var pct = Math.round(d.score * 100);
    var html = '<div class="disc-card">';
    html += '<div class="disc-header">';
    html += '<div class="disc-gauge" style="--pct:' + pct + ';--clr:' + d.grade.color + '">';
    html += '<div class="disc-circle"><span class="disc-grade" style="color:' + d.grade.color + '">' + d.grade.letter + '</span><span class="disc-pct">' + pct + '%</span></div>';
    html += '</div>';
    html += '<div class="disc-title">Discipline Score' + (label ? '<br><span class="muted small">' + esc(label) + '</span>' : '') + '</div>';
    html += '</div>';
    html += '<div class="disc-breakdown">';
    d.components.forEach(function(c) {
      var cpct = Math.round(c.rate * 100);
      var clr = cpct >= 80 ? '#22c55e' : cpct >= 60 ? '#f59e0b' : '#ef4444';
      html += '<div class="disc-row"><span class="disc-name">' + (c.icon || '') + ' ' + esc(c.name) + '</span>';
      html += '<div class="disc-bar-bg"><div class="disc-bar-fill" style="width:' + cpct + '%;background:' + clr + '"></div></div>';
      html += '<span class="disc-val">' + cpct + '% <span class="muted">(' + c.detail + ')</span></span></div>';
    });
    html += '</div></div>';
    return html;
  }



  function renderDashboard() {
    const f = ui.dash;
    const all = enriched();
    const skipped = all.filter(t => !S.taken(t)).length;
    const ts = all.filter(t => (!f.from || t.date >= f.from) && (!f.to || t.date <= f.to) && (!f.instrument || t.instrument === f.instrument) && (!f.session || t.session === f.session) && (!f.excl || S.taken(t)));
    const sel = S.enrich(ts.map(t => ({ ...t })));       // R cumulé recalculé sur la sélection
    const sm = S.summary(ts), win = S.summary(sel.slice(-Math.max(1, +f.window || 20)));
    const kpi = (l, v, s, c) => `<div class="kpi"><div class="l">${l}</div><div class="v ${c || ''}">${v}</div><div class="s">${s || ''}</div></div>`;
    const ci = (a, d = 2) => a[0] === null ? '' : `IC95 % [${num(a[0], d)} ; ${num(a[1], d)}]`;
    const cards = sm => [
      kpi('Trades', sm.n, `${sm.wins} W · ${sm.losses} L · ${sm.be} BE`),
      kpi('Win rate', pct(sm.winRate, 1), sm.winCI[0] === null ? '' : `IC95 % [${pct(sm.winCI[0])} ; ${pct(sm.winCI[1])}]`),
      kpi('Net R', sgn(sm.net), '', cls(sm.net)),
      kpi('Espérance (R/trade)', sgn(sm.exp, 3), ci(sm.expCI), cls(sm.exp)),
      kpi('Profit factor', num(sm.profitFactor), ''),
      kpi('Max drawdown', num(sm.maxDD) + ' R', ''),
      kpi('Gain moyen', sgn(sm.avgWin), 'Perte moy. ' + sgn(sm.avgLoss)),
      kpi('Écart-type des R', num(sm.sd, 3), 'Sharpe-like ' + num(sm.sharpe, 3)),
      kpi('Plan-follow', pct(sm.planRate), `${sm.ruleBreaks} trade(s) hors plan`),
      kpi('FOMO / impulsion', sm.fomo, sm.n ? pct(sm.fomo / sm.n) + ' des trades' : ''),
      kpi('Meilleur trade', sgn(sm.best) + ' R', '', 'pos'), kpi('Pire trade', sgn(sm.worst) + ' R', '', 'neg'),
    ].join('');
    const eq = [[0, 0], ...sel.filter(t => t._cum !== null).map((t, i) => [i + 1, t._cum])];
    const dd = [[0, 0], ...sel.filter(t => t._dd !== null).map((t, i) => [i + 1, -t._dd])];
    const roll = sel.filter(t => t._roll !== null).map((t, i) => [i + 1, t._roll * 100]);
    const rs = ts.filter(t => S.filled(t.ret)).map(t => Number(t.ret));
    const g = fn => S.groupBy(ts, fn);
    $('#main').innerHTML = `
      <h1>Dashboard <span class="muted small">entrée conservative</span></h1>
      <div class="bar">
        <label>Du<input type="date" id="d-from" value="${esc(f.from)}"></label>
        <label>Au<input type="date" id="d-to" value="${esc(f.to)}"></label>
        <label>Instrument<select id="d-inst">${opts(uniq('instruments'), f.instrument, 'Tous')}</select></label>
        <label>Session<select id="d-sess">${opts(uniq('sessions'), f.session, 'Toutes')}</select></label>
        <label>Fenêtre glissante (trades)<input type="number" min="1" id="d-win" value="${f.window}" style="width:90px"></label>
        <label style="flex-direction:row;align-items:center;gap:6px;padding-bottom:7px"><input type="checkbox" id="d-excl" ${f.excl ? 'checked' : ''}> Exclure les trades sans entrée</label>
        <button class="btn" id="d-reset">Réinitialiser</button>
      </div>
      ${guardrailBanner()}
      <div class="kpis">${cards(sm)}</div>
      ${skipped ? `<div class="note"><b>${skipped} trade(s) sans entrée</b> (« No Entry », entrée vide ou risque = 0) ont un Return de 0 et sont comptés comme Breakeven, comme dans votre Excel. Ils réduisent mécaniquement le win rate et l'espérance : cochez « Exclure les trades sans entrée » pour mesurer uniquement les trades réellement pris.</div>` : ''}
      ${sm.n < 30 ? `<div class="note">Échantillon de ${sm.n} trade(s) : intervalles de confiance larges. Les sous-groupes de moins de 10 trades (lignes grisées) ne sont pas statistiquement fiables.</div>` : ''}
      ${disciplineHTML(sel, '')}
      ${consistencyHTML(sel)}
      ${checklistStatsHTML(sel)}
      <h2>Fenêtre glissante : ${Math.min(win.n, +f.window || 20)} derniers trades de la sélection</h2>
      <div class="kpis">${cards(win)}</div>
      <h2>Courbes</h2>
      <div class="grid2">
        <div class="card"><h3>R cumulé</h3>${lineChart({ series: [{ name: 'R cumulé', color: 'var(--accent)', pts: eq }], yFmt: v => v.toFixed(1) })}</div>
        <div class="card"><h3>Drawdown (R)</h3>${lineChart({ series: [{ name: 'Drawdown', color: 'var(--loss)', pts: dd, area: true }], yMax: 0, yFmt: v => v.toFixed(1) })}</div>
        <div class="card"><h3>Distribution des R</h3>${histChart(S.histogram(rs, 0.5))}</div>
        <div class="card"><h3>Plan-follow glissant (10 derniers trades)</h3>${lineChart({ series: [{ name: 'Plan-follow', color: 'var(--win)', pts: roll }], yMin: 0, yMax: 100, yFmt: v => v.toFixed(0) + ' %' })}</div>
      </div>
      <details class="cat-fold"${catOpen() ? ' open' : ''}><summary><h2>Performance par catégorie</h2><span class="cat-hint"></span></summary>
      <div class="grid2">
        ${groupTable('Instrument', g(t => t.instrument))}${groupTable('Session', g(t => t.session))}
        ${groupTable('Jour', g(t => S.dayName(t.date)))}${groupTable('Direction', g(t => t.direction))}
        ${groupTable('Modèle d\'entrée', g(t => t.entry))}${groupTable('Stop loss', g(t => t.sl))}
        ${groupTable('Take profit', g(t => t.tp))}${groupTable('Grade du setup', g(t => t._grade))}
        ${groupTable('Score du setup (/4)', g(t => t._score === null ? '' : t._score + '/4'))}${groupTable('Plan-follow', g(t => t.planFollow))}
        ${groupTable('FOMO / impulsion', g(t => t.fomo))}${groupTable('Gestion du trade', g(t => normMgmt(t.management)))}
        ${groupTable('Setup', g(t => t.setup))}${groupTable('POI d\'exécution', g(t => t.execPoi))}${groupTable('Type de sortie', g(t => t.exitType))}
      </div></details>`;
    const re = () => { f.from = $('#d-from').value; f.to = $('#d-to').value; f.instrument = $('#d-inst').value; f.session = $('#d-sess').value; f.window = $('#d-win').value; f.excl = $('#d-excl').checked; renderDashboard(); };
    ['#d-from', '#d-to', '#d-inst', '#d-sess', '#d-win', '#d-excl'].forEach(s => $(s).addEventListener('change', re));
    $('#d-reset').onclick = () => { ui.dash = { from: '', to: '', instrument: '', session: '', window: 20, excl: false }; renderDashboard(); };
  }


  /* ---------- JOURNAL ---------- */
  const SORTS = { n: t => t.n, date: t => t.date + String(t.n).padStart(5, '0'), instrument: t => t.instrument, ret: t => t.ret === null ? -1e9 : t.ret,
    agg: t => t.agg && S.filled(t.agg.ret) ? t.agg.ret : -1e9, session: t => t.session, entry: t => t.entry };
  const delta = t => S.hasAgg(t) ? t.agg.ret - t.ret : null;
  function renderJournalList() {
    const f = ui.jr, q = f.q.toLowerCase();
    let ts = enriched().filter(t => (!f.instrument || t.instrument === f.instrument) && (!f.session || t.session === f.session) && (!f.result || t._result === f.result) &&
      (!f.direction || t.direction === f.direction) && (!f.entry || t.entry === f.entry) && (!f.incomplete || completeness(t).pct < 100) && (!f.from || t.date >= f.from) && (!f.to || t.date <= f.to) &&
      (!f.aggOnly || S.hasAgg(t)) &&
      (!q || [t.notes, t.mistakes, t.management, t.instrument, t.entry, t.agg && t.agg.entry].join(' ').toLowerCase().includes(q)));
    const key = SORTS[f.sort] || SORTS.n;
    ts.sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0); if (f.desc) ts.reverse();
    const sm = S.summary(ts);
    const th = (k, l, c) => `<th class="${c || ''}" data-sort="${k}" style="cursor:pointer">${l}${f.sort === k ? (f.desc ? ' ▼' : ' ▲') : ''}</th>`;
    const nShots = t => SLOTS.reduce((a, [k]) => a + (t.screens && t.screens[k] ? t.screens[k].length : 0), 0);
    $('#main').innerHTML = `
      ${guardrailBanner()}
      <h1>Journal <span class="muted small">Fiches complètes à ${ts.length ? Math.round(ts.reduce((a, t) => a + completeness(t).pct, 0) / ts.length) : 0} % en moyenne · ${ts.length} trade(s) · Net conservative ${sgn(sm.net)} R · win rate ${pct(sm.winRate)}</span></h1>
      <div class="bar">
        <label>Recherche<input id="j-q" value="${esc(f.q)}" placeholder="notes, erreurs…"></label>
        <label>Instrument<select id="j-inst">${opts(uniq('instruments'), f.instrument, 'Tous')}</select></label>
        <label>Session<select id="j-sess">${opts(uniq('sessions'), f.session, 'Toutes')}</select></label>
        <label>Résultat<select id="j-res">${opts(['Win', 'Loss', 'Breakeven'], f.result, 'Tous')}</select></label>
        <label>Direction<select id="j-dir">${opts(['Long', 'Short'], f.direction, 'Toutes')}</select></label>
        <label>Entrée cons.<select id="j-ent">${opts(uniq('entries'), f.entry, 'Toutes')}</select></label>
        <label>Du<input type="date" id="j-from" value="${esc(f.from)}"></label>
        <label>Au<input type="date" id="j-to" value="${esc(f.to)}"></label>
        <label style="flex-direction:row;align-items:center;gap:6px;padding-bottom:7px"><input type="checkbox" id="j-agg" ${f.aggOnly ? 'checked' : ''}> Avec simulation aggressive</label>
        <label style="flex-direction:row;align-items:center;gap:6px;padding-bottom:7px"><input type="checkbox" id="j-inc" ${f.incomplete ? 'checked' : ''}> Fiches incomplètes</label>
        <button class="btn" id="j-reset">Réinitialiser</button>
      </div>
      <div class="twrap"><table><thead><tr>${th('n', '#', 'num')}${th('date', 'Date')}${th('instrument', 'Instrument')}<th>Dir.</th>${th('session', 'Session')}${th('entry', 'Entrée cons.')}<th>SL</th><th>TP</th>${th('ret', 'R cons.', 'num')}${th('agg', 'R agg.', 'num')}<th class="num">Δ</th><th>Résultat</th><th>Grade</th><th>Plan</th><th>FOMO</th><th class="num">R cumulé</th><th class="num">📷</th><th class="num" title="Fiche complète">Fiche</th></tr></thead><tbody>` +
      ts.map(t => { const d = delta(t); return `<tr class="click" data-n="${t.n}"><td class="num">${t.n}</td><td>${esc(t.date)}</td><td>${esc(t.instrument)}</td><td>${esc(t.direction)}</td><td>${esc(t.session)}</td><td>${esc(t.entry)}</td><td>${esc(t.sl)}</td><td>${esc(t.tp)}</td><td class="num ${cls(t.ret)}">${sgn(t.ret)}</td><td class="num ${cls(t.agg && t.agg.ret)}">${t.agg && S.filled(t.agg.ret) ? sgn(t.agg.ret) : ''}</td><td class="num ${cls(d)}">${d === null ? '' : sgn(d)}</td><td>${t._result ? `<span class="badge ${t._result}">${t._result}</span>` : ''}</td><td>${t._grade ? `<span class="badge g">${t._grade}</span>` : ''}</td><td>${esc(t.planFollow)}</td><td>${esc(t.fomo)}</td><td class="num">${num(t._cum)}</td><td class="num">${nShots(t) || ''}</td><td class="num">${fichePill(t)}</td></tr>`; }).join('') +
      `</tbody></table></div>${ts.length ? '' : '<p class="muted pad">Aucun trade ne correspond aux filtres.</p>'}`;
    const re = () => { Object.assign(f, { incomplete: $('#j-inc').checked, q: $('#j-q').value, instrument: $('#j-inst').value, session: $('#j-sess').value, result: $('#j-res').value, direction: $('#j-dir').value, entry: $('#j-ent').value, from: $('#j-from').value, to: $('#j-to').value, aggOnly: $('#j-agg').checked }); renderJournal(); };
    $('#j-q').addEventListener('change', re);
    ['#j-inc', '#j-inst', '#j-sess', '#j-res', '#j-dir', '#j-ent', '#j-from', '#j-to', '#j-agg'].forEach(s => $(s).addEventListener('change', re));
    $('#j-reset').onclick = () => { Object.assign(f, { incomplete: false, q: '', instrument: '', session: '', result: '', direction: '', entry: '', from: '', to: '', aggOnly: false }); renderJournal(); };
    document.querySelectorAll('th[data-sort]').forEach(h => h.onclick = () => { const k = h.dataset.sort; f.desc = f.sort === k ? !f.desc : true; f.sort = k; renderJournal(); });
    document.querySelectorAll('tr.click').forEach(r => r.onclick = () => openTrade(+r.dataset.n));
  }


  /* ---------- capture d'écran : affichage dans l'application ---------- */
  function shotPanel(t, key, label) {
    const urls = (t.screens && t.screens[key]) || [];
    const inner = urls.length ? urls.map(u => {
      const img = S.imageUrl(u);
      return img
        ? `<img loading="lazy" referrerpolicy="no-referrer" src="${esc(img)}" alt="${esc(label)}" data-url="${esc(u)}" data-label="${esc(label)}">`
        : `<div class="fail">Lien non affichable en image : <a href="${esc(u)}" target="_blank" rel="noopener noreferrer">ouvrir</a></div>`;
    }).join('') : '<div class="nolink">Pas de capture</div>';
    return `<div class="shot"><h3><span>${esc(label)}</span><span>${urls.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" title="Ouvrir l'original">↗</a>`).join(' ')}</span></h3>${inner}</div>`;
  }
  function bindShots(root, t) {
    const imgs = [...root.querySelectorAll('.shot img')];
    imgs.forEach((im, i) => im.addEventListener('click', () => openLightbox(imgs.map(x => ({ src: x.src, url: x.dataset.url, label: x.dataset.label + ' – trade #' + t.n })), i)));
    root.addEventListener('error', e => {   // image introuvable (lien expiré, hors ligne…) -> repli sur un lien
      const im = e.target; if (!(im instanceof HTMLImageElement)) return;
      const d = document.createElement('div'); d.className = 'fail';
      d.innerHTML = `Image indisponible (lien expiré ou hors ligne). <a href="${esc(im.dataset.url)}" target="_blank" rel="noopener noreferrer">Ouvrir sur le site d'origine</a>`;
      im.replaceWith(d);
    }, true);
  }
  let LB = null;
  function openLightbox(items, i) { LB = { items, i }; drawLightbox(); }
  function drawLightbox() {
    const lb = $('#lightbox'), it = LB.items[LB.i];
    lb.hidden = false;
    lb.innerHTML = `<button class="x" aria-label="Fermer">×</button>${LB.items.length > 1 ? '<button class="nav prev">‹</button><button class="nav next">›</button>' : ''}<img src="${esc(it.src)}" alt=""><div class="cap">${esc(it.label)} (${LB.i + 1}/${LB.items.length})${it.url ? ` · <a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer" style="color:#8fc1ff">ouvrir l'original</a>` : ''}</div>`;
    lb.querySelector('.x').onclick = closeLightbox;
    if (LB.items.length > 1) { lb.querySelector('.prev').onclick = e => { e.stopPropagation(); step(-1); }; lb.querySelector('.next').onclick = e => { e.stopPropagation(); step(1); }; }
    lb.onclick = e => { if (e.target === lb) closeLightbox(); };
  }
  const step = d => { LB.i = (LB.i + d + LB.items.length) % LB.items.length; drawLightbox(); };
  function closeLightbox() { $('#lightbox').hidden = true; $('#lightbox').innerHTML = ''; LB = null; }


  /* ---------- fiche trade ---------- */
  function showModal(html) { $('#modal').innerHTML = html; $('#overlay').hidden = false; $('#overlay').scrollTop = 0; document.body.style.overflow = 'hidden'; }
  function closeModal() { $('#overlay').hidden = true; $('#modal').innerHTML = ''; document.body.style.overflow = ''; }
  function openTrade(n) {
    const t = byN(n); if (!t) return;
    const a = t.agg || {}, d = delta(t);
    const D = (l, v) => v !== '' && v !== null && v !== undefined ? `<div><b>${l}</b>${esc(v)}</div>` : '';
    const block = (l, v) => v ? `<h3>${l}</h3><div class="textblock">${esc(v)}</div>` : '';
    const hasA = [a.entry, a.sl, a.tp, a.risk, a.ret].some(S.filled);
    showModal(`
      <div class="mhead"><h1>#${t.n} · ${esc(t.instrument)} ${esc(t.direction)} <span class="muted small">${esc(t.date)} (${S.dayName(t.date)})</span></h1>
        ${t._result ? `<span class="badge ${t._result}">Cons. ${t._result} ${sgn(t.ret)} R</span>` : ''}${S.filled(a.ret) ? `<span class="badge ${a.ret > 0 ? 'Win' : a.ret < 0 ? 'Loss' : 'Breakeven'}">Agg. ${sgn(a.ret)} R</span>` : ''}${t._grade ? `<span class="badge g">Setup ${t._grade}</span>` : ''}
        <button class="btn" id="m-prev">←</button><button class="btn" id="m-next">→</button>
        <button class="btn" id="m-edit">Modifier</button><button class="btn danger" id="m-del">Supprimer</button><button class="btn" id="m-close">Fermer</button></div>
      <div class="shots">${SLOTS.map(([k, l]) => shotPanel(t, k, l)).join('')}</div>
      <div class="grid2" style="margin-top:14px">
        <div class="card"><h3>Entrée conservative</h3><div class="details">${D('Entrée', t.entry)}${D('SL', t.sl)}${D('TP', t.tp)}${D('Risque', S.filled(t.risk) ? t.risk + ' R' : '')}${D('Return', S.filled(t.ret) ? sgn(t.ret) + ' R' : '')}${D('R cumulé', num(t._cum))}${D('Drawdown', num(t._dd))}</div></div>
        <div class="card"><h3>Entrée aggressive (simulation)</h3>${hasA ? `<div class="details">${D('Entrée', a.entry)}${D('SL', a.sl)}${D('TP', a.tp)}${D('Risque', S.filled(a.risk) ? a.risk + ' R' : '')}${D('Return', S.filled(a.ret) ? sgn(a.ret) + ' R' : '')}${D('Δ (agg − cons)', d === null ? '' : sgn(d) + ' R')}</div>` : '<p class="muted">Pas encore simulée pour ce trade. Utilisez « Modifier » pour la renseigner.</p>'}</div>
      </div>
      <div class="details">${D('Session', t.session)}${D('Durée', t.duration)}${D('Plan suivi', t.planName || (planById(t.planId) || {}).name || '')}${D('Overtrade', t.overtrade)}${D('Revenge trade', t.revenge)}${D('Guardrails broken', grBrokenNames(t.guardrailsBroken))}${D('Plan-follow', t.planFollow)}${D('FOMO / impulsion', t.fomo)}${D('Gestion', t.management)}
        ${D('Bias alignment', t.bias)}${D('POI haute proba', t.poi)}${D('Killzone', t.killzone)}${D('Sweep + Market Shift', t.sweep)}${D('Score setup', t._score === null ? '' : t._score + '/4')}</div>
      ${v3Details(t)}
      ${block('Erreurs', t.mistakes)}${block('Notes', t.notes)}${block('Amélioration pour demain', t.improvement)}`);
    bindShots($('#modal'), t);
    $('#m-close').onclick = closeModal; $('#m-edit').onclick = () => editTrade(t.n);
    $('#m-del').onclick = async () => { if (confirm(`Supprimer définitivement le trade #${t.n} ?\n(une copie de sauvegarde du jour est conservée dans backups/)`)) { DB.trades = DB.trades.filter(x => x.n !== t.n); if (await save('Trade supprimé')) { closeModal(); render(); } } };
    const order = DB.trades.map(x => x.n).sort((a, b) => a - b), i = order.indexOf(t.n);
    $('#m-prev').disabled = i <= 0; $('#m-next').disabled = i >= order.length - 1;
    $('#m-prev').onclick = () => openTrade(order[i - 1]); $('#m-next').onclick = () => openTrade(order[i + 1]);
  }

  /* ---------- formulaire (ajout / édition) ---------- */
  /* --- guardrail rules a trade can break (built from the current Guardrails settings) --- */
  var GR_BREAK_NAMES = { maxTrades: 'Max trades / jour', maxLoss: 'Max loss / jour', maxRisk: 'Risque > max / trade', killzone: 'Hors killzone' };
  function grBreakItems() {
    var g = getGuardrails(), kz = g.killzones || {};
    var act = (kz.sessions || []).filter(function(s) { return s.active; }).map(function(s) { return s.name; });
    var items = [
      { key: 'maxTrades', label: 'Max trades / jour (' + g.maxTrades + ')' },
      { key: 'maxLoss', label: 'Max loss / jour (' + sgn(g.maxLossR) + ' R)' },
      { key: 'maxRisk', label: 'Risque > max / trade (' + num(g.maxRiskR) + ' R)' }
    ];
    if (kz.enabled !== false && act.length) items.push({ key: 'killzone', label: 'Hors killzone (' + act.join(', ') + ')' });
    return items;
  }
  function grBrokenNames(list) {
    return (list || []).map(function(k) { return GR_BREAK_NAMES[k] || k; }).join(', ');
  }
  function grBrokenField(t) {
    var sel = t.guardrailsBroken || [];
    var items = grBreakItems();
    // keep a rule ticked on an old trade even if it is no longer in the settings
    sel.forEach(function(k) { if (!items.some(function(i) { return i.key === k; })) items.push({ key: k, label: GR_BREAK_NAMES[k] || k }); });
    return '<div class="ms-field"><span class="ms-title">Guardrails broken</span>' +
      '<details class="ms" id="f-grBroken"><summary>' + esc(sel.length ? grBrokenNames(sel) : 'Aucun') + '</summary><div class="ms-list">' +
      items.map(function(i) {
        return '<label class="ms-opt"><input type="checkbox" value="' + esc(i.key) + '"' + (sel.indexOf(i.key) >= 0 ? ' checked' : '') + '> ' + esc(i.label) + '</label>';
      }).join('') + '</div></details></div>';
  }
  function grBrokenWire() {
    var box = document.getElementById('f-grBroken');
    if (!box) return;
    var sum = box.querySelector('summary');
    box.querySelectorAll('input[type=checkbox]').forEach(function(cb) {
      cb.onchange = function() {
        var keys = Array.prototype.map.call(box.querySelectorAll('input:checked'), function(x) { return x.value; });
        sum.textContent = keys.length ? grBrokenNames(keys) : 'Aucun';
      };
    });
  }
  function grBrokenValue() {
    var box = document.getElementById('f-grBroken');
    return box ? Array.prototype.map.call(box.querySelectorAll('input:checked'), function(x) { return x.value; }) : [];
  }

  const YN = (id, label, v) => `<label>${label}<select id="${id}">${opts(['Yes', 'No'], v, '—')}</select></label>`;
  function editTrade(n) {
    const isNew = n === null;
    const t = isNew ? { n: Math.max(0, ...DB.trades.map(x => x.n)) + 1, date: todayISO(), risk: getGuardrails().maxRiskR || 1, direction: 'Long', screens: {}, agg: {} } : DB.trades.find(x => x.n === n);
    const a = t.agg || {};
    const dl = (id, arr) => `<datalist id="${id}">${arr.map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
    const mgmt = [...new Set(DB.trades.map(x => x.management).filter(Boolean))];
    const val = v => v === null || v === undefined ? '' : v;
    const inp = (id, label, v, type = 'text', extra = '') => `<label>${label}<input id="${id}" type="${type}" value="${esc(val(v))}" ${extra}></label>`;
    showModal(`
      <div class="mhead"><h1>${isNew ? 'Nouveau trade' : 'Modifier le trade'} #${t.n}</h1></div>
      <div class="form">
        ${inp('f-date', 'Date', t.date, 'date')}
        <label>Instrument<input id="f-instrument" list="dl-inst" value="${esc(t.instrument)}"></label>
        <label>Direction<select id="f-direction">${opts(['Long', 'Short'], t.direction)}</select></label>
        <label>Session<input id="f-session" list="dl-sess" value="${esc(t.session)}"></label>
        ${!isNew && t.duration ? '<label>Durée (hh:mm)<input id="f-duration" type="text" inputmode="numeric" pattern="[0-9]{1,2}:[0-9]{2}" placeholder="00:00" value="' + esc(val(t.duration)) + '"></label>' : ''}
        <fieldset><legend>Entrée CONSERVATIVE</legend><div class="row">
          <label>Entrée<input id="f-entry" list="dl-entry" value="${esc(t.entry)}"></label>
          <label>SL<input id="f-sl" list="dl-sl" value="${esc(t.sl)}"></label>
          <label>TP<input id="f-tp" list="dl-tp" value="${esc(t.tp)}"></label>
          ${inp('f-risk', 'Risque (R)', t.risk, 'number', 'step="0.01"')}${inp('f-ret', 'Return (R)', t.ret, 'number', 'step="0.01"')}</div></fieldset>
        <fieldset><legend>Entrée AGGRESSIVE (simulation du même trade)</legend><div class="row">
          <label>Entrée<input id="f-aentry" list="dl-aentry" value="${esc(a.entry)}"></label>
          <label>SL<input id="f-asl" list="dl-sl" value="${esc(a.sl)}"></label>
          <label>TP<input id="f-atp" list="dl-tp" value="${esc(a.tp)}"></label>
          ${inp('f-arisk', 'Risque (R)', a.risk, 'number', 'step="0.01"')}${inp('f-aret', 'Return (R)', a.ret, 'number', 'step="0.01"')}</div></fieldset>
        ${v3ExecFieldset(t, isNew)}
        <fieldset><legend>Process</legend><div class="row">
          ${(() => { const pd = plansData(); const cur = t.planId || pd.activeId;
            return `<label>Plan suivi<select id="f-planId">${pd.plans.map(p => `<option value="${esc(p.id)}"${p.id === cur ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>`; })()}
          ${YN('f-planFollow', 'Plan-follow', t.planFollow)}${YN('f-fomo', 'FOMO / impulsion', t.fomo)}${YN('f-overtrade', 'Overtrade', t.overtrade)}${YN('f-revenge', 'Revenge trade', t.revenge)}${grBrokenField(t)}
          <label>Gestion du trade<select id="f-management">${closedOpts(lst('management'), t.management || '')}</select></label></div></fieldset>
        <fieldset><legend>Critères du setup (grade automatique)</legend><div class="row">
          ${YN('f-bias', 'Bias alignment', t.bias)}${YN('f-poi', 'POI haute probabilité', t.poi)}${!isNew && !t.entryTime && !t.killzoneAuto ? YN('f-killzone', 'Killzone (ancien trade sans heure)', t.killzone) : ''}${YN('f-sweep', 'Liquidity sweep + Market Shift', t.sweep)}</div><p class="muted small">Grade sur 4 critères (Bias, POI, Killzone, Sweep). La killzone est calculée automatiquement depuis l'heure d'entrée.</p></fieldset>
        <fieldset><legend>Captures d'écran (un lien par ligne : lien TradingView /x/…, ou URL d'image)</legend><div class="row" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
          ${SLOTS.map(([k, l]) => `<label>${l}<textarea id="f-s-${k}" placeholder="https://www.tradingview.com/x/…">${esc(((t.screens || {})[k] || []).join('\n'))}</textarea></label>`).join('')}</div></fieldset>
        <div class="wide">${v3MistakesField(t)}</div>
        <label class="wide">Détail des erreurs<textarea id="f-mistakes">${esc(t.mistakes)}</textarea></label>
        <label class="wide">Notes<textarea id="f-notes">${esc(t.notes)}</textarea></label>
        <label class="wide">Amélioration pour demain<textarea id="f-improvement" placeholder="Une chose précise à faire mieux demain…">${esc(t.improvement)}</textarea></label>
      </div>
      ${dl('dl-inst', uniq('instruments'))}${dl('dl-sess', uniq('sessions'))}${dl('dl-entry', uniq('entries'))}${dl('dl-aentry', uniq('aggEntries'))}${dl('dl-sl', uniq('sl'))}${dl('dl-tp', uniq('tp'))}${dl('dl-mgmt', mgmt)}
      <div class="actions"><button class="btn" id="f-cancel">Annuler</button><button class="btn primary" id="f-save">Enregistrer</button></div>`);
    $('#f-cancel').onclick = () => isNew ? closeModal() : openTrade(t.n);
    grBrokenWire(); v3Wire(t, isNew); formProgressInit(t);
    $('#f-save').onclick = async () => {
      const v = id => { const el = $('#f-' + id); return el ? el.value.trim() : (t[id] === null || t[id] === undefined ? '' : String(t[id])); };
      const numOrNull = id => { const x = v(id); return x === '' ? null : +x; };
      if (!v('date')) return alert('La date est obligatoire.');
      const v3err = v3Validate(); if (v3err) return alert(v3err);
      if (isNew && !guardrailConfirm(v('date'), v('session'), ($('#f-entryTime') || {}).value)) return;
      if (!v('instrument')) return alert('L\'instrument est obligatoire.');
      for (const id of ['ret', 'aret', 'risk', 'arisk']) { const x = v(id); if (x !== '' && !Number.isFinite(+x)) return alert('Valeur numérique invalide (' + id + ').'); }
      const urls = k => v('s-' + k).split(/[\s,;]+/).filter(u => /^(https?:\/\/|data:image\/)/.test(u));
      const nt = {
        n: t.n, instrument: v('instrument'), direction: v('direction'), date: v('date'), session: v('session'), duration: v('duration'),
        entry: v('entry'), sl: v('sl'), tp: v('tp'), risk: numOrNull('risk'), ret: numOrNull('ret'),
        agg: { entry: v('aentry'), sl: v('asl'), tp: v('atp'), risk: numOrNull('arisk'), ret: numOrNull('aret') },
        screens: Object.fromEntries(SLOTS.map(([k]) => [k, urls(k)])),
        planId: v('planId'), planName: (planById(v('planId')) || {}).name || '',
        overtrade: v('overtrade'), revenge: v('revenge'), guardrailsBroken: grBrokenValue(), improvement: v('improvement'), improvementAt: v('improvement') ? (v('improvement') !== String(t.improvement || '').trim() ? todayISO() : (t.improvementAt || todayISO())) : '',
        planFollow: v('planFollow'), management: v('management'), mistakes: v('mistakes'), notes: v('notes'), fomo: v('fomo'),
        goodTrade: v('goodTrade'), execScore: v('execScore') === '' ? null : +v('execScore'), execReview: v('execReview'), bias: v('bias'), poi: v('poi'), killzone: v('killzone'), sweep: v('sweep'),
      };
      Object.assign(nt, v3Collect(t, isNew, nt));
      const warns = v4Checks(nt);
      if (warns.length && !confirm('Incohérences détectées :\n\n• ' + warns.join('\n• ') + '\n\nEnregistrer quand même ?')) return;
      if (isNew && newsBlockCfg().enabled && nt.entryTime && (nt.guardrailsBroken || []).indexOf('news') < 0) {
        const nw = newsBlockAt(tzToTs(nt.date, nt.entryTime, newsCfg().tz));
        if (nw) { if (!confirm(`Ce trade est dans une fenêtre de blocage news (${nw.evs.map(e => e.country + ' ' + e.title).join(', ')}).\n\nL'enregistrer quand même ? Il sera marqué « Garde-fou : news ».`)) return; nt.guardrailsBroken = (nt.guardrailsBroken || []).concat(['news']); }
      }
      const i = DB.trades.findIndex(x => x.n === t.n);
      if (i >= 0) DB.trades[i] = nt; else DB.trades.push(nt);
      if (await save(isNew ? 'Trade ajouté' : 'Trade modifié')) { openTrade(nt.n); render(); }
    };
  }


  /* ---------- REVUES (weekly / monthly / quarterly / yearly) ---------- */
  const QUESTIONS = {
    weekly: [['q1', 'Qu\'est-ce qui a bien marché cette semaine, et pourquoi ?'], ['q2', 'Quelles erreurs ou points faibles, et quel plan de prévention ?'], ['q3', 'Quel schéma voyez-vous dans vos meilleurs et pires trades ?'], ['q4', 'Quel est votre unique priorité pour la semaine prochaine ?'], ['best', 'Meilleur trade (pourquoi il était bon)'], ['worst', 'Pire trade (cause)'], ['missed', 'Setups valides manqués', 'number'], ['missedLinks', 'Captures TradingView des setups manqués', 'links'], ['chart', 'Graphique à étudier']],
    monthly: [['q1', 'Quelle est la leçon n°1 du mois ?'], ['q2', 'Quelle barrière mentale est revenue le plus, et quel plan pour la corriger ?'], ['q3', 'De quoi êtes-vous le plus fier (process ou résultat) ?'], ['q4', 'Priorité unique pour le mois prochain ?'], ['best', 'Meilleur jour (qu\'avez-vous bien fait ?)'], ['worst', 'Pire jour (qu\'est-ce qui a mal tourné ?)']],
    quarterly: [['q1', 'Plus grand progrès d\'exécution ce trimestre'], ['q2', 'Plus grand progrès de discipline ce trimestre'], ['q3', 'Schéma d\'erreur à éliminer le trimestre prochain'], ['q4', 'Quelle a été votre plus grande avancée ?'], ['q5', 'Où avez-vous le plus dérapé, et quelle correction ?'], ['q6', 'Moment le plus dur et ce qu\'il vous a appris'], ['q7', 'Si vous ne maîtrisez qu\'UNE chose le trimestre prochain, laquelle ?'], ['best', 'Meilleur setup (nom + pourquoi)'], ['worst', 'Pire setup (nom + pourquoi)'], ['mistakes', '1–2 erreurs qui ont coûté le plus (en R)']],
    yearly: [['q1', 'Leçons les plus puissantes de l\'année'], ['q2', 'Habitudes, système ou changements mentaux qui ont le plus contribué à votre progression'], ['q3', 'Revers ou schémas répétés, et ce que vous changerez'], ['q4', 'Moment de trading dont vous êtes le plus fier'], ['q5', 'Partie de la stratégie à développer ou affiner'], ['q6', 'Qu\'est-ce qui ferait de l\'an prochain votre meilleure année ?'], ['best', 'Meilleur mois (pourquoi ça a marché)'], ['worst', 'Mois le plus difficile (ce qui a lâché)'], ['mistakes', 'Schéma d\'erreur le plus coûteux']],
  };
  const TYPES = { weekly: 'Semaine', monthly: 'Mois', quarterly: 'Trimestre', yearly: 'Année' };
  function periodLabel(type, p) {
    const d = new Date(p.start + 'T00:00:00Z');
    if (type === 'weekly') return `Semaine du ${p.start} au ${p.end}`;
    if (type === 'monthly') return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    if (type === 'quarterly') return `T${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
    return String(d.getUTCFullYear());
  }
  function renderReviews() {
    const r = ui.rev;
    if (!r.start) { const last = DB.trades.map(t => t.date).sort().pop() || todayISO(); r.start = S.period(r.type, last).start; }
    const p = S.period(r.type, r.start), all = enriched(), ts = S.inPeriod(all, p), sm = S.summary(ts);
    const id = `${r.type}:${p.start}`, rv = DB.reviews.find(x => x.id === id) || { answers: {} }, pre = reviewPrefill(r.type, p, rv);
    const kpi = (l, v, c) => `<div class="kpi"><div class="l">${l}</div><div class="v ${c || ''}">${v}</div></div>`;
    const withRet = ts.filter(t => S.filled(t.ret)), best = withRet.slice().sort((a, b) => b.ret - a.ret)[0], worst = withRet.slice().sort((a, b) => a.ret - b.ret)[0];
    const ctx = t => t ? `#${t.n} ${esc(t.instrument)} ${esc(t.direction)} (${esc(t.date)}) : ${sgn(t.ret)} R${t.mistakes ? ' · erreurs : ' + esc(t.mistakes) : ''}${t.notes ? ' · notes : ' + esc(t.notes) : ''}` : '–';
    const gt = (title, fn) => groupTable(title, S.groupBy(ts, fn));
    const months = r.type === 'yearly' ? gt('Par mois', t => t.date.slice(0, 7)) : '';
    $('#main').innerHTML = `
      <h1>Revues</h1>
      ${reviewBanner()}
      <div class="tabs">${Object.entries(TYPES).map(([k, l]) => `<button data-t="${k}" class="${k === r.type ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="bar"><button class="btn" id="r-prev">←</button><h2 style="margin:0 8px">${esc(periodLabel(r.type, p))}</h2><button class="btn" id="r-next">→</button><span class="muted small">${p.start} → ${p.end}</span></div>
      <div class="kpis">${kpi('Trades', sm.n)}${kpi('Wins / Losses / BE', `${sm.wins} / ${sm.losses} / ${sm.be}`)}${kpi('Win rate', pct(sm.winRate))}${kpi('Net R', sgn(sm.net), cls(sm.net))}${kpi('Gain moy.', sgn(sm.avgWin))}${kpi('Perte moy.', sgn(sm.avgLoss))}${kpi('Profit factor', num(sm.profitFactor))}${kpi('Max drawdown', num(sm.maxDD) + ' R')}${kpi('Plan-follow', pct(sm.planRate))}${kpi('Hors règles', sm.ruleBreaks)}${kpi('FOMO', sm.fomo)}${kpi('A+ pris', ts.filter(t => t._grade === 'A+').length)}</div>
      ${sm.n ? `<h2>Contexte automatique</h2><div class="textblock"><b>Meilleur trade :</b> ${ctx(best)}\n<b>Pire trade :</b> ${ctx(worst)}</div>` : '<div class="note">Aucun trade sur cette période.</div>'}
      ${sm.n ? `<div class="grid2" style="margin-top:12px">${gt('Par instrument', t => t.instrument)}${gt('Par session', t => t.session)}${months}</div>` : ''}
      ${reviewSynthesis(r.type, p)}
      <h2>Réflexion</h2>
      ${prefillNote(r.type, p, rv)}
      <div class="card">${QUESTIONS[r.type].map(([k, label, kind]) => kind === 'links' ? linksField(k, label, rv.answers[k]) : `<div class="qa"><label for="q-${k}">${esc(label)}</label>${kind === 'number' ? `<input type="number" id="q-${k}" value="${esc(rv.answers[k] ?? pre[k] ?? '')}">` : `<textarea id="q-${k}">${esc(rv.answers[k] ?? pre[k] ?? '')}</textarea>`}</div>`).join('')}
        <div class="actions"><button class="btn primary" id="r-save">Enregistrer la revue</button></div></div>
      ${ts.length ? `<h2>Trades de la période</h2><div class="twrap"><table><thead><tr><th class="num">#</th><th>Date</th><th>Instrument</th><th>Dir.</th><th class="num">R</th><th>Grade</th><th>Plan</th></tr></thead><tbody>${ts.map(t => `<tr class="click" data-n="${t.n}"><td class="num">${t.n}</td><td>${esc(t.date)}</td><td>${esc(t.instrument)}</td><td>${esc(t.direction)}</td><td class="num ${cls(t.ret)}">${sgn(t.ret)}</td><td>${esc(t._grade)}</td><td>${esc(t.planFollow)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
    document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { const last = DB.trades.map(t => t.date).sort().pop() || p.start; r.type = b.dataset.t; r.start = S.period(r.type, p.start <= last && last <= p.end ? last : p.start).start; renderReviews(); });
    $('#r-prev').onclick = () => { r.start = S.shiftPeriod(r.type, p.start, -1).start; renderReviews(); };
    $('#r-next').onclick = () => { r.start = S.shiftPeriod(r.type, p.start, 1).start; renderReviews(); };
    document.querySelectorAll('tr.click').forEach(row => row.onclick = () => openTrade(+row.dataset.n));
    QUESTIONS[r.type].forEach(([k, , kind]) => { if (kind === 'links') linksWire(k); });
    $('#r-save').onclick = async () => {
      const answers = {};
      QUESTIONS[r.type].forEach(([k, , kind]) => { if (kind === 'links') { const l = linksCollect(k); if (l.length) answers[k] = l; return; } const v = $('#q-' + k).value; if (v !== '') answers[k] = kind === 'number' ? +v : v; });
      const i = DB.reviews.findIndex(x => x.id === id), rec = { id, type: r.type, start: p.start, end: p.end, answers, savedAt: todayISO() };
      if (i >= 0) DB.reviews[i] = rec; else DB.reviews.push(rec);
      await save('Revue enregistrée');
    };
  }


  /* ---------- COMPARAISON Conservative vs Aggressive (apparié) ---------- */
  function verdict(c) {
    if (c.n < 2) return 'Aucune comparaison possible : renseignez le Return aggressive pour au moins 2 trades.';
    const ciTxt = `IC95 % [${num(c.ci[0], 3)} ; ${num(c.ci[1], 3)}]`;
    if (c.n < 30) return `Échantillon insuffisant (n = ${c.n} < 30) : le Δ moyen observé (${sgn(c.mean, 3)} R/trade, ${ciTxt}, p = ${num(c.p, 3)}) ne permet aucune conclusion fiable. Avec ${c.n} trades appariés, l'écart minimal détectable est d'environ ±${num(c.mde, 2)} R/trade (puissance 80 %) : une différence plus petite passerait inaperçue.`;
    if (c.p < 0.05) return `L'entrée ${c.mean > 0 ? 'AGGRESSIVE' : 'CONSERVATIVE'} est statistiquement supérieure : Δ = ${sgn(c.mean, 3)} R/trade, ${ciTxt}, p = ${num(c.p, 3)} (test t apparié). Vérifiez que le test des signes (p = ${num(c.pSign, 3)}) et le bootstrap [${num(c.boot.lo, 3)} ; ${num(c.boot.hi, 3)}] concordent.`;
    return `Différence NON significative (p = ${num(c.p, 3)}, ${ciTxt}) : rien ne prouve que l'entrée aggressive soit plus rentable que la conservative.`;
  }
  function renderCompare() {
    const all = DB.trades;
    const consN = all.filter(t => S.filled(t.ret)).length, aggN = all.filter(t => t.agg && S.filled(t.agg.ret)).length;
    const rows = S.pairedRows(all), c = S.comparePaired(rows);
    const noType = rows.filter(t => !t.agg.entry), consNoEntry = rows.filter(t => S.isNoEntry(t.entry)), aggNoEntry = rows.filter(t => t.agg.entry && S.isNoEntry(t.agg.entry));
    const ns = rows.map(t => t.n), kpi = (l, v, s, k) => `<div class="kpi"><div class="l">${l}</div><div class="v ${k || ''}">${v}</div><div class="s">${s || ''}</div></div>`;
    const scen = [
      ['Tous les trades appariés', rows],
      ['Hors Return aggressif sans type d\'entrée aggressive', rows.filter(t => t.agg.entry)],
      ['Seulement les trades pris dans les DEUX groupes', rows.filter(t => !S.isNoEntry(t.entry) && !S.isNoEntry(t.agg.entry))],
    ].map(([label, rs]) => ({ label, c: S.comparePaired(rs) }));
    const kr = [
      ['Nombre de trades (n)', c.n, c.n, '0', false],
      ['Win rate', c.cons.winRate, c.agg.winRate, 'p'],
      ['Net R', c.cons.net, c.agg.net, '2'],
      ['Espérance (R/trade)', c.cons.exp, c.agg.exp, '3'],
      ['Gain moyen (R)', c.cons.avgWin, c.agg.avgWin, '2'],
      ['Perte moyenne (R)', c.cons.avgLoss, c.agg.avgLoss, '2'],
      ['Profit factor', c.cons.profitFactor, c.agg.profitFactor, '2'],
      ['Écart-type des R', c.cons.sd, c.agg.sd, '3'],
      ['Sharpe-like (moy. / écart-type)', c.cons.sharpe, c.agg.sharpe, '3'],
      ['Max drawdown (R, sur ces trades)', c.cons.maxDD, c.agg.maxDD, '2'],
      ['Série max de pertes consécutives', c.lossStreakC, c.lossStreakA, '0'],
    ];
    const fm = (v, k) => v === null || v === undefined ? '–' : k === 'p' ? pct(v, 1) : k === '0' ? String(v) : num(v, +k);
    const kpiRows = kr.map(([l, a, b, k, diff]) => `<tr><td>${l}</td><td class="num">${fm(a, k)}</td><td class="num">${fm(b, k)}</td><td class="num ${diff === false ? '' : cls(b - a)}">${diff === false || a === null || b === null || !isFinite(a) || !isFinite(b) ? '' : k === 'p' ? sgn((b - a) * 100, 1) + ' pts' : sgn(b - a, +k)}</td></tr>`).join('');
    const sc = x => x.n < 2 ? '–' : '';
    const scenRows = scen.map(({ label, c: s }) => `<tr><td>${esc(label)}</td><td class="num">${s.n}</td><td class="num ${cls(s.mean)}">${s.n < 2 ? '–' : sgn(s.mean, 3)}</td><td class="num">${s.n < 2 ? '–' : `[${num(s.ci[0], 2)} ; ${num(s.ci[1], 2)}]`}</td><td class="num">${s.n < 2 ? '–' : num(s.p, 3)}</td><td class="num">${s.n < 2 ? '–' : num(s.pSign, 3)}</td><td class="num">${pct(s.cons.winRate)} / ${pct(s.agg.winRate)}</td><td class="num">${s.n ? sgn(s.cons.net) + ' / ' + sgn(s.agg.net) : '–'}</td></tr>`).join('');
    const byType = {};
    rows.forEach((t, i) => { const k = t.agg.entry || '(type non renseigné)'; (byType[k] = byType[k] || []).push(i); });
    const typeRows = Object.entries(byType).map(([k, idx]) => {
      const m = a => a.reduce((x, y) => x + y, 0) / a.length, C = idx.map(i => c.C[i]), A = idx.map(i => c.A[i]);
      return `<tr class="${idx.length < 10 ? 'low' : ''}"><td>${esc(k)}</td><td class="num">${idx.length}</td><td class="num">${sgn(m(C), 2)}</td><td class="num">${sgn(m(A), 2)}</td><td class="num ${cls(m(A) - m(C))}">${sgn(m(A) - m(C), 2)}</td><td class="num">${pct(A.filter(x => x > 0).length / A.length)}</td></tr>`;
    }).join('');
    const eqC = [[0, 0], ...c.cumC.map((v, i) => [i + 1, v])], eqA = [[0, 0], ...c.cumA.map((v, i) => [i + 1, v])];
    const dC = [[0, 0], ...c.cumA.map((v, i) => [i + 1, v - c.cumC[i]])];
    const warn = [];
    if (noType.length) warn.push(`<b>${noType.length}</b> trade(s) ont un Return aggressif mais <b>aucun type d'entrée aggressive</b> (valeurs : ${noType.map(t => sgn(t.agg.ret, 2)).join(', ')}). Ce sont peut-être des espaces réservés non resimulés : le scénario 2 ci-dessous les exclut.`);
    if (consNoEntry.length) warn.push(`<b>${consNoEntry.length}</b> trade(s) n'ont pas d'entrée conservative (« No Entry » ou vide, Return 0) : l'aggressive y est comparée à un trade non pris.`);
    if (aggNoEntry.length) warn.push(`<b>${aggNoEntry.length}</b> trade(s) ont « No Entry » côté aggressif (Return 0 : l'entrée aggressive n'aurait pas eu lieu).`);
    $('#main').innerHTML = `
      <h1>Comparaison Conservative vs Aggressive</h1>
      <div class="note" style="border-color:var(--accent)">Comparaison <b>appariée</b> : seuls les trades dont les deux Return (conservative ET aggressive) sont renseignés sont retenus, afin de comparer les deux stratégies sur exactement les mêmes trades. Δ = Return aggressif − Return conservatif.</div>
      <div class="kpis">
        ${kpi('Trades avec Return conservative', consN)}${kpi('Trades avec Return aggressive', aggN)}
        ${kpi('Trades appariés (n)', c.n, c.n < 30 ? 'sous le seuil de 30' : '', c.n < 30 ? 'neu' : '')}
        ${kpi('Couverture', consN ? pct(c.n / consN, 1) : '–', ns.length ? `trades #${Math.min(...ns)} à #${Math.max(...ns)}` : '')}
      </div>
      ${c.n && c.n < consN ? `<div class="note">Seuls ${c.n} trades sur ${consN} ont été resimulés${ns.length && Math.min(...ns) > Math.min(...all.map(t => t.n)) + (consN - c.n) / 2 ? ', et ce sont les plus récents' : ''} : ce n'est pas un échantillon aléatoire (période et conditions de marché propres). La conclusion ne vaut que pour ces trades, pas pour l'ensemble du journal.</div>` : ''}
      ${warn.length ? `<div class="note"><b>Qualité des données</b><br>${warn.map(w => '• ' + w).join('<br>')}</div>` : ''}
      <h2>Verdict automatique</h2>
      <div class="card"><b>${esc(verdict(c))}</b></div>
      <h2>KPIs comparés (trades appariés)</h2>
      <div class="twrap" style="max-height:none"><table><thead><tr><th>KPI</th><th class="num">Conservative</th><th class="num">Aggressive</th><th class="num">Écart (Agg − Cons)</th></tr></thead><tbody>${kpiRows}</tbody></table></div>
      <h2>Test apparié sur les Δ</h2>
      <div class="kpis">
        ${kpi('Δ moyen (R/trade)', sgn(c.mean, 3), `écart-type ${num(c.sd, 3)} · erreur std ${num(c.se, 3)}`, cls(c.mean))}
        ${kpi('IC 95 % (Student)', c.n < 2 ? '–' : `[${num(c.ci[0], 2)} ; ${num(c.ci[1], 2)}]`, c.n < 2 ? '' : (c.ci[0] <= 0 && c.ci[1] >= 0 ? 'contient 0' : 'exclut 0'))}
        ${kpi('IC 95 % (bootstrap)', c.n < 2 ? '–' : `[${num(c.boot.lo, 2)} ; ${num(c.boot.hi, 2)}]`, c.n < 2 ? '' : '10 000 rééchantillonnages · P(Δ>0) = ' + pct(c.boot.pPos))}
        ${kpi('t de Student', num(c.t, 3), `df = ${c.df} · p = ${num(c.p, 4)}`)}
        ${kpi('Test des signes', 'p = ' + num(c.pSign, 3), `${c.signPos} + · ${c.signNeg} − · ${c.tie} égalités`)}
        ${kpi('Taille d\'effet (dz)', num(c.dz, 3), '|dz| < 0,2 = négligeable')}
        ${kpi('Part où Aggressive > Cons.', c.n ? pct(c.signPos / c.n, 1) : '–', `${c.signPos} / ${c.n} trades`)}
        ${kpi('Écart minimal détectable', c.mde === null ? '–' : '±' + num(c.mde, 2) + ' R', 'α 5 %, puissance 80 % avec n = ' + c.n)}
        ${kpi('n nécessaire (écart observé)', c.nNeeded === null ? '–' : c.nNeeded, 'trades appariés pour le confirmer')}
      </div>
      <div class="note">Le test t suppose des Δ à peu près normaux ; or les R sont asymétriques (beaucoup de −1, quelques gros gains). Le test des signes et le bootstrap, qui n'ont pas cette hypothèse, sont donnés en contrôle : une conclusion fiable exige qu'ils concordent.</div>
      <h2>Robustesse : trois façons de constituer l'échantillon</h2>
      <div class="twrap" style="max-height:none"><table><thead><tr><th>Scénario</th><th class="num">n</th><th class="num">Δ moyen</th><th class="num">IC 95 %</th><th class="num">p (t)</th><th class="num">p (signes)</th><th class="num">Win rate cons. / agg.</th><th class="num">Net R cons. / agg.</th></tr></thead><tbody>${scenRows}</tbody></table></div>
      <div class="note">Ces trois scénarios sont des découpes <b>a posteriori</b> du même petit échantillon. Quand on teste 3 variantes à 5 %, la probabilité d'obtenir au moins un résultat « significatif » par pur hasard est d'environ 14 % ; et plus le sous-échantillon est réduit (n &lt; 15), plus l'IC est fragile. Un seul scénario significatif sur trois ne prouve donc rien : seule une répétition sur davantage de trades appariés (idéalement ≥ 30, tirés sans sélection) permet de conclure.</div>
      <h2>Courbes de R cumulé (trades appariés)</h2>
      <div class="grid2">
        <div class="card"><h3>R cumulé : conservative vs aggressive</h3>${lineChart({ series: [{ name: 'Conservative', color: 'var(--accent)', pts: eqC }, { name: 'Aggressive', color: 'var(--be)', pts: eqA }], yFmt: v => v.toFixed(0) })}<p class="small muted">Bleu = conservative · Jaune = aggressive</p></div>
        <div class="card"><h3>Δ cumulé (aggressive − conservative)</h3>${lineChart({ series: [{ name: 'Δ cumulé', color: 'var(--win)', pts: dC }], yFmt: v => v.toFixed(1) })}<p class="small muted">Une pente positive durable = avantage cumulé de l'aggressive.</p></div>
      </div>
      <div class="grid2" style="margin-top:14px">
        <div class="card"><h3>Par type d'entrée aggressive</h3><div class="twrap" style="max-height:none"><table><thead><tr><th>Type</th><th class="num">n</th><th class="num">R moy. cons.</th><th class="num">R moy. agg.</th><th class="num">Δ moy.</th><th class="num">Win rate agg.</th></tr></thead><tbody>${typeRows}</tbody></table></div></div>
      </div>
      <h2>Détail des trades appariés</h2>
      <div class="twrap"><table><thead><tr><th class="num">#</th><th>Date</th><th>Instrument</th><th>Dir.</th><th>Entrée cons.</th><th class="num">R cons.</th><th>Entrée agg.</th><th class="num">R agg.</th><th class="num">Δ</th></tr></thead><tbody>${rows.map((t, i) => `<tr class="click" data-n="${t.n}"><td class="num">${t.n}</td><td>${esc(t.date)}</td><td>${esc(t.instrument)}</td><td>${esc(t.direction)}</td><td>${esc(t.entry)}</td><td class="num ${cls(c.C[i])}">${sgn(c.C[i])}</td><td>${esc(t.agg.entry)}</td><td class="num ${cls(c.A[i])}">${sgn(c.A[i])}</td><td class="num ${cls(c.D[i])}">${sgn(c.D[i])}</td></tr>`).join('')}</tbody></table></div>
      ${c.n ? '' : '<p class="muted pad">Aucun trade apparié pour l\'instant : renseignez le Return aggressive dans la fiche d\'un trade (bouton « Modifier »).</p>'}`;
    document.querySelectorAll('tr.click').forEach(r => r.onclick = () => openTrade(+r.dataset.n));
  }










  /* NEWS : voir le calendrier V4 plus bas */

  /* ---------- TRADING PLAN ---------- */
  function plansData() {
    if (!DB) return { plans: [], activeId: null };
    // migrate the old single plan into the new list
    if (!DB.tradingPlans) {
      var first = (DB.tradingPlan && DB.tradingPlan.sections && DB.tradingPlan.sections.length)
        ? DB.tradingPlan : EMPTY_JOURNAL.tradingPlan;
      DB.tradingPlans = [{ id: 'p' + Date.now(), name: 'Plan principal',
                           sections: JSON.parse(JSON.stringify(first.sections || [])),
                           notes: JSON.parse(JSON.stringify(first.notes || [])) }];
    }
    if (!DB.tradingPlans.length) {
      DB.tradingPlans = [{ id: 'p' + Date.now(), name: 'Plan principal',
                           sections: JSON.parse(JSON.stringify(EMPTY_JOURNAL.tradingPlan.sections)),
                           notes: JSON.parse(JSON.stringify(EMPTY_JOURNAL.tradingPlan.notes)) }];
    }
    if (!DB.activePlanId || !DB.tradingPlans.filter(function(p) { return p.id === DB.activePlanId; }).length) {
      DB.activePlanId = DB.tradingPlans[0].id;
    }
    return { plans: DB.tradingPlans, activeId: DB.activePlanId };
  }
  function activePlan() {
    var d = plansData();
    return d.plans.filter(function(p) { return p.id === d.activeId; })[0] || d.plans[0];
  }
  function planById(id) {
    var d = plansData();
    return d.plans.filter(function(p) { return p.id === id; })[0] || null;
  }
  function planNewId() { return 'p' + Date.now() + Math.random().toString(36).slice(2, 5); }
  /* --- presse-papier de plans, partagé entre les deux journaux --- */
  var TP_CLIP = 'tp_clipboard_v1';
  function tpClipPeek() {
    try {
      var o = JSON.parse(localStorage.getItem(TP_CLIP) || 'null');
      return (o && o.plan && o.plan.name) ? o : null;
    } catch (e) { return null; }
  }
  function tpCopyToClip(plan) {
    var copy = JSON.parse(JSON.stringify(plan));
    delete copy.id;
    try {
      localStorage.setItem(TP_CLIP, JSON.stringify({ from: (DB.meta && DB.meta.name) || 'Journal', plan: copy }));
    } catch (e) { alert('Plan trop volumineux pour \u00eatre copi\u00e9.'); return false; }
    toast('Plan \u00ab ' + copy.name + ' \u00bb copi\u00e9 \u2014 collez-le dans l\'autre journal', 6000);
    return true;
  }

  function renderTradingPlan() {
    var pd = plansData();
    var plan = activePlan();
    var editing = renderTradingPlan._editing || false;
    if (!editing) renderTradingPlan._draft = null;
    var clip = tpClipPeek();
    var planBar =
      '<div class="tp-bar">' +
      '<label>Plan actif <select id="tp-select">' +
      pd.plans.map(function(p) {
        return '<option value="' + p.id + '"' + (p.id === pd.activeId ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      }).join('') + '</select></label>' +
      '<button class="btn sm" id="tp-new">+ Nouveau</button>' +
      '<button class="btn sm" id="tp-rename">\u270f\ufe0f Renommer</button>' +
      '<button class="btn sm" id="tp-dup">\u29c9 Dupliquer</button>' +
      '<button class="btn sm" id="tp-copy">\ud83d\udccb Copier</button>' +
      (clip ? '<button class="btn sm" id="tp-paste">\ud83d\udccb Coller \u00ab ' + esc(clip.plan.name.slice(0, 22)) + ' \u00bb</button>' : '') +
      (pd.plans.length > 1 ? '<button class="btn sm danger" id="tp-del">\ud83d\uddd1</button>' : '') +
      '<span class="muted small">' + pd.plans.length + ' plan(s)</span>' +
      '</div>';

    if (editing) {
      // Brouillon : les modifications ne touchent le plan qu'à l'enregistrement
      var draft = renderTradingPlan._draft && renderTradingPlan._draft.id === plan.id ? renderTradingPlan._draft : (renderTradingPlan._draft = JSON.parse(JSON.stringify(plan)));
      draft.sections = draft.sections || []; draft.notes = draft.notes || [];
      var secOpts = function(si) { return draft.sections.map(function(s, k) { return '<option value="' + k + '"' + (k === si ? ' selected' : '') + '>' + esc(s.title || ('Section ' + (k + 1))) + '</option>'; }).join(''); };
      var sectionsHTML = '';
      draft.sections.forEach(function(sec, si) {
        sectionsHTML += '<fieldset class="tpe-sec" data-si="' + si + '"><legend class="tpe-legend">' +
          '<input type="text" class="tp-title" data-si="' + si + '" value="' + esc(sec.title) + '" aria-label="Titre de la section">' +
          '<span class="tpe-tools"><button class="btn sm tpe-sup" data-si="' + si + '" ' + (si === 0 ? 'disabled' : '') + ' title="Monter la section" aria-label="Monter la section">↑</button>' +
          '<button class="btn sm tpe-sdown" data-si="' + si + '" ' + (si === draft.sections.length - 1 ? 'disabled' : '') + ' title="Descendre la section" aria-label="Descendre la section">↓</button>' +
          '<button class="btn sm danger tp-del-sec" data-si="' + si + '" aria-label="Supprimer la section">×</button></span></legend>' +
          '<div class="tpe-items" data-si="' + si + '">';
        sec.items.forEach(function(item, ii) {
          sectionsHTML += '<div class="tpe-row tpe-drag" data-si="' + si + '" data-ii="' + ii + '">' +
            '<span class="tpe-handle" title="Glisser pour déplacer" aria-hidden="true">⠇</span>' +
            '<input type="text" class="tp-item" data-si="' + si + '" data-ii="' + ii + '" value="' + esc(item) + '">' +
            '<button class="btn sm tpe-up" data-si="' + si + '" data-ii="' + ii + '" ' + (ii === 0 ? 'disabled' : '') + ' aria-label="Monter">↑</button>' +
            '<button class="btn sm tpe-down" data-si="' + si + '" data-ii="' + ii + '" ' + (ii === sec.items.length - 1 ? 'disabled' : '') + ' aria-label="Descendre">↓</button>' +
            (draft.sections.length > 1 ? '<select class="tpe-move" data-si="' + si + '" data-ii="' + ii + '" aria-label="Déplacer vers une autre section"><option value="">Déplacer vers…</option>' + draft.sections.map(function(s, k) { return k === si ? '' : '<option value="' + k + '">' + esc(s.title || ('Section ' + (k + 1))) + '</option>'; }).join('') + '</select>' : '') +
            '<button class="btn sm danger tp-del-item" data-si="' + si + '" data-ii="' + ii + '" aria-label="Supprimer">×</button></div>';
        });
        sectionsHTML += '</div><button class="btn sm tp-add-item" data-si="' + si + '">+ Ajouter un point</button></fieldset>';
      });

      var notesHTML = '';
      draft.notes.forEach(function(note, ni) {
        notesHTML += '<div class="tpe-row" data-ni="' + ni + '"><span class="muted">📝</span>' +
          '<input type="text" class="tp-note" data-ni="' + ni + '" value="' + esc(note) + '">' +
          '<button class="btn sm tpe-nup" data-ni="' + ni + '" ' + (ni === 0 ? 'disabled' : '') + ' aria-label="Monter">↑</button>' +
          '<button class="btn sm tpe-ndown" data-ni="' + ni + '" ' + (ni === draft.notes.length - 1 ? 'disabled' : '') + ' aria-label="Descendre">↓</button>' +
          '<button class="btn sm danger tp-del-note" data-ni="' + ni + '" aria-label="Supprimer">×</button></div>';
      });

      $('#main').innerHTML =
        '<h1>📝 Trading Plan <span class="muted small">(édition)</span></h1>' + planBar +
        '<div class="card" style="margin-bottom:12px"><div class="form"><label>Sous-titre (ex. London Checklist)<input id="tp-subtitle" value="' + esc(draft.subtitle || '') + '"></label><label class="wide">Images de setup (un lien TradingView ou image par ligne)<textarea id="tp-images">' + esc((draft.images || []).join('\n')) + '</textarea></label></div></div>' +
        '<p class="muted small">Déplace un point avec ↑ ↓, avec « Déplacer vers… » pour changer de section, ou en le faisant glisser par la poignée ⠇ (ordinateur).</p>' +
        '<div class="card"><div class="tpe-wrap">' + sectionsHTML +
        '<button class="btn" id="tp-add-sec">+ Ajouter une section</button>' +
        '</div></div>' +
        '<h2>Trading notes</h2>' +
        '<div class="card">' + notesHTML +
        '<button class="btn sm" id="tp-add-note">+ Ajouter une note</button></div>' +
        '<div class="actions" style="margin-top:14px"><button class="btn" id="tp-cancel">Annuler</button><button class="btn primary" id="tp-save">Enregistrer le plan</button></div>';

      // Event handlers

    // --- plan management ---
    var tpSel = $('#tp-select');
    if (tpSel) tpSel.onchange = async function() {
      DB.activePlanId = tpSel.value;
      DB.tradingPlan = activePlan();
      renderTradingPlan._editing = false;
      await save('Plan actif : ' + activePlan().name);
      renderTradingPlan();
    };
    var tpNew = $('#tp-new');
    if (tpNew) tpNew.onclick = async function() {
      var name = prompt('Nom du nouveau plan :', 'Plan ' + (plansData().plans.length + 1));
      if (!name || !name.trim()) return;
      var p = { id: planNewId(), name: name.trim(), sections: [{ title: 'Nouvelle section', items: [''] }], notes: [] };
      DB.tradingPlans.push(p);
      DB.activePlanId = p.id; DB.tradingPlan = p;
      renderTradingPlan._editing = true;
      await save('Plan cr\u00e9\u00e9');
      renderTradingPlan();
    };
    var tpRen = $('#tp-rename');
    if (tpRen) tpRen.onclick = async function() {
      var name = prompt('Nouveau nom du plan :', plan.name);
      if (!name || !name.trim()) return;
      plan.name = name.trim();
      await save('Plan renomm\u00e9');
      renderTradingPlan();
    };
    var tpDup = $('#tp-dup');
    if (tpDup) tpDup.onclick = async function() {
      var c = JSON.parse(JSON.stringify(plan));
      c.id = planNewId(); c.name = plan.name + ' (copie)';
      DB.tradingPlans.push(c);
      DB.activePlanId = c.id; DB.tradingPlan = c;
      await save('Plan dupliqu\u00e9');
      renderTradingPlan();
    };
    var tpCopy = $('#tp-copy');
    if (tpCopy) tpCopy.onclick = function() { tpCopyToClip(plan); renderTradingPlan(); };
    var tpPaste = $('#tp-paste');
    if (tpPaste) tpPaste.onclick = async function() {
      var c = tpClipPeek();
      if (!c) return;
      var p = JSON.parse(JSON.stringify(c.plan));
      p.id = planNewId();
      if (plansData().plans.filter(function(x) { return x.name === p.name; }).length) p.name = p.name + ' (copie)';
      DB.tradingPlans.push(p);
      DB.activePlanId = p.id; DB.tradingPlan = p;
      renderTradingPlan._editing = false;
      await save('Plan coll\u00e9 depuis ' + (c.from || 'l\'autre journal'));
      renderTradingPlan();
    };
    var tpDel = $('#tp-del');
    if (tpDel) tpDel.onclick = async function() {
      if (plansData().plans.length < 2) return;
      var used = ((DB.trades) || []).filter(function(t) { return t.planId === plan.id; }).length;
      if (!confirm('Supprimer le plan \u00ab ' + plan.name + ' \u00bb ?' +
        (used ? '\n\n' + used + ' trade(s) y font r\u00e9f\u00e9rence ; ils garderont le nom du plan.' : ''))) return;
      DB.tradingPlans = DB.tradingPlans.filter(function(x) { return x.id !== plan.id; });
      DB.activePlanId = DB.tradingPlans[0].id;
      DB.tradingPlan = activePlan();
      renderTradingPlan._editing = false;
      await save('Plan supprim\u00e9');
      renderTradingPlan();
    };

      // recopie ce qui est saisi dans le brouillon avant toute opération
      var sync = function() {
        document.querySelectorAll('.tp-title').forEach(function(el) { var s = draft.sections[+el.dataset.si]; if (s) s.title = el.value; });
        document.querySelectorAll('.tp-item').forEach(function(el) { var s = draft.sections[+el.dataset.si]; if (s) s.items[+el.dataset.ii] = el.value; });
        document.querySelectorAll('.tp-note').forEach(function(el) { draft.notes[+el.dataset.ni] = el.value; });
        if ($('#tp-subtitle')) draft.subtitle = $('#tp-subtitle').value;
        if ($('#tp-images')) draft.images = $('#tp-images').value.split('\n').map(function(x) { return x.trim(); }).filter(Boolean);
      };
      var redo = function(focusSel) { var y = window.scrollY; renderTradingPlan(); window.scrollTo(0, y); if (focusSel) { var f = document.querySelector(focusSel); if (f) f.focus(); } };
      var moveItem = function(si, ii, tsi, tii) {
        var it = draft.sections[si].items.splice(ii, 1)[0];
        var dest = draft.sections[tsi].items; if (tii === undefined || tii > dest.length) tii = dest.length; dest.splice(tii, 0, it);
        return tii;
      };
      $('#tp-save').onclick = async function() {
        sync();
        var newPlan = { sections: draft.sections.map(function(s) { return { title: String(s.title || '').trim(), items: s.items.map(function(x) { return String(x || '').trim(); }).filter(Boolean) }; }).filter(function(s) { return s.title; }),
          notes: draft.notes.map(function(x) { return String(x || '').trim(); }).filter(Boolean) };
        newPlan.id = plan.id; newPlan.name = plan.name;
        ['reviews', 'color'].forEach(function(k) { if (plan[k] !== undefined) newPlan[k] = plan[k]; });
        newPlan.subtitle = String(draft.subtitle || '').trim();
        newPlan.images = draft.images || [];
        var idx = pd.plans.map(function(p) { return p.id; }).indexOf(plan.id);
        if (idx >= 0) DB.tradingPlans[idx] = newPlan;
        DB.tradingPlan = newPlan; // keep the checklist and older code working
        renderTradingPlan._editing = false; renderTradingPlan._draft = null;
        await save('Plan « ' + newPlan.name + ' » enregistré'); renderTradingPlan();
      };
      $('#tp-cancel').onclick = function() { renderTradingPlan._editing = false; renderTradingPlan._draft = null; renderTradingPlan(); };
      $('#tp-add-sec').onclick = function() { sync(); draft.sections.push({ title: 'Nouvelle section', items: [''] }); redo('.tp-title[data-si="' + (draft.sections.length - 1) + '"]'); };
      $('#tp-add-note').onclick = function() { sync(); draft.notes.push(''); redo('.tp-note[data-ni="' + (draft.notes.length - 1) + '"]'); };
      document.querySelectorAll('.tp-add-item').forEach(function(btn) { btn.onclick = function() { sync(); var si = +btn.dataset.si; draft.sections[si].items.push(''); redo('.tp-item[data-si="' + si + '"][data-ii="' + (draft.sections[si].items.length - 1) + '"]'); }; });
      document.querySelectorAll('.tp-del-sec').forEach(function(btn) { btn.onclick = function() { sync(); var s = draft.sections[+btn.dataset.si]; if (s.items.filter(Boolean).length && !confirm('Supprimer la section « ' + s.title + ' » et ses ' + s.items.filter(Boolean).length + ' point(s) ?')) return; draft.sections.splice(+btn.dataset.si, 1); redo(); }; });
      document.querySelectorAll('.tp-del-item').forEach(function(btn) { btn.onclick = function() { sync(); draft.sections[+btn.dataset.si].items.splice(+btn.dataset.ii, 1); redo(); }; });
      document.querySelectorAll('.tp-del-note').forEach(function(btn) { btn.onclick = function() { sync(); draft.notes.splice(+btn.dataset.ni, 1); redo(); }; });
      document.querySelectorAll('.tpe-up, .tpe-down').forEach(function(btn) { btn.onclick = function() { sync(); var si = +btn.dataset.si, ii = +btn.dataset.ii, t = btn.classList.contains('tpe-up') ? ii - 1 : ii + 1; moveItem(si, ii, si, t); redo('.' + (btn.classList.contains('tpe-up') ? 'tpe-up' : 'tpe-down') + '[data-si="' + si + '"][data-ii="' + t + '"]'); }; });
      document.querySelectorAll('.tpe-move').forEach(function(sel) { sel.onchange = function() { if (sel.value === '') return; sync(); var tsi = +sel.value, ni = moveItem(+sel.dataset.si, +sel.dataset.ii, tsi); redo('.tp-item[data-si="' + tsi + '"][data-ii="' + ni + '"]'); toast('Point déplacé vers « ' + (draft.sections[tsi].title || 'section') + ' »'); }; });
      document.querySelectorAll('.tpe-sup, .tpe-sdown').forEach(function(btn) { btn.onclick = function() { sync(); var si = +btn.dataset.si, t = btn.classList.contains('tpe-sup') ? si - 1 : si + 1, s = draft.sections.splice(si, 1)[0]; draft.sections.splice(t, 0, s); redo(); }; });
      document.querySelectorAll('.tpe-nup, .tpe-ndown').forEach(function(btn) { btn.onclick = function() { sync(); var ni = +btn.dataset.ni, t = btn.classList.contains('tpe-nup') ? ni - 1 : ni + 1, n = draft.notes.splice(ni, 1)[0]; draft.notes.splice(t, 0, n); redo(); }; });
      // glisser-déposer (ordinateur) : déposer avant une ligne, ou à la fin d'une section
      var dragSrc = null;
      document.querySelectorAll('.tpe-row.tpe-drag').forEach(function(row) {
        var h = row.querySelector('.tpe-handle');
        h.addEventListener('mousedown', function() { row.draggable = true; });
        h.addEventListener('mouseup', function() { row.draggable = false; });
        row.addEventListener('dragstart', function(e) { if (!row.draggable) { e.preventDefault(); return; } dragSrc = { si: +row.dataset.si, ii: +row.dataset.ii }; row.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'x'); } catch (x) {} });
        row.addEventListener('dragend', function() { row.draggable = false; row.classList.remove('dragging'); document.querySelectorAll('.drop-before').forEach(function(x) { x.classList.remove('drop-before'); }); });
        row.addEventListener('dragover', function(e) { if (!dragSrc) return; e.preventDefault(); document.querySelectorAll('.drop-before').forEach(function(x) { x.classList.remove('drop-before'); }); row.classList.add('drop-before'); });
        row.addEventListener('drop', function(e) { if (!dragSrc) return; e.preventDefault(); sync(); var tsi = +row.dataset.si, tii = +row.dataset.ii; if (dragSrc.si === tsi && dragSrc.ii < tii) tii--; moveItem(dragSrc.si, dragSrc.ii, tsi, tii); dragSrc = null; redo(); });
      });
      document.querySelectorAll('.tpe-items').forEach(function(box) {
        box.parentNode.addEventListener('dragover', function(e) { if (dragSrc && !e.target.closest('.tpe-row')) e.preventDefault(); });
        box.parentNode.addEventListener('drop', function(e) { if (!dragSrc || e.target.closest('.tpe-row')) return; e.preventDefault(); sync(); moveItem(dragSrc.si, dragSrc.ii, +box.dataset.si); dragSrc = null; redo(); });
      });
      return;
    }

    // Read-only view (V5 : présentation « plan card »)
    var html = tpViewHTML(plan, planBar);
    $('#main').innerHTML = html;
    wireTpView(plan);

    // --- plan management ---
    var tpSel = $('#tp-select');
    if (tpSel) tpSel.onchange = async function() {
      DB.activePlanId = tpSel.value;
      DB.tradingPlan = activePlan();
      renderTradingPlan._editing = false;
      await save('Plan actif : ' + activePlan().name);
      renderTradingPlan();
    };
    var tpNew = $('#tp-new');
    if (tpNew) tpNew.onclick = async function() {
      var name = prompt('Nom du nouveau plan :', 'Plan ' + (plansData().plans.length + 1));
      if (!name || !name.trim()) return;
      var p = { id: planNewId(), name: name.trim(), sections: [{ title: 'Nouvelle section', items: [''] }], notes: [] };
      DB.tradingPlans.push(p);
      DB.activePlanId = p.id; DB.tradingPlan = p;
      renderTradingPlan._editing = true;
      await save('Plan cr\u00e9\u00e9');
      renderTradingPlan();
    };
    var tpRen = $('#tp-rename');
    if (tpRen) tpRen.onclick = async function() {
      var name = prompt('Nouveau nom du plan :', plan.name);
      if (!name || !name.trim()) return;
      plan.name = name.trim();
      await save('Plan renomm\u00e9');
      renderTradingPlan();
    };
    var tpDup = $('#tp-dup');
    if (tpDup) tpDup.onclick = async function() {
      var c = JSON.parse(JSON.stringify(plan));
      c.id = planNewId(); c.name = plan.name + ' (copie)';
      DB.tradingPlans.push(c);
      DB.activePlanId = c.id; DB.tradingPlan = c;
      await save('Plan dupliqu\u00e9');
      renderTradingPlan();
    };
    var tpCopy = $('#tp-copy');
    if (tpCopy) tpCopy.onclick = function() { tpCopyToClip(plan); renderTradingPlan(); };
    var tpPaste = $('#tp-paste');
    if (tpPaste) tpPaste.onclick = async function() {
      var c = tpClipPeek();
      if (!c) return;
      var p = JSON.parse(JSON.stringify(c.plan));
      p.id = planNewId();
      if (plansData().plans.filter(function(x) { return x.name === p.name; }).length) p.name = p.name + ' (copie)';
      DB.tradingPlans.push(p);
      DB.activePlanId = p.id; DB.tradingPlan = p;
      renderTradingPlan._editing = false;
      await save('Plan coll\u00e9 depuis ' + (c.from || 'l\'autre journal'));
      renderTradingPlan();
    };
    var tpDel = $('#tp-del');
    if (tpDel) tpDel.onclick = async function() {
      if (plansData().plans.length < 2) return;
      var used = ((DB.trades) || []).filter(function(t) { return t.planId === plan.id; }).length;
      if (!confirm('Supprimer le plan \u00ab ' + plan.name + ' \u00bb ?' +
        (used ? '\n\n' + used + ' trade(s) y font r\u00e9f\u00e9rence ; ils garderont le nom du plan.' : ''))) return;
      DB.tradingPlans = DB.tradingPlans.filter(function(x) { return x.id !== plan.id; });
      DB.activePlanId = DB.tradingPlans[0].id;
      DB.tradingPlan = activePlan();
      renderTradingPlan._editing = false;
      await save('Plan supprim\u00e9');
      renderTradingPlan();
    };

    $('#tp-edit').onclick = function() { renderTradingPlan._editing = true; renderTradingPlan(); };
  }



  /* ---------- CALCULATEUR DE POSITION ---------- */
  function renderCalculator() {
    var calc = DB.calculator || { accountSize: 5000, riskPercent: 0.06, instruments: [] };
    var instruments = calc.instruments && calc.instruments.length ? calc.instruments : [
      {name:'NAS',pipValue:20},{name:'US500',pipValue:1},{name:'EURUSD',pipValue:10},
      {name:'GBPUSD',pipValue:10},{name:'XAUUSD',pipValue:1},{name:'US30',pipValue:10}
    ];
    var riskDollar = calc.accountSize * (calc.riskPercent / 100);

    var instOpts = instruments.map(function(inst) {
      return '<option value="' + inst.pipValue + '" data-name="' + esc(inst.name) + '">' + esc(inst.name) + ' ($' + inst.pipValue + '/pip)</option>';
    }).join('');


    $('#main').innerHTML =
      '<h1>\ud83e\uddee Calculateur de position</h1>' +

      '<div class="card" style="margin-bottom:16px">' +
      '<h2 style="margin-top:0">Taille de position</h2>' +
      '<p class="muted small">Formule : Lot Size = Risk$ \u00f7 (Stop size \u00d7 $/pip)</p>' +
      '<div class="calc-grid">' +
        '<label class="calc-field">Account Size ($)<input type="number" id="c-account" value="' + calc.accountSize + '" min="0" step="100"></label>' +
        '<label class="calc-field">Risk %<input type="number" id="c-risk" value="' + calc.riskPercent + '" min="0" step="0.01"></label>' +
        '<label class="calc-field">Risk $<input type="text" id="c-riskdollar" value="$' + riskDollar.toFixed(2) + '" readonly class="calc-readonly"></label>' +
        '<label class="calc-field">Instrument<select id="c-instrument">' + instOpts + '</select></label>' +
        '<label class="calc-field">Stop size (pips/pts)<input type="number" id="c-stop" value="8" min="0.1" step="0.1"></label>' +
        '<div class="calc-result"><div class="calc-result-label">LOT SIZE</div><div class="calc-result-value" id="c-lot">0.00</div></div>' +
      '</div>' +
      '<div class="actions" style="margin-top:10px"><button class="btn" id="c-save">Enregistrer Account Size & Risk %</button></div>' +
      '</div>';
    // Position calculator logic
    function calcLot() {
      var account = +$('#c-account').value || 0;
      var risk = +$('#c-risk').value || 0;
      var riskD = account * (risk / 100);
      $('#c-riskdollar').value = '$' + riskD.toFixed(2);
      var pipVal = +$('#c-instrument').value || 1;
      var stop = +$('#c-stop').value || 1;
      var lot = riskD / (stop * pipVal);
      $('#c-lot').textContent = lot.toFixed(2);
    }

    ['c-account','c-risk','c-stop'].forEach(function(id) {
      $('#' + id).oninput = calcLot;
    });
    $('#c-instrument').onchange = calcLot;
    calcLot();

    // Save account size and risk %
    $('#c-save').onclick = async function() {
      DB.calculator = DB.calculator || {};
      DB.calculator.accountSize = +$('#c-account').value || 5000;
      DB.calculator.riskPercent = +$('#c-risk').value || 0.06;
      await save('Param\u00e8tres du calculateur enregistr\u00e9s');
    };
  }




  /* ---------- TRADING (TradingView) ---------- */
  var _tradingReady = false;

  function renderTrading() {
    var tc = document.getElementById('trading-container');
    if (!tc) { tc = document.createElement('div'); tc.id = 'trading-container'; tc.hidden = true; document.body.insertBefore(tc, document.getElementById('overlay')); }

    if (!_tradingReady) {
      var saved = DB.tradingView || {};
      var sym = saved.symbol || 'FX:EURUSD';
      var intv = saved.interval || '60';
      var theme = saved.theme || 'dark';

      var symbols = ['FX:EURUSD','FX:GBPUSD','FX:GBPJPY','FX:USDJPY','FX:AUDUSD','FX:USDCHF','FX:NZDUSD','TVC:DXY','OANDA:XAUUSD','CAPITALCOM:US500','CAPITALCOM:US30','CAPITALCOM:USTEC'];
      var intervals = [{v:'1',l:'1m'},{v:'5',l:'5m'},{v:'15',l:'15m'},{v:'60',l:'1H'},{v:'240',l:'4H'},{v:'D',l:'1D'},{v:'W',l:'1W'},{v:'M',l:'1M'}];

      var symOpts = symbols.map(function(s) {
        return '<option value="' + s + '"' + (s === sym ? ' selected' : '') + '>' + s.replace('FX:','').replace('OANDA:','').replace('CAPITALCOM:','').replace('TVC:','') + '</option>';
      }).join('');
      var intvOpts = intervals.map(function(i) {
        return '<option value="' + i.v + '"' + (i.v === intv ? ' selected' : '') + '>' + i.l + '</option>';
      }).join('');

      tc.innerHTML =
        '<div style="max-width:1400px;margin:0 auto;padding:0 18px">' +
        '<h1>\ud83d\udcca Trading</h1>' +
        '<div class="bar" style="flex-wrap:wrap;gap:8px;margin-bottom:10px">' +
        '<label>Symbol <select id="tv-sym" style="font-size:14px;padding:4px 8px">' + symOpts + '</select></label>' +
        '<label>Interval <select id="tv-intv" style="font-size:14px;padding:4px 8px">' + intvOpts + '</select></label>' +
        '<label>Theme <select id="tv-theme" style="font-size:14px;padding:4px 8px"><option value="dark"' + (theme === 'dark' ? ' selected' : '') + '>Dark</option><option value="light"' + (theme === 'light' ? ' selected' : '') + '>Light</option></select></label>' +
        '<button class="btn primary" id="tv-apply">Apply</button>' +
        '</div>' +
        '<div id="tv-layouts" class="tv-layouts"></div>' +
        '<div id="tv-chart-wrap" class="cal-embed" style="height:calc(100vh - 200px);min-height:500px"></div>' +
        '</div>';

      function buildChart() {
        var s = tc.querySelector('#tv-sym').value;
        var i = tc.querySelector('#tv-intv').value;
        var t = tc.querySelector('#tv-theme').value;
        DB.tradingView = Object.assign(DB.tradingView || {}, { symbol: s, interval: i, theme: t });
        renderTvLayouts(tc);
        var url = 'https://s.tradingview.com/widgetembed/?hideideas=1&overrides={}&enabled_features=[]&disabled_features=[]' +
          '&symbol=' + encodeURIComponent(s) +
          '&interval=' + i +
          '&theme=' + t +
          '&style=1&locale=en&withdateranges=1&showpopupbutton=1' +
          '&allow_symbol_change=1&save_image=1&hide_side_toolbar=0' +
          '&calendar=0&hotlist=0&studies=MASimple%409%2CMASimple%4021';
        tc.querySelector('#tv-chart-wrap').innerHTML =
          '<iframe src="' + url + '" style="width:100%;height:100%;border:1px solid var(--line);border-radius:var(--radius)" frameBorder="0" allowtransparency="true" allowfullscreen></iframe>';
      }

      tc.querySelector('#tv-apply').onclick = buildChart;
      tc.querySelector('#tv-sym').onchange = () => renderTvLayouts(tc);
      buildChart();
      _tradingReady = true;
    }

    renderTvLayouts(tc);
    tc.hidden = false;
    $('#main').hidden = true;
  }

  /* ---- Mes graphiques TradingView (layouts du compte) : ouverts dans TradingView, connectés au compte ---- */
  const DEFAULT_LAYOUT = { name: 'Mon graphique', url: 'https://fr.tradingview.com/chart/dj66K3s2/' };
  function tvLayouts() {
    DB.tradingView = DB.tradingView || {};
    if (!Array.isArray(DB.tradingView.layouts)) DB.tradingView.layouts = [Object.assign({}, DEFAULT_LAYOUT)];
    return DB.tradingView.layouts;
  }
  function layoutUrl(l, sym) {
    const base = String(l.url || '').split('#')[0].split('?')[0].replace(/\/?$/, '/');
    return sym ? base + '?symbol=' + encodeURIComponent(sym) : base;
  }
  function renderTvLayouts(tc) {
    const box = tc.querySelector('#tv-layouts'); if (!box) return;
    const ls = tvLayouts(), sym = (tc.querySelector('#tv-sym') || {}).value || (DB.tradingView.symbol || 'FX:EURUSD');
    const wide = window.matchMedia && window.matchMedia('(min-width: 1000px)').matches;
    box.innerHTML = `<div class="tv-lhead"><b>Mes graphiques TradingView</b> <span class="muted small">Ouverts dans TradingView avec ton compte (layouts, indicateurs, dessins) · symbole : ${esc(sym.replace(/^[A-Z]+:/, ''))}</span></div>
      <div class="tv-lrow">${ls.map((l, i) => `<div class="tv-lcard">
        <a class="btn primary" href="${esc(layoutUrl(l, sym))}" target="_blank" rel="noopener" data-tvopen="${i}">📈 ${esc(l.name || 'Graphique')} ↗</a>
        ${wide ? `<button class="btn sm" data-tvside="${i}" title="Ouvre une fenêtre à droite de l'écran pour garder le journal visible">🪟 Fenêtre à côté</button>` : ''}
        <button class="btn sm" data-tvedit="${i}" aria-label="Modifier">✎</button></div>`).join('')}
        <button class="btn sm" id="tv-add">+ Ajouter un graphique</button></div>
      <div id="tv-form"></div>
      <p class="muted small">TradingView n'autorise pas l'affichage de ton graphique connecté à l'intérieur d'un autre site : il s'ouvre dans l'application TradingView (téléphone) ou dans un nouvel onglet (PC). Le graphique ci-dessous est la version intégrable, sans ton compte.</p>`;
    box.querySelectorAll('[data-tvside]').forEach(b => b.onclick = () => {
      const l = ls[+b.dataset.tvside], w = Math.round(screen.availWidth / 2), h = screen.availHeight;
      const win = window.open(layoutUrl(l, sym), 'tv_side', `width=${w},height=${h},left=${screen.availWidth - w},top=0`);
      if (!win) toast('Fenêtre bloquée par le navigateur : autorise les pop-ups pour ce site.');
    });
    const form = (i) => {
      const l = i === null ? { name: '', url: '' } : ls[i];
      box.querySelector('#tv-form').innerHTML = `<div class="tv-edit card"><label>Nom<input id="tvf-name" value="${esc(l.name)}" placeholder="ex. EURUSD – analyse HTF"></label>
        <label>Lien du graphique<input id="tvf-url" value="${esc(l.url)}" placeholder="https://fr.tradingview.com/chart/xxxxxxx/"></label>
        <div class="actions">${i !== null ? '<button class="btn" id="tvf-del">Supprimer</button>' : ''}<button class="btn" id="tvf-cancel">Annuler</button><button class="btn primary" id="tvf-save">Enregistrer</button></div></div>`;
      box.querySelector('#tvf-cancel').onclick = () => { box.querySelector('#tv-form').innerHTML = ''; };
      if (i !== null) box.querySelector('#tvf-del').onclick = async () => { if (!confirm('Supprimer ce graphique de la liste ?')) return; ls.splice(i, 1); await save('Graphique supprimé'); renderTvLayouts(tc); };
      box.querySelector('#tvf-save').onclick = async () => {
        const name = box.querySelector('#tvf-name').value.trim(), url = box.querySelector('#tvf-url').value.trim();
        if (!/^https:\/\/([a-z]{2,3}\.)?(www\.)?tradingview\.com\/chart\//i.test(url)) return alert('Colle le lien d\u2019un graphique TradingView (il commence par https://…tradingview.com/chart/).');
        const item = { name: name || 'Graphique', url: url };
        if (i === null) ls.push(item); else ls[i] = item;
        await save('Graphique enregistré'); renderTvLayouts(tc);
      };
    };
    box.querySelectorAll('[data-tvedit]').forEach(b => b.onclick = () => form(+b.dataset.tvedit));
    box.querySelector('#tv-add').onclick = () => form(null);
  }

  function hideTrading() {
    var tc = document.getElementById('trading-container');
    if (tc) tc.hidden = true;
  }




  /* ---------- NOTEBOOK ---------- */
  var _nbState = { search: '', folder: null, openNote: null, editing: false };

  function nbData() {
    if (!DB) DB = { trades: [], reviews: [], lists: {} };
    if (!DB.notebook) DB.notebook = { notes: [], folders: ['Ideas', 'Drafts', 'Playbook', 'Mindset'] };
    if (!DB.notebook.notes) DB.notebook.notes = [];
    if (!DB.notebook.folders) DB.notebook.folders = ['Ideas', 'Drafts', 'Playbook', 'Mindset'];
    return DB.notebook;
  }

  function nbNewId() { return 'n' + Date.now() + Math.random().toString(36).slice(2, 6); }

  function nbTimeAgo(iso) {
    if (!iso) return '';
    var diff = Date.now() - new Date(iso).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'maintenant';
    if (mins < 60) return mins + 'mn';
    var h = Math.floor(mins / 60);
    if (h < 24) return h + 'h';
    var d = Math.floor(h / 24);
    if (d < 30) return d + 'j';
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  function nbIcon(note) {
    var icons = { Ideas: '\ud83d\udca1', Drafts: '\ud83d\udcdd', Playbook: '\ud83d\udcd8', Mindset: '\ud83e\udde0' };
    return note.icon || icons[note.folder] || '\ud83d\udcc4';
  }

  function renderNotebook() {
    var nb = nbData();
    var q = (_nbState.search || '').toLowerCase();
    var notes = nb.notes.slice();

    // Filter
    var filtered = notes.filter(function(n) {
      if (_nbState.folder && n.folder !== _nbState.folder) return false;
      if (!q) return true;
      return (n.title || '').toLowerCase().indexOf(q) >= 0 || (n.body || '').toLowerCase().indexOf(q) >= 0;
    });
    filtered.sort(function(a, b) {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.updated || '') > (a.updated || '') ? 1 : -1;
    });

    var pinned = filtered.filter(function(n) { return n.pinned; });
    var recent = filtered.filter(function(n) { return !n.pinned; });

    // Sidebar
    var sidebarHTML = '<div class="nb-sidebar">' +
      '<div class="nb-search"><input type="text" id="nb-search" placeholder="\ud83d\udd0d Rechercher..." value="' + esc(_nbState.search) + '"></div>';

    if (pinned.length) {
      sidebarHTML += '<div class="nb-group"><div class="nb-group-title">\ud83d\udccc \u00c9PINGL\u00c9ES <span>' + pinned.length + '</span></div>';
      pinned.forEach(function(n) { sidebarHTML += nbSidebarItem(n); });
      sidebarHTML += '</div>';
    }
    if (recent.length) {
      sidebarHTML += '<div class="nb-group"><div class="nb-group-title">R\u00c9CENTES <span>' + recent.length + '</span></div>';
      recent.slice(0, 10).forEach(function(n) { sidebarHTML += nbSidebarItem(n); });
      sidebarHTML += '</div>';
    }

    sidebarHTML += '<div class="nb-group"><div class="nb-group-title">DOSSIERS <span>' + nb.folders.length + '</span>' +
      '<button class="nb-add-folder" id="nb-add-folder" title="Nouveau dossier">+</button></div>';
    sidebarHTML += '<div class="nb-folder' + (!_nbState.folder ? ' active' : '') + '" data-folder="">\ud83d\udcc1 Toutes <span>' + nb.notes.length + '</span></div>';
    nb.folders.forEach(function(f) {
      var count = nb.notes.filter(function(n) { return n.folder === f; }).length;
      sidebarHTML += '<div class="nb-folder' + (_nbState.folder === f ? ' active' : '') + '" data-folder="' + esc(f) + '">\ud83d\udcc2 ' + esc(f) + ' <span>' + count + '</span></div>';
    });
    sidebarHTML += '</div></div>';

    // Main area
    var mainHTML = '<div class="nb-main">';
    if (_nbState.openNote) {
      var note = nb.notes.filter(function(n) { return n.id === _nbState.openNote; })[0];
      if (note) {
        if (_nbState.editing) {
          mainHTML += '<div class="nb-editor">' +
            '<div class="nb-editor-head">' +
            '<input type="text" id="nb-title" class="nb-title-input" value="' + esc(note.title) + '" placeholder="Titre de la note">' +
            '<select id="nb-folder" class="nb-folder-sel">' +
            '<option value="">Sans dossier</option>' +
            nb.folders.map(function(f) { return '<option value="' + esc(f) + '"' + (note.folder === f ? ' selected' : '') + '>' + esc(f) + '</option>'; }).join('') +
            '</select>' +
            '</div>' +
            '<textarea id="nb-body" class="nb-body-input" placeholder="\u00c9crivez votre note ici...\n\nAstuce : utilisez - pour une liste, # pour un titre">' + esc(note.body) + '</textarea>' +
            '<div class="nb-attach-bar">' +
            '<button class="btn sm" id="nb-img-file">\ud83d\uddbc Image</button>' +
            '<button class="btn sm" id="nb-img-url">\ud83d\udd17 Lien TradingView</button>' +
            '<button class="btn sm" id="nb-rec">\ud83c\udf99 Note vocale</button>' +
            '<span class="muted small" id="nb-rec-status"></span>' +
            '<input type="file" id="nb-file" accept="image/*" hidden>' +
            '</div>' +
            nbAttachHTML(note, true) +
            '<div class="nb-editor-actions">' +
            '<button class="btn" id="nb-cancel">Annuler</button>' +
            '<button class="btn primary" id="nb-save">Enregistrer</button>' +
            '</div></div>';
        } else {
          mainHTML += '<div class="nb-view">' +
            '<div class="nb-view-head">' +
            '<div><h2>' + nbIcon(note) + ' ' + esc(note.title) + '</h2>' +
            '<div class="nb-meta">' + (note.folder ? '\ud83d\udcc2 ' + esc(note.folder) + ' \u00b7 ' : '') + 'Modifi\u00e9e ' + nbTimeAgo(note.updated) + '</div></div>' +
            '<div class="nb-view-actions">' +
            '<button class="btn sm" id="nb-pin" title="\u00c9pingler">' + (note.pinned ? '\ud83d\udccc' : '\ud83d\udccd') + '</button>' +
            '<button class="btn sm" id="nb-edit">\u270f\ufe0f Modifier</button>' +
            '<button class="btn sm" id="nb-copy" title="Copier vers l\'autre journal">\ud83d\udccb Copier</button>' +
            '<button class="btn sm" id="nb-dup" title="Dupliquer ici">\u29c9</button>' +
            '<button class="btn sm danger" id="nb-delete">\ud83d\uddd1</button>' +
            '</div></div>' +
            '<div class="nb-content">' + nbRenderBody(note.body) + '</div>' +
            nbAttachHTML(note, false) +
            '</div>';
        }
      }
    } else {
      // Grid view
      var clip = nbClipPeek();
      mainHTML += '<div class="nb-grid-head"><h2>' + (_nbState.folder ? '\ud83d\udcc2 ' + esc(_nbState.folder) : 'Toutes les notes') + '</h2>' +
        '<div style="display:flex;gap:6px;align-items:center">' +
        (clip ? '<button class="btn" id="nb-paste" title="Coller la note copi\u00e9e">\ud83d\udccb Coller \u00ab ' + esc((clip.note.title || 'Sans titre').slice(0, 24)) + ' \u00bb</button>' : '') +
        '<button class="btn primary" id="nb-new">+ Nouvelle note</button></div></div>';
      if (!filtered.length) {
        mainHTML += '<div class="nb-empty">Aucune note. Cliquez sur \u00ab + Nouvelle note \u00bb pour commencer.</div>';
      } else {
        mainHTML += '<div class="nb-grid">';
        filtered.forEach(function(n) {
          var preview = (n.body || '').split('\n').slice(0, 4).join('\n').slice(0, 150);
          mainHTML += '<div class="nb-card" data-id="' + n.id + '">' +
            (n.pinned ? '<span class="nb-pin-badge">\ud83d\udccc</span>' : '') +
            '<div class="nb-card-title">' + nbIcon(n) + ' ' + esc(n.title || 'Sans titre') + '</div>' +
            '<div class="nb-card-preview">' + esc(preview) + '</div>' +
            nbCardBadges(n) +
            '<div class="nb-card-meta">' + (n.folder ? esc(n.folder) + ' \u00b7 ' : '') + nbTimeAgo(n.updated) + '</div>' +
            '</div>';
        });
        mainHTML += '</div>';
      }
    }
    mainHTML += '</div>';

    $('#main').innerHTML =
      '<div class="nb-header"><h1>\ud83d\udcd3 Notebook</h1>' +
      '<span class="muted small">Think before you trade. Review before you repeat.</span></div>' +
      '<div class="nb-layout">' + sidebarHTML + mainHTML + '</div>';

    // Events
    var si = $('#nb-search');
    if (si) {
      si.oninput = function() { _nbState.search = si.value; var pos = si.selectionStart; renderNotebook(); var ns = $('#nb-search'); if (ns) { ns.focus(); ns.setSelectionRange(pos, pos); } };
    }
    document.querySelectorAll('.nb-folder').forEach(function(el) {
      el.onclick = function() { _nbState.folder = el.dataset.folder || null; _nbState.openNote = null; renderNotebook(); };
    });
    document.querySelectorAll('.nb-item, .nb-card').forEach(function(el) {
      el.onclick = function() { _nbState.openNote = el.dataset.id; _nbState.editing = false; renderNotebook(); };
    });
    var nbNew = $('#nb-new');
    if (nbNew) nbNew.onclick = function() {
      var n = { id: nbNewId(), title: '', body: '', folder: _nbState.folder || '', pinned: false, created: new Date().toISOString(), updated: new Date().toISOString() };
      nbData().notes.unshift(n);
      _nbState.openNote = n.id; _nbState.editing = true;
      renderNotebook();
    };
    var nbCopy = $('#nb-copy');
    if (nbCopy) nbCopy.onclick = function() {
      var n = nbCurrentNote();
      if (n) { nbCopyToClip(n); renderNotebook(); }
    };
    var nbDup = $('#nb-dup');
    if (nbDup) nbDup.onclick = async function() {
      var n = nbCurrentNote();
      if (!n) return;
      var copy = JSON.parse(JSON.stringify(n));
      copy.id = nbNewId(); copy.pinned = false;
      copy.title = (copy.title || 'Sans titre') + ' (copie)';
      copy.created = copy.updated = new Date().toISOString();
      nbData().notes.unshift(copy);
      _nbState.openNote = copy.id; _nbState.editing = false;
      if (await save('Note dupliqu\u00e9e')) renderNotebook(); else renderNotebook();
    };
    var nbPaste = $('#nb-paste');
    if (nbPaste) nbPaste.onclick = async function() {
      var clip = nbClipPeek();
      if (!clip) { toast('Rien \u00e0 coller'); return; }
      var n = nbPasteNote(clip);
      _nbState.openNote = n.id; _nbState.editing = false;
      if (await save('Note coll\u00e9e depuis ' + (clip.from || 'l\'autre journal'))) renderNotebook(); else renderNotebook();
    };
    var nbEdit = $('#nb-edit');
    if (nbEdit) nbEdit.onclick = function() { _nbState.editing = true; renderNotebook(); };
    var nbCancel = $('#nb-cancel');
    if (nbCancel) nbCancel.onclick = function() {
      var note = nbData().notes.filter(function(n) { return n.id === _nbState.openNote; })[0];
      if (note && !note.title && !note.body) {
        nbData().notes = nbData().notes.filter(function(n) { return n.id !== _nbState.openNote; });
        _nbState.openNote = null;
      }
      _nbState.editing = false; renderNotebook();
    };
    var nbSave = $('#nb-save');
    if (nbSave) nbSave.onclick = async function() {
      var note = nbData().notes.filter(function(n) { return n.id === _nbState.openNote; })[0];
      if (note) {
        note.title = $('#nb-title').value.trim() || 'Sans titre';
        note.body = $('#nb-body').value;
        note.folder = $('#nb-folder').value;
        note.updated = new Date().toISOString();
        if (await save('Note enregistr\u00e9e')) { _nbState.editing = false; }
        renderNotebook();
      }
    };
    var nbPin = $('#nb-pin');
    if (nbPin) nbPin.onclick = async function() {
      var note = nbData().notes.filter(function(n) { return n.id === _nbState.openNote; })[0];
      if (note) { note.pinned = !note.pinned; note.updated = new Date().toISOString(); if (await save(note.pinned ? '\u00c9pingl\u00e9e' : 'D\u00e9sepingl\u00e9e')) renderNotebook(); }
    };
    var nbDel = $('#nb-delete');
    if (nbDel) nbDel.onclick = async function() {
      if (!confirm('Supprimer cette note ?')) return;
      nbData().notes = nbData().notes.filter(function(n) { return n.id !== _nbState.openNote; });
      _nbState.openNote = null;
      if (await save('Note supprim\u00e9e')) renderNotebook();
    };

    // --- attachments ---
    var nbFile = $('#nb-file');
    var nbImgFile = $('#nb-img-file');
    if (nbImgFile) nbImgFile.onclick = function() { nbFile.click(); };
    if (nbFile) nbFile.onchange = function() {
      var f = nbFile.files && nbFile.files[0];
      if (!f) return;
      if (f.size > 1500000) { alert('Image trop lourde (max ~1,5 Mo). R\u00e9duisez-la avant de l\u2019ajouter.'); return; }
      var rd = new FileReader();
      rd.onload = function() {
        nbCurrentNote().attachments = nbCurrentNote().attachments || [];
        nbCurrentNote().attachments.push({ type: 'image', src: rd.result, name: f.name });
        nbKeepDraft(); renderNotebook();
      };
      rd.readAsDataURL(f);
    };
    var nbImgUrl = $('#nb-img-url');
    if (nbImgUrl) nbImgUrl.onclick = function() {
      var u = prompt('Collez le lien TradingView (ou l\u2019URL d\u2019une image) :');
      if (!u) return;
      var raw = u.trim();
      var src = S.imageUrl ? S.imageUrl(raw) : raw;
      nbCurrentNote().attachments = nbCurrentNote().attachments || [];
      nbCurrentNote().attachments.push({ type: 'image', src: src, url: raw, name: 'TradingView' });
      nbKeepDraft(); renderNotebook();
    };
    var nbRec = $('#nb-rec');
    if (nbRec) nbRec.onclick = function() { nbToggleRecording(); };
    document.querySelectorAll('.nb-att-del').forEach(function(b) {
      b.onclick = function(e) {
        e.stopPropagation();
        var n = nbCurrentNote();
        n.attachments.splice(+b.dataset.i, 1);
        nbKeepDraft(); renderNotebook();
      };
    });
    document.querySelectorAll('.nb-att-img img').forEach(function(im) {
      im.onclick = function() {
        var n = nbCurrentNote();
        if (!n) return;
        var imgs = (n.attachments || []).filter(function(x) { return x.type === 'image'; })
          .map(function(x) { return { src: x.src, url: x.url || '', label: x.name || 'Image' }; });
        if (!imgs.length) return;
        openLightbox(imgs, +im.dataset.img || 0);
      };
    });

    var nbAddF = $('#nb-add-folder');
    if (nbAddF) nbAddF.onclick = async function(e) {
      e.stopPropagation();
      var name = prompt('Nom du nouveau dossier :');
      if (name && name.trim()) {
        nbData().folders.push(name.trim());
        if (await save('Dossier cr\u00e9\u00e9')) renderNotebook();
      }
    };
  }


  function nbCardBadges(n) {
    var a = n.attachments || [];
    if (!a.length) return '';
    var imgs = a.filter(function(x) { return x.type === 'image'; });
    var auds = a.filter(function(x) { return x.type === 'audio'; });
    var h = '';
    if (imgs.length) h += '<div class="nb-card-thumb">' + imgs.slice(0, 3).map(function(x) { return '<img src="' + esc(x.src) + '" loading="lazy">'; }).join('') + '</div>';
    var bits = [];
    if (imgs.length) bits.push('\ud83d\uddbc ' + imgs.length);
    if (auds.length) bits.push('\ud83c\udf99 ' + auds.length);
    if (bits.length) h += '<div class="nb-card-badges">' + bits.join(' \u00b7 ') + '</div>';
    return h;
  }


  /* --- presse-papier de notes, partagé entre les deux journaux (même domaine) --- */
  var NB_CLIP = 'nb_clipboard_v1';
  function nbClipPeek() {
    try {
      var raw = localStorage.getItem(NB_CLIP);
      if (!raw) return null;
      var o = JSON.parse(raw);
      return (o && o.note && o.note.title !== undefined) ? o : null;
    } catch (e) { return null; }
  }
  function nbCopyToClip(note) {
    var copy = JSON.parse(JSON.stringify(note));
    delete copy.id;
    var payload = { from: (DB.meta && DB.meta.name) || 'Journal', at: new Date().toISOString(), note: copy };
    var txt = JSON.stringify(payload);
    try {
      localStorage.setItem(NB_CLIP, txt);
    } catch (e) {
      // quota exceeded: retry without the attachments
      var light = JSON.parse(JSON.stringify(payload));
      light.note.attachments = [];
      light.stripped = true;
      try { localStorage.setItem(NB_CLIP, JSON.stringify(light)); } catch (e2) {
        alert('Note trop volumineuse pour \u00eatre copi\u00e9e.'); return false;
      }
      toast('Note copi\u00e9e sans les pi\u00e8ces jointes (trop volumineuses)', 6000);
      return true;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).catch(function() {});
    }
    var nAtt = (copy.attachments || []).length;
    toast('Note copi\u00e9e' + (nAtt ? ' avec ' + nAtt + ' pi\u00e8ce(s) jointe(s)' : '') + ' \u2014 collez-la dans l\'autre journal', 6000);
    return true;
  }
  function nbPasteNote(payload) {
    var src = payload.note;
    var n = JSON.parse(JSON.stringify(src));
    n.id = nbNewId();
    n.pinned = false;
    n.created = new Date().toISOString();
    n.updated = new Date().toISOString();
    var nb = nbData();
    // keep the folder only if it exists here, otherwise create it
    if (n.folder && nb.folders.indexOf(n.folder) < 0) nb.folders.push(n.folder);
    // avoid a confusing duplicate title inside the same journal
    var sameTitle = nb.notes.filter(function(x) { return x.title === n.title; }).length;
    if (sameTitle) n.title = n.title + ' (copie)';
    nb.notes.unshift(n);
    return n;
  }

  function nbCurrentNote() {
    return nbData().notes.filter(function(n) { return n.id === _nbState.openNote; })[0];
  }
  function nbKeepDraft() {
    // keep what is typed in the editor when the view re-renders
    var t = $('#nb-title'), b = $('#nb-body'), f = $('#nb-folder'), n = nbCurrentNote();
    if (n && t) { n.title = t.value; n.body = b.value; n.folder = f.value; }
  }
  function nbAttachHTML(note, editable) {
    var a = note.attachments || [];
    if (!a.length) return '';
    var html = '<div class="nb-attachments">';
    var imgIdx = 0;
    a.forEach(function(att, i) {
      var del = editable ? '<button class="nb-att-del" data-i="' + i + '" title="Supprimer">\u00d7</button>' : '';
      if (att.type === 'image') {
        html += '<div class="nb-att nb-att-img">' + del +
          '<img src="' + esc(att.src) + '" alt="' + esc(att.name || '') + '" loading="lazy" data-img="' + imgIdx + '" onerror="this.classList.add(\'nb-img-broken\')">' +
          '<div class="nb-img-fallback">\u26a0 Image inaccessible' +
          (att.url ? ' \u2014 <a href="' + esc(att.url) + '" target="_blank" rel="noopener noreferrer">ouvrir le lien</a>' : '') +
          '</div></div>';
        imgIdx++;
      } else if (att.type === 'audio') {
        html += '<div class="nb-att nb-att-audio">' + del +
          '<div class="nb-audio-label">\ud83c\udf99 ' + esc(att.name || 'Note vocale') + ' <span class="muted">' + esc(att.dur || '') + '</span></div>' +
          '<audio controls preload="none" src="' + esc(att.src) + '"></audio></div>';
      }
    });
    return html + '</div>';
  }

  /* --- voice notes --- */
  var _nbRec = null, _nbChunks = [], _nbRecStart = 0, _nbRecTimer = null;
  function nbToggleRecording() {
    var btn = $('#nb-rec'), st = $('#nb-rec-status');
    if (_nbRec && _nbRec.state === 'recording') { _nbRec.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      alert('L\u2019enregistrement audio n\u2019est pas disponible dans ce navigateur.'); return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
      _nbChunks = [];
      _nbRec = new MediaRecorder(stream);
      _nbRec.ondataavailable = function(e) { if (e.data.size) _nbChunks.push(e.data); };
      _nbRec.onstop = function() {
        stream.getTracks().forEach(function(t) { t.stop(); });
        clearInterval(_nbRecTimer);
        var secs = Math.round((Date.now() - _nbRecStart) / 1000);
        var blob = new Blob(_nbChunks, { type: _nbChunks[0] ? _nbChunks[0].type : 'audio/webm' });
        if (blob.size > 2000000) { alert('Note vocale trop longue (max ~2 Mo, environ 2 minutes).'); return; }
        var rd = new FileReader();
        rd.onload = function() {
          var n = nbCurrentNote();
          n.attachments = n.attachments || [];
          n.attachments.push({ type: 'audio', src: rd.result,
            name: 'Note vocale ' + new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
            dur: Math.floor(secs / 60) + ':' + ('0' + (secs % 60)).slice(-2) });
          nbKeepDraft(); renderNotebook();
        };
        rd.readAsDataURL(blob);
      };
      _nbRec.start();
      _nbRecStart = Date.now();
      if (btn) { btn.textContent = '\u23f9 Arr\u00eater'; btn.classList.add('danger'); }
      _nbRecTimer = setInterval(function() {
        var s2 = $('#nb-rec-status');
        if (!s2) return;
        var secs = Math.round((Date.now() - _nbRecStart) / 1000);
        s2.textContent = '\u25cf Enregistrement ' + Math.floor(secs / 60) + ':' + ('0' + (secs % 60)).slice(-2);
        if (secs >= 120 && _nbRec && _nbRec.state === 'recording') _nbRec.stop();
      }, 500);
    }).catch(function(err) {
      alert('Micro inaccessible : ' + err.message + '\n\nAutorisez le micro pour ce site dans les param\u00e8tres du navigateur.');
    });
  }

  function nbSidebarItem(n) {
    var preview = (n.body || '').replace(/\n/g, ' ').slice(0, 45);
    return '<div class="nb-item' + (_nbState.openNote === n.id ? ' active' : '') + '" data-id="' + n.id + '">' +
      '<div class="nb-item-title">' + nbIcon(n) + ' ' + esc(n.title || 'Sans titre') + '</div>' +
      '<div class="nb-item-preview">' + esc(preview) + '</div>' +
      '<div class="nb-item-time">' + nbTimeAgo(n.updated) + '</div></div>';
  }

  function nbRenderBody(body) {
    if (!body) return '<p class="muted">Note vide.</p>';
    var lines = body.split('\n');
    var html = '';
    var inList = false;
    lines.forEach(function(line) {
      var t = line.trim();
      if (t.indexOf('- [ ] ') === 0 || t.indexOf('- [x] ') === 0) {
        if (!inList) { html += '<ul class="nb-checklist">'; inList = true; }
        var checked = t.indexOf('- [x] ') === 0;
        html += '<li>' + (checked ? '\u2611' : '\u2610') + ' ' + esc(t.slice(6)) + '</li>';
      } else if (t.indexOf('- ') === 0 || t.indexOf('* ') === 0) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += '<li>' + esc(t.slice(2)) + '</li>';
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        if (t.indexOf('### ') === 0) html += '<h4>' + esc(t.slice(4)) + '</h4>';
        else if (t.indexOf('## ') === 0) html += '<h3>' + esc(t.slice(3)) + '</h3>';
        else if (t.indexOf('# ') === 0) html += '<h2>' + esc(t.slice(2)) + '</h2>';
        else if (!t) html += '<br>';
        else html += '<p>' + esc(t) + '</p>';
      }
    });
    if (inList) html += '</ul>';
    return html;
  }



  /* ================= V3 : données fiables, gel pré-entrée, analyse, backtest vs live ================= */
  const IS_BT = FILE_NAME === 'journal-backtest.json';
  const APP_ID = IS_BT ? 'journal-backtest' : 'journal-trading';
  const OTHER_FILE = IS_BT ? 'journal-trading.json' : 'journal-backtest.json';
  const DEF_LISTS = {
    setups: ['London Sweep Asia', 'NY Sweep Asia', 'London Continuation', 'NY Continuation'],
    management: ['Set and Forget', 'Set and Watch', 'TP repositionné', 'SL déplacé au BE', 'Trailing stop', 'Sortie partielle', 'Time stop'],
    execPoi: ['SND', 'FVG', 'OB'],
    exitTypes: ['TP atteint', 'SL touché', 'Breakeven', 'Sortie manuelle', 'Sortie partielle', 'Time stop'],
    mistakeTags: ['FOMO / entrée impulsive', 'Mauvaise lecture de structure (sweep ≠ BOS/MS)', 'Contre le biais / la direction HTF', 'Pas attendu le sweep de liquidité', 'POI / setup de faible qualité', 'Entrée trop tôt (sans confirmation)', 'SL trop serré / sans buffer', 'TP mal placé / déplacé / sortie anticipée', 'News ignorée', 'Routine pré-market non faite', 'Overtrade / revenge / garde-fous', 'Scaling / ajout de position'],
    emotions: ['Calme', 'Confiant', 'Patient', 'Concentré', 'Anxieux', 'Impatient', 'Euphorique', 'Frustré', 'Peur', 'Doute'],
  };
  const lst = k => (DB && DB.lists && DB.lists[k] && DB.lists[k].length) ? DB.lists[k] : (DEF_LISTS[k] || []);
  const vOr = v => v === null || v === undefined ? '' : v;
  const isSet = v => v !== null && v !== undefined && v !== '';
  /* liste fermée : une ancienne valeur hors liste reste affichée (marquée) pour ne rien perdre */
  function closedOpts(arr, v, blank) {
    let h = `<option value="">${esc(blank || '—')}</option>` + arr.map(x => `<option value="${esc(x)}"${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('');
    if (isSet(v) && arr.indexOf(v) < 0) h += `<option value="${esc(v)}" selected>${esc(v)} (ancienne valeur)</option>`;
    return h;
  }
  const takenT = t => !IS_BT || !S.taken || S.taken(t);

  /* ---- heures, durée, killzone automatique ---- */
  const toMin = s => { const m = /^(\d{1,2}):?(\d{2})$/.exec(String(s || '').trim()); return m && +m[1] < 24 && +m[2] < 60 ? (+m[1]) * 60 + (+m[2]) : null; };
  const fmtHM = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  function durationOf(a, b) { const x = toMin(a), y = toMin(b); if (x === null || y === null) return ''; let d = y - x; if (d < 0) d += 1440; return fmtHM(d); }
  function killzoneAt(time) {
    const m = toMin(time); if (m === null) return null;
    const kz = getGuardrails().killzones || {}; if (kz.enabled === false) return null;
    const act = (kz.sessions || []).filter(s => s.active); if (!act.length) return null;
    for (const s of act) {
      const a = toMin(s.from), b = toMin(s.to); if (a === null || b === null) continue;
      if (a <= b ? (m >= a && m < b) : (m >= a || m < b)) return { inKz: true, name: s.name };
    }
    return { inKz: false, name: '' };
  }
  function sessionKz(session) {
    const kz = getGuardrails().killzones || {}; if (kz.enabled === false) return null;
    const act = (kz.sessions || []).filter(s => s.active); if (!act.length || !session) return null;
    return act.some(s => s.name.toLowerCase() === String(session).toLowerCase().trim());
  }
  /* un trade est-il dans une killzone ? heure d'entrée d'abord, sinon nom de session */
  function tradeInKz(t) { const k = killzoneAt(t.entryTime); if (k) return k.inKz; const s = sessionKz(t.session); return s === null ? true : s; }

  /* ---- normalisation (nettoyage + comparaisons) ---- */
  function normMgmt(v) {
    const s = String(v || '').trim(), l = s.toLowerCase(); if (!s) return '';
    if (/set\s*(and|ad|&)?\s*forg/.test(l)) return 'Set and Forget';
    if (/set\s*(and|ad|&)?\s*watch/.test(l)) return 'Set and Watch';
    if (/tp\s*reposit/.test(l)) return 'TP repositionné';
    if (/trail/.test(l)) return 'Trailing stop';
    if (/time\s*stop/.test(l)) return 'Time stop';
    if (/partiel|partial/.test(l)) return 'Sortie partielle';
    if (/\bbe\b|break.?even/.test(l)) return 'SL déplacé au BE';
    return s;
  }
  function mapSetup(setup, session) {
    const l = String(setup || '').toLowerCase().trim(), s = String(session || '').toLowerCase().trim();
    if (!l || DEF_LISTS.setups.some(x => x.toLowerCase() === l)) return null;
    const ses = s === 'london' ? 'London' : s === 'ny' ? 'NY' : null;
    if (!ses) return null;
    if (/^rev/.test(l)) return ses + ' Sweep Asia';
    if (/^cont/.test(l)) return ses + ' Continuation';
    return null;
  }
  const TYPOS = { instrument: { GDPUSD: 'GBPUSD' }, entry: { Agressive: 'Aggressive' }, tp: { Structue: 'Structure', Sz: 'SZ' }, setup: { Reveesal: 'Reversal' } };
  const TAG_RULES = [
    [/fomo|rush|précipit|impuls/i, 0], [/structure|sweep not|sweep lot|not a (clear )?[^,]{0,4}ms|false 5|not bos|inducement|wrong analysis/i, 1],
    [/direction|htf/i, 2], [/wait for liquidity|liquidity remaining|liquidity sweep,/i, 3], [/poi|mauvaise qualit|avoid the kind|double top/i, 4],
    [/too early|confirmation|timing/i, 5], [/sl too tight|buffer/i, 6], [/tp|exit/i, 7], [/news/i, 8], [/routine|pre-market/i, 9],
    [/overtrade|revenge|guardrail/i, 10], [/scaling/i, 11],
  ];
  function suggestTags(text) { const out = []; TAG_RULES.forEach(([re, i]) => { if (re.test(text || '') && out.indexOf(DEF_LISTS.mistakeTags[i]) < 0) out.push(DEF_LISTS.mistakeTags[i]); }); return out; }

  /* ---- multi-sélection générique (même rendu que « Guardrails broken ») ---- */
  function msField(id, title, items, sel, empty) {
    sel = sel || []; items = items.slice(); sel.forEach(k => { if (items.indexOf(k) < 0) items.push(k); });
    return `<div class="ms-field"><span class="ms-title">${esc(title)}</span><details class="ms" id="${id}"><summary>${esc(sel.length ? sel.join(', ') : empty)}</summary><div class="ms-list">` +
      items.map(i => `<label class="ms-opt"><input type="checkbox" value="${esc(i)}"${sel.indexOf(i) >= 0 ? ' checked' : ''}> ${esc(i)}</label>`).join('') + '</div></details></div>';
  }
  function msWire(id, empty) {
    const box = document.getElementById(id); if (!box) return;
    const sum = box.querySelector('summary');
    box.querySelectorAll('input[type=checkbox]').forEach(cb => cb.onchange = () => { const k = msValue(id); sum.textContent = k.length ? k.join(', ') : empty; });
  }
  function msValue(id) { const box = document.getElementById(id); return box ? Array.prototype.map.call(box.querySelectorAll('input:checked'), x => x.value) : null; }

  /* ---- checklist figée (écrite par checklist.html, même navigateur) ---- */
  const SNAP_KEY = 'checklist_frozen_v1:' + APP_ID;
  function pendingSnap() { try { const s = JSON.parse(localStorage.getItem(SNAP_KEY)); if (s && !s.used && s.date === todayISO()) return s; } catch (e) {} return null; }
  function markSnapUsed(n) { try { const s = JSON.parse(localStorage.getItem(SNAP_KEY)); if (s) { s.used = n; localStorage.setItem(SNAP_KEY, JSON.stringify(s)); } } catch (e) {} }
  const PRE_FIELDS = [['setup', 'Setup'], ['execPoi', 'POI d\'exécution'], ['bias', 'Bias alignment'], ['poi', 'POI haute probabilité'], ['sweep', 'Liquidity sweep + Market Shift'], ['fomo', 'FOMO / impulsion']];
  const fmtStamp = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

  /* ---- champs ajoutés au formulaire ---- */
  function emoField(key, label, t) {
    const old = key === 'Entry' ? t.entryEmotion : key === 'Exit' ? t.exitEmotion : '';
    return `<div class="emo-field"><span class="ms-title">${label}${old ? ` <span class="muted">(ancien : ${esc(old)})</span>` : ''}</span>
      <div class="emo-row"><select id="f-emo${key}">${closedOpts(lst('emotions'), t['emo' + key] || '', '— état —')}</select>
      <select id="f-emo${key}Lvl" title="Intensité 1 (faible) à 5 (très forte)">${closedOpts(['1', '2', '3', '4', '5'], isSet(t['emo' + key + 'Lvl']) ? String(t['emo' + key + 'Lvl']) : '', 'Intensité')}</select></div>
      <input id="f-emo${key}Note" placeholder="Préciser (facultatif)…" value="${esc(t['emo' + key + 'Note'] || '')}"></div>`;
  }
  function v3ExecFieldset(t, isNew) {
    const snap = isNew ? pendingSnap() : null;
    const lockInfo = !isNew && t.preLockedAt ? `<div class="lockbar" id="f-lockbar">${lockLabel(t)}${t.preEdits && t.preEdits.length ? ` · modifiés après coup ${t.preEdits.length} fois` : ''} <button type="button" class="btn" id="f-unlock">Déverrouiller</button></div>` : '';
    return `${snap ? `<label class="snap-box"><input type="checkbox" id="f-attachSnap" checked> 📌 Joindre la checklist figée à <b>${esc(snap.time)}</b> : ${snap.done}/${snap.total} points cochés (${pct(snapRate(snap))}) · ${esc(snap.planName || 'plan')}. L'heure de verrouillage sera ${esc(snap.time)}.</label>` : ''}
      ${lockInfo}
      <fieldset><legend>Exécution</legend><div class="row">
        <label>Setup<select id="f-setup">${closedOpts(lst('setups'), t.setup || '')}</select></label>
        <label>POI d'exécution<select id="f-execPoi">${closedOpts(lst('execPoi'), t.execPoi || '')}</select></label>
        <label>Heure d'entrée<input id="f-entryTime" type="time" value="${esc(t.entryTime || (snap ? snap.time : ''))}"></label>
        <label>Heure de sortie<input id="f-exitTime" type="time" value="${esc(t.exitTime || '')}"></label>
        <div class="kz-ind" id="f-kzind"></div>
        <label>R prévu (TP initial)<input id="f-plannedR" type="number" step="0.01" value="${esc(vOr(t.plannedR))}" placeholder="ex. 3"></label>
        <label>Type de sortie<select id="f-exitType">${closedOpts(lst('exitTypes'), t.exitType || '')}</select></label>
        <label>Taille du SL (pips)<input id="f-slPips" type="number" step="0.1" min="0" value="${esc(vOr(t.slPips))}" placeholder="ex. 8"></label>
        <label>MAE (pips contre toi)<input id="f-maePips" type="number" step="0.1" min="0" value="${esc(vOr(isSet(t.maePips) ? t.maePips : (isSet(t.slPips) ? '' : t.mae)))}" placeholder="ex. 5"></label>
        <label>MFE (pips en ta faveur)<input id="f-mfePips" type="number" step="0.1" min="0" value="${esc(vOr(isSet(t.mfePips) ? t.mfePips : (isSet(t.slPips) ? '' : t.mfe)))}" placeholder="ex. 30"></label>
        <div class="kz-ind" id="f-rconv"></div>
      </div><p class="muted small">Killzone contrôlée automatiquement avec l'heure d'entrée (fenêtres de l'onglet Guardrails, même fuseau). MAE = recul maximal contre la position, MFE = avance maximale en ta faveur, en pips : la conversion en R se fait avec la taille du SL.</p></fieldset>`;
  }
  function v3MistakesField(t) { const nk = x => !/hors\s*kill/i.test(x); return msField('f-mtags', 'Erreurs (tags)', lst('mistakeTags').filter(nk), (t.mistakeTags || []).filter(nk), 'Aucune'); }
  function v3EmotionsFieldset(t) {
    if (IS_BT) return '';
    return `<fieldset><legend>Émotions (état + intensité 1–5)</legend><div class="row emo-grid">${emoField('Entry', 'À l\'entrée', t)}${emoField('During', 'Pendant le trade', t)}${emoField('Exit', 'À la sortie', t)}</div></fieldset>`;
  }
  function v3Wire(t, isNew) {
    msWire('f-mtags', 'Aucune');
    $('#modal').addEventListener('click', e => { document.querySelectorAll('#modal details.ms[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; }); });
    const upd = () => {
      const el = $('#f-kzind'); if (!el) return;
      const k = killzoneAt($('#f-entryTime').value), d = durationOf($('#f-entryTime').value, $('#f-exitTime').value);
      el.innerHTML = (k ? (k.inKz ? `<span class="badge Win">✓ Killzone ${esc(k.name)}</span>` : '<span class="badge Loss">✗ Hors killzone</span>') : '<span class="muted small">Killzone : saisis l\'heure d\'entrée</span>') + (d ? ` <span class="muted small">Durée ${d}</span>` : '');
    };
    ['#f-entryTime', '#f-exitTime'].forEach(s => $(s) && $(s).addEventListener('input', upd)); upd();
    const conv = () => { const el = $('#f-rconv'); if (!el) return; const sl = +$('#f-slPips').value, a = $('#f-maePips').value, b = $('#f-mfePips').value;
      el.innerHTML = sl > 0 ? `<span class="muted small">≈ MAE ${a === '' ? '–' : num(a / sl) + ' R'} · MFE ${b === '' ? '–' : num(b / sl) + ' R'}</span>` : ((a !== '' || b !== '') ? '<span class="badge Loss">Taille du SL requise pour convertir en R</span>' : ''); };
    ['#f-slPips', '#f-maePips', '#f-mfePips'].forEach(s => $(s) && $(s).addEventListener('input', conv)); conv();
    if (!isNew && t.preLockedAt) {
      PRE_FIELDS.forEach(([k]) => { const el = $('#f-' + k); if (el) el.disabled = true; });
      $('#f-unlock').onclick = () => {
        if (!confirm('Modifier les critères pré-entrée après coup ?\nLa modification sera enregistrée (date + valeurs d\'origine conservées) et le trade sera signalé dans l\'onglet Analyse.')) return;
        PRE_FIELDS.forEach(([k]) => { const el = $('#f-' + k); if (el) el.disabled = false; });
        $('#f-lockbar').classList.add('open'); $('#f-unlock').remove();
      };
    }
  }
  function v3Validate() {
    for (const id of ['plannedR', 'slPips', 'maePips', 'mfePips']) { const el = $('#f-' + id); if (el && el.value.trim() !== '' && !Number.isFinite(+el.value)) return 'Valeur numérique invalide (' + id + ').'; }
    for (const id of ['entryTime', 'exitTime']) { const el = $('#f-' + id); if (el && el.value.trim() !== '' && toMin(el.value) === null) return 'Heure invalide (hh:mm).'; }
    return '';
  }
  /* valeurs V3 à fusionner dans le trade enregistré ; `base` = trade déjà reconstruit par le formulaire */
  function v3Collect(t, isNew, base) {
    const g = id => { const el = document.getElementById('f-' + id); return el ? el.value.trim() : (t[id] === null || t[id] === undefined ? '' : String(t[id])); };
    const nf = id => { const x = g(id); return x === '' ? null : +x; };
    const o = { entryTime: g('entryTime'), exitTime: g('exitTime'), setup: g('setup'), execPoi: g('execPoi'), exitType: g('exitType'), plannedR: nf('plannedR'), slPips: nf('slPips'), maePips: nf('maePips'), mfePips: nf('mfePips') };
    o.mae = o.slPips > 0 && o.maePips !== null ? +(o.maePips / o.slPips).toFixed(2) : null;
    o.mfe = o.slPips > 0 && o.mfePips !== null ? +(o.mfePips / o.slPips).toFixed(2) : null;
    const tags = msValue('f-mtags'); o.mistakeTags = tags === null ? (t.mistakeTags || []) : tags;
    if (!IS_BT) ['Entry', 'During', 'Exit'].forEach(k => { o['emo' + k] = g('emo' + k); o['emo' + k + 'Lvl'] = g('emo' + k + 'Lvl') === '' ? null : +g('emo' + k + 'Lvl'); o['emo' + k + 'Note'] = g('emo' + k + 'Note'); });
    const d = durationOf(o.entryTime, o.exitTime); if (d) o.duration = d;
    const kz = killzoneAt(o.entryTime);
    if (kz) { o.killzone = kz.inKz ? 'Yes' : 'No'; o.killzoneAuto = 'time'; o.killzoneName = kz.name; }
    else if (isNew || t.killzoneAuto) { const s = sessionKz(base.session); if (s !== null) { o.killzone = s ? 'Yes' : 'No'; o.killzoneAuto = 'session'; o.killzoneName = s ? base.session : ''; } }
    ['preLockedAt', 'preOriginal', 'preEdits', 'checklistSnap', 'entryEmotion', 'exitEmotion', 'style', 'corr1', 'corr2'].forEach(k => { if (t[k] !== undefined && base[k] === undefined) o[k] = t[k]; });
    const now = new Date().toISOString();
    if (isNew) o.preLockedAt = now;
    else if (t.preLockedAt) {
      const cur = Object.assign({}, base, o), changed = PRE_FIELDS.map(p => p[0]).filter(k => String(t[k] || '') !== String(cur[k] || ''));
      if (changed.length) { o.preOriginal = t.preOriginal || Object.fromEntries(PRE_FIELDS.map(([k]) => [k, t[k] || ''])); o.preEdits = (t.preEdits || []).concat([{ at: now, fields: changed }]); }
    }
    const sc = document.getElementById('f-attachSnap');
    if (sc && sc.checked) { const s = pendingSnap(); if (s) { o.checklistSnap = s; o.preLockedAt = s.at; o.preLockedSrc = 'checklist'; markSnapUsed(base.n); } }
    delete o.used;
    return o;
  }
  /* ---- fiche trade : blocs ajoutés ---- */
  function v3Details(t) {
    const D = (l, v) => isSet(v) ? `<div><b>${l}</b>${esc(v)}</div>` : '';
    const emo = k => t['emo' + k] ? t['emo' + k] + (isSet(t['emo' + k + 'Lvl']) ? ' (' + t['emo' + k + 'Lvl'] + '/5)' : '') + (t['emo' + k + 'Note'] ? ' – ' + t['emo' + k + 'Note'] : '') : '';
    const kzTxt = t.killzoneAuto === 'time' ? (t.killzone === 'Yes' ? '✓ ' + (t.killzoneName || 'oui') : '✗ hors killzone') + ' (auto, heure)' : t.killzoneAuto === 'session' ? (t.killzone === 'Yes' ? '✓' : '✗') + ' (auto, session)' : t.killzone;
    let h = ficheBlock(t) + `<div class="details">${D('Heure d\'entrée', t.entryTime)}${D('Heure de sortie', t.exitTime)}${D('Killzone', kzTxt)}${D('Setup', t.setup)}${D('POI d\'exécution', t.execPoi)}${D('R prévu (TP initial)', isSet(t.plannedR) ? sgn(t.plannedR) + ' R' : '')}${D('Type de sortie', t.exitType)}${D('Taille du SL', isSet(t.slPips) ? t.slPips + ' pips' : '')}${D('MAE', isSet(t.maePips) ? t.maePips + ' pips' + (isSet(t.mae) ? ' (' + num(t.mae) + ' R)' : '') : isSet(t.mae) ? num(t.mae) : '')}${D('MFE', isSet(t.mfePips) ? t.mfePips + ' pips' + (isSet(t.mfe) ? ' (' + num(t.mfe) + ' R)' : '') : isSet(t.mfe) ? num(t.mfe) : '')}
      ${IS_BT ? '' : D('Émotion entrée', emo('Entry')) + D('Émotion pendant', emo('During')) + D('Émotion sortie', emo('Exit'))}${D('Erreurs (tags)', (t.mistakeTags || []).join(', '))}</div>`;
    if (t.preLockedAt) h += `<div class="lockbar">${lockLabel(t)}${t.preEdits && t.preEdits.length ? ` · <b>modifiés après coup</b> le ${esc(fmtStamp(t.preEdits[t.preEdits.length - 1].at))} (${esc(t.preEdits.map(e => e.fields.join(', ')).join(' ; '))}) — valeurs d'origine : ${esc(Object.entries(t.preOriginal || {}).map(([k, v]) => k + '=' + (v || '—')).join(', '))}` : ''}</div>`;
    const s = t.checklistSnap;
    if (s) h += `<details class="snap-view"><summary>📌 Checklist figée à ${esc(s.time)} : ${s.done}/${s.total} (${esc(s.planName || '')})</summary><ul>${(s.items || []).map(i => `<li class="${i.done ? 'ok' : 'ko'}">${i.done ? '✓' : '✗'} ${esc(i.text)}${i.note ? `<div class="muted small">${esc(i.note)}</div>` : ''}</li>`).join('')}</ul></details>`;
    return h;
  }

  /* ---- statistiques (tests exacts, Welch) ---- */
  const LF = [0]; for (let i = 1; i <= 6000; i++) LF[i] = LF[i - 1] + Math.log(i);
  function fisherP(a, b, c, d) {
    const n = a + b + c + d, r1 = a + b, c1 = a + c; if (!n || n > 6000) return null;
    const lp = x => LF[r1] + LF[n - r1] + LF[c1] + LF[n - c1] - LF[n] - LF[x] - LF[r1 - x] - LF[c1 - x] - LF[n - r1 - c1 + x];
    const p0 = lp(a); let s = 0;
    for (let x = Math.max(0, c1 - (n - r1)); x <= Math.min(r1, c1); x++) { const l = lp(x); if (l <= p0 + 1e-9) s += Math.exp(l); }
    return Math.min(1, s);
  }
  function vLgamma(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let ser = 1.000000000190015; for (let j = 0; j < 6; j++) ser += c[j] / ++y; return -t + Math.log(2.5066282746310005 * ser / x); }
  function vBetacf(a, b, x) { const F = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < F) d = F; d = 1 / d; let h = d; for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < F) d = F; c = 1 + aa / c; if (Math.abs(c) < F) c = F; d = 1 / d; h *= d * c; aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < F) d = F; c = 1 + aa / c; if (Math.abs(c) < F) c = F; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-15) break; } return h; }
  function vIbeta(x, a, b) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(vLgamma(a + b) - vLgamma(a) - vLgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * vBetacf(a, b, x) / a : 1 - bt * vBetacf(b, a, 1 - x) / b; }
  function welchP(x, y) {
    const n1 = x.length, n2 = y.length; if (n1 < 2 || n2 < 2) return null;
    const m = a => a.reduce((s, v) => s + v, 0) / a.length, v = (a, mu) => a.reduce((s, q) => s + (q - mu) ** 2, 0) / (a.length - 1);
    const m1 = m(x), m2 = m(y), v1 = v(x, m1) / n1, v2 = v(y, m2) / n2; if (v1 + v2 === 0) return m1 === m2 ? 1 : 0;
    const tt = (m1 - m2) / Math.sqrt(v1 + v2), df = (v1 + v2) ** 2 / (v1 * v1 / (n1 - 1) + v2 * v2 / (n2 - 1));
    return vIbeta(df / (df + tt * tt), df / 2, 0.5);
  }
  const fmtP = p => p === null || p === undefined ? '–' : p < 0.001 ? '< 0,001' : p.toFixed(3).replace('.', ',');
  const rets = ts => ts.filter(t => S.filled(t.ret)).map(t => Number(t.ret));
  const meanOf = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  const T975 = df => df < 1 ? NaN : df <= 30 ? [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042][df] : df <= 60 ? 2.0 : 1.96;
  function meanCI(a) { const n = a.length; if (n < 2) return [null, null]; const mu = meanOf(a), sd = Math.sqrt(a.reduce((s, v) => s + (v - mu) ** 2, 0) / (n - 1)), h = T975(n - 1) * sd / Math.sqrt(n); return [mu - h, mu + h]; }

  /* ---- espérance glissante (20 trades) ---- */
  function rollingExp(trades, w) {
    const rs = trades.filter(takenT).filter(t => S.filled(t.ret)).sort((a, b) => (a.date + String(a.n).padStart(6, '0')).localeCompare(b.date + String(b.n).padStart(6, '0'))).map(t => Number(t.ret));
    const pts = [], cum = []; let s = 0;
    rs.forEach((r, i) => { s += r; cum.push([i + 1, s / (i + 1)]); if (i + 1 >= w) pts.push([i + 1, meanOf(rs.slice(i + 1 - w, i + 1))]); });
    return { pts, cum, n: rs.length, last: rs.slice(-w) };
  }
  function e20Pill() {
    if (!DB || !DB.trades) return '';
    const r = rollingExp(DB.trades, 20); if (r.n < 20) return '';
    const e = r.pts[r.pts.length - 1][1];
    return e < 0 ? `<span class="gr-pill gr-pill-danger" title="Espérance des 20 derniers trades négative : ouvre l'onglet Analyse">📉 E20 ${sgn(e)}R</span>` : '';
  }

  /* ---- ONGLET ANALYSE ---- */
  const ERR_DEFS = () => [
    ...lst('mistakeTags').map(tag => ({ key: tag, f: t => (t.mistakeTags || []).indexOf(tag) >= 0 })),
    ...[...new Set(DB.trades.flatMap(t => t.mistakeTags || []))].filter(x => lst('mistakeTags').indexOf(x) < 0).map(tag => ({ key: tag, f: t => (t.mistakeTags || []).indexOf(tag) >= 0 })),
    { key: 'FOMO / impulsion = Yes', f: t => t.fomo === 'Yes' }, { key: 'Plan non suivi', f: t => t.planFollow === 'No' },
    { key: 'Revenge trade', f: t => t.revenge === 'Yes' }, { key: 'Overtrade', f: t => t.overtrade === 'Yes' },
    ...Object.keys(GR_BREAK_NAMES).map(k => ({ key: 'Garde-fou : ' + GR_BREAK_NAMES[k], f: t => (t.guardrailsBroken || []).indexOf(k) >= 0 })),
    { key: 'Hors killzone', f: t => t.killzone === 'No' },
    { key: 'Erreur écrite mais non taguée', f: t => !!(t.mistakes && !(t.mistakeTags || []).length) },
  ];
  const isClean = t => !(t.mistakeTags || []).length && !t.mistakes && t.fomo !== 'Yes' && t.planFollow !== 'No' && t.revenge !== 'Yes' && t.overtrade !== 'Yes' && !(t.guardrailsBroken || []).length;
  function renderAnalysis() {
    const all = DB.trades.filter(takenT).filter(t => S.filled(t.ret));
    const roll = rollingExp(DB.trades, 20), cur = roll.pts.length ? roll.pts[roll.pts.length - 1][1] : null, curCI = meanCI(roll.last);
    const clean = all.filter(isClean), eClean = meanOf(rets(clean));
    const rows = ERR_DEFS().map(d => { const ts = all.filter(d.f), r = rets(ts), e = meanOf(r); return { key: d.key, n: ts.length, wr: ts.length ? r.filter(x => x > 0).length / ts.length : null, net: r.reduce((s, v) => s + v, 0), e, cost: e === null || eClean === null ? null : (eClean - e) * ts.length }; }).filter(r => r.n).sort((a, b) => (b.cost || 0) - (a.cost || 0));
    const maxCost = Math.max(1, ...rows.map(r => Math.abs(r.cost || 0)));
    const g = fn => S.groupBy(all, fn);
    const withPlan = all.filter(t => isSet(t.plannedR)), mm = all.filter(t => isSet(t.mae) || isSet(t.mfe));
    const winners = mm.filter(t => t.ret > 0 && isSet(t.mae)), losers = mm.filter(t => t.ret < 0 && isSet(t.mfe));
    const share = (a, f) => a.length ? pct(a.filter(f).length / a.length) + ` (${a.filter(f).length}/${a.length})` : '–';
    const byExit = {}; withPlan.forEach(t => { const k = t.exitType || '(non renseigné)'; (byExit[k] = byExit[k] || []).push(t); });
    const locked = DB.trades.filter(t => t.preLockedAt), edited = locked.filter(t => t.preEdits && t.preEdits.length);
    const untagged = DB.trades.filter(t => t.mistakes && !(t.mistakeTags || []).length).length;
    $('#main').innerHTML = `
      <h1>Analyse</h1>
      <h2>Espérance glissante (20 derniers trades)</h2>
      <div class="kpis">
        <div class="kpi"><div class="l">E20 actuelle</div><div class="v ${cls(cur)}">${cur === null ? '–' : sgn(cur, 3) + ' R'}</div><div class="s">${curCI[0] === null ? (roll.n < 20 ? `Il faut 20 trades (${roll.n} pour l'instant)` : '') : `IC95 % [${num(curCI[0])} ; ${num(curCI[1])}]`}</div></div>
        <div class="kpi"><div class="l">Espérance globale</div><div class="v ${cls(meanOf(rets(all)))}">${sgn(meanOf(rets(all)), 3)} R</div><div class="s">${all.length} trades</div></div>
        <div class="kpi"><div class="l">Fenêtres E20 &lt; 0</div><div class="v">${roll.pts.length ? pct(roll.pts.filter(p => p[1] < 0).length / roll.pts.length) : '–'}</div><div class="s">${roll.pts.filter(p => p[1] < 0).length}/${roll.pts.length} fenêtres</div></div>
      </div>
      ${cur !== null && cur < 0 ? `<div class="gr-alert gr-danger">📉 L'espérance des 20 derniers trades est négative (${sgn(cur)} R). Sur 20 trades l'intervalle de confiance reste large (${num(curCI[0])} à ${num(curCI[1])} R) : c'est un signal de vigilance, pas une preuve que l'edge a disparu. Relis les erreurs ci-dessous avant de changer de stratégie.</div>` : ''}
      <div class="card">${lineChart({ series: [{ name: 'E20', color: 'var(--accent)', pts: roll.pts }, { name: 'Espérance cumulée', color: 'var(--muted)', pts: roll.cum.filter(p => p[0] >= 20) }], yFmt: v => v.toFixed(2) })}
        <p class="muted small">Bleu : moyenne des R des 20 derniers trades à chaque instant. Gris : espérance depuis le début.${IS_BT ? ' Trades sans entrée exclus.' : ''}</p></div>

      <h2>Coût des erreurs</h2>
      <div class="card"><p class="muted small">Référence : <b>${clean.length} trades « propres »</b> (aucune erreur, plan suivi, pas de FOMO / revenge / overtrade / garde-fou enfreint), espérance <b>${sgn(eClean)} R</b>. Coût estimé = (espérance des trades propres − espérance du groupe) × n : c'est le R perdu par rapport à ce que ces trades auraient rapporté s'ils avaient été « propres ». Un trade peut avoir plusieurs erreurs : les coûts se recoupent et ne s'additionnent pas. Lignes grisées : n &lt; 5, non fiable.</p>
        ${untagged ? `<div class="note">${untagged} trade(s) ont une erreur écrite sans tag : utilise <b>Données → Nettoyage</b> pour leur proposer des tags.</div>` : ''}
        <div class="twrap" style="max-height:none"><table><thead><tr><th>Erreur</th><th class="num">n</th><th class="num">Win rate</th><th class="num">Net R</th><th class="num">Espérance</th><th class="num">Coût estimé</th><th style="min-width:120px"></th></tr></thead><tbody>
        ${rows.map(r => `<tr class="${r.n < 5 ? 'low' : ''}"><td>${esc(r.key)}</td><td class="num">${r.n}</td><td class="num">${pct(r.wr)}</td><td class="num ${cls(r.net)}">${sgn(r.net)}</td><td class="num ${cls(r.e)}">${sgn(r.e)}</td><td class="num ${r.cost > 0 ? 'neg' : ''}">${r.cost === null ? '–' : (r.cost > 0 ? '−' : '+') + num(Math.abs(r.cost)) + ' R'}</td><td><div class="costbar"><span style="width:${Math.round(Math.abs(r.cost || 0) / maxCost * 100)}%;background:${r.cost > 0 ? 'var(--loss)' : 'var(--win)'}"></span></div></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Aucune erreur enregistrée.</td></tr>'}
        </tbody></table></div></div>

      <h2>Sortie : R prévu vs réalisé</h2>
      <div class="card">${withPlan.length ? `<div class="twrap" style="max-height:none"><table><thead><tr><th>Type de sortie</th><th class="num">n</th><th class="num">R prévu moy.</th><th class="num">R réalisé moy.</th><th class="num">Écart moy.</th><th class="num">R laissé (total)</th></tr></thead><tbody>
        ${Object.entries(byExit).sort((a, b) => b[1].length - a[1].length).map(([k, ts]) => { const p = meanOf(ts.map(t => +t.plannedR)), r = meanOf(rets(ts)), left = ts.filter(t => t.ret > -1 && t.ret < t.plannedR).reduce((s, t) => s + (t.plannedR - t.ret), 0); return `<tr class="${ts.length < 5 ? 'low' : ''}"><td>${esc(k)}</td><td class="num">${ts.length}</td><td class="num">${sgn(p)}</td><td class="num ${cls(r)}">${sgn(r)}</td><td class="num ${cls(r - p)}">${sgn(r - p)}</td><td class="num">${num(left)}</td></tr>`; }).join('')}
        </tbody></table></div><p class="muted small">« R laissé » = somme de (R prévu − R réalisé) pour les trades sortis entre −1 R et le TP prévu (sorties manuelles, BE, partielles). ${withPlan.length} trade(s) avec R prévu.</p>` : '<p class="muted">Renseigne « R prévu (TP initial) » et « Type de sortie » dans tes prochains trades pour voir cette analyse.</p>'}</div>

      <h2>MAE / MFE</h2>
      <div class="card">${mm.length ? `<div class="kpis">
        <div class="kpi"><div class="l">Gagnants : MAE moyenne</div><div class="v">${num(meanOf(winners.map(t => +t.mae)))} R</div><div class="s">MAE ≥ 0,8 R : ${share(winners, t => t.mae >= 0.8)}</div></div>
        <div class="kpi"><div class="l">Perdants : MFE moyenne</div><div class="v">${num(meanOf(losers.map(t => +t.mfe)))} R</div><div class="s">MFE ≥ 1 R : ${share(losers, t => t.mfe >= 1)}</div></div>
        <div class="kpi"><div class="l">Perdants allés à mi-TP</div><div class="v">${share(losers.filter(t => isSet(t.plannedR)), t => t.mfe >= t.plannedR / 2)}</div><div class="s">MFE ≥ 50 % du R prévu</div></div>
      </div><p class="muted small">Beaucoup de gagnants avec MAE ≥ 0,8 R : le SL est proche d'être touché (SL juste ou entrée tôt). Beaucoup de perdants avec MFE ≥ 1 R : une règle de BE ou de sortie partielle aurait pu sauver ces trades. ${mm.length} trade(s) renseigné(s) ; en dessous d'environ 20 par groupe, ces pourcentages sont indicatifs.</p>` : '<p class="muted">Renseigne MAE et MFE dans tes prochains trades pour voir cette analyse.</p>'}</div>

      <h2>Biais de rétrospective</h2>
      <div class="card"><p>${locked.length} trade(s) avec critères pré-entrée figés · <b>${edited.length}</b> modifié(s) après coup${locked.length ? ` (${pct(edited.length / locked.length)})` : ''} · ${DB.trades.filter(t => t.checklistSnap).length} trade(s) avec checklist figée jointe.</p>
        ${edited.length ? `<p class="muted small">Trades modifiés : ${edited.map(t => '#' + t.n).join(', ')}. Ces modifications sont conservées avec les valeurs d'origine.</p>` : ''}</div>

      <h2>Par catégorie</h2>
      <div class="grid2">${groupTable('Setup', g(t => t.setup))}${groupTable('POI d\'exécution', g(t => t.execPoi))}${groupTable('Type de sortie', g(t => t.exitType))}${groupTable('Gestion (normalisée)', g(t => normMgmt(t.management)))}${groupTable('Killzone', g(t => t.killzone === 'Yes' ? 'Dans une killzone' : t.killzone === 'No' ? 'Hors killzone' : ''))}
        ${IS_BT ? '' : groupTable('Émotion à l\'entrée', g(t => t.emoEntry)) + groupTable('Émotion pendant le trade', g(t => t.emoDuring)) + groupTable('Émotion à la sortie', g(t => t.emoExit)) + groupTable('Intensité émotion entrée', g(t => isSet(t.emoEntryLvl) ? t.emoEntryLvl + '/5' : ''))}</div>`;
  }

  /* ---- ONGLET BACKTEST VS LIVE ---- */
  let BVL = { dim: 'entry', other: null, loading: false, err: '', src: '' };
  const BVL_DIMS = [['entry', 'Modèle d\'entrée', t => t.entry], ['session', 'Session', t => t.session], ['direction', 'Direction', t => t.direction], ['setup', 'Setup', t => t.setup], ['execPoi', 'POI d\'exécution', t => t.execPoi],
    ['tp', 'Take profit', t => t.tp], ['sl', 'Stop loss', t => t.sl], ['mgmt', 'Gestion', t => normMgmt(t.management)], ['day', 'Jour', t => S.dayName(t.date)], ['instrument', 'Instrument', t => t.instrument], ['kz', 'Killzone', t => t.killzone === 'Yes' ? 'Dans' : t.killzone === 'No' ? 'Hors' : '']];
  const noEntry = t => t.entry === 'No Entry' || Number(t.risk) === 0 || (!t.entry && !Number(t.ret));
  function bvlStats(ts) { const r = rets(ts), w = r.filter(x => x > 0).length, ci = S.wilson(w, r.length); return { n: r.length, w, wr: r.length ? w / r.length : null, wrCI: ci, e: meanOf(r), eCI: meanCI(r), r }; }
  function loadOther() {
    BVL.loading = true; BVL.err = '';
    const p = Drive.peek ? Drive.peek(OTHER_FILE) : Promise.resolve({ db: null });
    return p.then(res => { BVL.other = res.db; BVL.src = res.source; BVL.loading = false; }).catch(e => { BVL.loading = false; BVL.err = e.message; });
  }
  function renderBvL() {
    if (!BVL.other && !BVL.loading && !BVL.err) { $('#main').innerHTML = '<h1>Backtest vs Live</h1><p class="muted">Chargement de l\'autre journal…</p>'; loadOther().then(() => { if (view === 'bvl') renderBvL(); }); return; }
    if (!BVL.other) { $('#main').innerHTML = `<h1>Backtest vs Live</h1><div class="note">Impossible de lire <code>${OTHER_FILE}</code>${BVL.err ? ' : ' + esc(BVL.err) : ''}. Connecte-toi à Google (ou ouvre l'autre journal une fois sur cet appareil), puis <button class="btn" id="b-retry">Réessayer</button></div>`; $('#b-retry').onclick = () => { BVL.err = ''; renderBvL(); }; return; }
    const btAll = (IS_BT ? DB.trades : BVL.other.trades || []), lvAll = (IS_BT ? BVL.other.trades || [] : DB.trades);
    const bt = btAll.filter(t => S.filled(t.ret) && !noEntry(t)), lv = lvAll.filter(t => S.filled(t.ret));
    const dim = BVL_DIMS.find(d => d[0] === BVL.dim) || BVL_DIMS[0];
    const keys = [...new Set([...bt, ...lv].map(dim[2]).filter(isSet))];
    const row = (label, a, b, bold) => {
      const A = bvlStats(a), B = bvlStats(b);
      const pW = A.n && B.n ? fisherP(A.w, A.n - A.w, B.w, B.n - B.w) : null, pE = welchP(A.r, B.r);
      const sig = (pW !== null && pW < 0.05) || (pE !== null && pE < 0.05);
      return { n: Math.min(A.n, B.n), html: `<tr class="${Math.min(A.n, B.n) < 10 ? 'low' : ''}${sig ? ' sig' : ''}"><td>${bold ? '<b>' + esc(label) + '</b>' : esc(label)}</td>
        <td class="num">${A.n}</td><td class="num">${pct(A.wr)}<div class="muted small">${A.n ? `[${pct(A.wrCI[0])} ; ${pct(A.wrCI[1])}]` : ''}</div></td><td class="num ${cls(A.e)}">${sgn(A.e)}<div class="muted small">${A.eCI[0] === null ? '' : `[${num(A.eCI[0])} ; ${num(A.eCI[1])}]`}</div></td>
        <td class="num">${B.n}</td><td class="num">${pct(B.wr)}<div class="muted small">${B.n ? `[${pct(B.wrCI[0])} ; ${pct(B.wrCI[1])}]` : ''}</div></td><td class="num ${cls(B.e)}">${sgn(B.e)}<div class="muted small">${B.eCI[0] === null ? '' : `[${num(B.eCI[0])} ; ${num(B.eCI[1])}]`}</div></td>
        <td class="num ${cls(B.e !== null && A.e !== null ? B.e - A.e : null)}">${B.e !== null && A.e !== null ? sgn(B.e - A.e) : '–'}</td><td class="num">${fmtP(pW)}</td><td class="num">${fmtP(pE)}</td></tr>` };
    };
    const rows = keys.map(k => Object.assign(row(k, bt.filter(t => dim[2](t) === k), lv.filter(t => dim[2](t) === k)), { k })).sort((a, b) => b.n - a.n);
    const tested = rows.filter(r => r.n >= 1).length;
    const head = `<thead><tr><th rowspan="2">Groupe</th><th colspan="3" class="ctr">Backtest</th><th colspan="3" class="ctr">Live (21D)</th><th rowspan="2" class="num">Δ espérance<br>(live − BT)</th><th rowspan="2" class="num">p win rate<br>(Fisher)</th><th rowspan="2" class="num">p espérance<br>(Welch)</th></tr><tr><th class="num">n</th><th class="num">Win rate</th><th class="num">Espérance</th><th class="num">n</th><th class="num">Win rate</th><th class="num">Espérance</th></tr></thead>`;
    $('#main').innerHTML = `
      <h1>Backtest vs Live</h1>
      <p class="muted small">Backtest : ${bt.length} trades pris (${btAll.length - bt.length} sans entrée exclus) · Live : ${lv.length} trades · autre journal lu depuis ${BVL.src === 'drive' ? 'Google Drive' : 'le cache de cet appareil'} <button class="btn" id="b-reload">Recharger</button></p>
      <div class="twrap" style="max-height:none"><table class="bvl">${head}<tbody>${row('Tous les trades', bt, lv, true).html}</tbody></table></div>
      <div class="bar" style="margin-top:14px"><label>Comparer par<select id="b-dim">${BVL_DIMS.map(d => `<option value="${d[0]}"${d[0] === dim[0] ? ' selected' : ''}>${esc(d[1])}</option>`).join('')}</select></label></div>
      <div class="twrap" style="max-height:none"><table class="bvl">${head}<tbody>${rows.map(r => r.html).join('') || '<tr><td colspan="10" class="muted">Aucune donnée pour ce critère.</td></tr>'}</tbody></table></div>
      <div class="note">Entre crochets : intervalles de confiance à 95 % (Wilson pour le win rate, Student pour l'espérance). Lignes surlignées : p &lt; 0,05 sur au moins un test. Lignes grisées : moins de 10 trades d'un côté, non fiable. Avec ${tested} groupes testés, il faut s'attendre à environ ${num(tested * 0.05, 1)} « faux positif » au seuil de 5 % : un seuil corrigé (Bonferroni) serait p &lt; ${fmtP(0.05 / Math.max(1, tested))}. Le backtest et le live ne couvrent ni la même période ni les mêmes conditions (exécution réelle, émotions, spreads) : un écart signale une différence à investiguer, pas sa cause.</div>`;
    $('#b-dim').onchange = e => { BVL.dim = e.target.value; renderBvL(); };
    $('#b-reload').onclick = () => { BVL.other = null; renderBvL(); };
  }

  /* ---- NETTOYAGE DES DONNÉES ---- */
  function cleanupPlan() {
    const groups = [];
    const mg = DB.trades.filter(t => t.management && normMgmt(t.management) !== t.management);
    const unknownMg = [...new Set(DB.trades.map(t => normMgmt(t.management)).filter(v => v && lst('management').indexOf(v) < 0))];
    if (mg.length) groups.push({ id: 'mgmt', title: `Gestion du trade : harmoniser ${mg.length} valeur(s)`, ex: [...new Set(mg.map(t => t.management + ' → ' + normMgmt(t.management)))], apply: () => mg.forEach(t => t.management = normMgmt(t.management)) });
    const ty = [];
    Object.entries(TYPOS).forEach(([f, map]) => DB.trades.forEach(t => { if (map[t[f]]) ty.push([t, f, map[t[f]]]); }));
    if (IS_BT) DB.trades.forEach(t => { if (t.agg && t.agg.entry === 'Strar') ty.push([t.agg, 'entry', 'Star']); });
    if (ty.length) groups.push({ id: 'typos', title: `Orthographe : corriger ${ty.length} valeur(s)`, ex: [...new Set(ty.map(([o, f, v]) => o[f] + ' → ' + v))], apply: () => ty.forEach(([o, f, v]) => o[f] = v) });
    const st = DB.trades.map(t => [t, mapSetup(TYPOS.setup[t.setup] || t.setup, t.session)]).filter(x => x[1]);
    const stLeft = DB.trades.filter(t => t.setup && lst('setups').indexOf(t.setup) < 0 && !mapSetup(TYPOS.setup[t.setup] || t.setup, t.session));
    if (st.length) groups.push({ id: 'setup', title: `Setup : convertir ${st.length} trade(s) vers la nouvelle liste (Reversal → Sweep Asia, Continuation → Continuation, selon la session)`, ex: [...new Set(st.map(([t, v]) => `${t.setup} + ${t.session} → ${v}`))], note: stLeft.length ? `${stLeft.length} trade(s) gardent leur ancien setup (session hors London/NY) : ${stLeft.map(t => '#' + t.n).join(', ')}` : '', apply: () => st.forEach(([t, v]) => t.setup = v) });
    const tg = DB.trades.filter(t => t.mistakes && !(t.mistakeTags || []).length).map(t => [t, suggestTags(t.mistakes)]).filter(x => x[1].length);
    if (tg.length) groups.push({ id: 'tags', title: `Erreurs : ajouter des tags à ${tg.length} trade(s) d'après le texte`, ex: tg.map(([t, tags]) => `#${t.n} « ${trunc(t.mistakes, 60)} » → ${tags.join(', ')}`), apply: () => tg.forEach(([t, tags]) => t.mistakeTags = tags) });
    const dates = DB.trades.map(t => t.date).filter(Boolean).sort();
    if (dates.length) {
      const lim = addDaysISO(dates[0], -31), rv = (DB.reviews || []).filter(r => r.start && r.start < lim);
      if (rv.length) groups.push({ id: 'reviews', title: `Revues : supprimer ${rv.length} revue(s) datée(s) avant le début de ce journal (${dates[0]})`, ex: rv.map(r => `${TYPES[r.type] || r.type} ${r.start}`), apply: () => { DB.reviews = DB.reviews.filter(r => rv.indexOf(r) < 0); } });
    }
    const mp = DB.trades.filter(t => (isSet(t.mae) || isSet(t.mfe)) && !isSet(t.slPips) && !isSet(t.maePips) && !isSet(t.mfePips));
    if (mp.length) groups.push({ id: 'maepips', title: `MAE/MFE : déplacer ${mp.length} valeur(s) saisies en pips vers les nouveaux champs « pips »`, ex: mp.map(t => `#${t.n} MAE ${isSet(t.mae) ? t.mae : '–'} · MFE ${isSet(t.mfe) ? t.mfe : '–'} → pips (ajoute la taille du SL pour la conversion en R)`), apply: () => mp.forEach(t => { if (isSet(t.mae)) t.maePips = t.mae; if (isSet(t.mfe)) t.mfePips = t.mfe; t.mae = null; t.mfe = null; }) });
    const hk = DB.trades.filter(t => (t.mistakeTags || []).some(x => /hors\s*kill/i.test(x))), hkList = (DB.lists.mistakeTags || []).some(x => /hors\s*kill/i.test(x));
    if (hk.length || hkList) groups.push({ id: 'horskz', title: `Retirer le tag « Hors Killzone » (${hk.length} trade(s)) : la killzone est déjà contrôlée automatiquement`, ex: hk.map(t => `#${t.n} : killzone = ${t.killzone || '–'}`).concat(hkList ? ['Retiré aussi de la liste des tags'] : []), apply: () => { hk.forEach(t => { t.mistakeTags = t.mistakeTags.filter(x => !/hors\s*kill/i.test(x)); if (!t.killzone) t.killzone = 'No'; }); if (DB.lists.mistakeTags) DB.lists.mistakeTags = DB.lists.mistakeTags.filter(x => !/hors\s*kill/i.test(x)); } });
    const rr = DB.trades.filter(t => 'rr' in t);
    if (rr.length) groups.push({ id: 'rr', title: `Supprimer le champ « RR asymétrique » de ${rr.length} trade(s)`, ex: ['Le grade du setup est désormais calculé sur 4 critères : Bias, POI, Killzone, Sweep'], apply: () => rr.forEach(t => delete t.rr) });
    return { groups, unknownMg };
  }
  function cleanupHTML() {
    return `<h2>🧹 Nettoyage des données</h2><div class="card" id="cl-card"><p class="muted small">Analyse le journal et propose des corrections. Rien n'est modifié avant que tu cliques « Appliquer ». Pense à exporter un JSON avant, par sécurité.</p><div class="bar"><button class="btn" id="cl-scan">Analyser</button></div><div id="cl-out"></div></div>`;
  }
  function cleanupWire() {
    $('#cl-scan').onclick = () => {
      const p = cleanupPlan();
      $('#cl-out').innerHTML = p.groups.length ? p.groups.map(g => `<div class="cl-group"><label><input type="checkbox" class="cl-ck" data-id="${g.id}" checked> <b>${esc(g.title)}</b></label><details><summary class="muted small">Voir le détail (${g.ex.length})</summary><ul>${g.ex.slice(0, 80).map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>${g.note ? `<p class="muted small">${esc(g.note)}</p>` : ''}</div>`).join('') +
        (p.unknownMg.length ? `<p class="muted small">Valeurs de gestion hors liste conservées : ${esc(p.unknownMg.join(', '))}. Modifie ces trades à la main si besoin.</p>` : '') +
        '<div class="actions"><button class="btn primary" id="cl-apply">Appliquer la sélection</button></div>' : '<p>✅ Rien à corriger.</p>';
      if (!p.groups.length) return;
      $('#cl-apply').onclick = async () => {
        const ids = Array.prototype.filter.call(document.querySelectorAll('.cl-ck'), c => c.checked).map(c => c.dataset.id);
        if (!ids.length) return;
        if (!confirm('Appliquer ' + ids.length + ' correction(s) au journal ?')) return;
        p.groups.filter(g => ids.indexOf(g.id) >= 0).forEach(g => g.apply());
        ['setups', 'management', 'execPoi', 'exitTypes', 'mistakeTags'].concat(IS_BT ? [] : ['emotions']).forEach(k => { if (!DB.lists[k] || !DB.lists[k].length) DB.lists[k] = DEF_LISTS[k].slice(); });
        if (await save('Nettoyage appliqué')) renderData();
      };
    };
  }
  const V3_LISTS = [['setups', 'Setups'], ['execPoi', 'POI d\'exécution'], ['management', 'Gestion du trade'], ['exitTypes', 'Types de sortie'], ['mistakeTags', 'Tags d\'erreurs']].concat(FILE_NAME === 'journal-backtest.json' ? [] : [['emotions', 'Émotions']]);


  /* ================= ALERTES DE REVUE (semaine / mois / trimestre / année) ================= */
  // Une revue est due pour la période précédente dès le début de la nouvelle période,
  // si cette période précédente contient au moins un trade. L'alerte reste jusqu'à ce que la revue soit enregistrée.
  const REV_ORDER = ['weekly', 'monthly', 'quarterly', 'yearly'];
  const REV_ICON = { weekly: '📝', monthly: '🗓️', quarterly: '📊', yearly: '🏁' };
  function reviewDone(type, start) {
    const rv = (DB.reviews || []).find(x => x.id === type + ':' + start || (x.type === type && x.start === start));
    return !!(rv && Object.values(rv.answers || {}).some(v => v !== '' && v !== null && v !== undefined));
  }
  function missingReviews() {
    if (!DB || !DB.trades || IS_BT) return [];   // backtest : dates historiques, pas d'alerte calendaire
    const today = todayISO(), out = [];
    REV_ORDER.forEach(type => {
      const prev = S.shiftPeriod(type, S.period(type, today).start, -1);
      const n = DB.trades.filter(t => t.date >= prev.start && t.date <= prev.end).length;
      if (n && !reviewDone(type, prev.start)) out.push({ type, p: prev, n, label: TYPES[type] + ' : ' + periodLabel(type, prev) });
    });
    return out;
  }
  function notifySafe(title, body, tag) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const opt = { body: body, tag: tag };
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
        navigator.serviceWorker.getRegistration().then(reg => { if (reg) reg.showNotification(title, opt); else { try { new Notification(title, opt); } catch (e) {} } }).catch(() => {});
      } else new Notification(title, opt);
    } catch (e) { /* Android sans service worker : la pastille et le toast suffisent */ }
  }
  function reviewAlertsOnce() {
    // une notification + un toast par revue manquante et par jour
    const miss = missingReviews(); if (!miss.length) return;
    const key = 'review_alert_v1:' + APP_ID, today = todayISO();
    let seen = {}; try { seen = JSON.parse(localStorage.getItem(key)) || {}; } catch (e) {}
    const fresh = miss.filter(m => seen[m.type + ':' + m.p.start] !== today);
    if (!fresh.length) return;
    fresh.forEach(m => { seen[m.type + ':' + m.p.start] = today; });
    try { localStorage.setItem(key, JSON.stringify(seen)); } catch (e) {}
    const msg = fresh.map(m => m.label).join(' · ');
    toast('📝 Revue à faire : ' + msg, 9000);
    notifySafe('📝 Revue à faire', msg, 'review-' + today);
  }
  function reviewPills() {
    return missingReviews().map(m => `<a class="gr-pill gr-pill-review" href="#/reviews" data-rev="${m.type}|${m.p.start}" title="${esc(m.n + ' trade(s) sur la période · clique pour faire la revue')}">${REV_ICON[m.type]} Revue ${esc(m.type === 'weekly' ? 'semaine du ' + m.p.start.slice(8) + '/' + m.p.start.slice(5, 7) : periodLabel(m.type, m.p))} à faire</a>`).join('');
  }
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('[data-rev]'); if (!a) return;
    const [type, start] = a.dataset.rev.split('|');
    ui.rev.type = type; ui.rev.start = start;
    if (location.hash === '#/reviews') { e.preventDefault(); renderReviews(); }
  });
  function btMissingReviews() {
    const out = {};
    REV_ORDER.forEach(type => {
      const starts = [...new Set(DB.trades.map(t => t.date).filter(Boolean).map(d => S.period(type, d).start))].sort();
      out[type] = starts.filter(st => !reviewDone(type, st));
    });
    return out;
  }
  function reviewBanner() {
    if (IS_BT) {
      const m = btMissingReviews(), tot = REV_ORDER.reduce((s, k) => s + m[k].length, 0);
      if (!tot) return '';
      return `<div class="gr-alert gr-warn">📝 Périodes backtestées sans revue : ${REV_ORDER.filter(k => m[k].length).map(k => `${TYPES[k]} (${m[k].length}) : ${m[k].slice(0, 6).map(st => `<a href="#/reviews" data-rev="${k}|${st}">${esc(periodLabel(k, S.period(k, st)))}</a>`).join(', ')}${m[k].length > 6 ? '…' : ''}`).join(' · ')}</div>`;
    }
    const miss = missingReviews(); if (!miss.length) return '';
    return `<div class="gr-alert gr-warn">📝 Revue(s) en retard : ${miss.map(m => `<a href="#/reviews" data-rev="${m.type}|${m.p.start}">${esc(m.label)}</a> (${m.n} trade${m.n > 1 ? 's' : ''})`).join(' · ')}</div>`;
  }

  /* ================= V4 : pips, cohérence, fiche complète, setups, revues pré-remplies ================= */
  const vOrN = v => v === null || v === undefined || v === '' ? null : +v;
  GR_BREAK_NAMES.news = 'Trade pendant un blocage news';

  /* ---- contrôles de cohérence (avertissement avant enregistrement) ---- */
  function v4Checks(t) {
    const w = [], r = Number(t.ret), has = v => isSet(v) && !isNaN(+v);
    if (S.filled(t.ret)) {
      if (t.exitType === 'SL touché' && r > 0) w.push(`Sortie « SL touché » mais résultat positif (${sgn(r)} R). Si le SL avait été déplacé en profit, choisis plutôt « Trailing stop » (gestion) ou « Breakeven ».`);
      if (t.exitType === 'TP atteint' && r <= 0) w.push(`Sortie « TP atteint » mais résultat ${sgn(r)} R.`);
      if (t.exitType === 'Breakeven' && Math.abs(r) > 0.3) w.push(`Sortie « Breakeven » mais résultat ${sgn(r)} R.`);
      if (t.exitType === 'TP atteint' && !has(t.plannedR)) w.push('« TP atteint » sans R prévu : renseigne le R du TP initial.');
      if (t.exitType === 'TP atteint' && has(t.plannedR) && Math.abs(r - t.plannedR) > 0.5) w.push(`TP atteint à ${sgn(r)} R alors que le R prévu est ${sgn(+t.plannedR)} R.`);
      if (r < -1.2) w.push(`Perte de ${sgn(r)} R : plus grande que le risque de 1 R.`);
      if (has(t.mae) && t.mae > 1.05 && r > -1) w.push(`MAE de ${num(t.mae)} R alors que le SL fait 1 R : le stop aurait été touché. Vérifie la taille du SL ou la MAE.`);
      if (has(t.mfe) && r > 0 && t.mfe + 0.05 < r) w.push(`MFE (${num(t.mfe)} R) plus petite que le gain réalisé (${sgn(r)} R).`);
      if (has(t.mfe) && r < 0 && t.mfe >= 1 && !t.exitType) w.push(`Perte alors que le prix est allé à +${num(t.mfe)} R : précise le type de sortie.`);
    }
    if ((has(t.maePips) || has(t.mfePips)) && !(+t.slPips > 0)) w.push('MAE/MFE saisies sans taille de SL : la conversion en R est impossible.');
    if (t.entryTime && t.exitTime && toMin(t.exitTime) < toMin(t.entryTime)) w.push('Heure de sortie avant l\'heure d\'entrée (trade sur deux jours ?).');
    if (t.fomo === 'Yes' && t.planFollow === 'Yes') w.push('FOMO = Yes mais « Plan suivi » = Yes.');
    if (t.revenge === 'Yes' && t.planFollow === 'Yes') w.push('Revenge trade = Yes mais « Plan suivi » = Yes.');
    if (S.filled(t.ret) && r > 0 && t.exitType === 'SL touché' && t.management === 'Set and Forget') w.push('« Set and Forget » + « SL touché » + gain : combinaison impossible.');
    return w;
  }

  /* ---- fiche complète ---- */
  const COMPLETE_FIELDS = () => [['instrument', 'Instrument'], ['direction', 'Direction'], ['session', 'Session'], ['entry', 'Entrée'], ['sl', 'SL'], ['tp', 'TP'], ['ret', 'Résultat (R)'],
    ['setup', 'Setup'], ['execPoi', 'POI d\'exécution'], ['entryTime', 'Heure d\'entrée'], ['exitTime', 'Heure de sortie'], ['slPips', 'Taille SL (pips)'], ['plannedR', 'R prévu'], ['exitType', 'Type de sortie'],
    ['maePips', 'MAE'], ['mfePips', 'MFE'], ['bias', 'Bias'], ['poi', 'POI'], ['sweep', 'Sweep'], ['fomo', 'FOMO'], ['management', 'Gestion'], ['screens', 'Captures']]
    .concat(IS_BT ? [] : [['planFollow', 'Plan suivi'], ['emoEntry', 'Émotion entrée'], ['emoDuring', 'Émotion pendant'], ['emoExit', 'Émotion sortie']]);
  function completeness(t) {
    const f = COMPLETE_FIELDS();
    const miss = f.filter(([k]) => k === 'screens' ? !(t.screens && Object.values(t.screens).some(v => v && v.length)) : !isSet(t[k])).map(x => x[1]);
    return { pct: Math.round((f.length - miss.length) / f.length * 100), miss };
  }
  function fichePill(t) {
    const c = completeness(t), k = c.pct >= 100 ? 'ok' : c.pct >= 80 ? 'mid' : 'low';
    return `<span class="fiche fiche-${k}" title="${esc(c.miss.length ? 'Manque : ' + c.miss.join(', ') : 'Fiche complète')}">${c.pct}%</span>`;
  }
  function ficheBlock(t) {
    const c = completeness(t);
    return c.miss.length ? `<div class="fiche-line">${fichePill(t)} Fiche complète à ${c.pct} % · manque : ${esc(c.miss.join(', '))}</div>` : `<div class="fiche-line">${fichePill(t)} Fiche complète</div>`;
  }

  /* ---- fiche par setup (playbook) ---- */
  function pbData() { DB.playbook = DB.playbook || {}; return DB.playbook; }
  function renderSetups() {
    const all = DB.trades.filter(takenT).filter(t => S.filled(t.ret));
    const names = [...new Set(lst('setups').concat(all.map(t => t.setup).filter(Boolean)))];
    ui.pb = ui.pb && names.indexOf(ui.pb) >= 0 ? ui.pb : names[0];
    const card = name => {
      const ts = all.filter(t => t.setup === name).sort((a, b) => (a.date + String(a.n).padStart(6, '0')).localeCompare(b.date + String(b.n).padStart(6, '0')));
      const st = bvlStats(ts), last = ts.slice(-15), eLast = meanOf(rets(last)), gp = st.r.filter(x => x > 0).reduce((s, v) => s + v, 0), gl = -st.r.filter(x => x < 0).reduce((s, v) => s + v, 0);
      return { ts, st, eLast, last, pf: gl ? gp / gl : null };
    };
    const chips = names.map(n => { const c = card(n); return `<button class="pb-chip ${n === ui.pb ? 'on' : ''} ${c.st.n >= 5 && c.eLast !== null && c.eLast < 0 ? 'alert' : ''}" data-pb="${esc(n)}">${esc(n)} <span class="muted small">${c.st.n}</span></button>`; }).join('');
    const name = ui.pb; if (!name) { $('#main').innerHTML = '<h1>Setups</h1><p class="muted">Ajoute des setups dans Données → Listes.</p>'; return; }
    const c = card(name), pb = pbData()[name] || {}, g = fn => S.groupBy(c.ts, fn);
    const ex = (pb.examples || '').split('\n').map(s => s.trim()).filter(Boolean);
    $('#main').innerHTML = `
      <h1>Setups</h1>
      <div class="pb-chips">${chips}</div>
      <div class="card pb-card">
        <h2 style="margin-top:0">${esc(name)}</h2>
        ${c.st.n >= 5 && c.eLast !== null && c.eLast < 0 ? `<div class="gr-alert gr-danger">⚠ Espérance des ${c.last.length} derniers trades de ce setup : ${sgn(c.eLast)} R. Relis les règles et les erreurs récentes avant de le reprendre.</div>` : ''}
        <div class="kpis">
          <div class="kpi"><div class="l">Trades</div><div class="v">${c.st.n}</div></div>
          <div class="kpi"><div class="l">Win rate</div><div class="v">${pct(c.st.wr)}</div><div class="s">${c.st.n ? `IC95 % [${pct(c.st.wrCI[0])} ; ${pct(c.st.wrCI[1])}]` : ''}</div></div>
          <div class="kpi"><div class="l">Espérance</div><div class="v ${cls(c.st.e)}">${c.st.e === null ? '–' : sgn(c.st.e) + ' R'}</div><div class="s">${c.st.eCI[0] === null ? '' : `IC95 % [${num(c.st.eCI[0])} ; ${num(c.st.eCI[1])}]`}</div></div>
          <div class="kpi"><div class="l">${c.last.length} derniers</div><div class="v ${cls(c.eLast)}">${c.eLast === null ? '–' : sgn(c.eLast) + ' R'}</div><div class="s">Profit factor ${c.pf === null ? '–' : num(c.pf)}</div></div>
        </div>
        ${c.st.n && c.st.n < 20 ? `<p class="muted small">Moins de 20 trades : les intervalles sont larges, ne tire pas de règle définitive.</p>` : ''}
        <div class="grid2">
          <div><h3>Règles du setup</h3><textarea id="pb-rules" rows="8" placeholder="Contexte HTF, conditions d'entrée, invalidation, TP, gestion…">${esc(pb.rules || '')}</textarea></div>
          <div><h3>Exemples (un lien TradingView ou image par ligne)</h3><textarea id="pb-ex" rows="8" placeholder="https://www.tradingview.com/x/…">${esc(pb.examples || '')}</textarea>
            <div class="pb-ex">${ex.map(u => { const img = S.imageUrl ? S.imageUrl(u) : null; return img ? `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(img)}" alt="Exemple ${esc(name)}" loading="lazy"></a>` : `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(trunc(u, 50))}</a>`; }).join('')}</div></div>
        </div>
        <h3>Notes</h3><textarea id="pb-notes" rows="3" placeholder="Ce que les données t'apprennent sur ce setup…">${esc(pb.notes || '')}</textarea>
        <div class="actions"><button class="btn primary" id="pb-save">Enregistrer la fiche</button></div>
      </div>
      ${c.ts.length ? `<div class="grid2">${groupTable('POI d\'exécution', g(t => t.execPoi))}${groupTable('Session', g(t => t.session))}${groupTable('Gestion', g(t => normMgmt(t.management)))}${groupTable('Type de sortie', g(t => t.exitType))}${groupTable('Direction', g(t => t.direction))}${groupTable('Killzone', g(t => t.killzone === 'Yes' ? 'Dans' : t.killzone === 'No' ? 'Hors' : ''))}</div>
      <h2>Derniers trades</h2><div class="twrap"><table><thead><tr><th class="num">#</th><th>Date</th><th>Instrument</th><th>Dir.</th><th>POI exéc.</th><th class="num">R</th><th>Erreurs</th></tr></thead><tbody>
      ${c.ts.slice(-15).reverse().map(t => `<tr class="click" data-n="${t.n}"><td class="num">${t.n}</td><td>${esc(t.date)}</td><td>${esc(t.instrument)}</td><td>${esc(t.direction)}</td><td>${esc(t.execPoi || '')}</td><td class="num ${cls(t.ret)}">${sgn(t.ret)}</td><td class="small">${esc((t.mistakeTags || []).join(', '))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucun trade avec ce setup pour l\'instant.</p>'}`;
    document.querySelectorAll('[data-pb]').forEach(b => b.onclick = () => { ui.pb = b.dataset.pb; renderSetups(); });
    document.querySelectorAll('tr.click').forEach(r => r.onclick = () => openTrade(+r.dataset.n));
    $('#pb-save').onclick = async () => { pbData()[name] = { rules: $('#pb-rules').value, examples: $('#pb-ex').value, notes: $('#pb-notes').value }; if (await save('Fiche setup enregistrée')) renderSetups(); };
  }

  /* ---- revues : synthèse des sous-périodes + pré-remplissage mensuel ---- */
  const SUB_TYPE = { monthly: 'weekly', quarterly: 'monthly', yearly: 'quarterly' };
  const SUB_CHAIN = { monthly: ['weekly'], quarterly: ['monthly', 'weekly'], yearly: ['quarterly', 'monthly', 'weekly'] };
  const hasAns = r => Object.keys(r.answers || {}).length > 0;
  function subOf(type, sub, p) { return (DB.reviews || []).filter(r => r.type === sub && r.start >= p.start && r.start <= p.end && hasAns(r)).sort((a, b) => a.start.localeCompare(b.start)); }
  // sous-revues utilisées : type « naturel » (mois pour un trimestre…), sinon le niveau en dessous
  function subReviews(type, p) {
    for (const sub of (SUB_CHAIN[type] || [])) { const a = subOf(type, sub, p); if (a.length) return a; }
    return [];
  }
  const subTypeUsed = (type, p) => { const s = subReviews(type, p); return s.length ? s[0].type : SUB_TYPE[type]; };
  function fmtAnswer(v) {
    if (Array.isArray(v)) return v.map(x => typeof x === 'string' ? x : (x.url || '') + (x.note ? ' — ' + x.note : '')).join('\n');
    return String(v);
  }
  function reviewSynthesis(type, p) {
    if (!SUB_TYPE[type]) return '';
    const subs = subReviews(type, p), sub = subTypeUsed(type, p), qs = QUESTIONS[sub];
    if (!subs.length) return `<h2>Synthèse des revues</h2><div class="note">Aucune revue (${SUB_CHAIN[type].map(x => TYPES[x].toLowerCase()).join(', ')}) enregistrée sur cette période.</div>`;
    const links = subs.flatMap(r => (r.answers.missedLinks || []));
    return `<h2>Synthèse des revues (${TYPES[sub].toLowerCase()}, ${subs.length})</h2><div class="card syn">${subs.map(r => `<details${subs.length <= 5 ? ' open' : ''}><summary><b>${esc(periodLabel(sub, r))}</b></summary><dl>${qs.filter(([k]) => isSet(r.answers[k]) && !(Array.isArray(r.answers[k]) && !r.answers[k].length)).map(([k, l, kind]) => `<dt>${esc(l)}</dt><dd>${kind === 'links' ? linksView(r.answers[k]) : esc(fmtAnswer(r.answers[k]))}</dd>`).join('')}</dl></details>`).join('')}
      ${links.length ? `<details open><summary><b>📷 Setups manqués de la période (${links.length})</b></summary>${linksView(links)}</details>` : ''}</div>`;
  }
  /* --- statistiques d'une période, pour pré-remplir --- */
  function periodTrades(p) { return enriched().filter(t => t.date >= p.start && t.date <= p.end && S.filled(t.ret)).filter(takenT); }
  function setupRank(ts) {
    const m = {}; ts.forEach(t => { if (t.setup) (m[t.setup] = m[t.setup] || []).push(+t.ret); });
    return Object.entries(m).filter(([, a]) => a.length >= 2).map(([k, a]) => ({ k, net: a.reduce((s, v) => s + v, 0), n: a.length, wr: a.filter(x => x > 0).length / a.length })).sort((a, b) => b.net - a.net);
  }
  function costlyErrors(ts) {
    const clean = ts.filter(isClean), e0 = meanOf(rets(clean)); if (e0 === null) return [];
    const m = {}; ts.forEach(t => (t.mistakeTags || []).forEach(g => { (m[g] = m[g] || []).push(+t.ret); }));
    return Object.entries(m).map(([k, a]) => ({ k, n: a.length, cost: (e0 - meanOf(a)) * a.length })).filter(x => x.cost > 0).sort((a, b) => b.cost - a.cost);
  }
  function kpiLine(ts) { const r = rets(ts); if (!r.length) return null; const pf = ts.filter(t => t.planFollow); return { n: r.length, e: meanOf(r), wr: r.filter(x => x > 0).length / r.length, net: r.reduce((a, b) => a + b, 0), plan: pf.length ? pf.filter(t => t.planFollow === 'Yes').length / pf.length : null, fomo: ts.filter(t => t.fomo === 'Yes').length, kzOut: ts.filter(t => t.killzone === 'No').length }; }
  function prevPeriod(type, p) { try { return S.shiftPeriod(type, p.start, -1); } catch (e) { return null; } }
  function reviewPrefill(type, p, rv) {
    if (!SUB_TYPE[type] || hasAns(rv)) return {};
    const subs = subReviews(type, p), sub = subTypeUsed(type, p), out = {};
    const tag = r => sub === 'weekly' ? `sem. ${r.start.slice(8)}/${r.start.slice(5, 7)}` : periodLabel(sub, r);
    const join = (...keys) => subs.flatMap(r => keys.filter(k => isSet(r.answers[k]) && typeof r.answers[k] === 'string').map(k => `• (${tag(r)}) ${r.answers[k]}`)).join('\n');
    const ts = periodTrades(p), cur = kpiLine(ts), pp = prevPeriod(type, p), prev = pp ? kpiLine(periodTrades(pp)) : null;
    const evo = (a, b, f) => b === null || b === undefined ? f(a) : `${f(b)} → ${f(a)}`;
    const rk = setupRank(ts), errs = costlyErrors(ts);
    const bestSetup = rk.length && rk[0].net > 0 ? `${rk[0].k} : ${sgn(rk[0].net)} R sur ${rk[0].n} trades (win rate ${pct(rk[0].wr)})` : '';
    const worstSetup = rk.length > 1 && rk[rk.length - 1].net < 0 ? `${rk[rk.length - 1].k} : ${sgn(rk[rk.length - 1].net)} R sur ${rk[rk.length - 1].n} trades (win rate ${pct(rk[rk.length - 1].wr)})` : '';
    const errTxt = errs.slice(0, 2).map(x => `${x.k} : ${x.n} trade(s), coût estimé ${num(x.cost)} R`).join('\n');
    if (type === 'monthly') {
      if (subs.length) { out.q1 = join('q3'); out.q2 = join('q2'); out.q3 = join('q1'); const pr = join('q4'); if (pr) out.q4 = 'Priorités des semaines :\n' + pr; }
      const days = {}; ts.forEach(t => { (days[t.date] = days[t.date] || []).push(+t.ret); });
      const dl = Object.entries(days).map(([d, a]) => [d, a.reduce((s, v) => s + v, 0), a.length]).sort((a, b) => b[1] - a[1]);
      if (dl.length) { const b = dl[0], w = dl[dl.length - 1]; out.best = `${b[0]} : ${sgn(b[1])} R (${b[2]} trade${b[2] > 1 ? 's' : ''})`; if (dl.length > 1) out.worst = `${w[0]} : ${sgn(w[1])} R (${w[2]} trade${w[2] > 1 ? 's' : ''})`; }
    }
    if (type === 'quarterly') {
      if (cur) {
        out.q1 = `Chiffres${prev ? ' (trimestre précédent → ce trimestre)' : ' du trimestre'} : espérance ${evo(cur.e, prev && prev.e, v => sgn(v) + ' R')}, win rate ${evo(cur.wr, prev && prev.wr, pct)}, net ${evo(cur.net, prev && prev.net, v => sgn(v) + ' R')}.`;
        out.q2 = `Plan suivi ${evo(cur.plan, prev && prev.plan, v => v === null ? '–' : pct(v))}, trades FOMO ${evo(cur.fomo, prev && prev.fomo, String)}, trades hors killzone ${evo(cur.kzOut, prev && prev.kzOut, String)}.`;
      }
      const a = join(sub === 'monthly' ? 'q2' : 'q2'); if (a) out.q3 = a;
      const b = join(sub === 'monthly' ? 'q3' : 'q1'); if (b) out.q4 = b;
      if (errTxt) out.q5 = 'Erreurs les plus coûteuses :\n' + errTxt;
      const d = join(sub === 'monthly' ? 'q1' : 'q3'); if (d) out.q6 = d;
      const e = join('q4'); if (e) out.q7 = 'Priorités notées dans tes revues :\n' + e;
      if (bestSetup) out.best = bestSetup; if (worstSetup) out.worst = worstSetup; if (errTxt) out.mistakes = errTxt;
    }
    if (type === 'yearly') {
      const MAP = { quarterly: [['q6'], ['q2', 'q4'], ['q3', 'q5'], ['q4'], ['q7']], monthly: [['q1'], ['q3'], ['q2'], ['q3'], ['q4']], weekly: [['q3'], ['q1'], ['q2'], ['best'], ['q4']] }[sub] || [];
      ['q1', 'q2', 'q3', 'q4', 'q5'].forEach((q, i) => { const v = MAP[i] ? join(...MAP[i]) : ''; if (v) out[q] = v; });
      if (cur) out.q6 = `Point de départ chiffré : ${cur.n} trades, espérance ${sgn(cur.e)} R, win rate ${pct(cur.wr)}, net ${sgn(cur.net)} R${cur.plan !== null ? ', plan suivi ' + pct(cur.plan) : ''}.${prev ? ` (année précédente : espérance ${sgn(prev.e)} R, net ${sgn(prev.net)} R)` : ''}`;
      const mo = {}; ts.forEach(t => { const k = t.date.slice(0, 7); (mo[k] = mo[k] || []).push(+t.ret); });
      const ml = Object.entries(mo).map(([k, a]) => [k, a.reduce((s, v) => s + v, 0), a.length]).sort((x, y) => y[1] - x[1]);
      const mn = k => new Date(k + '-01T00:00:00Z').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      if (ml.length) { out.best = `${mn(ml[0][0])} : ${sgn(ml[0][1])} R (${ml[0][2]} trades)`; if (ml.length > 1) out.worst = `${mn(ml[ml.length - 1][0])} : ${sgn(ml[ml.length - 1][1])} R (${ml[ml.length - 1][2]} trades)`; }
      if (errs.length) out.mistakes = `${errs[0].k} : ${errs[0].n} trade(s), coût estimé ${num(errs[0].cost)} R`;
    }
    Object.keys(out).forEach(k => { if (!out[k]) delete out[k]; });
    return out;
  }
  function prefillNote(type, p, rv) {
    const pre = reviewPrefill(type, p, rv); if (!Object.keys(pre).length) return '';
    const subs = subReviews(type, p), what = { monthly: 'du mois', quarterly: 'du trimestre', yearly: 'de l\'année' }[type];
    return `<div class="note">✍️ Pré-rempli à partir de ${subs.length ? subs.length + ' revue(s) ' + TYPES[subTypeUsed(type, p)].toLowerCase() + ' et ' : ''}des trades ${what}${type !== 'monthly' ? ' (comparés à la période précédente)' : ''}. Relis et reformule avant d'enregistrer.</div>`;
  }
  /* --- liens TradingView des setups manqués --- */
  function linksView(list) {
    list = (list || []).filter(x => x && (x.url || typeof x === 'string'));
    if (!list.length) return '';
    return `<div class="ml-view">${list.map(x => { const u = typeof x === 'string' ? x : x.url, img = S.imageUrl ? S.imageUrl(u) : null;
      return `<a class="ml-item" href="${esc(u)}" target="_blank" rel="noopener">${img ? `<img src="${esc(img)}" alt="Setup manqué" loading="lazy">` : '<span class="ml-ph">📈</span>'}<span>${esc(x.note || trunc(u.replace(/^https?:\/\/(www\.)?/, ''), 38))}</span></a>`; }).join('')}</div>`;
  }
  function linksField(k, label, list) {
    list = (list && list.length ? list : [{ url: '', note: '' }]);
    const row = (x, i) => `<div class="ml-row"><input class="ml-url" type="url" inputmode="url" placeholder="https://www.tradingview.com/x/…" value="${esc(x.url || '')}" aria-label="Lien ${i + 1}"><input class="ml-note" placeholder="Note (paire, jour, pourquoi manqué)" value="${esc(x.note || '')}" aria-label="Note ${i + 1}"><button type="button" class="btn sm ml-del" aria-label="Supprimer">×</button></div>`;
    return `<div class="qa" id="q-${k}"><label>${esc(label)}</label><div class="ml-rows">${list.map(row).join('')}</div>
      <button type="button" class="btn sm" id="ml-add">+ Ajouter un lien</button>
      <div class="ml-prev">${linksView(list.filter(x => x.url))}</div>
      <p class="muted small">Colle le lien de la capture TradingView (bouton 📷 → « Copier le lien »). Un lien par setup manqué.</p></div>`;
  }
  function linksCollect(k) {
    const box = document.getElementById('q-' + k); if (!box) return [];
    return Array.prototype.map.call(box.querySelectorAll('.ml-row'), r => ({ url: r.querySelector('.ml-url').value.trim(), note: r.querySelector('.ml-note').value.trim() })).filter(x => x.url);
  }
  function linksWire(k) {
    const box = document.getElementById('q-' + k); if (!box) return;
    const rows = box.querySelector('.ml-rows');
    const refresh = () => { box.querySelector('.ml-prev').innerHTML = linksView(linksCollect(k)); const n = linksCollect(k).length, m = document.getElementById('q-missed'); if (m && n && (+m.value || 0) < n) m.value = n; };
    const wireRow = r => { r.querySelector('.ml-del').onclick = () => { if (rows.children.length > 1) r.remove(); else { r.querySelector('.ml-url').value = ''; r.querySelector('.ml-note').value = ''; } refresh(); }; r.querySelector('.ml-url').onchange = refresh; r.querySelector('.ml-note').onchange = refresh; };
    rows.querySelectorAll('.ml-row').forEach(wireRow);
    box.querySelector('#ml-add').onclick = () => { const tmp = document.createElement('div'); tmp.innerHTML = `<div class="ml-row"><input class="ml-url" type="url" inputmode="url" placeholder="https://www.tradingview.com/x/…"><input class="ml-note" placeholder="Note (paire, jour, pourquoi manqué)"><button type="button" class="btn sm ml-del" aria-label="Supprimer">×</button></div>`; const r = tmp.firstChild; rows.appendChild(r); wireRow(r); r.querySelector('.ml-url').focus(); };
  }

  /* ================= CALENDRIER ÉCONOMIQUE ================= */
  const CCY_FLAG = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', CHF: '🇨🇭', AUD: '🇦🇺', NZD: '🇳🇿', CAD: '🇨🇦', CNY: '🇨🇳', ALL: '🌐' };
  const ALL_CCY = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD', 'CNY'];
  const IMPACTS = [['High', 'Fort', 'hi'], ['Medium', 'Moyen', 'me'], ['Low', 'Faible', 'lo'], ['Holiday', 'Férié', 'ho']];
  const impCls = i => (IMPACTS.find(x => x[0].toLowerCase() === String(i || '').toLowerCase()) || IMPACTS[2])[2];
  const TZ_LIST = ['Indian/Antananarivo', 'Africa/Nairobi', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Abidjan', 'UTC', 'Europe/London', 'Europe/Paris', 'America/New_York', 'Asia/Dubai', 'Asia/Tokyo', 'Australia/Sydney'];
  const NEWS_ARCH = 'news_archive_v1', NEWS_META = 'news_fetch_v2';
  const NUI = { month: '', day: '', sel: '', q: '', settings: false };
  let NEWS_EVENTS = [], NEWS_STATUS = '', NEWS_LOADING = null, _nsSave = null;
  function newsCfg() {
    DB.newsFilter = DB.newsFilter || {}; const c = DB.newsFilter;
    if (!c.tz) c.tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';
    if (!c.currencies || !c.currencies.length) c.currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD'];
    if (!c.impacts) c.impacts = c.impact === '3' ? ['High'] : c.impact === '2,3' ? ['High', 'Medium'] : ['High', 'Medium', 'Low', 'Holiday'];
    return c;
  }
  function newsBlockCfg() { const d = { enabled: false, currencies: ['USD', 'EUR', 'GBP'], window: 15, behavior: 'both' }; if (!DB.newsBlock) DB.newsBlock = {}; Object.keys(d).forEach(k => { if (DB.newsBlock[k] === undefined) DB.newsBlock[k] = d[k]; }); return DB.newsBlock; }
  function saveNewsSoon(msg) { clearTimeout(_nsSave); _nsSave = setTimeout(() => save(msg || 'Préférences du calendrier enregistrées'), 1200); }
  function archLoad() { try { return JSON.parse(localStorage.getItem(NEWS_ARCH)) || {}; } catch (e) { return {}; } }
  function archSave(a) { try { localStorage.setItem(NEWS_ARCH, JSON.stringify(a)); } catch (e) { const ks = Object.keys(a).sort((x, y) => a[x].ts - a[y].ts); ks.slice(0, Math.ceil(ks.length / 3)).forEach(k => delete a[k]); try { localStorage.setItem(NEWS_ARCH, JSON.stringify(a)); } catch (e2) {} } }
  /* --- sources : biquote.io (réel/prévision/précédent, ±90 j) puis ForexFactory ; chaque URL est tentée en direct puis via plusieurs relais CORS --- */
  const NEWS_ROUTE_KEY = 'news_route_v1';
  const ROUTES = [
    ['direct', u => u],
    ['corsproxy', u => 'https://corsproxy.io/?url=' + encodeURIComponent(u)],
    ['codetabs', u => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u)],
    ['allorigins', u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u)],
    ['allorigins-get', u => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u)],
  ];
  function fetchTimeout(u, ms) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = setTimeout(() => ctl && ctl.abort(), ms || 9000);
    return fetch(u, { cache: 'no-store', signal: ctl ? ctl.signal : undefined }).finally(() => clearTimeout(tm));
  }
  async function fetchJSON(url) {
    let pref = ''; try { pref = localStorage.getItem(NEWS_ROUTE_KEY) || ''; } catch (e) {}
    const one = ([name, mk]) => fetchTimeout(mk(url), 8000).then(async r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      let txt = await r.text(); if (name === 'allorigins-get') txt = JSON.parse(txt).contents;
      return [name, JSON.parse(txt)];
    });
    const first = ROUTES.find(r => r[0] === pref);
    if (first) { try { return (await one(first))[1]; } catch (e) {} }
    // sinon : toutes les autres voies en parallèle, la première qui répond gagne
    const [name, j] = await Promise.any(ROUTES.filter(r => r !== first).map(one)).catch(() => { throw new Error('indisponible'); });
    try { localStorage.setItem(NEWS_ROUTE_KEY, name); } catch (e) {}
    return j;
  }
  const asList = j => Array.isArray(j) ? j : j && (j.data || j.events || j.items || j.results || j.calendar) || [];
  const IMP_MAP = { high: 'High', medium: 'Medium', low: 'Low', holiday: 'Holiday', '3': 'High', '2': 'Medium', '1': 'Low' };
  const fmtVal = (v, e) => v === null || v === undefined || v === '' ? '' : String(v) + (e && e.unit && /%/.test(e.unit) && !/%/.test(String(v)) ? '%' : '');
  const CC2CCY = { US: 'USD', EU: 'EUR', EA: 'EUR', EZ: 'EUR', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', GB: 'GBP', UK: 'GBP', JP: 'JPY', CH: 'CHF', AU: 'AUD', NZ: 'NZD', CA: 'CAD', CN: 'CNY' };
  const CCY2CC = { USD: ['US'], EUR: ['EU', 'DE', 'FR', 'IT', 'ES'], GBP: ['GB'], JPY: ['JP'], CHF: ['CH'], AUD: ['AU'], NZD: ['NZ'], CAD: ['CA'], CNY: ['CN'] };
  function normBQ(e) {
    const ts = new Date(e.time || e.date || e.datetime).getTime();
    const imp = String(e.type || '').toLowerCase() === 'holiday' ? 'Holiday' : (IMP_MAP[String(e.importance || e.impact || '').toLowerCase()] || 'Low');
    const cc = String(e.countryCode || e.country || '').toUpperCase();
    return { title: String(e.name || e.title || e.event || '').trim(), country: String(e.currency || CC2CCY[cc] || cc).toUpperCase(), cc, raw: e, date: e.time || e.date, ts, impact: imp, rawImp: String(e.importance || e.impact || ''),
      forecast: fmtVal(e.forecast, e), previous: fmtVal(e.revisedPrevious != null ? e.revisedPrevious : e.previous, e), actual: fmtVal(e.actual, e),
      eventId: e.eventId || e.id || '', allDay: e.timeMode && e.timeMode !== 'exact', src: 'bq' };
  }
  function normEv(e) { const ts = new Date(e.date).getTime(); return { title: String(e.title || e.event || '').trim(), country: String(e.country || e.currency || '').toUpperCase(), date: e.date, ts, impact: e.impact || 'Low', forecast: e.forecast || '', previous: e.previous || '', actual: e.actual || '', src: 'ff' }; }
  const evKey = e => e.src + '|' + e.country + '|' + e.title + '|' + new Date(e.ts).toISOString().slice(0, 16);
  const MAJOR_RE = /\b(core )?(cpi|ppi|hicp)\b|consumer price index|producer price index|non.?farm|unemployment rate|interest rate decision|rate decision|fed(eral)? funds|fomc|monetary policy (statement|report|summary)|press conference|retail sales|\bgdp\b|gross domestic product|\bpce\b|ism (manufacturing|services|non.?manufacturing)|average (hourly )?earnings|cash rate|official bank rate|main refinancing|deposit facility rate/i;
  const MAJOR_CCY = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD'];
  const ovKey = e => e.country + '|' + String(e.title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function effImpact(e) {
    const c = DB && DB.newsFilter || {}, ov = (c.impOverride || {})[ovKey(e)];
    if (ov) return ov;
    if (c.majorHigh !== false && e.srcImpact !== 'Holiday' && MAJOR_CCY.indexOf(e.country) >= 0 && MAJOR_RE.test(e.title)) return 'High';
    return e.srcImpact;
  }
  function applyImpacts() { NEWS_EVENTS.forEach(e => { e.srcImpact = e.srcImpact || e.impact; e.impact = effImpact(e); }); }
  function rebuildEvents(arch) {
    const bqDays = new Set(Object.values(arch).filter(e => e.src === 'bq').map(e => new Date(e.ts).toISOString().slice(0, 10)));
    NEWS_EVENTS = Object.values(arch).filter(e => !isNaN(e.ts) && !(e.src === 'ff' && bqDays.has(new Date(e.ts).toISOString().slice(0, 10)))).sort((a, b) => a.ts - b.ts);
    applyImpacts();
    return NEWS_EVENTS;
  }
  function getMeta() { try { return JSON.parse(localStorage.getItem(NEWS_META)) || {}; } catch (e) { return {}; } }
  function setMeta(m) { try { localStorage.setItem(NEWS_META, JSON.stringify(m)); } catch (e) {} }
  // charge le mois `ym` (et la semaine courante) ; cache : 30 mn pour le mois en cours, 12 h pour les autres
  function loadNewsEvents(force, ym) {
    const arch = archLoad(), meta = getMeta();
    const cur = new Date().toISOString().slice(0, 7); ym = ym || cur;
    const ttl = ym === cur ? 30 * 60e3 : 12 * 3600e3, k = 'bq:' + ym;
    if (!force && meta[k] && Date.now() - meta[k] < ttl && Object.keys(arch).length) return Promise.resolve(rebuildEvents(arch));
    if (NEWS_LOADING) return NEWS_LOADING;
    const from = addDaysISO(ym + '-01', -7), to = addDaysISO(addMonth(ym, 1) + '-01', 7);
    const span = l => { const v = l.filter(e => !isNaN(e.ts)).map(e => e.ts); return v.length ? [new Date(Math.min(...v)).toISOString().slice(0, 10), new Date(Math.max(...v)).toISOString().slice(0, 10)] : null; };
    const diag = { bq: null, ff: null };
    // biquote.io plafonne chaque réponse (en partant de la date de début) : lecture par pages,
    // on redemande à partir du dernier jour reçu jusqu'à atteindre la date de fin.
    const bqRange = async (extra, info) => {
      const out = [], seen = new Set(); let curD = from, guard = 0, req = 0;
      while (curD <= to && guard++ < 40) {
        const l = asList(await fetchJSON(`https://biquote.io/api/calendar?from=${curD}&to=${to}&limit=1000${extra}`)); req++;
        let added = 0;
        l.forEach(e => { const id = e.id || (e.eventId + '|' + e.time + '|' + e.name); if (!seen.has(id)) { seen.add(id); out.push(e); added++; } });
        if (!l.length || !added) break;
        const maxDay = l.map(e => String(e.time || e.date || '').slice(0, 10)).filter(Boolean).sort().pop();
        if (!maxDay || maxDay >= to) break;
        curD = maxDay > curD ? maxDay : addDaysISO(curD, 1);
      }
      const list = out.map(normBQ); info.n = list.length; info.req = req; info.span = span(list); return list;
    };
    const bq = (async () => {
      const nc0 = newsCfg(), ccs = [...new Set(nc0.currencies.concat(newsBlockCfg().currencies).flatMap(c => CCY2CC[c] || []))].join(',');
      diag.bqHigh = {}; diag.bqCcy = {};
      const parts = await Promise.all([
        bqRange('&importance=high', diag.bqHigh).catch(() => []),                    // toutes les news fortes, tous pays
        bqRange(ccs ? '&countries=' + ccs : '', diag.bqCcy).catch(() => []),          // tout pour les pays de tes devises
      ]);
      const list = parts[0].concat(parts[1]);
      if (!list.length) throw new Error('vide');
      diag.bq = { n: list.length, span: span(list), req: (diag.bqHigh.req || 0) + (diag.bqCcy.req || 0) }; return list;
    })().catch(() => { diag.bq = { err: true }; return null; });
    const ff = ym === cur ? fetchJSON('https://nfs.faireconomy.media/ff_calendar_thisweek.json').then(j => { const l = asList(j).map(normEv); diag.ff = { n: l.length, span: span(l) }; return l; }).catch(() => { diag.ff = { err: true }; return null; }) : Promise.resolve(null);
    NEWS_LOADING = Promise.all([bq, ff]).then(([a, b]) => {
      let got = 0; const srcs = []; meta.diag = diag; meta.diagAt = Date.now(); setMeta(meta);
      [[a, 'biquote.io'], [b, 'ForexFactory']].forEach(([list, nm]) => { if (list && list.length) { srcs.push(nm); list.forEach(n => { if (n.title && !isNaN(n.ts)) { arch[evKey(n)] = n; got++; } }); } });
      if (got) {
        const lim = Date.now() - 400 * 864e5; Object.keys(arch).forEach(x => { if (arch[x].ts < lim) delete arch[x]; });
        archSave(arch); meta[k] = Date.now(); meta.src = srcs.join(' + '); meta.at = Date.now(); setMeta(meta); NEWS_STATUS = '';
      } else { NEWS_FAIL[ym] = Date.now(); NEWS_STATUS = 'Aucune source de news joignable pour le moment (biquote.io et ForexFactory, en direct et via 4 relais). ' + (Object.keys(arch).length ? 'Affichage des données en cache.' : 'Vérifie ta connexion puis clique « Actualiser ».'); }
      NEWS_LOADING = null; return rebuildEvents(arch);
    });
    return NEWS_LOADING;
  }
  const HIST = {}, NEWS_FAIL = {};
  function newsDiag() {
    const d = (getMeta().diag) || {}, f = x => x ? (x.err ? 'injoignable' : x.n + ' événements' + (x.span ? ` (${x.span[0].slice(8)}/${x.span[0].slice(5, 7)} → ${x.span[1].slice(8)}/${x.span[1].slice(5, 7)})` : '')) : 'non interrogé';
    let route = ''; try { route = localStorage.getItem(NEWS_ROUTE_KEY) || ''; } catch (e) {}
    const cnt = {}; NEWS_EVENTS.forEach(e => { cnt[e.impact] = (cnt[e.impact] || 0) + 1; });
    const unk = [...new Set(NEWS_EVENTS.filter(e => e.src === 'bq' && e.rawImp && !IMP_MAP[e.rawImp.toLowerCase()]).map(e => e.rawImp))];
    const fx = x => x && x.n !== undefined ? `${x.n} (${x.req || 0} req.${x.span ? ', ' + x.span[0].slice(8) + '/' + x.span[0].slice(5, 7) + ' → ' + x.span[1].slice(8) + '/' + x.span[1].slice(5, 7) : ''})` : '–';
    return `Diagnostic : biquote.io ${f(d.bq)} [fortes ${fx(d.bqHigh)} · tes devises ${fx(d.bqCcy)}] · ForexFactory ${f(d.ff)}${route ? ' · voie : ' + route : ''} · impacts : fort ${cnt.High || 0}, moyen ${cnt.Medium || 0}, faible ${cnt.Low || 0}, férié ${cnt.Holiday || 0}${unk.length ? ' · valeurs d\'impact inconnues : ' + unk.join(', ') : ''}`;
  }
  function loadHistory(e) {
    if (!e.eventId || HIST[e.eventId]) return Promise.resolve(HIST[e.eventId] || null);
    return fetchJSON('https://biquote.io/api/calendar/' + encodeURIComponent(e.eventId) + '/history').then(j => {
      HIST[e.eventId] = asList(j).map(normBQ).filter(h => !isNaN(h.ts)).sort((a, b) => b.ts - a.ts); return HIST[e.eventId];
    }).catch(() => { HIST[e.eventId] = []; return []; });
  }
  function tzParts(ts, tz) {
    const p = {}; new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ts)).forEach(x => p[x.type] = x.value);
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` };
  }
  function tzToTs(date, time, tz) {   // date + heure locales (dans tz) -> timestamp
    const [y, m, d] = date.split('-').map(Number), mm = toMin(time); if (mm === null) return NaN;
    const guess = Date.UTC(y, m - 1, d, Math.floor(mm / 60), mm % 60);
    const p = tzParts(guess, tz), back = Date.UTC(+p.date.slice(0, 4), +p.date.slice(5, 7) - 1, +p.date.slice(8), +p.time.slice(0, 2), +p.time.slice(3));
    return guess - (back - guess);
  }
  function newsFiltered() { const c = newsCfg(); return NEWS_EVENTS.filter(e => (c.currencies.indexOf(e.country) >= 0 || e.country === 'ALL') && c.impacts.some(i => i.toLowerCase() === String(e.impact).toLowerCase())); }
  function blockWindows(evs) {
    const b = newsBlockCfg(); if (!b.enabled) return [];
    const w = (+b.window || 15) * 60e3, out = [];
    evs.filter(e => String(e.impact).toLowerCase() === 'high' && b.currencies.indexOf(e.country) >= 0).forEach(e => {
      const a = e.ts - (b.behavior === 'after' ? 0 : w), z = e.ts + (b.behavior === 'before' ? 0 : w);
      const last = out[out.length - 1];
      if (last && a <= last.to) { last.to = Math.max(last.to, z); last.evs.push(e); } else out.push({ from: a, to: z, evs: [e] });
    });
    return out;
  }
  function newsBlockAt(ts) { if (isNaN(ts)) return null; return blockWindows(NEWS_EVENTS).find(w => ts >= w.from && ts <= w.to) || null; }
  function newsBlockPill() {
    const w = newsBlockAt(Date.now()); if (!w) return '';
    const tz = newsCfg().tz;
    return `<a class="gr-pill gr-pill-danger" href="#/news" title="${esc(w.evs.map(e => e.country + ' ' + e.title).join(' · '))}">🔒 Trading bloqué jusqu'à ${tzParts(w.to, tz).time} (${esc(w.evs[0].country + ' ' + trunc(w.evs[0].title, 24))})</a>`;
  }
  const EV_DESC = [
    [/\bcpi\b|consumer price/i, 'Indice des prix à la consommation : mesure l\'inflation payée par les ménages. Un chiffre au-dessus des attentes soutient en général la devise (anticipation de taux plus hauts).'],
    [/\bppi\b|producer price/i, 'Indice des prix à la production : inflation des prix de vente des producteurs, souvent annonciatrice du CPI.'],
    [/non-farm|nfp/i, 'Créations d\'emplois hors secteur agricole : l\'un des chiffres les plus suivis du marché, forte volatilité sur l\'USD.'],
    [/unemployment|jobless|claimant/i, 'Chômage / inscriptions au chômage : santé du marché du travail.'],
    [/fomc|federal funds|rate statement|cash rate|official bank rate|main refinancing|policy rate|interest rate|monetary policy/i, 'Décision ou communication de politique monétaire : peut provoquer de très forts mouvements, avant et pendant la conférence de presse.'],
    [/press conference|speaks|testifies/i, 'Discours d\'un responsable de banque centrale ou du gouvernement : volatilité imprévisible pendant toute la durée de l\'intervention.'],
    [/\bgdp\b/i, 'Produit intérieur brut : mesure la croissance de l\'économie.'],
    [/retail sales/i, 'Ventes au détail : consommation des ménages.'],
    [/\bpmi\b/i, 'Indice des directeurs d\'achat : au-dessus de 50 = expansion, en dessous = contraction.'],
    [/\bpce\b/i, 'Dépenses de consommation (PCE) : mesure d\'inflation préférée de la Fed.'],
    [/trade balance/i, 'Balance commerciale : exportations moins importations.'],
    [/sentiment|confidence/i, 'Indice de confiance : moral des consommateurs ou des entreprises.'],
    [/bank holiday|holiday/i, 'Jour férié : liquidité réduite sur la devise concernée.'],
  ];
  const evDesc = t => (EV_DESC.find(([re]) => re.test(t)) || [null, ''])[1];
  function relTime(ts) { const d = Math.round((ts - Date.now()) / 60000); if (Math.abs(d) < 1) return 'maintenant'; const a = Math.abs(d), s = a < 60 ? a + ' mn' : a < 1440 ? Math.round(a / 60) + ' h' : Math.round(a / 1440) + ' j'; return d > 0 ? 'dans ' + s : 'il y a ' + s; }
  const fmtDayLong = (iso, tz) => new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const addMonth = (ym, k) => { const d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + k, 1)); return d.toISOString().slice(0, 7); };

  function renderNews() {
    const nc = $('#news-container'); nc.hidden = false; $('#main').hidden = true;
    const c = newsCfg(), tz = c.tz, today = tzParts(Date.now(), tz).date;
    if (!NUI.day) NUI.day = today; if (!NUI.month) NUI.month = NUI.day.slice(0, 7);
    const evs = newsFiltered(), byDay = {};
    evs.forEach(e => { const d = tzParts(e.ts, tz).date; (byDay[d] = byDay[d] || []).push(e); });
    const blocks = blockWindows(NEWS_EVENTS);
    const blockDays = new Set(blocks.map(w => tzParts(w.evs[0].ts, tz).date));
    // grille : 6 semaines à partir du lundi précédant le 1er du mois
    const first = NUI.month + '-01', dow = (new Date(first + 'T00:00:00Z').getUTCDay() + 6) % 7, start = addDaysISO(first, -dow);
    const cells = []; for (let i = 0; i < 42; i++) cells.push(addDaysISO(start, i));
    const dim = new Date(Date.UTC(+NUI.month.slice(0, 4), +NUI.month.slice(5, 7), 0)).getUTCDate(), weeks = Math.ceil((dow + dim) / 7);
    const monthLabel = new Date(first + 'T00:00:00Z').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const cell = d => {
      const list = byDay[d] || [], cnt = { hi: 0, me: 0, lo: 0, ho: 0 }; list.forEach(e => cnt[impCls(e.impact)]++);
      const top = cnt.hi ? 'hi' : cnt.me ? 'me' : '';
      const we = [5, 6].indexOf((new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7) >= 0;
      const label = +d.slice(8) === 1 && d.slice(0, 7) !== NUI.month ? new Date(d + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : String(+d.slice(8));
      return `<button class="nc-cell ${d.slice(0, 7) !== NUI.month ? 'out' : ''} ${we ? 'we' : ''} ${top ? 'b-' + top : ''} ${d === NUI.day ? 'sel' : ''}" data-day="${d}">
        <span class="nc-num">${d === today ? `<span class="nc-today"><span class="lbl">Aujourd'hui </span>${+d.slice(8)}</span>` : esc(label)}</span>
        <span class="nc-cnt">${['hi', 'me', 'lo', 'ho'].filter(k => cnt[k]).map(k => `<span><i class="dot ${k}"></i>${cnt[k]}</span>`).join('')}</span>
        ${blockDays.has(d) ? '<span class="nc-lock" title="Blocage news ce jour">🔒</span>' : ''}</button>`;
    };
    // liste du jour
    const q = NUI.q.toLowerCase();
    const dayEvs = q ? [] : (byDay[NUI.day] || []);
    const ALIAS = { ppi: /producer price|\bppi\b/i, cpi: /consumer price|\bcpi\b/i, nfp: /non.?farm|payroll/i, pib: /\bgdp\b|gross domestic/i, gdp: /\bgdp\b|gross domestic/i, fomc: /fomc|fed(eral)? funds|interest rate/i };
    const qm = e => (e.country + ' ' + e.title).toLowerCase().indexOf(q) >= 0 || (ALIAS[q] && ALIAS[q].test(e.title));
    const found = q ? NEWS_EVENTS.filter(qm).sort((a, b) => b.ts - a.ts).slice(0, 80) : [];
    const dayBlocks = blocks.filter(w => tzParts(w.from, tz).date === NUI.day || tzParts(w.to, tz).date === NUI.day);
    let rows = '', bi = 0;
    dayEvs.forEach(e => {
      while (bi < dayBlocks.length && dayBlocks[bi].from <= e.ts) { const w = dayBlocks[bi++]; rows += `<div class="nc-lockrow">🔒 ${tzParts(w.from, tz).time} · Trading bloqué jusqu'à ${tzParts(w.to, tz).time}</div>`; }
      const k = evKey(e), t = tzParts(e.ts, tz).time;
      rows += `<button class="nc-ev ${k === NUI.sel ? 'on' : ''} ${e.ts < Date.now() ? 'past' : ''}" data-ev="${esc(k)}"><span class="t">${e.allDay || (/^00:00$/.test(t) && /holiday/i.test(e.impact)) ? 'Jour' : t}</span><span class="c">${CCY_FLAG[e.country] || ''} ${esc(e.country)}</span><i class="dot ${impCls(e.impact)}"></i><span class="n">${esc(e.title)}</span></button>`;
    });
    if (q) rows = `<div class="pad"><button class="btn sm" id="nc-raw">📋 Copier les données brutes (pour diagnostic)</button></div>` + (found.length ? `<div class="muted small pad">${found.length} résultat(s) sur toute la période chargée, sans filtre de devise ni d'impact</div>` + found.map(e => { const k = evKey(e), pt = tzParts(e.ts, tz); return `<button class="nc-ev ${k === NUI.sel ? 'on' : ''}" data-ev="${esc(k)}" data-evday="${pt.date}"><span class="t">${pt.date.slice(8)}/${pt.date.slice(5, 7)}<br>${pt.time}</span><span class="c">${CCY_FLAG[e.country] || ''} ${esc(e.country)}</span><i class="dot ${impCls(e.impact)}"></i><span class="n">${esc(e.title)}</span></button>`; }).join('') : '<p class="muted small pad">Aucun événement trouvé dans la période chargée.</p>');
    const sel = NUI.sel && NEWS_EVENTS.find(e => evKey(e) === NUI.sel);
    const hist = sel ? ((sel.eventId && HIST[sel.eventId] && HIST[sel.eventId].length) ? HIST[sel.eventId] : NEWS_EVENTS.filter(e => e.country === sel.country && e.title === sel.title).sort((a, b) => b.ts - a.ts)) : [];
    const b = newsBlockCfg();
    const isToday = NUI.day === today;
    nc.innerHTML = `<div class="nc-wrap">
      <div class="nc-head"><h1>Calendrier économique</h1>
        <div class="nc-tools">
          <label class="nc-tz">Fuseau<select id="nc-tz">${[...new Set([tz].concat(TZ_LIST))].map(z => `<option value="${esc(z)}"${z === tz ? ' selected' : ''}>${esc(z.replace('_', ' '))} (${tzParts(Date.now(), z).time})</option>`).join('')}</select></label>
          <button class="btn" id="nc-alerts">${newsAlertCfg().enabled ? '🔔 Alertes : ' + newsAlertCfg().leads.slice().sort((a, b) => b - a).map(m => m === 60 ? '1 h' : m + ' mn').join(', ') : '🔕 Alertes'}</button>
          <button class="btn" id="nc-block">${b.enabled ? '🔒 Blocage news : ' + b.window + ' mn' : '🔓 Blocage news'}</button>
          <button class="btn" id="nc-refresh">Actualiser</button>
        </div></div>
      <div class="nc-filters">
        <div class="nc-chips">${ALL_CCY.map(x => `<button class="nc-chip ${c.currencies.indexOf(x) >= 0 ? 'on' : ''}" data-ccy="${x}">${CCY_FLAG[x]} ${x}</button>`).join('')}</div>
        <div class="nc-chips">${IMPACTS.map(([k, l, cl]) => `<button class="nc-chip ${c.impacts.indexOf(k) >= 0 ? 'on' : ''}" data-imp="${k}"><i class="dot ${cl}"></i> ${l}</button>`).join('')}
          <label class="nc-major"><input type="checkbox" id="nc-major" ${c.majorHigh !== false ? 'checked' : ''}> Indicateurs majeurs toujours en fort (CPI, PPI, NFP, taux, PIB, ventes au détail, PMI ISM…)</label></div>
      </div>
      ${NEWS_STATUS ? `<div class="note">${esc(NEWS_STATUS)}</div>` : ''}
      <div class="nc-layout">
        <div class="nc-cal card">
          <div class="nc-calhead"><button class="btn sm" id="nc-pm" aria-label="Mois précédent">‹</button><button class="btn sm" id="nc-nm" aria-label="Mois suivant">›</button><h2>${esc(monthLabel)}</h2></div>
          <div class="nc-grid">${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => `<div class="nc-wd">${d}</div>`).join('')}${cells.slice(0, weeks * 7).map(cell).join('')}</div>
        </div>
        <div class="nc-day card">
          <div class="nc-dayhead"><button class="btn sm" id="nc-pd" aria-label="Jour précédent">‹</button><button class="btn sm" id="nc-nd" aria-label="Jour suivant">›</button><h2>${esc(fmtDayLong(NUI.day))}${isToday ? ' · Aujourd\'hui' : ''}</h2><button class="btn sm" id="nc-today" ${isToday ? 'disabled' : ''}>Aujourd'hui</button></div>
          <input id="nc-q" type="search" placeholder="Rechercher dans toute la période (ex. PPI)…" value="${esc(NUI.q)}">
          <div class="nc-list">${rows || `<p class="muted small pad">${NEWS_EVENTS.length ? 'Aucun événement pour ce jour avec ces filtres.' : 'Chargement des événements…'}</p>`}</div>
          ${sel ? `<div class="nc-detail" id="nc-detail">
            <div class="nc-dethead"><h3>${CCY_FLAG[sel.country] || ''} ${esc(sel.title)}</h3><button class="btn sm" id="nc-close" aria-label="Fermer">×</button></div>
            <p class="small">🕒 ${esc(fmtDayLong(tzParts(sel.ts, tz).date))} · ${tzParts(sel.ts, tz).time} (${esc(tz)}) · <b>${relTime(sel.ts)}</b></p>
            <div class="nc-facts"><div><span>Devise</span>${esc(sel.country)}</div><div><span>Impact</span><i class="dot ${impCls(sel.impact)}"></i> ${esc((IMPACTS.find(x => x[0].toLowerCase() === String(sel.impact).toLowerCase()) || [0, sel.impact])[1])}</div><div><span>Prévision</span>${esc(sel.forecast || '–')}</div><div><span>Précédent</span>${esc(sel.previous || '–')}</div>${sel.actual ? `<div><span>Réel</span>${esc(sel.actual)}</div>` : ''}</div>
            <label class="nc-ov">Impact de cette news <select id="nc-ov"><option value="">Automatique (${esc(sel.srcImpact === sel.impact ? 'source : ' + (sel.rawImp || sel.srcImpact) : 'source : ' + (sel.rawImp || sel.srcImpact) + ', relevé à Fort')})</option>${IMPACTS.map(([k, l]) => `<option value="${k}"${((newsCfg().impOverride || {})[ovKey(sel)] === k) ? ' selected' : ''}>${l} (toujours)</option>`).join('')}</select></label>
            ${evDesc(sel.title) ? `<p class="small">${esc(evDesc(sel.title))}</p>` : ''}
            ${hist.length > 1 ? `<table class="nc-hist"><thead><tr><th>Date</th><th class="num">Réel${hist.some(h => h.src === 'ff') ? '*' : ''}</th><th class="num">Prévision</th><th class="num">Précédent</th></tr></thead><tbody>${hist.slice(0, 8).map((h, i) => `<tr><td>${esc(tzParts(h.ts, tz).date)}</td><td class="num">${esc(h.actual || (h.src === 'ff' && i > 0 ? hist[i - 1].previous : '') || '–')}</td><td class="num">${esc(h.forecast || '–')}</td><td class="num">${esc(h.previous || '–')}</td></tr>`).join('')}</tbody></table>${hist.some(h => h.src === 'ff') ? '<p class="muted small">* Réel estimé = valeur « précédent » annoncée à la publication suivante (ForexFactory ne donne pas le réel).</p>' : ''}` : ''}
          </div>` : ''}
        </div>
      </div>
      <p class="muted small">${newsDiag()}</p>
      <p class="muted small">Sources : ${esc(getMeta().src || 'biquote.io, ForexFactory')} (environ 90 jours avant et après aujourd'hui)${getMeta().at ? ' · mis à jour ' + relTime(getMeta().at) : ''}. Heures affichées dans le fuseau ${esc(tz)}. <a href="https://www.investing.com/economic-calendar/" target="_blank" rel="noopener">Ouvrir investing.com</a></p>
      ${NUI.settings ? newsSettingsHTML() : ''}${NUI.alerts ? newsAlertsHTML() : ''}
    </div>`;
    const go = () => renderNews();
    nc.querySelectorAll('[data-day]').forEach(x => x.onclick = () => { NUI.day = x.dataset.day; NUI.sel = ''; if (NUI.day.slice(0, 7) !== NUI.month) NUI.month = NUI.day.slice(0, 7); go(); });
    nc.querySelectorAll('[data-ev]').forEach(x => x.onclick = () => { NUI.sel = NUI.sel === x.dataset.ev ? '' : x.dataset.ev; if (x.dataset.evday) { NUI.day = x.dataset.evday; NUI.month = NUI.day.slice(0, 7); } go(); });
    nc.querySelectorAll('[data-ccy]').forEach(x => x.onclick = () => { const a = newsCfg().currencies, i = a.indexOf(x.dataset.ccy); if (i >= 0) { if (a.length > 1) a.splice(i, 1); } else a.push(x.dataset.ccy); saveNewsSoon(); go(); });
    nc.querySelectorAll('[data-imp]').forEach(x => x.onclick = () => { const a = newsCfg().impacts, i = a.indexOf(x.dataset.imp); if (i >= 0) { if (a.length > 1) a.splice(i, 1); } else a.push(x.dataset.imp); saveNewsSoon(); go(); });
    $('#nc-tz').onchange = e => { newsCfg().tz = e.target.value; NUI.day = ''; NUI.month = ''; save('Fuseau horaire enregistré'); go(); };
    $('#nc-pm').onclick = () => { NUI.month = addMonth(NUI.month, -1); go(); };
    $('#nc-nm').onclick = () => { NUI.month = addMonth(NUI.month, 1); go(); };
    $('#nc-pd').onclick = () => { NUI.day = addDaysISO(NUI.day, -1); NUI.month = NUI.day.slice(0, 7); NUI.sel = ''; go(); };
    $('#nc-nd').onclick = () => { NUI.day = addDaysISO(NUI.day, 1); NUI.month = NUI.day.slice(0, 7); NUI.sel = ''; go(); };
    $('#nc-today').onclick = () => { NUI.day = today; NUI.month = today.slice(0, 7); NUI.sel = ''; go(); };
    $('#nc-q').onchange = e => { NUI.q = e.target.value.trim(); go(); };
    $('#nc-refresh').onclick = () => { $('#nc-refresh').disabled = true; loadNewsEvents(true, NUI.month).then(() => { if (view === 'news') go(); }); };
    $('#nc-block').onclick = () => { NUI.settings = true; go(); };
    $('#nc-alerts').onclick = () => { NUI.alerts = true; go(); };
    if (sel && $('#nc-close')) $('#nc-close').onclick = () => { NUI.sel = ''; go(); };
    if ($('#nc-raw')) $('#nc-raw').onclick = () => {
      const dayRaw = NEWS_EVENTS.filter(e => ['2026-11-06', '2026-11-13', NUI.day].indexOf(tzParts(e.ts, 'UTC').date) >= 0 && (e.country === 'USD' || e.cc === 'US')).slice(0, 60);
      const txt = JSON.stringify({ diag: getMeta().diag, q: NUI.q, found: found.filter(e => e.country === 'USD').slice(0, 40).map(e => e.raw || e), usSample: dayRaw.map(e => e.raw || e), total: NEWS_EVENTS.length }, null, 1);
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Données copiées : colle-les dans la conversation avec Claude'), () => { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Données copiées'); } catch (e) {} ta.remove(); });
    };
    if (sel && $('#nc-ov')) $('#nc-ov').onchange = e => { const c2 = newsCfg(); c2.impOverride = c2.impOverride || {}; if (e.target.value) c2.impOverride[ovKey(sel)] = e.target.value; else delete c2.impOverride[ovKey(sel)]; applyImpacts(); saveNewsSoon('Impact enregistré'); go(); };
    if ($('#nc-major')) $('#nc-major').onchange = e => { newsCfg().majorHigh = e.target.checked; applyImpacts(); saveNewsSoon(); go(); };
    if (NUI.settings) wireNewsSettings();
    if (NUI.alerts) wireNewsAlerts();
    const meta = getMeta();
    const recentFail = NEWS_FAIL[NUI.month] && Date.now() - NEWS_FAIL[NUI.month] < 2 * 60e3;
    if (!NEWS_LOADING && !recentFail && (!NEWS_EVENTS.length || !(meta['bq:' + NUI.month] && Date.now() - meta['bq:' + NUI.month] < 12 * 3600e3))) loadNewsEvents(false, NUI.month).then(() => { if (view === 'news') go(); });
    if (sel && sel.eventId && !HIST[sel.eventId]) loadHistory(sel).then(() => { if (view === 'news' && NUI.sel === evKey(sel)) go(); });
  }
  function newsSettingsHTML() {
    const b = newsBlockCfg();
    const desc = (b.behavior === 'before' ? `${b.window} mn avant` : b.behavior === 'after' ? `${b.window} mn après` : `${b.window} mn avant et ${b.window} mn après`) + ` les news à fort impact ${b.currencies.join(', ')}`;
    return `<div class="nc-overlay"><div class="nc-modal card" role="dialog" aria-label="Blocage news">
      <div class="nc-dethead"><h3>Blocage du trading autour des news</h3><button class="btn sm" id="ns-x" aria-label="Fermer">×</button></div>
      <label class="nc-switch"><input type="checkbox" id="ns-on" ${b.enabled ? 'checked' : ''}> <span><b>Activer le blocage news</b><br><span class="muted small">Pastille rouge pendant la fenêtre, avertissement si tu enregistres un trade dedans (marqué « Garde-fou : news »).</span></span></label>
      <div class="ns-sec"><div class="ms-title">Devises</div><div class="nc-chips">${ALL_CCY.map(x => `<button class="nc-chip ${b.currencies.indexOf(x) >= 0 ? 'on' : ''}" data-bccy="${x}">${CCY_FLAG[x]} ${x}</button>`).join('')}</div></div>
      <div class="ns-sec"><div class="ms-title">Fenêtre</div><div class="nc-seg">${[5, 10, 15, 30, 60].map(m => `<button class="${+b.window === m ? 'on' : ''}" data-bw="${m}">${m} mn</button>`).join('')}</div></div>
      <div class="ns-sec"><div class="ms-title">Comportement</div><select id="ns-beh"><option value="both"${b.behavior === 'both' ? ' selected' : ''}>Avant et après</option><option value="before"${b.behavior === 'before' ? ' selected' : ''}>Avant seulement</option><option value="after"${b.behavior === 'after' ? ' selected' : ''}>Après seulement</option></select></div>
      <div class="note">🕒 Bloque les nouveaux trades ${esc(desc)}.</div>
      <div class="actions"><button class="btn" id="ns-cancel">Annuler</button><button class="btn primary" id="ns-save">Enregistrer</button></div>
    </div></div>`;
  }
  let _nsDraft = null;
  function wireNewsSettings() {
    const b = newsBlockCfg(); if (!_nsDraft) _nsDraft = JSON.parse(JSON.stringify(b));
    const redraw = () => { DB.newsBlock = _nsDraft; renderNews(); };
    $('#ns-on').onchange = e => { _nsDraft.enabled = e.target.checked; redraw(); };
    document.querySelectorAll('[data-bccy]').forEach(x => x.onclick = () => { const a = _nsDraft.currencies, i = a.indexOf(x.dataset.bccy); if (i >= 0) a.splice(i, 1); else a.push(x.dataset.bccy); redraw(); });
    document.querySelectorAll('[data-bw]').forEach(x => x.onclick = () => { _nsDraft.window = +x.dataset.bw; redraw(); });
    $('#ns-beh').onchange = e => { _nsDraft.behavior = e.target.value; redraw(); };
    const close = () => { NUI.settings = false; _nsDraft = null; renderNews(); };
    $('#ns-x').onclick = $('#ns-cancel').onclick = () => { DB.newsBlock = NUI._bk || DB.newsBlock; delete NUI._bk; close(); };
    if (!NUI._bk) NUI._bk = JSON.parse(JSON.stringify(b));
    $('#ns-save').onclick = async () => { DB.newsBlock = _nsDraft; delete NUI._bk; NUI.settings = false; _nsDraft = null; await save('Blocage news enregistré'); updateStatusBar(); renderNews(); };
  }
  function hideNews() { const nc = $('#news-container'); if (nc) nc.hidden = true; $('#main').hidden = false; }


  /* ================= V5 : thèmes, Sanctuary, Journal calendrier (R), Trading Plan ================= */

  /* ---------- THÈME ---------- */
  const THEME_KEY = 'journal_theme_v1';
  const THEMES = [['light', '☀️ Clair'], ['dark', '🌙 Sombre'], ['auto', '🖥 Auto']];
  function getTheme() { try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { return 'auto'; } }
  function applyTheme(t) {
    t = t || getTheme();
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    const tv = DB && DB.tradingView; // le graphique intégré suit le thème si l'utilisateur n'a rien choisi
    if (tv && !tv.themeLocked) tv.theme = (t === 'light' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches)) ? 'light' : 'dark';
  }
  function themeSwitcher() {
    const top = document.querySelector('.top'); if (!top || document.getElementById('theme-sel')) return;
    const sel = document.createElement('select'); sel.id = 'theme-sel'; sel.className = 'theme-sel'; sel.setAttribute('aria-label', 'Thème du journal');
    sel.innerHTML = THEMES.map(([k, l]) => `<option value="${k}"${k === getTheme() ? ' selected' : ''}>${l}</option>`).join('');
    sel.onchange = () => { try { localStorage.setItem(THEME_KEY, sel.value); } catch (e) {} applyTheme(sel.value); render(); };
    const auth = top.querySelector('#auth-info');
    if (auth) top.insertBefore(sel, auth); else top.appendChild(sel);
  }
  applyTheme();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', themeSwitcher); else setTimeout(themeSwitcher, 0);

  /* ---------- SANCTUARY : paysages (SVG générés), sons (Web Audio), séances, exercices ---------- */
  const SCENES = [
    { name: 'Aube sur les crêtes', sky: ['#f6c9a7', '#a9c6ea'], m: ['#8fa3c4', '#6a80a6', '#475a7d'], sun: '#fff1d6' },
    { name: 'Vallée verte', sky: ['#d9e4ea', '#eef3f5'], m: ['#94b483', '#6f955f', '#4b6f41'], sun: null },
    { name: 'Océan calme', sky: ['#a7c6f7', '#d6ecfb'], m: ['#7da3c2', '#58819f', '#2f5a7a'], sun: '#ffffff', sea: true },
    { name: 'Crépuscule', sky: ['#f6b6d6', '#9fb6ea'], m: ['#9b86b8', '#755f96', '#4d3e6c'], sun: '#ffe1b8' },
    { name: 'Nuit étoilée', sky: ['#0f2230', '#2c5266'], m: ['#284456', '#1b3242', '#10202c'], sun: '#f5f3d7', stars: true },
  ];
  function sceneSVG(i, small) {
    const s = SCENES[i % SCENES.length]; let seed = (i + 1) * 9301;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const ridge = (base, amp, n) => { let d = `M0,${base}`; for (let k = 0; k <= n; k++) d += ` L${(k / n * 400).toFixed(1)},${(base - rnd() * amp).toFixed(1)}`; return d + ' L400,220 L0,220 Z'; };
    const id = 'sg' + i + (small ? 's' : '');
    let stars = ''; if (s.stars) for (let k = 0; k < 40; k++) stars += `<circle cx="${(rnd() * 400).toFixed(0)}" cy="${(rnd() * 90).toFixed(0)}" r="${(rnd() * 1.2 + .3).toFixed(1)}" fill="#fff" opacity="${(rnd() * .6 + .3).toFixed(2)}"/>`;
    return `<svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" class="scene" role="img" aria-label="${esc(s.name)}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.sky[0]}"/><stop offset="1" stop-color="${s.sky[1]}"/></linearGradient></defs>
      <rect width="400" height="220" fill="url(#${id})"/>${stars}${s.sun ? `<circle cx="${s.stars ? 320 : 290}" cy="${s.stars ? 45 : 70}" r="${s.stars ? 14 : 22}" fill="${s.sun}" opacity=".9"/>` : ''}
      <path d="${ridge(120, 50, 9)}" fill="${s.m[0]}" opacity=".85"/><path d="${ridge(150, 45, 7)}" fill="${s.m[1]}" opacity=".92"/>${s.sea ? '<rect y="175" width="400" height="45" fill="#3f6f93" opacity=".9"/>' : ''}<path d="${ridge(s.sea ? 182 : 180, 35, 6)}" fill="${s.m[2]}"/></svg>`;
  }
  const AMB = { ctx: null, nodes: [], gain: null, kind: 'none' };
  const SOUNDS = [['none', 'Silence'], ['rain', 'Pluie'], ['ocean', 'Vagues'], ['wind', 'Vent'], ['brown', 'Bruit brun'], ['bowl', 'Bol chantant']];
  function audioCtx() { if (!AMB.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; AMB.ctx = new AC(); } if (AMB.ctx.state === 'suspended') AMB.ctx.resume(); return AMB.ctx; }
  function noiseSrc(C, type) {
    const len = C.sampleRate * 4, buf = C.createBuffer(1, len, C.sampleRate), d = buf.getChannelData(0); let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else if (type === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; } else d[i] = w * 0.35; }
    const s = C.createBufferSource(); s.buffer = buf; s.loop = true; return s;
  }
  function lfo(C, freq, depth, target, offset) { const o = C.createOscillator(), g = C.createGain(); o.frequency.value = freq; g.gain.value = depth; o.connect(g).connect(target); if (offset !== undefined) target.value = offset; o.start(); AMB.nodes.push(o); }
  function ambStart(kind, vol) {
    ambStop(); AMB.kind = kind; if (kind === 'none') return;
    const C = audioCtx(); if (!C) return;
    const g = C.createGain(); g.gain.value = 0; g.connect(C.destination); g.gain.linearRampToValueAtTime(vol, C.currentTime + 2); AMB.gain = g;
    const flt = (type, f, q) => { const b = C.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
    if (kind === 'rain') { const s = noiseSrc(C, 'white'), a = flt('highpass', 600), b = flt('lowpass', 7500); s.connect(a).connect(b).connect(g); s.start(); AMB.nodes.push(s); }
    if (kind === 'ocean') { const s = noiseSrc(C, 'brown'), a = flt('lowpass', 900), w = C.createGain(); s.connect(a).connect(w).connect(g); lfo(C, 0.09, 0.45, w.gain, 0.55); s.start(); AMB.nodes.push(s); }
    if (kind === 'wind') { const s = noiseSrc(C, 'pink'), a = flt('bandpass', 500, 0.8); s.connect(a).connect(g); lfo(C, 0.05, 280, a.frequency, 520); s.start(); AMB.nodes.push(s); }
    if (kind === 'brown') { const s = noiseSrc(C, 'brown'); s.connect(g); s.start(); AMB.nodes.push(s); }
    if (kind === 'bowl') [[196, .5], [392.6, .25], [588, .12], [784.9, .06]].forEach(([f, a], k) => { const o = C.createOscillator(), og = C.createGain(); o.type = 'sine'; o.frequency.value = f; og.gain.value = a * 0.35; o.connect(og).connect(g); lfo(C, 0.07 + k * 0.03, a * 0.12, og.gain); o.start(); AMB.nodes.push(o); });
  }
  function ambVolume(v) { if (AMB.gain && AMB.ctx) AMB.gain.gain.setTargetAtTime(v, AMB.ctx.currentTime, 0.2); }
  function ambStop() { AMB.nodes.forEach(n => { try { n.stop(); } catch (e) {} }); AMB.nodes = []; if (AMB.gain) { try { AMB.gain.disconnect(); } catch (e) {} AMB.gain = null; } AMB.kind = 'none'; }
  function bell(n) {
    const C = audioCtx(); if (!C) return;
    for (let r = 0; r < (n || 1); r++) [[1, .5], [2.76, .18], [5.4, .08]].forEach(([k, a]) => {
      const o = C.createOscillator(), g = C.createGain(), t0 = C.currentTime + r * 2.2; o.frequency.value = 528 * k; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(a * 0.5, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.5);
      o.connect(g).connect(C.destination); o.start(t0); o.stop(t0 + 4.6);
    });
  }
  function sanct() { const d = { sessions: [], favs: [], scene: 0, minutes: 10, bells: true, bellEvery: 1, sound: 'rain', volume: 0.5, voice: false }; if (!DB.sanctuary) DB.sanctuary = {}; Object.keys(d).forEach(k => { if (DB.sanctuary[k] === undefined) DB.sanctuary[k] = d[k]; }); return DB.sanctuary; }
  function planRuleLines() {
    const p = activePlan ? activePlan() : null; if (!p) return [];
    const entry = (p.sections || []).find(s => /entry|entrée/i.test(s.title)), out = [];
    if (entry) entry.items.filter(Boolean).forEach(x => out.push([8, x]));
    (p.notes || []).filter(Boolean).slice(0, 4).forEach(x => out.push([10, x]));
    return out;
  }
  const EXOS = () => [
    { id: 'reboot60', cat: 'Reboot', name: 'Reset 60 secondes', sub: 'Remise à zéro rapide', scene: 2, steps: [[10, 'Lâche la souris. Pose les mains à plat, épaules relâchées.'], [15, 'Deux inspirations par le nez, puis une longue expiration par la bouche.'], [15, 'Encore une fois : deux inspirations, une longue expiration.'], [10, 'Nomme en un mot ce que tu ressens.'], [10, 'Reviens au plan : quel est le prochain point de ta checklist ?']] },
    { id: 'box', cat: 'Reboot', name: 'Respiration carrée', sub: '4 – 4 – 4 – 4', scene: 4, breath: [4, 4, 4, 4], cycles: 12 },
    { id: 'sigh', cat: 'Reboot', name: 'Soupir physiologique', sub: 'Calme en 2 minutes', scene: 1, breath: [3, 1, 6, 0], cycles: 12, labels: ['Inspire', 'Petite inspiration en plus', 'Longue expiration', ''] },
    { id: 'revenge', cat: 'Recovery', name: 'Après une perte', sub: 'Stopper le revenge trade', scene: 3, steps: [[20, 'Ferme la plateforme ou recule ta chaise. Aucun ordre pendant cet exercice.'], [30, 'Respire lentement : 4 secondes d\'inspiration, 6 secondes d\'expiration.'], [20, 'Cette perte faisait partie du risque prévu. 1 R, rien de plus.'], [25, 'Relis ta règle : « If invalidation hits, reset. No coping, no revenge trade. »'], [25, 'Vérifie tes garde-fous : as-tu atteint ta perte maximale ou ton nombre de trades du jour ?'], [30, 'Décide maintenant : pause de 30 minutes ou fin de journée. Écris ta décision dans le journal.']] },
    { id: 'letgo', cat: 'Recovery', name: 'Lâcher la journée', sub: 'Clôture du soir', scene: 3, steps: [[30, 'Repense à ta journée de trading sans la juger.'], [30, 'Une chose que tu as bien faite, même petite.'], [30, 'Une chose à améliorer demain : note-la dans « Amélioration pour demain ».'], [40, 'Respire profondément. Le marché sera là demain.'], [30, 'Ferme les graphiques. La journée de trading est terminée.']] },
    { id: 'scan', cat: 'Recovery', name: 'Scan corporel', sub: 'Relâcher la tension', scene: 1, steps: [[30, 'Ferme les yeux. Sens le poids de ton corps sur la chaise.'], [30, 'Front, mâchoire, nuque : relâche.'], [30, 'Épaules et bras : laisse-les tomber.'], [30, 'Poitrine et ventre : observe la respiration sans la forcer.'], [30, 'Jambes et pieds : ancrés au sol.'], [30, 'Reviens doucement. Ouvre les yeux.']] },
    { id: 'plan', cat: 'Rewire', name: 'Suivre mon plan', sub: 'Relecture guidée du plan actif', scene: 0, steps: [[8, 'Avant de trader, relis ton plan point par point.']].concat(planRuleLines().length ? planRuleLines() : [[10, 'Ajoute des critères d\'entrée et des notes dans ton Trading Plan pour personnaliser cet exercice.']]).concat([[8, 'Tu ne prends que les setups qui cochent tout. Le reste, tu le laisses passer.']]) },
    { id: 'visual', cat: 'Rewire', name: 'Visualisation pré-session', sub: 'Se préparer avant Londres', scene: 0, steps: [[30, 'Visualise ton écran et la paire que tu vas trader.'], [40, 'Imagine le setup A+ se former : sweep, market shift, POI.'], [30, 'Tu entres calmement, ton risque est déjà défini.'], [30, 'Imagine maintenant l\'invalidation : tu acceptes la perte sans réagir.'], [30, 'Tu respectes ton plan quel que soit le résultat. C\'est ça, une bonne journée.']] },
    { id: 'process', cat: 'Rewire', name: 'Process plutôt que résultat', sub: 'Se détacher du P&L', scene: 4, steps: [[20, 'Un trade n\'est qu\'un échantillon de ton edge.'], [20, 'Ta mission : exécuter le plan, pas gagner chaque trade.'], [20, 'Un trade perdant bien exécuté est un bon trade.'], [20, 'Un trade gagnant hors plan est un mauvais trade.'], [20, 'Juge ta journée sur ton score de discipline.']] },
  ].map(x => { if (x.breath) { const lb = x.labels || ['Inspire', 'Retiens', 'Expire', 'Retiens']; x.steps = []; for (let c = 0; c < x.cycles; c++) x.breath.forEach((s, k) => { if (s) x.steps.push([s, lb[k], k]); }); } x.secs = x.steps.reduce((a, s) => a + s[0], 0); return x; });
  const fmtMS = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  let SAN = { tab: 'Tout', q: '', run: null, timer: null };
  function sanctStats() {
    const ss = sanct().sessions, today = todayISO(), wk = weekStartISO(today);
    const min = ss.filter(x => x.date >= wk).reduce((a, x) => a + (x.minutes || 0), 0);
    const days = new Set(ss.map(x => x.date)); let streak = 0, d = days.has(today) ? today : addDaysISO(today, -1);
    while (days.has(d)) { streak++; d = addDaysISO(d, -1); }
    return { min: Math.round(min), streak, today: days.has(today), n: ss.length };
  }
  async function logSession(type, minutes) { sanct().sessions.push({ date: todayISO(), at: new Date().toISOString(), type, minutes: +minutes.toFixed(1) }); await save('Séance enregistrée 🧘'); }
  function speak(txt) { try { if (!sanct().voice || !window.speechSynthesis || !txt) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = 'fr-FR'; u.rate = 0.9; speechSynthesis.speak(u); } catch (e) {} }
  let _wake = null;
  async function wakeOn() { try { if (navigator.wakeLock) _wake = await navigator.wakeLock.request('screen'); } catch (e) {} }
  function wakeOff() { try { if (_wake) _wake.release(); } catch (e) {} _wake = null; }
  function stopRun(silent) { clearInterval(SAN.timer); SAN.timer = null; SAN.run = null; ambStop(); wakeOff(); try { speechSynthesis.cancel(); } catch (e) {} if (!silent && view === 'sanctuary') renderSanctuary(); }

  function renderSanctuary() {
    const c = sanct(), st = sanctStats(), sc = c.scene % SCENES.length, run = SAN.run;
    const ex = EXOS(), cats = ['Tout', 'Reboot', 'Rewire', 'Recovery', 'Favoris'];
    const list = ex.filter(x => (SAN.tab === 'Tout' || (SAN.tab === 'Favoris' ? c.favs.indexOf(x.id) >= 0 : x.cat === SAN.tab)) && (!SAN.q || (x.name + ' ' + x.sub + ' ' + x.cat).toLowerCase().indexOf(SAN.q.toLowerCase()) >= 0));
    const exo = run && run.exo ? ex.find(x => x.id === run.exo) : null;
    $('#main').innerHTML = `
      <div class="san-head"><h1>🧘 Sanctuary</h1><div class="san-stats"><span><b>${st.min}</b> min cette semaine</span><span><b>${st.streak}</b> jour${st.streak > 1 ? 's' : ''} d'affilée</span><span>${st.today ? '✅ Méditation faite aujourd\'hui' : '○ Pas encore de séance aujourd\'hui'}</span></div></div>
      <div class="san-hero">
        <div class="san-scene">${sceneSVG(sc)}</div>
        <button class="san-nav prev" id="sn-prev" aria-label="Paysage précédent">‹</button><button class="san-nav next" id="sn-next" aria-label="Paysage suivant">›</button>
        <div class="san-dots">${SCENES.map((s, i) => `<button class="${i === sc ? 'on' : ''}" data-scene="${i}" aria-label="${esc(s.name)}"></button>`).join('')}</div>
        <div class="san-card">
          ${run ? `<div class="san-run">
              <div class="san-title">${exo ? esc(exo.name) : 'Séance de méditation'}</div>
              <div class="san-breath ${run.phase || ''}" id="sn-circle" style="transition-duration:${run.stepSecs || 4}s"></div>
              <div class="san-step" id="sn-step">${esc(run.label || 'Respire calmement')}</div>
              <div class="san-time" id="sn-time">${fmtMS(run.left)}</div>
              <div class="san-prog"><span id="sn-prog" style="width:${Math.round((1 - run.left / run.total) * 100)}%"></span></div>
              <div class="san-actions"><button class="btn" id="sn-pause">${run.paused ? 'Reprendre' : 'Pause'}</button><button class="btn" id="sn-stop">Arrêter</button></div>
            </div>` : `
            <div class="san-title">🪷 Séance de méditation</div>
            <label class="san-lbl">Durée</label>
            <div class="san-dur">🕒 <input id="sn-min" type="number" min="1" max="120" value="${c.minutes}" aria-label="Durée en minutes"> min</div>
            <div class="nc-seg">${[5, 10, 15, 30, 60].map(m => `<button class="${+c.minutes === m ? 'on' : ''}" data-min="${m}">${m < 60 ? m + ' min' : '1 h'}</button>`).join('')}</div>
            <label class="san-lbl san-row">Cloches d'intervalle <input type="checkbox" id="sn-bells" ${c.bells ? 'checked' : ''}></label>
            ${c.bells ? `<select id="sn-every">${[1, 2, 5, 10].map(m => `<option value="${m}"${+c.bellEvery === m ? ' selected' : ''}>Toutes les ${m} min</option>`).join('')}</select>` : ''}
            <label class="san-lbl">Son d'ambiance</label>
            <select id="sn-sound">${SOUNDS.map(([k, l]) => `<option value="${k}"${c.sound === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
            <div class="san-vol">🔈 <input type="range" id="sn-vol" min="0" max="1" step="0.05" value="${c.volume}" aria-label="Volume"></div>
            <label class="san-lbl san-row">Voix guidée (exercices) <input type="checkbox" id="sn-voice" ${c.voice ? 'checked' : ''}></label>
            <button class="btn primary san-start" id="sn-start">Commencer</button>`}
        </div>
      </div>
      <div class="card san-kit">
        <div class="san-kithead"><div><h2 style="margin:0">Mental Toolkit</h2><span class="muted small">Exercices guidés pour garder un esprit de trader discipliné.</span></div><input id="sn-q" type="search" placeholder="Rechercher…" value="${esc(SAN.q)}"></div>
        <div class="san-tabs">${cats.map(k => `<button class="${SAN.tab === k ? 'on' : ''}" data-tab="${k}">${k === 'Favoris' ? '☆ Favoris ' + c.favs.length : k}</button>`).join('')}</div>
        <div class="san-grid">${list.map(x => `<div class="san-exo" data-exo="${x.id}" role="button" tabindex="0">
            ${sceneSVG(x.scene, true)}<span class="san-badge">${x.cat}</span>
            <button class="san-fav ${c.favs.indexOf(x.id) >= 0 ? 'on' : ''}" data-fav="${x.id}" aria-label="Favori">${c.favs.indexOf(x.id) >= 0 ? '★' : '☆'}</button>
            <span class="san-play">▶</span>
            <div class="san-exoname"><b>${esc(x.name)}</b><span>${esc(x.sub)}</span></div><span class="san-dur2">${fmtMS(x.secs)}</span></div>`).join('') || '<p class="muted">Aucun exercice.</p>'}</div>
      </div>
      ${c.sessions.length ? `<p class="muted small">${c.sessions.length} séance(s) enregistrée(s). Dernière : ${esc(fmtStamp(c.sessions[c.sessions.length - 1].at))}.</p>` : ''}`;
    const setScene = i => { c.scene = (i + SCENES.length) % SCENES.length; saveSoonSan(); renderSanctuary(); };
    $('#sn-prev').onclick = () => setScene(sc - 1); $('#sn-next').onclick = () => setScene(sc + 1);
    document.querySelectorAll('[data-scene]').forEach(b => b.onclick = () => setScene(+b.dataset.scene));
    document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { SAN.tab = b.dataset.tab; renderSanctuary(); });
    $('#sn-q').onchange = e => { SAN.q = e.target.value.trim(); renderSanctuary(); };
    document.querySelectorAll('[data-fav]').forEach(b => b.onclick = ev => { ev.stopPropagation(); const i = c.favs.indexOf(b.dataset.fav); if (i >= 0) c.favs.splice(i, 1); else c.favs.push(b.dataset.fav); saveSoonSan(); renderSanctuary(); });
    document.querySelectorAll('[data-exo]').forEach(b => { const go = () => startExo(b.dataset.exo); b.onclick = go; b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; });
    if (run) {
      $('#sn-pause').onclick = () => { run.paused = !run.paused; if (run.paused) { ambStop(); try { speechSynthesis.cancel(); } catch (e) {} } else ambStart(c.sound, +c.volume); run.last = Date.now(); renderSanctuary(); };
      $('#sn-stop').onclick = async () => { const done = (run.total - run.left) / 60; stopRun(true); if (done >= 1) await logSession(run.exo || 'meditation', done); renderSanctuary(); };
      return;
    }
    document.querySelectorAll('[data-min]').forEach(b => b.onclick = () => { c.minutes = +b.dataset.min; saveSoonSan(); renderSanctuary(); });
    $('#sn-min').onchange = e => { c.minutes = Math.max(1, Math.min(120, +e.target.value || 10)); saveSoonSan(); renderSanctuary(); };
    $('#sn-bells').onchange = e => { c.bells = e.target.checked; saveSoonSan(); renderSanctuary(); };
    if ($('#sn-every')) $('#sn-every').onchange = e => { c.bellEvery = +e.target.value; saveSoonSan(); };
    $('#sn-sound').onchange = e => { c.sound = e.target.value; saveSoonSan(); ambStart(c.sound, +c.volume); clearTimeout(SAN.preview); SAN.preview = setTimeout(() => { if (!SAN.run) ambStop(); }, 4000); };
    $('#sn-vol').oninput = e => { c.volume = +e.target.value; ambVolume(c.volume); saveSoonSan(); };
    $('#sn-voice').onchange = e => { c.voice = e.target.checked; saveSoonSan(); };
    $('#sn-start').onclick = () => startRun({ total: c.minutes * 60 });
  }
  let _sanSave = null; function saveSoonSan() { clearTimeout(_sanSave); _sanSave = setTimeout(() => save('Préférences Sanctuary enregistrées'), 1500); }
  function startExo(id) { const x = EXOS().find(e => e.id === id); if (x) startRun({ total: x.secs, exo: x.id }); }
  function startRun(o) {
    const c = sanct(); stopRun(true); clearTimeout(SAN.preview);
    const x = o.exo ? EXOS().find(e => e.id === o.exo) : null;
    SAN.run = { total: o.total, left: o.total, exo: o.exo || '', paused: false, last: Date.now(), stepIdx: -1, label: x ? '' : 'Respire calmement', nextBell: c.bells ? c.bellEvery * 60 : Infinity };
    audioCtx(); ambStart(c.sound, +c.volume); bell(1); wakeOn();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderSanctuary(); tick();
    SAN.timer = setInterval(tick, 250);
    function tick() {
      const r = SAN.run; if (!r) return;
      const now = Date.now(); if (!r.paused) r.left = Math.max(0, r.left - (now - r.last) / 1000); r.last = now;
      const el = r.total - r.left;
      if (x) { let acc = 0, idx = x.steps.length - 1; for (let i = 0; i < x.steps.length; i++) { if (el < acc + x.steps[i][0]) { idx = i; break; } acc += x.steps[i][0]; }
        if (idx !== r.stepIdx) { r.stepIdx = idx; const s = x.steps[idx]; r.label = s[1]; r.stepSecs = s[0]; r.phase = s[2] === 0 ? 'in' : s[2] === 2 ? 'out' : s[2] === undefined ? '' : 'hold-' + (s[2] === 1 ? 'in' : 'out');
          const stEl = $('#sn-step'), ci = $('#sn-circle'); if (stEl) stEl.textContent = r.label; if (ci) { ci.style.transitionDuration = r.stepSecs + 's'; ci.className = 'san-breath ' + r.phase; } speak(r.label); }
      } else {
        const ph = Math.floor(el / 5) % 2 === 0 ? 'in' : 'out'; if (ph !== r.phase) { r.phase = ph; r.stepSecs = 5; const ci = $('#sn-circle'), stEl = $('#sn-step'); if (ci) { ci.style.transitionDuration = '5s'; ci.className = 'san-breath ' + ph; } if (stEl) stEl.textContent = ph === 'in' ? 'Inspire…' : 'Expire…'; }
        if (el >= r.nextBell && r.left > 2) { bell(1); r.nextBell += sanct().bellEvery * 60; }
      }
      const t = $('#sn-time'), p = $('#sn-prog'); if (t) t.textContent = fmtMS(Math.ceil(r.left)); if (p) p.style.width = Math.round(el / r.total * 100) + '%';
      if (r.left <= 0) { const mins = r.total / 60, ex = r.exo; stopRun(true); bell(3); toast('🧘 Séance terminée'); logSession(ex || 'meditation', mins).then(() => { if (view === 'sanctuary') renderSanctuary(); }); }
    }
  }

  /* ---------- JOURNAL : vue calendrier en R ---------- */
  const JKEY = 'journal_view_v1';
  let JCAL = { month: '', day: '', n: null };
  function shotsOf(t) {
    const out = []; Object.values(t.screens || {}).forEach(v => (Array.isArray(v) ? v : [v]).forEach(x => { const u = typeof x === 'string' ? x : x && (x.url || x.src); if (u) out.push(u); }));
    return out;
  }
  function monthAnalysis(ts, mLabel) {
    const good = [], bad = [];
    if (!ts.length) return { head: 'Aucun trade sur ce mois.', good, bad };
    const r = rets(ts), net = r.reduce((a, b) => a + b, 0), wr = r.filter(x => x > 0).length / r.length;
    const by = (fn) => { const m = {}; ts.forEach(t => { const k = fn(t); if (!k) return; (m[k] = m[k] || []).push(+t.ret || 0); }); return Object.entries(m).filter(([, a]) => a.length >= 2).map(([k, a]) => [k, a.reduce((x, y) => x + y, 0), a.length]).sort((a, b) => b[1] - a[1]); };
    const ss = by(t => t.setup), se = by(t => t.session), gr = by(t => t._grade);
    if (ss.length && ss[0][1] > 0) good.push(`Meilleur setup : ${ss[0][0]} (${sgn(ss[0][1])} R sur ${ss[0][2]} trades).`);
    if (se.length && se[0][1] > 0) good.push(`Meilleure session : ${se[0][0]} (${sgn(se[0][1])} R).`);
    const ap = ts.filter(t => t._grade === 'A+' || t._grade === 'A'); if (ap.length >= 2) { const e = meanOf(rets(ap)); if (e > 0) good.push(`Setups A/A+ : ${ap.length} trades, espérance ${sgn(e)} R.`); }
    const pf = ts.filter(t => t.planFollow), pfy = pf.filter(t => t.planFollow === 'Yes'); if (pf.length) (pfy.length / pf.length >= 0.8 ? good : bad).push(`Plan suivi sur ${pct(pfy.length / pf.length)} des trades (${pfy.length}/${pf.length}).`);
    const clean = ts.filter(isClean); if (clean.length >= 2 && meanOf(rets(clean)) > 0) good.push(`Trades sans erreur : ${clean.length}, espérance ${sgn(meanOf(rets(clean)))} R.`);
    if (ss.length > 1 && ss[ss.length - 1][1] < 0) bad.push(`Setup le plus coûteux : ${ss[ss.length - 1][0]} (${sgn(ss[ss.length - 1][1])} R).`);
    const tags = {}; ts.forEach(t => (t.mistakeTags || []).forEach(g => { tags[g] = (tags[g] || 0) + 1; }));
    const tt = Object.entries(tags).sort((a, b) => b[1] - a[1]); if (tt.length) bad.push(`Erreur la plus fréquente : ${tt[0][0]} (${tt[0][1]} fois).`);
    const fomo = ts.filter(t => t.fomo === 'Yes').length; if (fomo) bad.push(`${fomo} trade(s) en FOMO, total ${sgn(rets(ts.filter(t => t.fomo === 'Yes')).reduce((a, b) => a + b, 0))} R.`);
    const kz = ts.filter(t => t.killzone === 'No').length; if (kz) bad.push(`${kz} trade(s) hors killzone.`);
    const g = getGuardrails(), days = {}; ts.forEach(t => { (days[t.date] = days[t.date] || []).push(t); });
    const breakDays = Object.entries(days).filter(([, a]) => (g.maxTrades && a.length > g.maxTrades) || a.some(t => t.revenge === 'Yes' || t.overtrade === 'Yes' || (t.guardrailsBroken || []).length || t.planFollow === 'No')).map(([d]) => d).sort();
    const wd = d => new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', timeZone: 'UTC' });
    const head = `${mLabel} : ${ts.length} trades, ${sgn(net)} R, win rate ${pct(wr)}. ` + (breakDays.length ? `Écarts aux règles sur ${breakDays.length} jour(s) : ${breakDays.slice(0, 6).map(wd).join(', ')}${breakDays.length > 6 ? '…' : ''}.` : 'Aucun écart aux règles enregistré.');
    if (!good.length) good.push('Pas encore assez de trades pour dégager un point fort (au moins 2 trades par catégorie).');
    if (!bad.length) bad.push('Rien de notable : continue comme ça.');
    return { head, good, bad };
  }
  function tradePanelHTML(t) {
    const R = +t.ret, chip = (opts, v) => opts.map(o => `<span class="chip ${o === v ? 'on' : ''}">${o}</span>`).join('');
    const emo = k => t['emo' + k] ? t['emo' + k] + (isSet(t['emo' + k + 'Lvl']) ? ' ' + t['emo' + k + 'Lvl'] + '/5' : '') : (k === 'Entry' ? t.entryEmotion : k === 'Exit' ? t.exitEmotion : '') || '–';
    const shots = shotsOf(t);
    const row = (l, v) => `<div class="tp-row"><span>${l}</span><b>${v === undefined || v === null || v === '' ? '–' : v}</b></div>`;
    return `<div class="jc-trade">
      <div class="jc-tl">
        <div class="muted small">Détails du trade #${t.n}</div>
        <div class="jc-big ${cls(R)}">${S.filled(t.ret) ? sgn(R) + ' R' : '–'}</div>
        <div class="jc-meta"><div><b>${esc(t.instrument || '–')}</b><span>Instrument</span></div><div><b>${t.direction === 'Short' || /sell/i.test(t.direction) ? '↓' : '↑'} ${esc(t.direction || '–')}</b><span>Direction</span></div><div><b>${esc(t.risk || '–')}</b><span>Risque</span></div></div>
        <div class="tp-sec">Contexte</div>${row('Date', esc(t.date))}${row('Session', esc(t.session))}${row('Durée', t.duration ? esc(t.duration) + (t.entryTime ? ` <span class="muted">(${esc(t.entryTime)} → ${esc(t.exitTime || '?')})</span>` : '') : '')}${row('Killzone', t.killzone === 'Yes' ? '✓ ' + esc(t.killzoneName || '') : t.killzone === 'No' ? '✗ hors killzone' : '')}
        <div class="tp-sec">Exécution</div>${row('Setup', esc(t.setup))}${row('Entrée', esc(t.entry))}${row('POI d\'exécution', esc(t.execPoi))}${row('Stop loss', esc(t.sl) + (isSet(t.slPips) ? ` · ${t.slPips} pips` : ''))}${row('Take profit', esc(t.tp))}
        <div class="tp-sec">Performance</div>${row('R prévu', isSet(t.plannedR) ? sgn(+t.plannedR) + ' R' : '')}${row('Résultat', S.filled(t.ret) ? `<span class="${cls(R)}">${sgn(R)} R</span>` : '')}${row('Type de sortie', esc(t.exitType))}${row('MAE / MFE', isSet(t.mae) || isSet(t.mfe) ? `${isSet(t.mae) ? num(t.mae) : '–'} / ${isSet(t.mfe) ? num(t.mfe) : '–'} R` : (isSet(t.maePips) ? `${t.maePips} / ${t.mfePips || '–'} pips` : ''))}
      </div>
      <div class="jc-tr">
        <div class="tp-sec">Snapshot du trade</div>
        ${shots.length ? `<div class="jc-shots">${shots.slice(0, 4).map(u => { const img = S.imageUrl ? S.imageUrl(u) : null; return img ? `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(img)}" alt="Capture du trade #${t.n}" loading="lazy"></a>` : `<a class="btn sm" href="${esc(u)}" target="_blank" rel="noopener">Ouvrir la capture ↗</a>`; }).join('')}</div>` : '<div class="jc-noshot muted small">Aucune capture pour ce trade. Ajoute un lien TradingView dans la fiche.</div>'}
        <div class="tp-sec">Revue et réflexion</div>
        <div class="jc-rev"><div><span>Plan suivi</span><div>${chip(['Yes', 'No'], t.planFollow)}</div></div><div><span>Qualité du setup</span><div>${chip(['A+', 'A', 'B', 'C'], t._grade)}</div></div>
          <div><span>Gestion</span><b>${esc(t.management || '–')}</b></div><div><span>Erreurs</span><b>${esc((t.mistakeTags || []).join(', ') || t.mistakes || 'Aucune')}</b></div>
          <div><span>Émotion entrée</span><b>${esc(emo('Entry'))}</b></div><div><span>Émotion sortie</span><b>${esc(emo('Exit'))}</b></div></div>
        ${t.notes ? `<div class="jc-note">${esc(t.notes)}</div>` : ''}
        <div class="actions"><button class="btn" data-open="${t.n}">Ouvrir la fiche</button><button class="btn primary" data-edit="${t.n}">Modifier</button></div>
      </div></div>`;
  }
  function renderJournalCal() {
    const all = enriched().filter(t => t.date);
    if (!JCAL.month) { const last = all.map(t => t.date).sort().pop(), cur = todayISO().slice(0, 7); JCAL.month = all.some(t => t.date.slice(0, 7) === cur) || !last ? cur : last.slice(0, 7); }
    const m = JCAL.month, first = m + '-01', dow = (new Date(first + 'T00:00:00Z').getUTCDay() + 6) % 7;
    const dim = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate(), weeks = Math.ceil((dow + dim) / 7), start = addDaysISO(first, -dow), today = todayISO();
    const byDay = {}; all.forEach(t => { (byDay[t.date] = byDay[t.date] || []).push(t); });
    const sumR = a => a.reduce((s, t) => s + (S.filled(t.ret) ? +t.ret : 0), 0);
    const mts = all.filter(t => t.date.slice(0, 7) === m), mLabel = new Date(first + 'T00:00:00Z').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const an = monthAnalysis(mts, mLabel.charAt(0).toUpperCase() + mLabel.slice(1));
    let grid = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim', 'Semaine'].map(d => `<div class="nc-wd">${d}</div>`).join('');
    for (let w = 0; w < weeks; w++) {
      let wts = [];
      for (let k = 0; k < 7; k++) {
        const d = addDaysISO(start, w * 7 + k), a = byDay[d] || [], r = sumR(a); wts = wts.concat(a);
        grid += `<button class="jc-cell ${d.slice(0, 7) !== m ? 'out' : ''} ${a.length ? (r > 0.001 ? 'win' : r < -0.001 ? 'loss' : 'be') : ''} ${d === JCAL.day ? 'sel' : ''} ${d === today ? 'today' : ''}" data-jday="${d}">
          <span class="jc-d">${+d.slice(8)}</span>${a.length ? `<span class="jc-n">${a.length} trade${a.length > 1 ? 's' : ''}</span><span class="jc-r">${sgn(r)} R</span>` : ''}</button>`;
      }
      const wr = sumR(wts); grid += `<div class="jc-week ${wts.length ? (wr > 0.001 ? 'pos' : wr < -0.001 ? 'neg' : '') : ''}">${wts.length ? `<b>${sgn(wr)} R</b><span>${wts.length} trade${wts.length > 1 ? 's' : ''}</span>` : '<span class="muted">–</span>'}</div>`;
    }
    const dts = JCAL.day ? (byDay[JCAL.day] || []).slice().sort((a, b) => String(a.entryTime || '').localeCompare(String(b.entryTime || '')) || a.n - b.n) : [];
    const selT = JCAL.n !== null ? all.find(t => t.n === JCAL.n) : null;
    const msm = S.summary(mts);
    return `
      <details class="jc-analysis card"${window.innerWidth >= 700 ? ' open' : ''}><summary class="jc-ahead">📊 Analyse du mois <span class="muted small">(calculée à partir de tes trades)</span></summary><p class="small">${esc(an.head)}</p>
        <div class="jc-cols"><div class="jc-good"><b>✓ Ce qui a marché</b><ul>${an.good.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div class="jc-bad"><b>✗ Ce qui n'a pas marché</b><ul>${an.bad.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div></details>
      <div class="card jc-cal">
        <div class="nc-calhead"><button class="btn sm" id="jc-pm" aria-label="Mois précédent">‹</button><button class="btn sm" id="jc-nm" aria-label="Mois suivant">›</button><h2>${esc(mLabel)}</h2>
          <span class="jc-msum"><b class="${cls(msm.net)}">${sgn(msm.net)} R</b> · ${mts.length} trades · WR ${pct(msm.winRate)}</span><button class="btn sm" id="jc-today">Ce mois</button></div>
        <div class="jc-grid">${grid}</div>
      </div>
      ${JCAL.day ? `<div class="card jc-daylist"><h2 style="margin-top:0">${esc(new Date(JCAL.day + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }))} · ${dts.length ? `<span class="${cls(sumR(dts))}">${sgn(sumR(dts))} R</span>` : 'aucun trade'}</h2>
        ${dts.map(t => `<button class="jc-tbtn ${t.n === JCAL.n ? 'on' : ''}" data-jn="${t.n}"><span>#${t.n}</span><span>${esc(t.entryTime || '')}</span><b>${esc(t.instrument || '')}</b><span>${esc(t.direction || '')}</span><span>${esc(t.setup || t.entry || '')}</span><b class="${cls(t.ret)}">${sgn(t.ret)} R</b></button>`).join('')}</div>` : '<p class="muted small">Clique sur un jour pour voir ses trades.</p>'}
      ${selT ? tradePanelHTML(selT) : ''}`;
  }
  function wireJournalCal() {
    const go = () => renderJournal();
    $('#jc-pm').onclick = () => { JCAL.month = addMonth(JCAL.month, -1); JCAL.day = ''; JCAL.n = null; go(); };
    $('#jc-nm').onclick = () => { JCAL.month = addMonth(JCAL.month, 1); JCAL.day = ''; JCAL.n = null; go(); };
    $('#jc-today').onclick = () => { JCAL.month = todayISO().slice(0, 7); JCAL.day = ''; JCAL.n = null; go(); };
    document.querySelectorAll('[data-jday]').forEach(b => b.onclick = () => { JCAL.day = b.dataset.jday; const a = enriched().filter(t => t.date === JCAL.day); JCAL.n = a.length === 1 ? a[0].n : null; if (JCAL.day.slice(0, 7) !== JCAL.month) JCAL.month = JCAL.day.slice(0, 7); go(); setTimeout(() => { const el = document.querySelector('.jc-daylist'); if (el && window.innerWidth < 900) el.scrollIntoView({ behavior: 'smooth' }); }, 50); });
    document.querySelectorAll('[data-jn]').forEach(b => b.onclick = () => { JCAL.n = +b.dataset.jn; go(); setTimeout(() => { const el = document.querySelector('.jc-trade'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50); });
    document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openTrade(+b.dataset.open));
    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editTrade(+b.dataset.edit));
  }
  function journalViewBar() {
    const v = getJView();
    return `<div class="jv-bar" role="tablist"><button class="${v === 'cal' ? 'on' : ''}" data-jv="cal" role="tab">📅 Calendrier</button><button class="${v === 'list' ? 'on' : ''}" data-jv="list" role="tab">☰ Liste</button></div>`;
  }
  function getJView() { try { return localStorage.getItem(JKEY) || 'cal'; } catch (e) { return 'cal'; } }
  function wireJView() { document.querySelectorAll('[data-jv]').forEach(b => b.onclick = () => { try { localStorage.setItem(JKEY, b.dataset.jv); } catch (e) {} renderJournal(); }); }
  function renderJournal() {
    if (getJView() === 'list') { renderJournalList(); $('#main').insertAdjacentHTML('afterbegin', journalViewBar()); wireJView(); return; }
    $('#main').innerHTML = `${guardrailBanner()}${journalViewBar()}<h1>Journal</h1>${renderJournalCal()}`;
    wireJView(); wireJournalCal();
  }

  /* ---------- TRADING PLAN : présentation « plan card » ---------- */
  const SEC_KIND = title => { const t = String(title).toLowerCase(); return /pre.?market|routine|avant/.test(t) ? ['☀️', 'check'] : /chart|analy|process/.test(t) ? ['📊', 'num'] : /entry|entr[ée]e/.test(t) ? ['✅', 'check'] : /management|gestion/.test(t) ? ['🧭', 'text'] : /exit|sortie/.test(t) ? ['🏁', 'check'] : ['📌', 'num']; };
  function planStats(plan) {
    const ts = enriched().filter(t => t.planId === plan.id || (!t.planId && t.planName === plan.name)).filter(t => S.filled(t.ret));
    const r = rets(ts), pf = ts.filter(t => t.planFollow);
    return { n: ts.length, wr: r.length ? r.filter(x => x > 0).length / r.length : null, net: r.reduce((a, b) => a + b, 0), comp: pf.length ? pf.filter(t => t.planFollow === 'Yes').length / pf.length : null, e: meanOf(r) };
  }
  function planCardHTML(plan, mini) {
    const secs = (plan.sections || []).map(sec => {
      const [ic, kind] = SEC_KIND(sec.title), items = (sec.items || []).filter(Boolean).slice(0, mini ? 4 : 999);
      return `<div class="pc-sec"><div class="pc-h">${ic} ${esc(sec.title)}</div>${kind === 'text' && !mini ? `<div class="pc-text">${items.map(esc).join('<br>')}</div>` :
        `<ol class="pc-list ${kind}">${items.map((x, i) => `<li><span class="pc-mark">${kind === 'num' ? i + 1 : '✓'}</span>${esc(x)}</li>`).join('')}</ol>`}</div>`;
    });
    const imgs = (plan.images || []).filter(Boolean);
    return `<div class="pc ${mini ? 'mini' : ''}"><div class="pc-title"><span class="pc-dot"></span>${esc(plan.name)} ${plan.subtitle ? `<span class="muted small">${esc(plan.subtitle)}</span>` : ''}</div>
      <div class="pc-cols"><div>${secs.filter((_, i) => i % 2 === 0 || mini).join('')}</div>${mini ? '' : `<div>
        ${imgs.length ? `<div class="pc-sec"><div class="pc-h">📷 Setup</div><div class="pc-imgs">${imgs.map(u => { const img = S.imageUrl ? S.imageUrl(u) : null; return img ? `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(img)}" alt="Exemple de setup" loading="lazy"></a>` : `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(trunc(u, 40))}</a>`; }).join('')}</div></div>` : ''}
        ${secs.filter((_, i) => i % 2 === 1).join('')}
        ${(plan.notes || []).filter(Boolean).length ? `<div class="pc-sec"><div class="pc-h">✍️ Trading notes</div><div class="pc-text">${plan.notes.filter(Boolean).map(esc).join('<br>')}</div></div>` : ''}</div>`}</div></div>`;
  }
  function planReviewed(plan) { const r = (plan.reviews || []).slice(-1)[0]; return r ? new Date(r) : null; }
  function tpViewHTML(plan, planBar) {
    const st = planStats(plan), rv = planReviewed(plan), today = todayISO();
    const rvTxt = rv ? (tzParts(rv.getTime(), Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC').date === today ? `✓ Revu aujourd'hui à ${String(rv.getHours()).padStart(2, '0')}:${String(rv.getMinutes()).padStart(2, '0')}` : `Dernière revue : ${fmtStamp(rv.toISOString())}`) : 'Pas encore revu';
    return `<h1>📝 Trading Plan</h1>${planBar}
      <div class="pc-wrap card">
        <div class="pc-top"><button class="btn sm" id="tp-preset">🗂 Choisir un plan</button><button class="btn sm" id="tp-edit">✏️ Modifier le plan</button></div>
        ${planCardHTML(plan)}
        <div class="pc-foot"><span class="muted small" id="tp-rvtxt">${esc(rvTxt)}</span><button class="btn primary pc-review ${rv && rv.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10) ? 'done' : ''}" id="tp-review">✓ Marquer comme revu</button></div>
      </div>
      <div class="pc-stats card"><div class="pc-sh">Statistiques du plan <span class="muted small" title="Trades enregistrés avec ce plan dans « Plan suivi »">ⓘ</span></div>
        <div class="pc-sg"><div><b>${st.n}</b><span>Trades pris</span></div><div><b>${st.wr === null ? '–' : pct(st.wr)}</b><span>Win rate</span></div><div><b class="${cls(st.net)}">${sgn(st.net)} R</b><span>Net R</span></div><div><b>${st.comp === null ? '–' : pct(st.comp)}</b><span>Respect du plan</span></div></div>
        ${st.n && st.n < 20 ? '<p class="muted small">Moins de 20 trades avec ce plan : statistiques indicatives.</p>' : ''}
        <p class="muted small">${(plan.reviews || []).length} revue(s) du plan · ${(plan.reviews || []).filter(x => x.slice(0, 10) >= addDaysISO(today, -6)).length} sur les 7 derniers jours</p></div>`;
  }
  function wireTpView(plan) {
    $('#tp-review').onclick = async () => { plan.reviews = (plan.reviews || []).concat([new Date().toISOString()]).slice(-200); if (await save('Plan marqué comme revu ✓')) renderTradingPlan(); };
    $('#tp-preset').onclick = () => {
      const pd = plansData(), ov = document.createElement('div'); ov.className = 'nc-overlay';
      ov.innerHTML = `<div class="nc-modal card pc-preset" role="dialog" aria-label="Choisir un plan"><div class="nc-dethead"><h3>Choisir un plan</h3><button class="btn sm" id="pp-x" aria-label="Fermer">×</button></div>
        <div class="pp-grid">${pd.plans.map(p => `<button class="pp-card ${p.id === pd.activeId ? 'on' : ''}" data-pp="${p.id}">${planCardHTML(p, true)}</button>`).join('')}</div></div>`;
      document.body.appendChild(ov);
      const close = () => ov.remove();
      ov.querySelector('#pp-x').onclick = close; ov.onclick = e => { if (e.target === ov) close(); };
      ov.querySelectorAll('[data-pp]').forEach(b => b.onclick = async () => { DB.activePlanId = b.dataset.pp; DB.tradingPlan = activePlan(); close(); renderTradingPlan._editing = false; await save('Plan actif : ' + activePlan().name); renderTradingPlan(); });
    };
  }


  /* ================= V6 : score de consistance + catégories repliables ================= */
  const clamp01 = x => Math.max(0, Math.min(1, x));
  function consistency(ts) {
    const T = ts.filter(takenT).filter(t => S.filled(t.ret) && t.date);
    if (T.length < 5) return null;
    const wk = {}, dy = {}, dn = {};
    T.forEach(t => { const w = weekStartISO(t.date), r = +t.ret; wk[w] = (wk[w] || 0) + r; dy[t.date] = (dy[t.date] || 0) + r; dn[t.date] = (dn[t.date] || 0) + 1; });
    const wv = Object.values(wk), dv = Object.values(dy), dc = Object.values(dn);
    const wPos = wv.filter(x => x > 0).length / wv.length;
    const gains = dv.filter(x => x > 0).reduce((a, b) => a + b, 0), best = Math.max(0, ...dv), share = gains > 0 ? best / gains : 1;
    const pf = T.filter(t => t.planFollow); let disc, discLbl, discTxt;
    if (pf.length >= 5) { const y = pf.filter(t => t.planFollow === 'Yes').length; disc = y / pf.length; discLbl = 'Respect du plan'; discTxt = `${y}/${pf.length} trades avec « Plan suivi » = Yes`; }
    else { const gr = T.filter(t => t._grade); const a = gr.filter(t => t._grade === 'A+' || t._grade === 'A').length; disc = gr.length ? a / gr.length : null; discLbl = 'Qualité des setups'; discTxt = `${a}/${gr.length} setups A ou A+`; }
    const mx = getGuardrails().maxTrades || 3, okDays = dc.filter(n => n <= mx).length;
    const comps = [
      { k: 'Semaines positives', w: 30, v: wPos, txt: `${wv.filter(x => x > 0).length}/${wv.length} semaines avec un net en R positif` },
      { k: 'Gains bien répartis', w: 20, v: clamp01((0.8 - share) / 0.6), txt: gains > 0 ? `Le meilleur jour pèse ${pct(share)} des gains (${sgn(best)} R sur ${num(gains)} R). 100 si ≤ 20 %, 0 si ≥ 80 %.` : 'Aucun jour gagnant.' },
      { k: discLbl, w: 30, v: disc, txt: discTxt },
      { k: 'Nombre de trades maîtrisé', w: 20, v: okDays / dc.length, txt: `${okDays}/${dc.length} jours à ${mx} trade${mx > 1 ? 's' : ''} ou moins (limite Guardrails)` },
    ].filter(c => c.v !== null && c.v !== undefined && !isNaN(c.v));
    const W = comps.reduce((a, c) => a + c.w, 0), score = Math.round(comps.reduce((a, c) => a + c.w * c.v, 0) / W * 100);
    const label = score >= 80 ? 'Très régulier' : score >= 65 ? 'Régulier' : score >= 50 ? 'Irrégulier' : 'Très irrégulier';
    return { score, label, comps, n: T.length, weeks: wv.length, days: dc.length };
  }
  function consistencyHTML(ts) {
    const c = consistency(ts);
    if (!c) return `<h2>Score de consistance</h2><div class="note">Il faut au moins 5 trades dans la sélection pour calculer le score.</div>`;
    const col = c.score >= 80 ? 'var(--win)' : c.score >= 65 ? '#3ba0ff' : c.score >= 50 ? 'var(--be)' : 'var(--loss)';
    const weakest = c.comps.slice().sort((a, b) => a.v - b.v)[0];
    return `<h2>Score de consistance</h2>
      <div class="card cons">
        <div class="cons-ring" style="--p:${c.score};--c:${col}" role="img" aria-label="Score de consistance ${c.score} sur 100"><div><b>${c.score}</b><span>/100</span></div></div>
        <div class="cons-main"><div class="cons-lbl" style="color:${col}">${c.label}</div>
          <div class="muted small">${c.n} trades · ${c.days} jours tradés · ${c.weeks} semaine(s) dans la sélection${c.weeks < 4 ? ' · moins de 4 semaines : score peu fiable' : ''}</div>
          <div class="cons-comps">${c.comps.map(x => `<div class="cons-c"><div class="cons-ch"><span>${esc(x.k)} <span class="muted small">(${x.w} %)</span></span><b>${Math.round(x.v * 100)}</b></div><div class="cons-bar"><span style="width:${Math.round(x.v * 100)}%;background:${x.v >= .8 ? 'var(--win)' : x.v >= .5 ? 'var(--be)' : 'var(--loss)'}"></span></div><div class="muted small">${esc(x.txt)}</div></div>`).join('')}</div>
          <p class="small cons-tip">👉 Point le plus faible : <b>${esc(weakest.k)}</b> (${Math.round(weakest.v * 100)}/100).</p>
        </div>
      </div>`;
  }
  const CAT_KEY = 'dash_cat_open_v1';
  const catOpen = () => { try { return localStorage.getItem(CAT_KEY) === '1'; } catch (e) { return false; } };
  document.addEventListener('toggle', e => { const t = e.target; if (t && t.classList && t.classList.contains('cat-fold')) { try { localStorage.setItem(CAT_KEY, t.open ? '1' : '0'); } catch (x) {} } }, true);

  /* ================= V8 : progression du formulaire en direct + alertes news réglables ================= */
  /* ---- barre de remplissage du formulaire ---- */
  function formDraft(t) {
    const d = Object.assign({}, t), m = document.getElementById('modal'); if (!m) return d;
    m.querySelectorAll('[id^="f-"]').forEach(el => {
      if (!('value' in el) || el.type === 'checkbox' || el.tagName === 'BUTTON') return;
      const k = el.id.slice(2); if (k.startsWith('s-')) return;
      d[k] = String(el.value || '').trim();
    });
    d.screens = {}; SLOTS.forEach(([k]) => { const el = document.getElementById('f-s-' + k); d.screens[k] = el ? el.value.split('\n').map(x => x.trim()).filter(Boolean) : ((t.screens || {})[k] || []); });
    return d;
  }
  function formProgressInit(t) {
    const m = document.getElementById('modal'); if (!m) return;
    if (m._fpOff) m._fpOff();
    if (document.getElementById('fp-bar')) return;
    const head = m.querySelector('h2'); const bar = document.createElement('div'); bar.id = 'fp-bar'; bar.className = 'fp-bar';
    bar.innerHTML = '<div class="fp-top"><b id="fp-pct">0 %</b><span class="fp-lbl">fiche remplie</span><button type="button" class="fp-more" id="fp-more" aria-expanded="false">Voir ce qui manque</button></div><div class="fp-track"><span id="fp-fill"></span></div><div class="fp-miss" id="fp-miss" hidden></div>';
    if (head && head.nextSibling) head.parentNode.insertBefore(bar, head.nextSibling); else m.insertBefore(bar, m.firstChild);
    const idOf = k => k === 'screens' ? 'f-s-' + SLOTS[0][0] : 'f-' + k;
    const upd = () => {
      if (!document.getElementById('fp-bar')) return;
      const c = completeness(formDraft(t)), keys = COMPLETE_FIELDS();
      const missKeys = keys.filter(([, l]) => c.miss.indexOf(l) >= 0);
      $('#fp-pct').textContent = c.pct + ' %';
      const fill = $('#fp-fill'); fill.style.width = c.pct + '%'; fill.className = c.pct >= 100 ? 'ok' : c.pct >= 80 ? 'mid' : 'low';
      $('#fp-more').hidden = !missKeys.length;
      $('#fp-miss').innerHTML = missKeys.length ? missKeys.map(([k, l]) => `<button type="button" data-goto="${idOf(k)}">${esc(l)}</button>`).join('') : '';
      if (!missKeys.length) $('#fp-miss').hidden = true;
      $('#fp-miss').querySelectorAll('[data-goto]').forEach(b => b.onclick = () => { const el = document.getElementById(b.dataset.goto); if (el) { if (el.disabled) return toast('Champ verrouillé (critère pré-entrée figé)'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => el.focus(), 300); } });
    };
    $('#fp-more').onclick = () => { const mm = $('#fp-miss'); mm.hidden = !mm.hidden; $('#fp-more').textContent = mm.hidden ? 'Voir ce qui manque' : 'Masquer'; $('#fp-more').setAttribute('aria-expanded', String(!mm.hidden)); };
    let raf = 0; const sched = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(upd); };
    const onClick = e => { if (e.target.closest('.yn, .ms, button')) setTimeout(sched, 0); };
    m.addEventListener('input', sched); m.addEventListener('change', sched); m.addEventListener('click', onClick);
    m._fpOff = () => { m.removeEventListener('input', sched); m.removeEventListener('change', sched); m.removeEventListener('click', onClick); m._fpOff = null; };
    upd();
  }

  /* ---- alertes news réglables ---- */
  function newsAlertCfg() {
    const d = { enabled: true, leads: [10], currencies: ['USD', 'EUR', 'GBP'], impacts: ['High'] };
    if (!DB.newsAlerts) DB.newsAlerts = {};
    Object.keys(d).forEach(k => { if (DB.newsAlerts[k] === undefined) DB.newsAlerts[k] = Array.isArray(d[k]) ? d[k].slice() : d[k]; });
    return DB.newsAlerts;
  }
  const FIRED_KEY = 'news_alert_fired_v1';
  let _naTimer = null;
  function alertEvents() {
    const a = newsAlertCfg();
    return NEWS_EVENTS.filter(e => a.currencies.indexOf(e.country) >= 0 && a.impacts.some(i => i.toLowerCase() === String(e.impact).toLowerCase()));
  }
  function checkNewsAlerts() {
    const a = newsAlertCfg(); if (!a.enabled || !NEWS_EVENTS.length) return;
    let fired = {}; try { fired = JSON.parse(localStorage.getItem(FIRED_KEY)) || {}; } catch (e) {}
    const now = Date.now(), tz = newsCfg().tz; let changed = false;
    alertEvents().forEach(e => {
      if (e.ts < now - 60e3 || e.ts > now + 3 * 3600e3) return;
      a.leads.slice().sort((x, y) => x - y).some(L => {
        const at = e.ts - L * 60e3, key = evKey(e) + '|' + L;
        // fenêtre de tir : de l'heure d'alerte jusqu'à 2 mn après (rattrape un onglet mis en veille)
        if (now >= at && now < at + 2 * 60e3 && !fired[key]) {
          fired[key] = now; changed = true;
          const mins = Math.max(0, Math.round((e.ts - now) / 60000));
          const title = `🚨 ${e.country} ${e.title} dans ${mins} mn`;
          const body = `${tzParts(e.ts, tz).time} · impact ${(IMPACTS.find(x => x[0].toLowerCase() === String(e.impact).toLowerCase()) || [0, e.impact])[1].toLowerCase()}` + (e.forecast ? ` · prévision ${e.forecast}` : '') + (e.previous ? ` · précédent ${e.previous}` : '');
          notifyNews(title, body, key);
          toast(title, 12000);
          setNewsPill(`🚨 ${e.country} ${e.title} dans ${mins} mn`, `${e.title} (${e.country}) à ${tzParts(e.ts, tz).time}`, e.ts);
          return true;
        }
        return false;
      });
    });
    if (changed) { Object.keys(fired).forEach(k => { if (now - fired[k] > 2 * 864e5) delete fired[k]; }); try { localStorage.setItem(FIRED_KEY, JSON.stringify(fired)); } catch (e) {} }
  }
  function notifyNews(title, body, tag) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const opt = { body, tag, renotify: true, requireInteraction: true, vibrate: [300, 120, 300, 120, 300], data: { url: location.href.split('#')[0] + '#/news' } };
      const show = () => { try { new Notification(title, opt); } catch (e) { /* Android : seul le service worker peut notifier */ } };
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(reg => reg ? reg.showNotification(title, opt) : show()).catch(show);
      else show();
    } catch (e) {}
  }
  function setNewsPill(msg, tip, ts) {
    _newsAlertMsg = msg;
    const bar = document.getElementById('gr-status-bar'); if (!bar) return;
    let pill = bar.querySelector('#news-alert-pill');
    if (!pill) { pill = document.createElement('a'); pill.id = 'news-alert-pill'; pill.className = 'gr-pill gr-pill-news'; pill.href = '#/news'; bar.appendChild(pill); }
    pill.textContent = msg; pill.title = tip;
    clearTimeout(setNewsPill.t); setNewsPill.t = setTimeout(() => { const pl = document.getElementById('news-alert-pill'); if (pl) pl.remove(); _newsAlertMsg = ''; }, Math.max(60e3, ts - Date.now() + 5 * 60e3));
  }
  function startNewsAlertLoop() { clearInterval(_naTimer); _naTimer = setInterval(() => { checkNewsAlerts(); }, 20000); checkNewsAlerts(); }
  function registerSW() { try { if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {} }
  function nextAlertsList(n) {
    const a = newsAlertCfg(), now = Date.now(), tz = newsCfg().tz, out = [];
    alertEvents().filter(e => e.ts > now).slice(0, 60).forEach(e => a.leads.forEach(L => { const at = e.ts - L * 60e3; if (at > now) out.push({ at, e, L }); }));
    return out.sort((x, y) => x.at - y.at).slice(0, n || 6).map(x => `${fmtDayLong(tzParts(x.at, tz).date)} ${tzParts(x.at, tz).time} → ${x.e.country} ${x.e.title} (${x.L} mn avant)`);
  }
  function icsExport() {
    const a = newsAlertCfg(), now = Date.now(), evs = alertEvents().filter(e => e.ts > now && e.ts < now + 15 * 864e5);
    if (!evs.length) return toast('Aucune news correspondant à tes réglages dans les 15 prochains jours.');
    const z = ts => new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const escI = s => String(s).replace(/[\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Journal Trading//News//FR', 'CALSCALE:GREGORIAN'];
    evs.forEach(e => {
      lines.push('BEGIN:VEVENT', 'UID:' + encodeURIComponent(evKey(e)) + '@journal-trading', 'DTSTAMP:' + z(now), 'DTSTART:' + z(e.ts), 'DTEND:' + z(e.ts + 15 * 60e3),
        'SUMMARY:' + escI(`🚨 ${e.country} ${e.title}`), 'DESCRIPTION:' + escI(`Impact ${e.impact}` + (e.forecast ? ` · prévision ${e.forecast}` : '') + (e.previous ? ` · précédent ${e.previous}` : '')));
      a.leads.forEach(L => lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escI(`${e.country} ${e.title} dans ${L} mn`), 'TRIGGER:-PT' + L + 'M', 'END:VALARM'));
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    download('alertes-news.ics', lines.join('\r\n'), 'text/calendar');
    toast(`${evs.length} news exportées avec ${a.leads.length} rappel(s) chacune. Ouvre le fichier pour l'ajouter à ton agenda.`, 9000);
  }
  function newsAlertsHTML() {
    const a = newsAlertCfg(), perm = !('Notification' in window) ? 'unsupported' : Notification.permission;
    const nx = nextAlertsList(5);
    return `<div class="nc-overlay"><div class="nc-modal card" role="dialog" aria-label="Alertes news">
      <div class="nc-dethead"><h3>🔔 Alertes avant les news</h3><button class="btn sm" id="na-x" aria-label="Fermer">×</button></div>
      <label class="nc-switch"><input type="checkbox" id="na-on" ${a.enabled ? 'checked' : ''}> <span><b>Activer les alertes</b><br><span class="muted small">Notification + message + pastille, pour chaque news choisie.</span></span></label>
      <div class="ns-sec"><div class="ms-title">Me prévenir (plusieurs choix possibles)</div><div class="nc-seg">${[60, 30, 15, 10, 5, 1].map(m => `<button class="${a.leads.indexOf(m) >= 0 ? 'on' : ''}" data-lead="${m}">${m === 60 ? '1 h' : m + ' mn'} avant</button>`).join('')}</div></div>
      <div class="ns-sec"><div class="ms-title">Devises</div><div class="nc-chips">${ALL_CCY.map(x => `<button class="nc-chip ${a.currencies.indexOf(x) >= 0 ? 'on' : ''}" data-accy="${x}">${CCY_FLAG[x]} ${x}</button>`).join('')}</div></div>
      <div class="ns-sec"><div class="ms-title">Impact</div><div class="nc-chips">${IMPACTS.slice(0, 2).map(([k, l, cl]) => `<button class="nc-chip ${a.impacts.indexOf(k) >= 0 ? 'on' : ''}" data-aimp="${k}"><i class="dot ${cl}"></i> ${l}</button>`).join('')}</div></div>
      <div class="note small">${perm === 'granted' ? '✅ Notifications autorisées sur cet appareil.' : perm === 'denied' ? '⛔ Notifications bloquées : autorise-les dans les réglages du site (cadenas à gauche de l\'adresse), puis recharge la page.' : perm === 'unsupported' ? 'Ce navigateur ne gère pas les notifications : seuls le message et la pastille s\'afficheront.' : '<button class="btn sm" id="na-perm">Autoriser les notifications</button>'}
        <br>Les notifications arrivent tant que le journal est ouvert (même en arrière-plan). Pour être prévenu journal fermé, ajoute les alertes à l'agenda de ton téléphone.</div>
      ${nx.length ? `<div class="ns-sec"><div class="ms-title">Prochaines alertes</div><ul class="na-next">${nx.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '<p class="muted small">Aucune alerte prévue avec ces réglages dans les données chargées.</p>'}
      <div class="actions"><button class="btn" id="na-test">Tester</button><button class="btn" id="na-ics">📅 Ajouter à mon agenda (.ics)</button><button class="btn primary" id="na-save">Enregistrer</button></div>
    </div></div>`;
  }
  let _naDraft = null;
  function wireNewsAlerts() {
    if (!_naDraft) _naDraft = JSON.parse(JSON.stringify(newsAlertCfg()));
    const redraw = () => { DB.newsAlerts = _naDraft; renderNews(); };
    $('#na-on').onchange = e => { _naDraft.enabled = e.target.checked; redraw(); };
    document.querySelectorAll('[data-lead]').forEach(b => b.onclick = () => { const v = +b.dataset.lead, i = _naDraft.leads.indexOf(v); if (i >= 0) { if (_naDraft.leads.length > 1) _naDraft.leads.splice(i, 1); } else _naDraft.leads.push(v); redraw(); });
    document.querySelectorAll('[data-accy]').forEach(b => b.onclick = () => { const v = b.dataset.accy, i = _naDraft.currencies.indexOf(v); if (i >= 0) { if (_naDraft.currencies.length > 1) _naDraft.currencies.splice(i, 1); } else _naDraft.currencies.push(v); redraw(); });
    document.querySelectorAll('[data-aimp]').forEach(b => b.onclick = () => { const v = b.dataset.aimp, i = _naDraft.impacts.indexOf(v); if (i >= 0) { if (_naDraft.impacts.length > 1) _naDraft.impacts.splice(i, 1); } else _naDraft.impacts.push(v); redraw(); });
    if ($('#na-perm')) $('#na-perm').onclick = () => { try { Notification.requestPermission().then(() => renderNews()); } catch (e) {} };
    $('#na-test').onclick = () => { notifyNews('🚨 Test : USD CPI m/m dans 10 mn', 'Exemple d\'alerte news du journal', 'news-test'); toast('🚨 Test : USD CPI m/m dans 10 mn', 6000); };
    $('#na-ics').onclick = () => { DB.newsAlerts = _naDraft; icsExport(); };
    const close = () => { NUI.alerts = false; _naDraft = null; renderNews(); };
    $('#na-x').onclick = () => { DB.newsAlerts = NUI._abk || DB.newsAlerts; delete NUI._abk; close(); };
    if (!NUI._abk) NUI._abk = JSON.parse(JSON.stringify(newsAlertCfg()));
    $('#na-save').onclick = async () => { DB.newsAlerts = _naDraft; delete NUI._abk; NUI.alerts = false; _naDraft = null; await save('Alertes news enregistrées'); startNewsAlertLoop(); renderNews(); };
  }

  function initNewsAlerts() { if (!DB) return; registerSW(); loadNewsEvents().then(() => { updateStatusBar(); startNewsAlertLoop(); }).catch(() => {}); }

  /* ================= V9 : checklist figée (heure, taux de remplissage, statistiques) ================= */
  function snapRate(s) { return s && s.total ? s.done / s.total : null; }
  function snapSections(s) {
    const m = []; (s && s.items || []).forEach(i => { const k = i.section || 'Checklist'; let r = m.find(x => x.k === k); if (!r) { r = { k, d: 0, n: 0 }; m.push(r); } r.n++; if (i.done) r.d++; });
    return m;
  }
  function lockLabel(t) {
    const s = t.checklistSnap, r = snapRate(s);
    const base = `🔒 Critères pré-entrée figés le ${esc(fmtStamp(t.preLockedAt))}`;
    if (!s) return base + ' · <span class="muted">sans checklist figée</span>';
    const cls2 = r >= 1 ? 'pos' : r >= 0.8 ? '' : 'neg';
    return base + ` · checklist <b class="${cls2}">${s.done}/${s.total} (${pct(r)})</b> <span class="muted small">${snapSections(s).map(x => esc(x.k) + ' ' + x.d + '/' + x.n).join(' · ')}</span>`;
  }
  function checklistStatsHTML(ts) {
    const T = ts.filter(takenT).filter(t => S.filled(t.ret));
    if (!T.length) return '';
    const W = T.filter(t => t.checklistSnap && t.checklistSnap.total);
    const head = `<h2>Checklist pré-entrée</h2>`;
    if (!W.length) return head + `<div class="note">Aucun trade de la sélection n'a de checklist figée. Avant d'entrer, ouvre la checklist (bouton ✅), coche les points puis appuie sur « 📌 Figer (entrée) » : elle sera jointe au trade et ses statistiques apparaîtront ici (routine pré-market, chart process, critères d'entrée).</div>`;
    const avg = meanOf(W.map(t => snapRate(t.checklistSnap)));
    const secs = {}; W.forEach(t => snapSections(t.checklistSnap).forEach(x => { const r = secs[x.k] = secs[x.k] || { d: 0, n: 0, trades: 0, full: 0 }; r.d += x.d; r.n += x.n; r.trades++; if (x.d === x.n) r.full++; }));
    const full = W.filter(t => snapRate(t.checklistSnap) >= 1), part = W.filter(t => snapRate(t.checklistSnap) < 1);
    const line = (lbl, a) => { const r = rets(a); if (!r.length) return `<tr><td>${lbl}</td><td class="num">0</td><td class="num">–</td><td class="num">–</td><td class="num">–</td></tr>`; return `<tr class="${r.length < 5 ? 'low' : ''}"><td>${lbl}</td><td class="num">${r.length}</td><td class="num">${pct(r.filter(x => x > 0).length / r.length)}</td><td class="num ${cls(meanOf(r))}">${sgn(meanOf(r))}</td><td class="num ${cls(r.reduce((a, b) => a + b, 0))}">${sgn(r.reduce((a, b) => a + b, 0))}</td></tr>`; };
    const pE = welchP(rets(full), rets(part));
    return head + `<div class="card cl-stats">
      <div class="kpis">
        <div class="kpi"><div class="l">Trades avec checklist figée</div><div class="v">${W.length}/${T.length}</div><div class="s">${pct(W.length / T.length)} de la sélection</div></div>
        <div class="kpi"><div class="l">Remplissage moyen</div><div class="v ${avg >= 1 ? 'pos' : avg < 0.8 ? 'neg' : ''}">${pct(avg)}</div><div class="s">${full.length} checklist(s) complète(s) à 100 %</div></div>
      </div>
      <div class="cl-secs">${Object.entries(secs).map(([k, r]) => { const v = r.n ? r.d / r.n : 0; return `<div class="cons-c"><div class="cons-ch"><span>${esc(k)}</span><b>${pct(v)}</b></div><div class="cons-bar"><span style="width:${Math.round(v * 100)}%;background:${v >= .95 ? 'var(--win)' : v >= .8 ? 'var(--be)' : 'var(--loss)'}"></span></div><div class="muted small">${r.d}/${r.n} points cochés · section complète sur ${r.full}/${r.trades} trades</div></div>`; }).join('')}</div>
      <div class="twrap" style="max-height:none;margin-top:12px"><table><thead><tr><th>Checklist</th><th class="num">n</th><th class="num">Win rate</th><th class="num">Espérance</th><th class="num">Net R</th></tr></thead><tbody>
        ${line('Complète (100 %)', full)}${line('Incomplète', part)}${line('Non figée', T.filter(t => !(t.checklistSnap && t.checklistSnap.total)))}</tbody></table></div>
      <p class="muted small">${full.length >= 5 && part.length >= 5 ? `Différence d'espérance complète / incomplète : p = ${fmtP(pE)} (Welch). ` : ''}Lignes grisées : moins de 5 trades, non concluant. Le taux mesure les points cochés au moment du gel, avant l'entrée.</p>
    </div>`;
  }

  /* ================= V10 : interface allégée, mode Session, corrélation checklist, taille d'échantillon ================= */
  const N_MIN = 20;
  const EXPAND_ALL = (() => { try { return localStorage.getItem('v10_expand_all') === '1'; } catch (e) { return false; } })();   // tout déplié (tests / préférence avancée)
  const V10_LS = { fold: 'fold_state_v1', kpi: 'kpi_open_v1', compact: 'journal_compact_v1' };
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const foldState = () => { try { return JSON.parse(lsGet(V10_LS.fold, '{}')) || {}; } catch (e) { return {}; } };

  /* ---- 1. en-tête compact ---- */
  function isCompact() { return lsGet(V10_LS.compact, '1') !== '0'; }
  function applyCompact() { document.documentElement.toggleAttribute('data-compact', isCompact()); }
  applyCompact();
  function buildHeader() {
    const top = document.querySelector('.top'); if (!top || top.dataset.v10) return;
    try { themeSwitcher(); } catch (e) {}
    top.dataset.v10 = '1';
    const row = document.createElement('div'); row.className = 'top-row';
    const brand = top.querySelector('.brand'); if (brand) row.appendChild(brand);
    const acts = document.createElement('div'); acts.className = 'top-acts';
    acts.innerHTML = `<a class="btn top-ses" href="#/session" title="Mode Session : écran épuré pour trader">⏱<span class="top-lbl"> Session</span></a>`;
    const nb = document.getElementById('btn-new'); if (nb) { nb.innerHTML = '+<span class="top-lbl"> Trade</span>'; nb.title = 'Nouveau trade'; acts.appendChild(nb); }
    const gear = document.createElement('button'); gear.type = 'button'; gear.className = 'btn top-gear'; gear.id = 'top-gear'; gear.title = 'Réglages'; gear.setAttribute('aria-expanded', 'false'); gear.textContent = '⚙';
    acts.appendChild(gear); row.appendChild(acts);
    top.insertBefore(row, top.firstChild);
    const menu = document.createElement('div'); menu.className = 'top-menu'; menu.id = 'top-menu'; menu.hidden = true;
    menu.innerHTML = `<div class="tm-row"><span>Thème</span><span id="tm-theme"></span></div>
      <label class="tm-row"><span>Mode compact</span><input type="checkbox" id="tm-compact"${isCompact() ? ' checked' : ''}></label>
      <div class="tm-row tm-auth" id="tm-auth"></div>`;
    top.appendChild(menu);
    const sel = document.getElementById('theme-sel'); if (sel) menu.querySelector('#tm-theme').appendChild(sel);
    ['auth-info', 'auth-btn'].forEach(id => { const el = document.getElementById(id); if (el) menu.querySelector('#tm-auth').appendChild(el); });
    menu.querySelector('#tm-compact').onchange = e => { lsSet(V10_LS.compact, e.target.checked ? '1' : '0'); applyCompact(); };
    gear.onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; gear.setAttribute('aria-expanded', String(!menu.hidden)); };
    const bar = document.getElementById('gr-status-bar'), nav = document.getElementById('nav');
    if (bar && nav) { const r2 = document.createElement('div'); r2.className = 'top-row2'; top.insertBefore(r2, nav); r2.appendChild(bar); r2.appendChild(nav); }
    document.addEventListener('click', e => {
      if (!menu.hidden && !e.target.closest('#top-menu, #top-gear')) { menu.hidden = true; gear.setAttribute('aria-expanded', 'false'); }
      const dr = document.getElementById('gr-drawer');
      if (dr && !dr.hidden && !e.target.closest('#gr-drawer, #gr-sum, #focus-pop')) { dr.hidden = true; const s = document.getElementById('gr-sum'); if (s) s.setAttribute('aria-expanded', 'false'); }
    });
    try { updateStatusBar(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(buildHeader, 0)); else setTimeout(buildHeader, 0);

  function compactStatus() {
    const bar = document.getElementById('gr-status-bar'); if (!bar || !DB) return;
    const top = document.querySelector('.top'); if (!top) return;
    let dr = document.getElementById('gr-drawer');
    const wasOpen = dr && !dr.hidden;
    if (!dr) { dr = document.createElement('div'); dr.id = 'gr-drawer'; dr.className = 'gr-drawer'; dr.hidden = true; top.appendChild(dr); }
    dr.innerHTML = '';
    const blocking = el => el.matches('.gr-pill-danger, #news-alert-pill, .gr-pill-news');
    [...bar.children].forEach(el => { if (!blocking(el)) dr.appendChild(el); });
    const warn = dr.querySelectorAll('.gr-pill-warn, .gr-pill-review').length, n = dr.children.length;
    const g = getGuardrails(), st = todayStats();
    const txt = g.enabled ? `📊 ${st.n}/${g.maxTrades} · ${sgn(st.net)}R` : '☰ Infos';
    const b = document.createElement('button'); b.type = 'button'; b.id = 'gr-sum'; b.className = 'gr-pill gr-sum' + (warn ? ' has-warn' : '');
    b.setAttribute('aria-expanded', String(wasOpen)); b.title = 'Objectifs, focus du jour, revues à faire';
    b.innerHTML = `${txt}${n ? ` <span class="gr-cnt">${n}</span>` : ''} ▾`;
    b.onclick = e => { e.stopPropagation(); dr.hidden = !dr.hidden; b.setAttribute('aria-expanded', String(!dr.hidden)); };
    bar.insertBefore(b, bar.firstChild);
    dr.hidden = !wasOpen;
    if (!n) dr.innerHTML = '<span class="muted small">Rien à signaler.</span>';
  }
  { const _usb = updateStatusBar; updateStatusBar = function () { _usb(); try { compactStatus(); } catch (e) {} }; }

  /* ---- 6. textes d'aide -> ⓘ ---- */
  function helpify(root) {
    if (EXPAND_ALL) return;
    const cand = root.querySelectorAll('p.muted, .note, p.small.muted');
    cand.forEach(p => {
      if (p.dataset.help || p.closest('.kpi, table, .help-text, .fp-bar, .top, .gr-drawer, .ses-keep, .ms-list, .tm-row')) return;
      const txt = p.textContent.trim(); if (txt.length < 70) return;
      if (p.querySelector('input, select, textarea, button')) return;
      const par = p.parentElement; if (!par) return;
      const others = [...par.children].filter(c => c !== p && !/^(H1|H2|H3|LEGEND|SUMMARY)$/.test(c.tagName) && !c.matches('p.muted, .note'));
      if (!others.length && !par.matches('.card, fieldset, .fstep-b')) return;   // état vide : on laisse visible
      const pv = p.previousElementSibling, nx = p.nextElementSibling;
      if (pv && pv.tagName === 'H2' && (!nx || /^(H2|DETAILS)$/.test(nx.tagName))) return;   // seul contenu d'une section
      p.dataset.help = '1'; p.classList.add('help-text'); p.hidden = true;
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'info-i'; btn.textContent = 'ⓘ'; btn.title = 'Afficher l\'explication'; btn.setAttribute('aria-expanded', 'false');
      btn.onclick = e => { e.preventDefault(); e.stopPropagation(); p.hidden = !p.hidden; btn.setAttribute('aria-expanded', String(!p.hidden)); btn.classList.toggle('on', !p.hidden); };
      let head = null;
      for (let s = p.previousElementSibling; s; s = s.previousElementSibling) if (/^(H1|H2|H3)$/.test(s.tagName) || s.matches('legend')) { head = s; break; }
      if (!head) head = par.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > legend, :scope > summary');
      if (!head && par.parentElement) { const ps = par.previousElementSibling; if (ps && /^(H2|H3)$/.test(ps.tagName)) head = ps; }
      if (head && !head.querySelector('.info-i')) head.appendChild(btn);
      else p.parentNode.insertBefore(btn, p);
    });
  }

  /* ---- 11. taille d'échantillon ---- */
  function nBadges(root) {
    root.querySelectorAll('table').forEach(tb => {
      if (tb.dataset.nb) return; tb.dataset.nb = '1';
      const ths = [...tb.querySelectorAll('thead th')]; const ci = ths.findIndex(th => th.textContent.trim().toLowerCase() === 'n'); if (ci < 0) return;
      tb.querySelectorAll('tbody tr').forEach(tr => {
        const td = tr.children[ci]; if (!td) return; const n = parseInt(td.textContent, 10); if (!Number.isFinite(n) || n >= N_MIN) return;
        tr.classList.add('low'); td.insertAdjacentHTML('beforeend', ` <span class="nb" title="Moins de ${N_MIN} trades : statistique peu fiable, ne pas en tirer de conclusion">n&lt;${N_MIN}</span>`);
      });
    });
  }

  /* ---- 3 / 4. sections repliables ---- */
  const FOLD_CFG = {
    dashboard: { open: [/^Courbes/], hint: {
      'Discipline': b => { const g = b.querySelector('.disc-grade'), p = b.querySelector('.disc-pct'); return g ? `${g.textContent} · ${p ? p.textContent : ''}` : ''; },
      'Score de consistance': b => { const v = b.querySelector('.cons-ring b'); return v ? v.textContent + '/100' : ''; },
      'Checklist pré-entrée': b => { const v = b.querySelectorAll('.cl-stats .kpi .v')[1]; return v ? 'Remplissage ' + v.textContent : ''; },
      'Fenêtre glissante': b => { const k = [...b.querySelectorAll('.kpi')].find(x => (x.querySelector('.l') || {}).textContent === 'Net R'); return k ? 'Net ' + k.querySelector('.v').textContent + ' R' : ''; },
    } },
    analysis: { open: [/^Espérance glissante/], hint: {
      'Espérance glissante': b => { const v = b.querySelector('.kpi .v'); return v ? 'E20 ' + v.textContent : ''; },
      'Coût des erreurs': b => { const tr = b.querySelector('tbody tr'); return tr && tr.children.length > 5 ? `${tr.children[0].textContent.trim()} ${tr.children[5].textContent.trim()}` : ''; },
      'Checklist ↔ résultat': b => { const v = b.querySelector('[data-r]'); return v ? v.dataset.r : ''; },
    } },
    reviews: { open: [/^Réflexion/], hint: {
      'Réflexion': b => { const q = [...b.querySelectorAll('.qa textarea, .qa input')]; return q.length ? `${q.filter(x => x.value.trim()).length}/${q.length} réponses` : ''; },
      'Trades de la période': b => `${b.querySelectorAll('tbody tr').length} trade(s)`,
      'Historique': b => { const d = b.querySelectorAll('.rh-todo').length; return d ? `${d} à faire` : 'à jour'; },
    } },
  };
  const foldKey = t => t.replace(/ⓘ/g, '').split(/\s*[:(]/)[0].replace(/^[^\wÀ-ÿ]+/, '').trim();
  // place chaque <details> à l'endroit du titre d'origine (le titre a été déplacé, on utilise un repère)
  function foldifyInPlace(v) {
    const cfg = FOLD_CFG[v]; if (!cfg) return;
    const main = $('#main'), st = foldState();
    if (v === 'dashboard') { const d = main.querySelector(':scope > .disc-card'); if (d) { const h = document.createElement('h2'); h.textContent = 'Discipline'; main.insertBefore(h, d); } }
    [...main.children].filter(c => c.tagName === 'H2').forEach(h => {
      const key = foldKey(h.textContent), id = v + ':' + key;
      const d = document.createElement('details'); d.className = 'fold'; d.dataset.k = id;
      main.insertBefore(d, h);
      const body = document.createElement('div'); body.className = 'fold-b';
      for (let s = h.nextElementSibling; s && s.tagName !== 'H2' && !(s.tagName === 'DETAILS'); s = h.nextElementSibling) body.appendChild(s);
      const sum = document.createElement('summary'); sum.appendChild(h);
      const hf = Object.keys(cfg.hint).find(k => key.startsWith(k));
      let hint = ''; try { hint = hf ? cfg.hint[hf](body) : ''; } catch (e) {}
      if (hint) { const sp = document.createElement('span'); sp.className = 'fold-h'; sp.textContent = hint; sum.appendChild(sp); }
      d.appendChild(sum); d.appendChild(body);
      d.open = EXPAND_ALL || (id in st ? !!st[id] : cfg.open.some(re => re.test(key)));
      d.addEventListener('toggle', () => { const s2 = foldState(); s2[id] = d.open ? 1 : 0; lsSet(V10_LS.fold, JSON.stringify(s2)); });
    });
  }

  /* filtres repliés + indicateurs secondaires masqués */
  function foldFilters(root) {
    const bar = root.querySelector(':scope > .bar'); if (!bar || bar.querySelectorAll('label').length < 4 || bar.closest('details')) return;
    let act = 0; bar.querySelectorAll('select, input').forEach(el => { if (el.type === 'checkbox' ? el.checked : el.type !== 'number' && el.value) act++; });
    const d = document.createElement('details'); d.className = 'filt'; d.open = EXPAND_ALL || act > 0 && lsGet('filt_open_v1', '0') === '1';
    d.innerHTML = `<summary>🔎 Filtres${act ? ` <span class="gr-cnt">${act} actif${act > 1 ? 's' : ''}</span>` : ''}</summary>`;
    root.insertBefore(d, bar); d.appendChild(bar);
    d.addEventListener('toggle', () => lsSet('filt_open_v1', d.open ? '1' : '0'));
  }
  function trimKpis(root) {
    root.querySelectorAll('.kpis').forEach(k => {
      if (k.dataset.trim || k.children.length <= 6 || k.closest('.cl-stats, .ses')) return; k.dataset.trim = '1';
      const extra = k.children.length - 4; k.classList.add('kpis-trim'); k.classList.toggle('kpis-open', EXPAND_ALL || lsGet(V10_LS.kpi, '0') === '1');
      const b = document.createElement('button'); b.type = 'button'; b.className = 'kpi-more';
      const lab = () => { b.textContent = k.classList.contains('kpis-open') ? 'Moins d\'indicateurs ▴' : `＋ ${extra} indicateurs ▾`; };
      lab(); b.onclick = () => { k.classList.toggle('kpis-open'); lsSet(V10_LS.kpi, k.classList.contains('kpis-open') ? '1' : '0'); lab(); };
      k.insertAdjacentElement('afterend', b);
    });
    const tk = root.querySelector('.kpis .kpi'); // badge « peu fiable » sur le nombre de trades
    if (tk && /trades/i.test((tk.querySelector('.l') || {}).textContent || '')) { const n = parseInt(tk.querySelector('.v').textContent, 10); if (n < N_MIN && !tk.querySelector('.nb')) tk.querySelector('.l').insertAdjacentHTML('beforeend', ` <span class="nb" title="Moins de ${N_MIN} trades : toutes les statistiques de cette sélection sont peu fiables">n&lt;${N_MIN}</span>`); }
  }

  function postRender() {
    const main = document.getElementById('main'); if (!main) return;
    try { nBadges(main); } catch (e) {}
    try { helpify(main); } catch (e) {}
    if (['dashboard', 'journal'].includes(view)) try { foldFilters(main); } catch (e) {}
    if (['dashboard', 'reviews'].includes(view)) try { trimKpis(main); } catch (e) {}
    try { foldifyInPlace(view); } catch (e) { console.error(e); }
  }
  (function observe() {
    const go = () => {
      const main = document.getElementById('main'), modal = document.getElementById('modal'); if (!main || !modal) return setTimeout(go, 50);
      let busy = false;
      new MutationObserver(() => { if (busy) return; busy = true; try { postRender(); } finally { setTimeout(() => { busy = false; }, 0); } }).observe(main, { childList: true });
      new MutationObserver(() => { if (modal.childElementCount) { try { nBadges(modal); helpify(modal); } catch (e) {} } }).observe(modal, { childList: true });
    };
    go();
  })();

  /* ---- 4. revues : historique en une ligne par période ---- */
  function reviewHistoryHTML() {
    const r = ui.rev, all = enriched(); if (!r.start) return '';
    let p = S.period(r.type, r.start); const rows = [];
    for (let i = 0; i < 8; i++) {
      p = S.shiftPeriod(r.type, p.start, -1);
      const ts = S.inPeriod(all, p), sm = S.summary(ts), done = reviewDone(r.type, p.start);
      rows.push(`<tr class="click rh-row" data-rev="${r.type}|${p.start}"><td>${esc(periodLabel(r.type, p))}</td><td class="num">${sm.n}</td><td class="num ${cls(sm.net)}">${sm.n ? sgn(sm.net) : '–'}</td><td>${done ? '<span class="rh-ok">✓ faite</span>' : sm.n ? '<span class="rh-todo">à faire</span>' : '<span class="muted">–</span>'}</td></tr>`);
    }
    return `<h2>Historique</h2><div class="twrap"><table><thead><tr><th>Période</th><th class="num">Trades</th><th class="num">Net R</th><th>Revue</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  }
  { const _rr = renderReviews; renderReviews = function () { _rr(); try { $('#main').insertAdjacentHTML('beforeend', reviewHistoryHTML()); document.querySelectorAll('.rh-row').forEach(row => row.addEventListener('click', () => { const [type, start] = row.dataset.rev.split('|'); ui.rev.type = type; ui.rev.start = start; renderReviews(); window.scrollTo(0, 0); })); } catch (e) {} }; }

  /* ---- 10. corrélation checklist ↔ résultat ---- */
  function pearson(x, y) {
    const n = x.length; if (n < 3) return null;
    const mx = meanOf(x), my = meanOf(y); let sxy = 0, sx = 0, sy = 0;
    for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; }
    if (!sx || !sy) return { r: null, n };
    const r = sxy / Math.sqrt(sx * sy), df = n - 2, t = r * Math.sqrt(df / Math.max(1e-12, 1 - r * r));
    const p = vIbeta(df / (df + t * t), df / 2, 0.5);
    const z = Math.atanh(Math.max(-0.999999, Math.min(0.999999, r))), se = 1 / Math.sqrt(Math.max(1, n - 3));
    return { r, n, p, ci: n > 3 ? [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)] : [null, null] };
  }
  function ranks(a) { const s = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), r = new Array(a.length); for (let i = 0; i < s.length;) { let j = i; while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++; for (let k = i; k <= j; k++) r[s[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; }
  function scatterSVG(pts) {
    const W = 320, H = 160, L = 34, B = 22, ys = pts.map(p => p[1]), y0 = Math.min(-1, ...ys), y1 = Math.max(1, ...ys);
    const X = x => L + x * (W - L - 22), Y = y => 8 + (y1 - y) / (y1 - y0) * (H - B - 8);
    const ticks = [y0, 0, y1].map(v => `<text x="${L - 4}" y="${Y(v) + 3}" text-anchor="end">${num(v, 1)}</text><line x1="${L}" x2="${W - 8}" y1="${Y(v)}" y2="${Y(v)}" class="sc-g"/>`).join('');
    return `<svg class="scatter" viewBox="0 0 ${W} ${H}" role="img" aria-label="Remplissage de la checklist (x) et résultat en R (y)">${ticks}
      ${[0, .5, 1].map(v => `<text x="${X(v)}" y="${H - 6}" text-anchor="middle">${Math.round(v * 100)} %</text>`).join('')}
      ${pts.map(p => `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3.5" class="${p[1] > 0 ? 'sc-w' : p[1] < 0 ? 'sc-l' : 'sc-b'}"/>`).join('')}</svg>`;
  }
  function checklistCorrHTML(ts) {
    const T = ts.filter(takenT).filter(t => S.filled(t.ret)), W = T.filter(t => t.checklistSnap && t.checklistSnap.total);
    const head = `<h2>Checklist ↔ résultat</h2>`;
    if (!W.length) return head + `<div class="note">Aucun trade n'a encore de checklist figée : la corrélation sera calculée dès que tes trades auront une checklist jointe (bouton ✅ puis « 📌 Figer (entrée) »).</div>`;
    const x = W.map(t => snapRate(t.checklistSnap)), y = W.map(t => +t.ret), pr = pearson(x, y);
    const sp = W.length >= 3 ? pearson(ranks(x), ranks(y)) : null;
    const bk = [['< 80 %', t => snapRate(t.checklistSnap) < .8], ['80 – 99 %', t => { const r = snapRate(t.checklistSnap); return r >= .8 && r < 1; }], ['100 %', t => snapRate(t.checklistSnap) >= 1]];
    const none = T.filter(t => !(t.checklistSnap && t.checklistSnap.total));
    const line = (l, a) => { const r = rets(a), ci = meanCI(r); return `<tr><td>${l}</td><td class="num">${r.length}</td><td class="num">${r.length ? pct(r.filter(v => v > 0).length / r.length) : '–'}</td><td class="num ${cls(meanOf(r))}">${r.length ? sgn(meanOf(r)) : '–'}</td><td class="num">${ci[0] === null ? '–' : `[${num(ci[0])} ; ${num(ci[1])}]`}</td></tr>`; };
    const full = W.filter(bk[2][1]), part = W.filter(t => !bk[2][1](t));
    const wF = full.filter(t => t.ret > 0).length, wP = part.filter(t => t.ret > 0).length;
    const pW = full.length && part.length ? fisherP(wF, full.length - wF, wP, part.length - wP) : null, pE = welchP(rets(full), rets(part)), pFr = welchP(rets(W), rets(none));
    const rTxt = pr && pr.r !== null ? `r = ${num(pr.r, 2)}` : 'r indéfini';
    const minR = W.length > 3 ? 2.8 / Math.sqrt(W.length) : null;
    let verdict;
    if (W.length < N_MIN) verdict = `<b>Échantillon insuffisant</b> : ${W.length} trade(s) avec checklist figée, il en faut au moins ${N_MIN} avant toute conclusion.`;
    else if (pr && pr.r !== null && pr.p < 0.05) verdict = `<b>Lien statistiquement significatif</b> (p = ${fmtP(pr.p)}) : ${pr.r > 0 ? 'plus la checklist est remplie, meilleur est le résultat' : 'un remplissage plus élevé va avec des résultats plus faibles'} sur cet échantillon. Corrélation n'est pas causalité.`;
    else verdict = `<b>Pas de lien démontré</b> (p = ${pr && pr.p !== undefined ? fmtP(pr.p) : '–'}). Cela ne prouve pas l'absence d'effet : avec n = ${W.length}, seule une corrélation |r| ≥ ${minR ? num(Math.min(1, minR), 2) : '–'} serait détectable (puissance 80 %).`;
    return head + `<div class="card"><div class="kpis">
        <div class="kpi"><div class="l">Corrélation remplissage ↔ R</div><div class="v ${pr && pr.p < 0.05 ? (pr.r > 0 ? 'pos' : 'neg') : ''}" data-r="${esc(rTxt)}">${pr && pr.r !== null ? num(pr.r, 2) : '–'}</div><div class="s">Pearson · IC95 % ${pr && pr.ci && pr.ci[0] !== null ? `[${num(pr.ci[0], 2)} ; ${num(pr.ci[1], 2)}]` : '–'} · p = ${pr ? fmtP(pr.p) : '–'}</div></div>
        <div class="kpi"><div class="l">Corrélation de rang</div><div class="v">${sp && sp.r !== null ? num(sp.r, 2) : '–'}</div><div class="s">Spearman · p = ${sp ? fmtP(sp.p) : '–'}</div></div>
        <div class="kpi"><div class="l">Trades analysés</div><div class="v">${W.length}</div><div class="s">${none.length} sans checklist figée</div></div></div>
      <p class="small cc-verdict">${verdict}</p>
      ${scatterSVG(W.map((t, i) => [x[i], y[i]]))}
      <div class="twrap" style="max-height:none;margin-top:10px"><table><thead><tr><th>Remplissage</th><th class="num">n</th><th class="num">Win rate</th><th class="num">Espérance</th><th class="num">IC95 %</th></tr></thead><tbody>
        ${bk.map(([l, f]) => line(l, W.filter(f))).join('')}${line('Sans checklist', none)}</tbody></table></div>
      <p class="muted small">Tests : win rate 100 % vs incomplète, p = ${fmtP(pW)} (Fisher exact) · espérance 100 % vs incomplète, p = ${fmtP(pE)} (Welch) · avec vs sans checklist figée, p = ${fmtP(pFr)} (Welch). Plusieurs tests sur les mêmes données : un p &lt; 0,05 isolé peut être dû au hasard (correction de Bonferroni : seuil 0,017 pour 3 tests). Le remplissage est mesuré au moment du gel, avant l'entrée.</p></div>`;
  }
  { const _ra = renderAnalysis; renderAnalysis = function () { _ra(); try { const ts = DB.trades.filter(takenT).filter(t => S.filled(t.ret)); const at = [...$('#main').children].find(c => c.tagName === 'H2' && /^Par catégorie/.test(c.textContent)); const html = checklistCorrHTML(ts); if (at) at.insertAdjacentHTML('beforebegin', html); else $('#main').insertAdjacentHTML('beforeend', html); } catch (e) { console.error(e); } }; }
  { const _rd = renderDashboard; renderDashboard = function () { _rd(); try { const c = document.querySelector('.cl-stats'); if (!c) return; const W = enriched().filter(takenT).filter(t => S.filled(t.ret) && t.checklistSnap && t.checklistSnap.total); const pr = pearson(W.map(t => snapRate(t.checklistSnap)), W.map(t => +t.ret)); if (pr && pr.r !== null) c.insertAdjacentHTML('beforeend', `<p class="small">Corrélation remplissage ↔ R (tous les trades) : <b>r = ${num(pr.r, 2)}</b>, p = ${fmtP(pr.p)}, n = ${pr.n}${pr.n < N_MIN ? ` <span class="nb">n&lt;${N_MIN}</span>` : ''} · détail dans <a href="#/analysis">Analyse</a>.</p>`); } catch (e) {} }; }

  /* ---- 5. formulaire en 3 étapes ---- */
  const STEP_DEF = () => [
    ['pre', '① Avant l\'entrée', ['f-date', 'f-instrument', 'f-direction', 'f-session', 'f-planId', 'f-setup', 'f-bias', 'f-poi', 'f-killzone', 'f-sweep', 'f-plannedR', 'f-slPips', 'f-risk', 'f-emoEntry']],
    ['exec', '② Exécution', ['f-entryTime', 'f-exitTime', 'f-kzind', 'f-entry', 'f-sl', 'f-tp', 'f-execPoi', 'f-management', 'f-exitType', 'f-ret', 'f-rconv', 'f-emoDuring']],
    ['post', '③ Après', ['f-planFollow', 'f-riskRespected', 'f-invalidation', 'f-fomo', 'f-overtrade', 'f-revenge', 'f-goodTrade', 'f-execScore', 'f-execReview', 'f-mtags', 'f-mistakes', 'f-notes', 'f-emoExit']],
    ['more', '＋ Détails', ['f-improvement', 'f-maePips', 'f-mfePips', 'f-grBroken', 'f-duration', 'f-style', 'f-corr1', 'f-corr2'].concat(SLOTS.map(([k]) => 'f-s-' + k))],
  ];
  const fieldBox = el => el.closest('.wide') || el.closest('.emo-field, .ms-field, .snap-box, label, .kz-ind') || el;
  const isFilled = el => { if (!el) return false; if (el.matches('details.ms')) return !!el.querySelector('input:checked'); if (el.type === 'checkbox') return el.checked; return String(el.value || '').trim() !== ''; };
  function formSteps(isNew) {
    const m = document.getElementById('modal'), form = m && m.querySelector('.form'); if (!form || form.dataset.steps) return;
    form.dataset.steps = '1'; form.classList.add('form-steps');
    const top = document.createElement('div'); top.className = 'fstep-top';
    form.querySelectorAll('.snap-box, #f-lockbar').forEach(x => top.appendChild(x));
    const helps = { pre: [], exec: [], more: [] };
    form.querySelectorAll('fieldset').forEach(fs => { const lg = (fs.querySelector('legend') || {}).textContent || ''; fs.querySelectorAll(':scope > p.muted').forEach(p => (/Critères/.test(lg) ? helps.pre : /Exécution/.test(lg) ? helps.exec : helps.more).push(p)); });
    const steps = STEP_DEF().map(([k, title, ids]) => {
      const d = document.createElement('details'); d.className = 'fstep'; d.dataset.step = k;
      d.innerHTML = `<summary><span class="fstep-t">${title}</span><span class="fstep-c"></span></summary><div class="fstep-b row"></div>`;
      const b = d.querySelector('.fstep-b');
      ids.forEach(id => { const el = document.getElementById(id); if (el && form.contains(el) && !el.closest('.fstep')) b.appendChild(fieldBox(el)); });
      (helps[k] || []).forEach(p => b.appendChild(p));
      return d;
    });
    // champs non prévus -> Détails
    const more = steps[3].querySelector('.fstep-b');
    form.querySelectorAll('input, select, textarea, details.ms').forEach(el => { if (!el.id || el.closest('.fstep, .fstep-top, .ms-list')) return; if (el.closest('details.ms') && el.tagName === 'INPUT') return; more.appendChild(fieldBox(el)); });
    form.innerHTML = '';
    form.appendChild(top); steps.forEach(s => { if (s.querySelector('.fstep-b').children.length) form.appendChild(s); });
    if (!top.children.length) top.remove();
    const count = () => steps.forEach(s => {
      const els = [...s.querySelectorAll('.fstep-b input:not([type=checkbox]), .fstep-b select, .fstep-b textarea, .fstep-b details.ms')].filter(e => !e.closest('details.ms') || e.matches('details.ms'));
      const f = els.filter(isFilled).length; const c = s.querySelector('.fstep-c'); c.textContent = `${f}/${els.length}`; c.className = 'fstep-c' + (f === els.length ? ' ok' : '');
    });
    count(); m.addEventListener('input', count); m.addEventListener('change', count);
    let opened = false;
    if (!isNew) for (const s of steps.slice(0, 3)) { const c = s.querySelector('.fstep-c').textContent.split('/'); if (+c[0] < +c[1]) { s.open = true; opened = true; break; } }
    if (!opened) steps[0].open = true;
    if (EXPAND_ALL) steps.forEach(s => { s.open = true; });
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-goto]'); if (!b) return; const el = document.getElementById(b.dataset.goto); for (let d = el && el.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true; }, true);
  { const _et = editTrade; editTrade = function (n) { _et(n); try { formSteps(n === null || n === undefined); } catch (e) { console.error(e); } }; }

  /* ---- 8. mode Session (avec calculateur) ---- */
  let _sesTimer = null;
  function sesLiveHTML() {
    const g = getGuardrails(), st = todayStats(), tz = newsCfg().tz, now = tzParts(Date.now(), tz), kz = killzoneAt(now.time);
    const left = Math.max(0, g.maxTrades - st.n), riskLeft = Math.max(0, st.losses - g.maxLossR);
    const al = g.enabled ? guardrailAlerts().alerts.filter(a => a.level === 'danger') : [];
    const evs = (typeof alertEvents === 'function' ? alertEvents() : []).filter(e => e.ts > Date.now() - 5 * 60e3).slice(0, 3);
    const mins = ts => { const m = Math.round((ts - Date.now()) / 60000); return m <= 0 ? 'en cours' : m < 60 ? `dans ${m} mn` : `dans ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };
    const snap = pendingSnap();
    return `<div class="ses-head"><div><b class="ses-clock">${esc(now.time)}</b> <span class="muted small">${esc(tz || '')}</span></div>
        ${kz ? `<span class="ses-kz ${kz.inKz ? 'in' : 'out'}">${kz.inKz ? '● Killzone ' + esc(kz.name) : '○ Hors killzone'}</span>` : ''}
        <button class="btn" id="ses-exit">Quitter</button></div>
      ${al.length ? `<div class="gr-alert gr-danger">${al.map(a => a.icon + ' ' + esc(a.msg)).join('<br>')}</div>` : ''}${newsBlockPill()}
      <div class="ses-grid">
        <div class="card ses-risk"><h3>Aujourd'hui</h3>${g.enabled ? `<div class="ses-nums">
          <div><span class="l">Trades</span><b>${st.n}/${g.maxTrades}</b><span class="s">${left} restant${left > 1 ? 's' : ''}</span></div>
          <div><span class="l">Net</span><b class="${cls(st.net)}">${sgn(st.net)} R</b><span class="s">objectif +${num(g.dailyTargetR)} R</span></div>
          <div><span class="l">Risque restant</span><b class="${riskLeft <= 1 ? 'neg' : ''}">${num(riskLeft)} R</b><span class="s">avant max loss ${sgn(g.maxLossR)} R</span></div></div>` : '<p class="muted small">Garde-fous désactivés (onglet Guardrails).</p>'}</div>
        <div class="card ses-news"><h3>Prochaines news</h3>${evs.length ? evs.map(e => `<div class="ses-ev"><b>${esc(tzParts(e.ts, tz).time)}</b> <span class="ccy">${esc(e.country)}</span> ${esc(trunc(e.title, 38))} <span class="muted small">${mins(e.ts)}</span></div>`).join('') : '<p class="muted small">Aucune news filtrée à venir (réglages dans News).</p>'}</div>
        <div class="card ses-cl"><h3>Checklist</h3>${snap ? `<p>📌 Figée à <b>${esc(snap.time)}</b> · ${snap.done}/${snap.total} (${pct(snapRate(snap))})</p>` : '<p class="muted small">Pas encore figée aujourd\'hui.</p>'}<a class="btn" href="checklist.html" target="_blank" rel="noopener">✅ Ouvrir la checklist</a></div>
      </div>`;
  }
  function renderSession() {
    renderCalculator();
    const calcNodes = [...$('#main').childNodes];
    $('#main').innerHTML = `<div class="ses ses-keep"><div id="ses-live"></div><div class="ses-focus">${focusPills()}</div>
      <div class="card ses-calc"><h3>Calculateur de position</h3><div id="ses-calc"></div></div>
      <button class="btn primary ses-new" id="ses-new">+ Enregistrer un trade</button></div>`;
    const box = $('#ses-calc'); calcNodes.forEach(n => box.appendChild(n));
    box.querySelectorAll('h1').forEach(h => h.remove()); box.querySelectorAll('h2').forEach(h => h.remove());
    const live = () => { const el = document.getElementById('ses-live'); if (!el || view !== 'session') { clearInterval(_sesTimer); return; } el.innerHTML = sesLiveHTML(); const x = document.getElementById('ses-exit'); if (x) x.onclick = () => { location.hash = '#/' + (renderSession.prev || 'dashboard'); }; };
    live(); clearInterval(_sesTimer); _sesTimer = setInterval(live, 30000);
    $('#ses-new').onclick = () => editTrade(null);
    if (!NEWS_EVENTS.length) try { loadNewsEvents().then(() => { if (view === 'session') live(); }).catch(() => {}); } catch (e) {}
  }
  { const _r = render; render = function () { document.body.classList.toggle('session-mode', view === 'session'); if (view !== 'session') { renderSession.prev = view; clearInterval(_sesTimer); } _r(); }; }

  /* ================= V11 : routine post-market ================= */
  const PM_JOURNAL_MIN = 80;   // % de fiche remplie pour cocher « Journaling »
  function pmData() { if (!DB.postMarket || typeof DB.postMarket !== 'object') DB.postMarket = {}; return DB.postMarket; }
  function pmCfg() { const d = { remind: !IS_BT, delay: 30 }; if (!DB.pmCfg) DB.pmCfg = {}; Object.keys(d).forEach(k => { if (DB.pmCfg[k] === undefined) DB.pmCfg[k] = d[k]; }); return DB.pmCfg; }
  const dayTrades = d => DB.trades.filter(t => t.date === d && takenT(t)).sort((a, b) => String(a.entryTime || '').localeCompare(String(b.entryTime || '')) || a.n - b.n);
  const yesNo = v => v === 'Yes' || v === 'Oui' ? 'Yes' : v === 'No' || v === 'Non' ? 'No' : '';
  function pmStatus(d, draft) {
    const ts = dayTrades(d), rec = draft || pmData()[d] || {};
    const get = (t, k) => draft && draft.trades && draft.trades[t.n] && draft.trades[t.n][k] !== undefined ? draft.trades[t.n][k] : t[k];
    const fiches = ts.map(t => completeness(t).pct);
    const items = [
      ['journal', 'Journaling', !ts.length || fiches.every(p => p >= PM_JOURNAL_MIN), ts.length ? `${fiches.filter(p => p >= PM_JOURNAL_MIN).length}/${ts.length} fiche(s) remplie(s) à ${PM_JOURNAL_MIN} % ou plus` : 'aucun trade ce jour'],
      ['exec', 'Revue de l\'exécution', !ts.length || ts.every(t => isSet(get(t, 'execScore')) && String(get(t, 'execReview') || '').trim()), ts.length ? `${ts.filter(t => isSet(get(t, 'execScore')) && String(get(t, 'execReview') || '').trim()).length}/${ts.length} trade(s) revu(s)` : 'aucun trade ce jour'],
      ['good', 'Bons trades ≠ trades gagnants', !ts.length || ts.every(t => yesNo(get(t, 'goodTrade'))), ts.length ? `${ts.filter(t => yesNo(get(t, 'goodTrade'))).length}/${ts.length} trade(s) classé(s)` : 'aucun trade ce jour'],
      ['lesson', 'Une leçon', !!String(rec.lesson || '').trim(), ''],
      ['improvement', 'Une amélioration pour demain', !!String(rec.improvement || '').trim(), ''],
    ];
    return { items, done: items.filter(i => i[2]).length, total: items.length, ts };
  }
  const pmDone = d => { const r = pmData()[d]; return !!(r && r.done); };

  function openPostMarket(d) {
    d = d || todayISO();
    const rec = Object.assign({ lesson: '', improvement: '' }, pmData()[d] || {}), ts = dayTrades(d);
    const label = new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
    const opt = (vals, cur, ph) => `<option value="">${ph}</option>` + vals.map(([v, l]) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${l}</option>`).join('');
    const tradeRow = t => `<div class="pm-trade" data-pmt="${t.n}">
        <div class="pm-th"><b>#${t.n}</b> ${esc(t.entryTime || '')} ${esc(t.instrument || '')} ${esc(t.direction || '')} <span class="muted small">${esc(t.setup || '')}</span> <b class="${cls(t.ret)}">${sgn(t.ret)} R</b>
          <button type="button" class="btn sm" data-pmopen="${t.n}">Voir la fiche</button>${completeness(t).pct < PM_JOURNAL_MIN ? `<button type="button" class="btn sm" data-pmedit="${t.n}">Compléter (${completeness(t).pct} %)</button>` : ''}</div>
        <div class="pm-tf">
          <label>Qualité d'exécution<select data-k="execScore">${opt([['5', '5 · parfaite'], ['4', '4 · bonne'], ['3', '3 · moyenne'], ['2', '2 · faible'], ['1', '1 · mauvaise']], t.execScore, '—')}</select></label>
          <label>Bon trade (process respecté) ?<select data-k="goodTrade">${opt([['Yes', 'Oui'], ['No', 'Non']], yesNo(t.goodTrade), '—')}</select></label>
          <label class="pm-wide">Comment j'ai exécuté (entrée, SL, gestion, sortie)<textarea data-k="execReview" rows="2" placeholder="Ex. entrée anticipée avant la confirmation 5 mn, SL bien placé sous le sweep, sortie trop tôt au premier repli…">${esc(t.execReview || '')}</textarea></label>
        </div></div>`;
    showModal(`<div class="mhead"><h1>🌙 Post-market <span class="muted small">${esc(label)}</span></h1></div>
      <div class="pm-prog" id="pm-prog"></div>
      <div class="pm-sec"><h3>1 · Journaling</h3><div id="pm-journal" class="small"></div></div>
      <div class="pm-sec"><h3>2 · Revue de l'exécution et 3 · bons trades ≠ trades gagnants</h3>
        ${ts.length ? ts.map(tradeRow).join('') : '<p class="muted small">Aucun trade ce jour : rien à revoir.</p>'}
        ${ts.length ? '<p class="muted small">Un bon trade respecte ton plan et ton process, quel que soit le résultat. Une perte peut être un bon trade ; un gain obtenu hors plan est un mauvais trade.</p>' : ''}</div>
      <div class="pm-sec"><h3>4 · Une leçon</h3><textarea id="pm-lesson" rows="2" placeholder="La leçon principale de la journée…">${esc(rec.lesson)}</textarea></div>
      <div class="pm-sec"><h3>5 · Une amélioration pour demain</h3><textarea id="pm-impr" rows="2" placeholder="Une chose précise à faire mieux demain…">${esc(rec.improvement)}</textarea><p class="muted small">Elle s'affichera demain dans la pastille 🔧.</p></div>
      ${IS_BT ? '' : `<label class="pm-remind"><input type="checkbox" id="pm-remind"${pmCfg().remind ? ' checked' : ''}> Me rappeler la routine ${pmCfg().delay} mn après la fin de ma dernière killzone (jours de semaine)</label>`}
      <div class="actions"><button class="btn" id="pm-cancel">Fermer</button><button class="btn primary" id="pm-save">Enregistrer</button></div>`);
    const draft = () => { const o = { lesson: $('#pm-lesson').value, improvement: $('#pm-impr').value, trades: {} };
      document.querySelectorAll('[data-pmt]').forEach(row => { const r = o.trades[row.dataset.pmt] = {}; row.querySelectorAll('[data-k]').forEach(el => { r[el.dataset.k] = el.value; }); }); return o; };
    const upd = () => {
      const st = pmStatus(d, draft());
      $('#pm-prog').innerHTML = `<div class="fp-top"><b>${st.done}/${st.total}</b><span class="fp-lbl">routine post-market</span></div><div class="fp-track"><span class="${st.done === st.total ? 'ok' : st.done >= 3 ? 'mid' : 'low'}" style="width:${Math.round(st.done / st.total * 100)}%"></span></div>
        <div class="pm-items">${st.items.map(i => `<span class="pm-it ${i[2] ? 'ok' : ''}">${i[2] ? '✓' : '○'} ${esc(i[1])}</span>`).join('')}</div>`;
      $('#pm-journal').innerHTML = `${st.items[0][2] ? '✓' : '○'} ${esc(st.items[0][3])}${st.items[0][2] ? '' : ' · complète les fiches signalées ci-dessous'}`;
    };
    upd(); $('#modal').addEventListener('input', upd); $('#modal').addEventListener('change', upd);
    $('#pm-cancel').onclick = closeModal;
    document.querySelectorAll('[data-pmopen]').forEach(b => b.onclick = () => openTrade(+b.dataset.pmopen));
    document.querySelectorAll('[data-pmedit]').forEach(b => b.onclick = () => editTrade(+b.dataset.pmedit));
    $('#pm-save').onclick = async () => {
      const dr = draft();
      Object.entries(dr.trades).forEach(([n, f]) => { const t = DB.trades.find(x => x.n === +n); if (!t) return; t.execScore = f.execScore === '' ? null : +f.execScore; t.execReview = f.execReview.trim(); t.goodTrade = f.goodTrade; });
      const st = pmStatus(d, null), prev = pmData()[d] || {};
      const st2 = pmStatus(d, { lesson: dr.lesson, improvement: dr.improvement });
      pmData()[d] = { lesson: dr.lesson.trim(), improvement: dr.improvement.trim(), done: st2.done === st2.total, score: st2.done, at: prev.at && prev.done ? prev.at : new Date().toISOString() };
      if (!IS_BT && $('#pm-remind')) pmCfg().remind = $('#pm-remind').checked;
      if (await save(st2.done === st2.total ? 'Post-market terminé ✓' : `Post-market enregistré (${st2.done}/${st2.total})`)) { closeModal(); render(); }
      void st;
    };
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-pmday]'); if (!b) return; e.preventDefault(); openPostMarket(b.dataset.pmday); });

  /* amélioration du post-market -> pastille 🔧 du lendemain */
  { const _ift = improvementsForToday; improvementsForToday = function () {
      const base = _ift(); if (!DB) return base;
      const today = todayISO(), floor = addDaysISO(today, -7);
      const days = Object.keys(pmData()).filter(d => /^\d{4}-\d\d-\d\d$/.test(d) && d < today && d >= floor && String(pmData()[d].improvement || '').trim()).sort();
      const pd = days[days.length - 1];
      if (!pd || (base.day && base.day > pd)) return base;
      const it = { n: -1, text: String(pmData()[pd].improvement).trim(), day: pd, instrument: '' };
      if (base.day === pd) return { day: pd, items: [it].concat(base.items.filter(x => x.text.toLowerCase() !== it.text.toLowerCase())) };
      return { day: pd, items: [it] };
    }; }

  /* calendrier : badge par jour + résumé dans le panneau du jour */
  { const _rjc = renderJournalCal; renderJournalCal = function () {
      let h = _rjc();
      h = h.replace(/data-jday="(\d{4}-\d\d-\d\d)">(\s*)<span class="jc-d">(\d+)<\/span>/g, (m, d, sp, n) => {
        const r = pmData()[d]; const b = r ? `<span class="jc-pm ${r.done ? 'ok' : 'part'}" title="Post-market ${r.done ? 'fait' : 'partiel (' + (r.score || 0) + '/5)'}">${r.done ? '🌙✓' : '🌙' + (r.score || 0) + '/5'}</span>` : '';
        return `data-jday="${d}">${sp}<span class="jc-d">${n}</span>${b}`;
      });
      if (JCAL.day) {
        const d = JCAL.day, r = pmData()[d], st = pmStatus(d);
        const box = `<div class="jc-pmbox ${r && r.done ? 'ok' : ''}"><div><b>🌙 Post-market</b> · ${r ? (r.done ? 'fait ✓' : `partiel ${st.done}/${st.total}`) : (d <= todayISO() ? 'pas fait' : '–')}
          ${r && r.lesson ? `<div class="small"><b>Leçon :</b> ${esc(r.lesson)}</div>` : ''}${r && r.improvement ? `<div class="small"><b>Amélioration :</b> ${esc(r.improvement)}</div>` : ''}</div>
          ${d <= todayISO() ? `<button class="btn sm" data-pmday="${d}">${r ? 'Modifier' : 'Faire la routine'}</button>` : ''}</div>`;
        h = h.replace(/(<div class="card jc-daylist"><h2[^>]*>[\s\S]*?<\/h2>)/, '$1' + box);
      }
      return h;
    }; }

  /* revues : leçons et améliorations de la période */
  function pmPeriodHTML(p) {
    const ds = Object.keys(pmData()).filter(d => d >= p.start && d <= p.end).sort(), days = [...new Set(DB.trades.filter(t => t.date >= p.start && t.date <= p.end).map(t => t.date))];
    if (!ds.length && !days.length) return '';
    const done = days.filter(pmDone).length;
    const rows = ds.filter(d => pmData()[d].lesson || pmData()[d].improvement).map(d => `<li><b>${esc(new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }))}</b>${pmData()[d].lesson ? ` · Leçon : ${esc(pmData()[d].lesson)}` : ''}${pmData()[d].improvement ? ` · Amélioration : ${esc(pmData()[d].improvement)}` : ''}</li>`).join('');
    return `<h2>Post-market de la période</h2><div class="card"><p class="small">Routine faite sur <b>${done}/${days.length}</b> jour(s) tradé(s)${days.length ? ` (${pct(done / days.length)})` : ''}.</p>${rows ? `<ul class="pm-list">${rows}</ul>` : '<p class="muted small">Aucune leçon notée sur la période.</p>'}</div>`;
  }
  { const _rr2 = renderReviews; renderReviews = function () { _rr2(); try { const r = ui.rev, p = S.period(r.type, r.start); const at = [...$('#main').children].find(c => c.tagName === 'H2' && /^Réflexion/.test(c.textContent)); const h = pmPeriodHTML(p); if (h) { if (at) at.insertAdjacentHTML('beforebegin', h); else $('#main').insertAdjacentHTML('beforeend', h); } } catch (e) { console.error(e); } }; }

  /* dashboard : bons trades vs trades gagnants + taux de routine */
  function goodWinHTML(ts) {
    const T = ts.filter(takenT).filter(t => S.filled(t.ret)), C = T.filter(t => yesNo(t.goodTrade));
    const first = Object.keys(pmData()).filter(k => /^\d{4}-/.test(k)).sort()[0];
    const days = first ? [...new Set(T.map(t => t.date))].filter(x => x >= first) : [], done = days.filter(pmDone).length;
    const head = `<h2>Post-market</h2>`;
    const routine = `<div class="kpi"><div class="l">Routine post-market</div><div class="v">${days.length ? pct(done / days.length) : '–'}</div><div class="s">${first ? `${done}/${days.length} jour(s) tradé(s) depuis le ${first.slice(8)}/${first.slice(5, 7)}` : 'pas encore utilisée'}</div></div>`;
    const sc = T.filter(t => isSet(t.execScore)).map(t => +t.execScore);
    const execK = `<div class="kpi"><div class="l">Qualité d'exécution</div><div class="v">${sc.length ? num(meanOf(sc), 1) + '/5' : '–'}</div><div class="s">${sc.length} trade(s) noté(s)</div></div>`;
    if (!C.length) return head + `<div class="card"><div class="kpis">${routine}${execK}</div><p class="muted small">Classe tes trades en « bon trade » ou non dans la routine post-market (bouton 🌙 du mode Session ou du calendrier) : le tableau bons trades / trades gagnants apparaîtra ici.</p></div>`;
    const cell = (g, w) => C.filter(t => yesNo(t.goodTrade) === g && (w ? t.ret > 0 : t.ret <= 0));
    const GW = cell('Yes', true), GL = cell('Yes', false), BW = cell('No', true), BL = cell('No', false);
    const sum = a => a.reduce((s, t) => s + +t.ret, 0);
    const c = (a, lbl, k) => `<td class="gw-c ${k}"><b>${a.length}</b> <span class="muted small">(${pct(a.length / C.length)})</span><div class="small ${cls(sum(a))}">${sgn(sum(a))} R</div><div class="muted small">${lbl}</div></td>`;
    const gains = sum(GW) + sum(BW), luck = gains > 0 ? sum(BW) / gains : null;
    const G = GW.length + GL.length, B = BW.length + BL.length, pF = G && B ? fisherP(GW.length, GL.length, BW.length, BL.length) : null;
    const eG = meanOf(rets(GW.concat(GL))), eB = meanOf(rets(BW.concat(BL)));
    return head + `<div class="card"><div class="kpis">${routine}${execK}
        <div class="kpi"><div class="l">Gains venant de mauvais trades</div><div class="v ${luck > .2 ? 'neg' : ''}">${luck === null ? '–' : pct(luck)}</div><div class="s">part chanceuse du R gagné</div></div></div>
      <div class="twrap" style="max-height:none;margin-top:12px"><table class="gw"><thead><tr><th></th><th>Gagnant</th><th>Perdant / BE</th></tr></thead><tbody>
        <tr><th>Bon trade<div class="muted small">n = ${G}${G < N_MIN ? ` <span class="nb">n&lt;${N_MIN}</span>` : ''} · E ${eG === null ? '–' : sgn(eG)}</div></th>${c(GW, 'à répéter', 'ok')}${c(GL, 'bonne perte', 'mid')}</tr>
        <tr><th>Mauvais trade<div class="muted small">n = ${B}${B < N_MIN ? ` <span class="nb">n&lt;${N_MIN}</span>` : ''} · E ${eB === null ? '–' : sgn(eB)}</div></th>${c(BW, 'gain chanceux', 'warn')}${c(BL, 'erreur', 'bad')}</tr></tbody></table></div>
      <p class="muted small">${C.length}/${T.length} trades classés. Win rate bons trades ${G ? pct(GW.length / G) : '–'} contre ${B ? pct(BW.length / B) : '–'} pour les mauvais : p = ${fmtP(pF)} (Fisher exact). Un « gain chanceux » renforce un mauvais comportement : c'est la case à surveiller.</p></div>`;
  }
  FOLD_CFG.dashboard.hint['Post-market'] = b => { const v = b.querySelector('.kpi .v'); return v ? 'Routine ' + v.textContent : ''; };
  { const _rd2 = renderDashboard; renderDashboard = function () { _rd2(); try {
      const f = ui.dash; const ts = enriched().filter(t => (!f.from || t.date >= f.from) && (!f.to || t.date <= f.to) && (!f.instrument || t.instrument === f.instrument) && (!f.session || t.session === f.session));
      const at = [...$('#main').children].find(c => c.tagName === 'H2' && /^Fenêtre glissante/.test(c.textContent));
      const h = goodWinHTML(ts); if (at) at.insertAdjacentHTML('beforebegin', h); else $('#main').insertAdjacentHTML('beforeend', h);
    } catch (e) { console.error(e); } }; }

  /* mode Session : carte post-market */
  { const _sl = sesLiveHTML; sesLiveHTML = function () {
      const h = _sl(), d = todayISO(), st = pmStatus(d), r = pmData()[d];
      const card = `<div class="card ses-pm ${r && r.done ? 'ok' : ''}"><h3>🌙 Post-market</h3><p>${r && r.done ? '✓ Routine faite aujourd\'hui' : `${st.done}/${st.total} · ${st.items.filter(i => !i[2]).map(i => i[1]).join(', ')}`}</p><button class="btn ${r && r.done ? '' : 'primary'}" data-pmday="${d}">${r && r.done ? 'Revoir' : 'Clôturer la session'}</button></div>`;
      return h.replace('<div class="card ses-cl">', card + '<div class="card ses-cl">');
    }; }

  /* rappel : X mn après la fin de la dernière killzone active */
  function pmReminderDue() {
    if (IS_BT || !DB || !pmCfg().remind) return false;
    const d = todayISO(), wd = new Date(d + 'T12:00:00Z').getUTCDay(); if (wd === 0 || wd === 6 || pmDone(d)) return false;
    const kz = getGuardrails().killzones || {}; const act = (kz.sessions || []).filter(s => s.active && toMin(s.to) !== null); if (!act.length) return false;
    const end = Math.max(...act.map(s => toMin(s.to))) + (+pmCfg().delay || 0);
    const tz = newsCfg().tz, now = toMin(tzParts(Date.now(), tz).time);
    return now !== null && now >= end;
  }
  function pmPill() { return pmReminderDue() ? `<a class="gr-pill gr-pill-review" href="#" data-pmday="${todayISO()}" title="Routine post-market à faire">🌙 Post-market à faire</a>` : ''; }
  { const _sp = statusPills; statusPills = function () { return _sp() + pmPill(); }; }
  setInterval(() => {
    try {
      if (!pmReminderDue()) return; const k = 'pm_reminded:' + todayISO();
      if (lsGet(k, '') ) return; lsSet(k, '1');
      notifySafe('🌙 Routine post-market', 'Journaling, revue d\'exécution, bons trades vs gagnants, une leçon, une amélioration pour demain.', 'pm-' + todayISO());
      toast('🌙 Routine post-market à faire'); updateStatusBar();
    } catch (e) {}
  }, 60000);

  /* formulaire de trade : champs post-market dans l'étape ③ ; fiche détaillée */
  { const _et2 = editTrade; editTrade = function (n) {
      _et2(n);
      try {
        const t = n === null || n === undefined ? {} : (DB.trades.find(x => x.n === n) || {}), post = document.querySelector('#modal details.fstep[data-step="post"] .fstep-b');
        if (!post || document.getElementById('f-goodTrade')) return;
        const o = (vals, cur) => '<option value="">—</option>' + vals.map(([v, l]) => `<option value="${v}"${String(cur) === v ? ' selected' : ''}>${l}</option>`).join('');
        post.insertAdjacentHTML('afterbegin', `<label>Bon trade (process) ?<select id="f-goodTrade">${o([['Yes', 'Oui'], ['No', 'Non']], yesNo(t.goodTrade))}</select></label>
          <label>Qualité d'exécution (1–5)<select id="f-execScore">${o([['5', '5'], ['4', '4'], ['3', '3'], ['2', '2'], ['1', '1']], isSet(t.execScore) ? String(t.execScore) : '')}</select></label>
          <label class="wide">Revue de l'exécution<textarea id="f-execReview" rows="2">${esc(t.execReview || '')}</textarea></label>`);
      } catch (e) { console.error(e); }
    }; }
  { const _ot = openTrade; openTrade = function (n) {
      _ot(n);
      try { const t = DB.trades.find(x => x.n === n); const det = document.querySelector('#modal .details'); if (!t || !det || (!yesNo(t.goodTrade) && !isSet(t.execScore) && !t.execReview)) return;
        det.insertAdjacentHTML('afterend', `<h3>Post-market</h3><div class="textblock">${yesNo(t.goodTrade) ? `<b>Bon trade :</b> ${yesNo(t.goodTrade) === 'Yes' ? 'oui' : 'non'}${t.ret > 0 && yesNo(t.goodTrade) === 'No' ? ' (gain chanceux)' : t.ret <= 0 && yesNo(t.goodTrade) === 'Yes' ? ' (bonne perte)' : ''}\n` : ''}${isSet(t.execScore) ? `<b>Qualité d'exécution :</b> ${t.execScore}/5\n` : ''}${t.execReview ? `<b>Revue :</b> ${esc(t.execReview)}` : ''}</div>`);
      } catch (e) {} }; }

  /* ---------- DONNÉES ---------- */
  function download(name, text, mime) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  function toCSV() {
    const cols = ['n', 'date', 'instrument', 'direction', 'session', 'duration', 'entry', 'sl', 'tp', 'risk', 'ret', '_result', '_cum', '_dd', '_grade', 'planFollow', 'fomo', 'overtrade', 'revenge', 'guardrailsBroken', 'management', 'mistakes', 'notes', 'improvement', 'bias', 'poi', 'killzone', 'sweep'];
    cols.push('entryTime', 'exitTime', 'killzoneAuto', 'setup', 'execPoi', 'plannedR', 'exitType', 'mae', 'mfe', 'mistakeTags', 'emoEntry', 'emoEntryLvl', 'emoEntryNote', 'emoDuring', 'emoDuringLvl', 'emoDuringNote', 'emoExit', 'emoExitLvl', 'emoExitNote', 'preLockedAt');
    const seen = {}; for (let i = 0; i < cols.length; i++) { if (seen[cols[i]]) cols.splice(i--, 1); else seen[cols[i]] = 1; }
    const q = v => { v = v === null || v === undefined ? '' : Array.isArray(v) ? v.join(' | ') : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const head = [...cols.slice(0, 11), 'agg_entry', 'agg_sl', 'agg_tp', 'agg_risk', 'agg_ret', 'delta_agg_minus_cons', ...cols.slice(11), ...SLOTS.map(([, l]) => 'screens_' + l)];
    return '\ufeff' + [head.join(','), ...enriched().map(t => { const a = t.agg || {}, d = delta(t);
      return [...cols.slice(0, 11).map(c => q(t[c])), q(a.entry), q(a.sl), q(a.tp), q(a.risk), q(a.ret), q(d), ...cols.slice(11).map(c => q(t[c])), ...SLOTS.map(([k]) => q(((t.screens || {})[k] || []).join(' ')))].join(','); })].join('\n');
  }
  const LISTS = [['instruments', 'Instruments'], ['sessions', 'Sessions'], ['entries', 'Entrées conservatives'], ['aggEntries', 'Entrées aggressives'], ['sl', 'Stop loss'], ['tp', 'Take profit']];
  function renderData() {
    const nShots = DB.trades.reduce((a, t) => a + SLOTS.reduce((b, [k]) => b + ((t.screens || {})[k] || []).length, 0), 0);
    $('#main').innerHTML = `
      <h1>Données</h1>
      <div class="card"><p><b>${DB.trades.length}</b> trades · <b>${DB.reviews.length}</b> revue(s) · <b>${nShots}</b> lien(s) de capture · stockés dans <code>journal-backtest.json</code> sur votre Google Drive personnel. Les données sont aussi cachées localement dans le navigateur pour un accès hors connexion.</p>
        <div class="bar"><button class="btn" id="x-json">Exporter JSON</button><button class="btn" id="x-csv">Exporter CSV (Excel)</button><label style="flex-direction:row;align-items:center;gap:8px"><span class="btn" style="pointer-events:none">Importer un JSON…</span><input type="file" id="x-imp" accept=".json,application/json"></label></div>
        <p class="muted small">L'import REMPLACE tout le journal actuel (la sauvegarde du jour est conservée).</p></div>
      ${cleanupHTML()}
      <h2>Listes proposées dans le formulaire</h2>
      <div class="card"><div class="form">${LISTS.concat(V3_LISTS).map(([k, l]) => `<label>${l} (une valeur par ligne)<textarea id="l-${k}" style="min-height:110px">${esc(list(k).join('\n'))}</textarea></label>`).join('')}</div><div class="actions"><button class="btn primary" id="l-save">Enregistrer les listes</button></div>
      <p class="muted small">Les valeurs déjà utilisées dans vos trades sont toujours proposées en plus de ces listes.</p></div>`;
    $('#x-json').onclick = () => download(`backtest-${todayISO()}.json`, JSON.stringify(DB, null, 1), 'application/json');
    cleanupWire();
    $('#x-csv').onclick = () => download(`backtest-${todayISO()}.csv`, toCSV(), 'text/csv');
    $('#x-imp').onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const db = JSON.parse(await file.text());
        if (!db || !Array.isArray(db.trades)) throw new Error('fichier sans liste « trades »');
        if (!confirm(`Remplacer le journal actuel (${DB.trades.length} trades) par ce fichier (${db.trades.length} trades) ?`)) return;
        DB = { meta: db.meta || {}, lists: db.lists || {}, trades: db.trades, reviews: db.reviews || [] };
        if (await save('Journal importé')) render();
      } catch (err) { alert('Import impossible : ' + err.message); }
    };
    $('#l-save').onclick = async () => { LISTS.concat(V3_LISTS).forEach(([k]) => DB.lists[k] = $('#l-' + k).value.split('\n').map(s => s.trim()).filter(Boolean)); await save('Listes enregistrées'); };
  }

  /* ---------- routage ---------- */
  const VIEWS = ['dashboard', 'compare', 'journal', 'reviews', 'guardrails', 'news', 'trading', 'plan', 'notebook', 'calc', 'analysis', 'setups', 'sanctuary', 'bvl', 'data', 'session'];
  function render() {
    hideNews(); hideTrading(); updateStatusBar();
    $('#dbname').textContent = (DB && DB.meta && DB.meta.name) || 'Journal de backtest';
    document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.v === view));
    ({ dashboard: renderDashboard, compare: renderCompare, journal: renderJournal, reviews: renderReviews, guardrails: renderGuardrails, news: renderNews, plan: renderTradingPlan, calc: renderCalculator, trading: renderTrading, notebook: renderNotebook, analysis: renderAnalysis, setups: renderSetups, sanctuary: renderSanctuary, bvl: renderBvL, data: renderData, session: renderSession }[view] || renderDashboard)();
  }
  function route() { const v = (location.hash.match(/^#\/(\w+)/) || [])[1]; view = VIEWS.includes(v) ? v : 'dashboard'; render(); }
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', e => {
    if (LB) { if (e.key === 'Escape') closeLightbox(); else if (e.key === 'ArrowLeft' && LB.items.length > 1) step(-1); else if (e.key === 'ArrowRight' && LB.items.length > 1) step(1); return; }
    if (e.key === 'Escape' && !$('#overlay').hidden) closeModal();
  });
  $('#overlay').addEventListener('mousedown', e => { if (e.target.id === 'overlay' && !$('#modal').querySelector('#f-save')) closeModal(); });
  $('#btn-new').onclick = () => editTrade(null);
  load().then(route);
  window.__app = { get DB() { return DB; } };   // utile pour les tests
})();
