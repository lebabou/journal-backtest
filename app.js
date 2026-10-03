/* Journal de backtest – interface. Données : GET/PUT /api/db (journal.json). */
(function () {
  'use strict';


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
  async function load() {
    // Initialize Google Drive connection
    Drive.init({
      clientId: '581487785097-euvn52u9tlbduie8mpsmmf6sanbcfsk2.apps.googleusercontent.com',
      fileName: FILE_NAME,
      onAuthChange: function(ok, err) {
        updateAuthUI();
        if (ok) load().then(render);
        if (err) banner('Erreur de connexion : ' + err);
      }
    });
    try {
      // 1. Try Google Drive if signed in
      if (Drive.isSignedIn()) {
        var result = await Drive.load(null);
        if (result.db) {
          DB = result.db;
          DB.lists = DB.lists || {}; DB.reviews = DB.reviews || []; DB.trades = DB.trades || [];
          banner(''); LAST_GOOD = JSON.stringify(DB);
          if (result.source === 'created') toast('Fichier cr\u00e9\u00e9 sur Google Drive');
          updateAuthUI();
          return;
        }
      }
      // 2. Try local cache
      var cached = Drive.getCached();
      if (cached && cached.trades && cached.trades.length) {
        DB = cached;
        DB.lists = DB.lists || {}; DB.reviews = DB.reviews || []; DB.trades = DB.trades || [];
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
          DB.lists = DB.lists || {}; DB.reviews = DB.reviews || []; DB.trades = DB.trades || [];
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
      DB = Drive.getCached() || { meta: {}, lists: {}, trades: [], reviews: [] };
      DB.lists = DB.lists || {}; DB.reviews = DB.reviews || []; DB.trades = DB.trades || [];
    }
    updateAuthUI();
  }
  function updateAuthUI() {
    var btn = document.getElementById('auth-btn');
    var info = document.getElementById('auth-info');
    if (!btn) return;
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
  async function save(okMsg) {
    try {
      await Drive.save(DB);
      LAST_GOOD = JSON.stringify(DB);
      banner('');
      toast(okMsg || 'Enregistr\u00e9 \u2601');
      return true;
    } catch (e) {
      if (LAST_GOOD) DB = JSON.parse(LAST_GOOD);
      banner('\u00c9chec : ' + e.message + ' \u2014 modification ANNUL\u00c9E.');
      return false;
    }
  }

  /* ---------- helpers ---------- */
  const list = k => DB.lists[k] || [];
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

  /* ---------- GUARDRAILS ---------- */
  function defaultGuardrails() { return { maxTrades: 3, maxLossR: -3, dailyTargetR: 3, enabled: true }; }
  function getGuardrails() { return Object.assign(defaultGuardrails(), DB.guardrails || {}); }
  function todayStats(dateStr) {
    var d = dateStr || new Date().toISOString().slice(0, 10);
    var ts = DB.trades.filter(function(t) { return t.date === d && S.filled(t.ret); });
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
    return { alerts: alerts, st: st, g: g };
  }
  function guardrailBanner() {
    var r = guardrailAlerts();
    if (!r.g.enabled || !r.alerts.length) return '';
    var html = '<div class="guardrails">';
    r.alerts.forEach(function(a) { html += '<div class="gr-alert gr-' + a.level + '"><span class="gr-icon">' + a.icon + '</span> ' + esc(a.msg) + '</div>'; });
    html += '<div class="gr-summary">' + r.st.n + ' trade(s) \u00b7 Net ' + sgn(r.st.net) + ' R \u00b7 Pertes ' + sgn(r.st.losses) + ' R</div></div>';
    return html;
  }
  function guardrailConfirm(dateStr) {
    var r = guardrailAlerts(dateStr, true);
    var danger = r.alerts.filter(function(a) { return a.level === 'danger'; });
    if (!danger.length) return true;
    var msg = '\u26a0\ufe0f GUARDRAIL ATTEINT \u26a0\ufe0f\n\n';
    danger.forEach(function(a) { msg += a.msg + '\n'; });
    msg += '\nVoulez-vous quand m\u00eame enregistrer ce trade ?';
    return confirm(msg);
  }
  function renderGuardrails() {
    var g = getGuardrails(), st = todayStats();
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
      '<label>Daily target (R)<input type="number" id="gr-target" step="0.5" min="0" value="' + g.dailyTargetR + '"></label>' +
      '</div><div class="actions" style="margin-top:10px"><button class="btn primary" id="gr-save">Enregistrer</button></div></div>' +
      '<h2>Statut du jour (' + st.date + ')</h2>' + bannerHTML +
      '<div class="kpis"><div class="kpi"><div class="l">Trades aujourd\u2019hui</div><div class="v ' + (st.n >= g.maxTrades ? 'neg' : '') + '">' + st.n + ' / ' + g.maxTrades + '</div></div>' +
      '<div class="kpi"><div class="l">Pertes du jour</div><div class="v ' + (st.losses <= g.maxLossR ? 'neg' : '') + '">' + sgn(st.losses) + ' R</div></div>' +
      '<div class="kpi"><div class="l">Net du jour</div><div class="v ' + cls(st.net) + '">' + sgn(st.net) + ' R</div></div>' +
      '<div class="kpi"><div class="l">Daily target</div><div class="v ' + (st.net >= g.dailyTargetR ? 'pos' : '') + '">+' + num(g.dailyTargetR) + ' R</div></div></div>' +
      '<h2>Historique des 7 derniers jours de trading</h2>' +
      '<div class="twrap" style="max-height:none"><table><thead><tr><th>Date</th><th class="num">Trades</th><th class="num">Wins</th><th class="num">Losses</th><th class="num">Net R</th><th class="num">Pertes R</th><th>Statut</th></tr></thead><tbody>' + days.join('') + '</tbody></table></div>';
    $('#gr-save').onclick = async function() {
      DB.guardrails = { enabled: $('#gr-enabled').checked, maxTrades: +$('#gr-maxTrades').value || 3, maxLossR: +$('#gr-maxLoss').value || -3, dailyTargetR: +$('#gr-target').value || 3 };
      if (await save('Guardrails enregistr\u00e9s')) renderGuardrails();
    };
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
      <h2>Fenêtre glissante : ${Math.min(win.n, +f.window || 20)} derniers trades de la sélection</h2>
      <div class="kpis">${cards(win)}</div>
      <h2>Courbes</h2>
      <div class="grid2">
        <div class="card"><h3>R cumulé</h3>${lineChart({ series: [{ name: 'R cumulé', color: 'var(--accent)', pts: eq }], yFmt: v => v.toFixed(1) })}</div>
        <div class="card"><h3>Drawdown (R)</h3>${lineChart({ series: [{ name: 'Drawdown', color: 'var(--loss)', pts: dd, area: true }], yMax: 0, yFmt: v => v.toFixed(1) })}</div>
        <div class="card"><h3>Distribution des R</h3>${histChart(S.histogram(rs, 0.5))}</div>
        <div class="card"><h3>Plan-follow glissant (10 derniers trades)</h3>${lineChart({ series: [{ name: 'Plan-follow', color: 'var(--win)', pts: roll }], yMin: 0, yMax: 100, yFmt: v => v.toFixed(0) + ' %' })}</div>
      </div>
      <h2>Performance par catégorie</h2>
      <div class="grid2">
        ${groupTable('Instrument', g(t => t.instrument))}${groupTable('Session', g(t => t.session))}
        ${groupTable('Jour', g(t => S.dayName(t.date)))}${groupTable('Direction', g(t => t.direction))}
        ${groupTable('Modèle d\'entrée', g(t => t.entry))}${groupTable('Stop loss', g(t => t.sl))}
        ${groupTable('Take profit', g(t => t.tp))}${groupTable('Grade du setup', g(t => t._grade))}
        ${groupTable('Score du setup (/5)', g(t => t._score === null ? '' : t._score + '/5'))}${groupTable('Plan-follow', g(t => t.planFollow))}
        ${groupTable('FOMO / impulsion', g(t => t.fomo))}${groupTable('Gestion du trade', g(t => t.management))}
      </div>`;
    const re = () => { f.from = $('#d-from').value; f.to = $('#d-to').value; f.instrument = $('#d-inst').value; f.session = $('#d-sess').value; f.window = $('#d-win').value; f.excl = $('#d-excl').checked; renderDashboard(); };
    ['#d-from', '#d-to', '#d-inst', '#d-sess', '#d-win', '#d-excl'].forEach(s => $(s).addEventListener('change', re));
    $('#d-reset').onclick = () => { ui.dash = { from: '', to: '', instrument: '', session: '', window: 20, excl: false }; renderDashboard(); };
  }


  /* ---------- JOURNAL ---------- */
  const SORTS = { n: t => t.n, date: t => t.date + String(t.n).padStart(5, '0'), instrument: t => t.instrument, ret: t => t.ret === null ? -1e9 : t.ret,
    agg: t => t.agg && S.filled(t.agg.ret) ? t.agg.ret : -1e9, session: t => t.session, entry: t => t.entry };
  const delta = t => S.hasAgg(t) ? t.agg.ret - t.ret : null;
  function renderJournal() {
    const f = ui.jr, q = f.q.toLowerCase();
    let ts = enriched().filter(t => (!f.instrument || t.instrument === f.instrument) && (!f.session || t.session === f.session) && (!f.result || t._result === f.result) &&
      (!f.direction || t.direction === f.direction) && (!f.entry || t.entry === f.entry) && (!f.from || t.date >= f.from) && (!f.to || t.date <= f.to) &&
      (!f.aggOnly || S.hasAgg(t)) &&
      (!q || [t.notes, t.mistakes, t.management, t.instrument, t.entry, t.agg && t.agg.entry].join(' ').toLowerCase().includes(q)));
    const key = SORTS[f.sort] || SORTS.n;
    ts.sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0); if (f.desc) ts.reverse();
    const sm = S.summary(ts);
    const th = (k, l, c) => `<th class="${c || ''}" data-sort="${k}" style="cursor:pointer">${l}${f.sort === k ? (f.desc ? ' ▼' : ' ▲') : ''}</th>`;
    const nShots = t => SLOTS.reduce((a, [k]) => a + (t.screens && t.screens[k] ? t.screens[k].length : 0), 0);
    $('#main').innerHTML = `
      ${guardrailBanner()}
      <h1>Journal <span class="muted small">${ts.length} trade(s) · Net conservative ${sgn(sm.net)} R · win rate ${pct(sm.winRate)}</span></h1>
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
        <button class="btn" id="j-reset">Réinitialiser</button>
      </div>
      <div class="twrap"><table><thead><tr>${th('n', '#', 'num')}${th('date', 'Date')}${th('instrument', 'Instrument')}<th>Dir.</th>${th('session', 'Session')}${th('entry', 'Entrée cons.')}<th>SL</th><th>TP</th>${th('ret', 'R cons.', 'num')}${th('agg', 'R agg.', 'num')}<th class="num">Δ</th><th>Résultat</th><th>Grade</th><th>Plan</th><th>FOMO</th><th class="num">R cumulé</th><th class="num">📷</th></tr></thead><tbody>` +
      ts.map(t => { const d = delta(t); return `<tr class="click" data-n="${t.n}"><td class="num">${t.n}</td><td>${esc(t.date)}</td><td>${esc(t.instrument)}</td><td>${esc(t.direction)}</td><td>${esc(t.session)}</td><td>${esc(t.entry)}</td><td>${esc(t.sl)}</td><td>${esc(t.tp)}</td><td class="num ${cls(t.ret)}">${sgn(t.ret)}</td><td class="num ${cls(t.agg && t.agg.ret)}">${t.agg && S.filled(t.agg.ret) ? sgn(t.agg.ret) : ''}</td><td class="num ${cls(d)}">${d === null ? '' : sgn(d)}</td><td>${t._result ? `<span class="badge ${t._result}">${t._result}</span>` : ''}</td><td>${t._grade ? `<span class="badge g">${t._grade}</span>` : ''}</td><td>${esc(t.planFollow)}</td><td>${esc(t.fomo)}</td><td class="num">${num(t._cum)}</td><td class="num">${nShots(t) || ''}</td></tr>`; }).join('') +
      `</tbody></table></div>${ts.length ? '' : '<p class="muted pad">Aucun trade ne correspond aux filtres.</p>'}`;
    const re = () => { Object.assign(f, { q: $('#j-q').value, instrument: $('#j-inst').value, session: $('#j-sess').value, result: $('#j-res').value, direction: $('#j-dir').value, entry: $('#j-ent').value, from: $('#j-from').value, to: $('#j-to').value, aggOnly: $('#j-agg').checked }); renderJournal(); };
    $('#j-q').addEventListener('change', re);
    ['#j-inst', '#j-sess', '#j-res', '#j-dir', '#j-ent', '#j-from', '#j-to', '#j-agg'].forEach(s => $(s).addEventListener('change', re));
    $('#j-reset').onclick = () => { Object.assign(f, { q: '', instrument: '', session: '', result: '', direction: '', entry: '', from: '', to: '', aggOnly: false }); renderJournal(); };
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
    lb.innerHTML = `<button class="x" aria-label="Fermer">×</button>${LB.items.length > 1 ? '<button class="nav prev">‹</button><button class="nav next">›</button>' : ''}<img src="${esc(it.src)}" alt=""><div class="cap">${esc(it.label)} (${LB.i + 1}/${LB.items.length}) · <a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer" style="color:#8fc1ff">ouvrir l'original</a></div>`;
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
      <div class="details">${D('Session', t.session)}${D('Durée', t.duration)}${D('Plan-follow', t.planFollow)}${D('FOMO / impulsion', t.fomo)}${D('Gestion', t.management)}
        ${D('Bias alignment', t.bias)}${D('POI haute proba', t.poi)}${D('Killzone', t.killzone)}${D('Sweep + Market Shift', t.sweep)}${D('RR asymétrique', t.rr)}${D('Score setup', t._score === null ? '' : t._score + '/5')}</div>
      ${block('Erreurs', t.mistakes)}${block('Notes', t.notes)}`);
    bindShots($('#modal'), t);
    $('#m-close').onclick = closeModal; $('#m-edit').onclick = () => editTrade(t.n);
    $('#m-del').onclick = async () => { if (confirm(`Supprimer définitivement le trade #${t.n} ?\n(une copie de sauvegarde du jour est conservée dans backups/)`)) { DB.trades = DB.trades.filter(x => x.n !== t.n); if (await save('Trade supprimé')) { closeModal(); render(); } } };
    const order = DB.trades.map(x => x.n).sort((a, b) => a - b), i = order.indexOf(t.n);
    $('#m-prev').disabled = i <= 0; $('#m-next').disabled = i >= order.length - 1;
    $('#m-prev').onclick = () => openTrade(order[i - 1]); $('#m-next').onclick = () => openTrade(order[i + 1]);
  }

  /* ---------- formulaire (ajout / édition) ---------- */
  const YN = (id, label, v) => `<label>${label}<select id="${id}">${opts(['Yes', 'No'], v, '—')}</select></label>`;
  function editTrade(n) {
    const isNew = n === null;
    const t = isNew ? { n: Math.max(0, ...DB.trades.map(x => x.n)) + 1, date: new Date().toISOString().slice(0, 10), risk: 1, direction: 'Long', screens: {}, agg: {} } : DB.trades.find(x => x.n === n);
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
        ${'<label>Durée (hh:mm)<input id="f-duration" type="text" inputmode="numeric" pattern="[0-9]{1,2}:[0-9]{2}" placeholder="00:00" value="' + esc(val(t.duration)) + '"></label>'}
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
        <fieldset><legend>Process</legend><div class="row">
          ${YN('f-planFollow', 'Plan-follow', t.planFollow)}${YN('f-fomo', 'FOMO / impulsion', t.fomo)}
          <label>Gestion du trade<input id="f-management" list="dl-mgmt" value="${esc(t.management)}"></label></div></fieldset>
        <fieldset><legend>Critères du setup (grade automatique)</legend><div class="row">
          ${YN('f-bias', 'Bias alignment', t.bias)}${YN('f-poi', 'POI haute probabilité', t.poi)}${YN('f-killzone', 'Killzone respectée', t.killzone)}${YN('f-sweep', 'Liquidity sweep + Market Shift', t.sweep)}${YN('f-rr', 'RR asymétrique', t.rr)}</div></fieldset>
        <fieldset><legend>Captures d'écran (un lien par ligne : lien TradingView /x/…, ou URL d'image)</legend><div class="row" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
          ${SLOTS.map(([k, l]) => `<label>${l}<textarea id="f-s-${k}" placeholder="https://www.tradingview.com/x/…">${esc(((t.screens || {})[k] || []).join('\n'))}</textarea></label>`).join('')}</div></fieldset>
        <label class="wide">Erreurs<textarea id="f-mistakes">${esc(t.mistakes)}</textarea></label>
        <label class="wide">Notes<textarea id="f-notes">${esc(t.notes)}</textarea></label>
      </div>
      ${dl('dl-inst', uniq('instruments'))}${dl('dl-sess', uniq('sessions'))}${dl('dl-entry', uniq('entries'))}${dl('dl-aentry', uniq('aggEntries'))}${dl('dl-sl', uniq('sl'))}${dl('dl-tp', uniq('tp'))}${dl('dl-mgmt', mgmt)}
      <div class="actions"><button class="btn" id="f-cancel">Annuler</button><button class="btn primary" id="f-save">Enregistrer</button></div>`);
    $('#f-cancel').onclick = () => isNew ? closeModal() : openTrade(t.n);
    $('#f-save').onclick = async () => {
      const v = id => $('#f-' + id).value.trim();
      const numOrNull = id => { const x = v(id); return x === '' ? null : +x; };
      if (!v('date')) return alert('La date est obligatoire.');
      if (isNew && !guardrailConfirm(v('date'))) return;
      if (!v('instrument')) return alert('L\'instrument est obligatoire.');
      for (const id of ['ret', 'aret', 'risk', 'arisk']) { const x = v(id); if (x !== '' && !Number.isFinite(+x)) return alert('Valeur numérique invalide (' + id + ').'); }
      const urls = k => v('s-' + k).split(/[\s,;]+/).filter(u => /^(https?:\/\/|data:image\/)/.test(u));
      const nt = {
        n: t.n, instrument: v('instrument'), direction: v('direction'), date: v('date'), session: v('session'), duration: v('duration'),
        entry: v('entry'), sl: v('sl'), tp: v('tp'), risk: numOrNull('risk'), ret: numOrNull('ret'),
        agg: { entry: v('aentry'), sl: v('asl'), tp: v('atp'), risk: numOrNull('arisk'), ret: numOrNull('aret') },
        screens: Object.fromEntries(SLOTS.map(([k]) => [k, urls(k)])),
        planFollow: v('planFollow'), management: v('management'), mistakes: v('mistakes'), notes: v('notes'), fomo: v('fomo'),
        bias: v('bias'), poi: v('poi'), killzone: v('killzone'), sweep: v('sweep'), rr: v('rr'),
      };
      const i = DB.trades.findIndex(x => x.n === t.n);
      if (i >= 0) DB.trades[i] = nt; else DB.trades.push(nt);
      if (await save(isNew ? 'Trade ajouté' : 'Trade modifié')) { openTrade(nt.n); render(); }
    };
  }


  /* ---------- REVUES (weekly / monthly / quarterly / yearly) ---------- */
  const QUESTIONS = {
    weekly: [['q1', 'Qu\'est-ce qui a bien marché cette semaine, et pourquoi ?'], ['q2', 'Quelles erreurs ou points faibles, et quel plan de prévention ?'], ['q3', 'Quel schéma voyez-vous dans vos meilleurs et pires trades ?'], ['q4', 'Quel est votre unique priorité pour la semaine prochaine ?'], ['best', 'Meilleur trade (pourquoi il était bon)'], ['worst', 'Pire trade (cause)'], ['missed', 'Setups valides manqués', 'number'], ['chart', 'Graphique à étudier']],
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
    if (!r.start) { const last = DB.trades.map(t => t.date).sort().pop() || new Date().toISOString().slice(0, 10); r.start = S.period(r.type, last).start; }
    const p = S.period(r.type, r.start), all = enriched(), ts = S.inPeriod(all, p), sm = S.summary(ts);
    const id = `${r.type}:${p.start}`, rv = DB.reviews.find(x => x.id === id) || { answers: {} };
    const kpi = (l, v, c) => `<div class="kpi"><div class="l">${l}</div><div class="v ${c || ''}">${v}</div></div>`;
    const withRet = ts.filter(t => S.filled(t.ret)), best = withRet.slice().sort((a, b) => b.ret - a.ret)[0], worst = withRet.slice().sort((a, b) => a.ret - b.ret)[0];
    const ctx = t => t ? `#${t.n} ${esc(t.instrument)} ${esc(t.direction)} (${esc(t.date)}) : ${sgn(t.ret)} R${t.mistakes ? ' · erreurs : ' + esc(t.mistakes) : ''}${t.notes ? ' · notes : ' + esc(t.notes) : ''}` : '–';
    const gt = (title, fn) => groupTable(title, S.groupBy(ts, fn));
    const months = r.type === 'yearly' ? gt('Par mois', t => t.date.slice(0, 7)) : '';
    $('#main').innerHTML = `
      <h1>Revues</h1>
      <div class="tabs">${Object.entries(TYPES).map(([k, l]) => `<button data-t="${k}" class="${k === r.type ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="bar"><button class="btn" id="r-prev">←</button><h2 style="margin:0 8px">${esc(periodLabel(r.type, p))}</h2><button class="btn" id="r-next">→</button><span class="muted small">${p.start} → ${p.end}</span></div>
      <div class="kpis">${kpi('Trades', sm.n)}${kpi('Wins / Losses / BE', `${sm.wins} / ${sm.losses} / ${sm.be}`)}${kpi('Win rate', pct(sm.winRate))}${kpi('Net R', sgn(sm.net), cls(sm.net))}${kpi('Gain moy.', sgn(sm.avgWin))}${kpi('Perte moy.', sgn(sm.avgLoss))}${kpi('Profit factor', num(sm.profitFactor))}${kpi('Max drawdown', num(sm.maxDD) + ' R')}${kpi('Plan-follow', pct(sm.planRate))}${kpi('Hors règles', sm.ruleBreaks)}${kpi('FOMO', sm.fomo)}${kpi('A+ pris', ts.filter(t => t._grade === 'A+').length)}</div>
      ${sm.n ? `<h2>Contexte automatique</h2><div class="textblock"><b>Meilleur trade :</b> ${ctx(best)}\n<b>Pire trade :</b> ${ctx(worst)}</div>` : '<div class="note">Aucun trade sur cette période.</div>'}
      ${sm.n ? `<div class="grid2" style="margin-top:12px">${gt('Par instrument', t => t.instrument)}${gt('Par session', t => t.session)}${months}</div>` : ''}
      <h2>Réflexion</h2>
      <div class="card">${QUESTIONS[r.type].map(([k, label, kind]) => `<div class="qa"><label for="q-${k}">${esc(label)}</label>${kind === 'number' ? `<input type="number" id="q-${k}" value="${esc(rv.answers[k] ?? '')}">` : `<textarea id="q-${k}">${esc(rv.answers[k] ?? '')}</textarea>`}</div>`).join('')}
        <div class="actions"><button class="btn primary" id="r-save">Enregistrer la revue</button></div></div>
      ${ts.length ? `<h2>Trades de la période</h2><div class="twrap"><table><thead><tr><th class="num">#</th><th>Date</th><th>Instrument</th><th>Dir.</th><th class="num">R</th><th>Grade</th><th>Plan</th></tr></thead><tbody>${ts.map(t => `<tr class="click" data-n="${t.n}"><td class="num">${t.n}</td><td>${esc(t.date)}</td><td>${esc(t.instrument)}</td><td>${esc(t.direction)}</td><td class="num ${cls(t.ret)}">${sgn(t.ret)}</td><td>${esc(t._grade)}</td><td>${esc(t.planFollow)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
    document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { const last = DB.trades.map(t => t.date).sort().pop() || p.start; r.type = b.dataset.t; r.start = S.period(r.type, p.start <= last && last <= p.end ? last : p.start).start; renderReviews(); });
    $('#r-prev').onclick = () => { r.start = S.shiftPeriod(r.type, p.start, -1).start; renderReviews(); };
    $('#r-next').onclick = () => { r.start = S.shiftPeriod(r.type, p.start, 1).start; renderReviews(); };
    document.querySelectorAll('tr.click').forEach(row => row.onclick = () => openTrade(+row.dataset.n));
    $('#r-save').onclick = async () => {
      const answers = {};
      QUESTIONS[r.type].forEach(([k, , kind]) => { const v = $('#q-' + k).value; if (v !== '') answers[k] = kind === 'number' ? +v : v; });
      const i = DB.reviews.findIndex(x => x.id === id), rec = { id, type: r.type, start: p.start, end: p.end, answers };
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







  /* ---------- NEWS (calendrier économique) ---------- */
  function renderNews() {
    var saved = DB.newsFilter || { currencies: ['USD','EUR','GBP','JPY','CHF','AUD','NZD','CAD'], impact: '3' };

    var ccyMap = {USD:'5',EUR:'22',GBP:'17',JPY:'25',CHF:'34',AUD:'72',NZD:'43',CAD:'6'};
    var allCcy = ['USD','EUR','GBP','JPY','CHF','AUD','NZD','CAD'];

    var ccyChecks = allCcy.map(function(c) {
      var checked = saved.currencies.indexOf(c) >= 0 ? ' checked' : '';
      return '<label class="nw-chip"><input type="checkbox" class="nw-ccy" value="' + c + '"' + checked + '> ' + c + '</label>';
    }).join('');

    $('#main').innerHTML =
      '<h1>\ud83d\udcc5 Calendrier \u00e9conomique</h1>' +
      '<div class="nw-filters">' +
      '<div class="nw-filter-row"><span class="nw-label">Devises :</span>' + ccyChecks +
      '<button class="btn sm" id="nw-all">Toutes</button><button class="btn sm" id="nw-none">Aucune</button></div>' +
      '<div class="nw-filter-row"><span class="nw-label">Impact :</span>' +
      '<label class="nw-chip"><input type="radio" name="nw-imp" value="3"' + (saved.impact === '3' ? ' checked' : '') + '> \ud83d\udd34 High uniquement</label>' +
      '<label class="nw-chip"><input type="radio" name="nw-imp" value="2,3"' + (saved.impact === '2,3' ? ' checked' : '') + '> \ud83d\udfe0 Medium + High</label>' +
      '<label class="nw-chip"><input type="radio" name="nw-imp" value="1,2,3"' + (saved.impact === '1,2,3' ? ' checked' : '') + '> Tous</label>' +
      '</div>' +
      '<button class="btn primary" id="nw-apply">Appliquer les filtres</button>' +
      '</div>' +
      '<div id="nw-frame-wrap" class="cal-embed"></div>' +
      '<p class="muted small" style="margin-top:8px">Source : <a href="https://www.investing.com/economic-calendar/" target="_blank" rel="noopener">Investing.com</a> \u2014 S\u00e9lectionnez une date avec le calendrier int\u00e9gr\u00e9 pour voir les semaines pass\u00e9es (backtest 2024, etc.)</p>';

    function buildIframe() {
      var ccys = [];
      document.querySelectorAll('.nw-ccy').forEach(function(cb) {
        if (cb.checked && ccyMap[cb.value]) ccys.push(ccyMap[cb.value]);
      });
      if (!ccys.length) { $('#nw-frame-wrap').innerHTML = '<div class="note">S\u00e9lectionnez au moins une devise.</div>'; return; }
      var imp = '3';
      document.querySelectorAll('input[name="nw-imp"]').forEach(function(r) { if (r.checked) imp = r.value; });

      // Save filter preferences
      var selCcys = [];
      document.querySelectorAll('.nw-ccy').forEach(function(cb) { if (cb.checked) selCcys.push(cb.value); });
      DB.newsFilter = { currencies: selCcys, impact: imp };

      var url = 'https://sslecal2.investing.com?columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous' +
        '&importance=' + imp +
        '&features=datepicker,timezone' +
        '&countries=' + ccys.join(',') +
        '&calType=week&timeZone=55&lang=5';

      $('#nw-frame-wrap').innerHTML = '<iframe src="' + url + '" width="100%" height="600" frameBorder="0" allowtransparency="true" style="border:1px solid var(--line);border-radius:var(--radius);background:#fff;display:block;min-height:500px"></iframe>';
    }

    $('#nw-apply').onclick = buildIframe;
    $('#nw-all').onclick = function() { document.querySelectorAll('.nw-ccy').forEach(function(cb) { cb.checked = true; }); buildIframe(); };
    $('#nw-none').onclick = function() { document.querySelectorAll('.nw-ccy').forEach(function(cb) { cb.checked = false; }); };

    buildIframe();
  }



  /* ---------- TRADING PLAN ---------- */
  function renderTradingPlan() {
    var plan = DB.tradingPlan || { sections: [], notes: [] };
    var editing = renderTradingPlan._editing || false;

    if (editing) {
      var sectionsHTML = '';
      plan.sections.forEach(function(sec, si) {
        sectionsHTML += '<fieldset><legend>' +
          '<input type="text" class="tp-title" data-si="' + si + '" value="' + esc(sec.title) + '" style="font-weight:700;border:none;background:transparent;font-size:14px;width:300px">' +
          ' <button class="btn sm danger tp-del-sec" data-si="' + si + '">\u00d7</button></legend>';
        sec.items.forEach(function(item, ii) {
          sectionsHTML += '<div style="display:flex;gap:6px;margin-bottom:4px;align-items:center">' +
            '<span class="muted">\u2022</span>' +
            '<input type="text" class="tp-item" data-si="' + si + '" data-ii="' + ii + '" value="' + esc(item) + '" style="flex:1">' +
            '<button class="btn sm danger tp-del-item" data-si="' + si + '" data-ii="' + ii + '">\u00d7</button></div>';
        });
        sectionsHTML += '<button class="btn sm tp-add-item" data-si="' + si + '">+ Ajouter un point</button></fieldset>';
      });

      var notesHTML = '';
      plan.notes.forEach(function(note, ni) {
        notesHTML += '<div style="display:flex;gap:6px;margin-bottom:4px;align-items:center">' +
          '<span class="muted">\ud83d\udcdd</span>' +
          '<input type="text" class="tp-note" data-ni="' + ni + '" value="' + esc(note) + '" style="flex:1">' +
          '<button class="btn sm danger tp-del-note" data-ni="' + ni + '">\u00d7</button></div>';
      });

      $('#main').innerHTML =
        '<h1>\ud83d\udcdd Trading Plan <span class="muted small">(\u00e9dition)</span></h1>' +
        '<div class="card"><div class="form">' + sectionsHTML +
        '<button class="btn" id="tp-add-sec">+ Ajouter une section</button>' +
        '</div></div>' +
        '<h2>Trading notes</h2>' +
        '<div class="card">' + notesHTML +
        '<button class="btn sm" id="tp-add-note">+ Ajouter une note</button></div>' +
        '<div class="actions" style="margin-top:14px"><button class="btn" id="tp-cancel">Annuler</button><button class="btn primary" id="tp-save">Enregistrer le plan</button></div>';

      // Event handlers
      $('#tp-save').onclick = async function() {
        var newPlan = { sections: [], notes: [] };
        document.querySelectorAll('.tp-title').forEach(function(el) {
          var si = +el.dataset.si;
          if (!newPlan.sections[si]) newPlan.sections[si] = { title: '', items: [] };
          newPlan.sections[si].title = el.value.trim();
        });
        document.querySelectorAll('.tp-item').forEach(function(el) {
          var si = +el.dataset.si, v = el.value.trim();
          if (v && newPlan.sections[si]) newPlan.sections[si].items.push(v);
        });
        newPlan.sections = newPlan.sections.filter(function(s) { return s && s.title; });
        document.querySelectorAll('.tp-note').forEach(function(el) {
          var v = el.value.trim(); if (v) newPlan.notes.push(v);
        });
        DB.tradingPlan = newPlan;
        renderTradingPlan._editing = false;
        if (await save('Trading plan enregistr\u00e9')) renderTradingPlan();
      };
      $('#tp-cancel').onclick = function() { renderTradingPlan._editing = false; renderTradingPlan(); };
      $('#tp-add-sec').onclick = function() { plan.sections.push({ title: 'Nouvelle section', items: [''] }); DB.tradingPlan = plan; renderTradingPlan(); };
      $('#tp-add-note').onclick = function() { plan.notes.push(''); DB.tradingPlan = plan; renderTradingPlan(); };
      document.querySelectorAll('.tp-add-item').forEach(function(btn) {
        btn.onclick = function() { plan.sections[+btn.dataset.si].items.push(''); DB.tradingPlan = plan; renderTradingPlan(); };
      });
      document.querySelectorAll('.tp-del-sec').forEach(function(btn) {
        btn.onclick = function() { plan.sections.splice(+btn.dataset.si, 1); DB.tradingPlan = plan; renderTradingPlan(); };
      });
      document.querySelectorAll('.tp-del-item').forEach(function(btn) {
        btn.onclick = function() { plan.sections[+btn.dataset.si].items.splice(+btn.dataset.ii, 1); DB.tradingPlan = plan; renderTradingPlan(); };
      });
      document.querySelectorAll('.tp-del-note').forEach(function(btn) {
        btn.onclick = function() { plan.notes.splice(+btn.dataset.ni, 1); DB.tradingPlan = plan; renderTradingPlan(); };
      });
      return;
    }

    // Read-only view
    var html = '<h1>\ud83d\udcdd Trading Plan</h1>';
    html += '<div class="actions" style="margin-bottom:14px"><button class="btn primary" id="tp-edit">Modifier le plan</button></div>';
    plan.sections.forEach(function(sec) {
      html += '<div class="card" style="margin-bottom:12px"><h2 style="margin-top:0">' + esc(sec.title) + '</h2><ul style="margin:0;padding-left:20px">';
      sec.items.forEach(function(item) {
        html += '<li style="margin-bottom:4px">' + esc(item) + '</li>';
      });
      html += '</ul></div>';
    });
    if (plan.notes && plan.notes.length) {
      html += '<div class="card" style="margin-bottom:12px;border-left:3px solid var(--be)"><h2 style="margin-top:0">\ud83d\udcdd Trading notes</h2><ul style="margin:0;padding-left:20px">';
      plan.notes.forEach(function(note) {
        html += '<li style="margin-bottom:6px">' + esc(note) + '</li>';
      });
      html += '</ul></div>';
    }
    $('#main').innerHTML = html;
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

    var sentimentRows = [
      {name:'US500 (risk appetite)', bull:'Risk On', bear:'Risk Off'},
      {name:'DXY (liquidity)', bull:'Risk Off', bear:'Risk On'},
      {name:'US10Y (core bond signals)', bull:'Risk On / Strong USD', bear:'Risk Off / Weak USD'},
      {name:'Gold (fear & risk aversion)', bull:'Risk Off', bear:'Risk On'},
      {name:'VIX (market stress)', bull:'Risk Off > 20', bear:'Risk On < 20'},
      {name:'OIL WTI (growth expectation)', bull:'Risk On', bear:'Risk Off'},
      {name:'AUDJPY (sentiment thermometer)', bull:'Risk On', bear:'Risk Off'}
    ];

    var sentimentHTML = sentimentRows.map(function(row, i) {
      return '<tr>' +
        '<td>' + esc(row.name) + '</td>' +
        '<td><select class="sent-sel" data-i="' + i + '" data-tf="w1"><option value="0">-</option><option value="1">\u2191 Up</option><option value="-1">\u2193 Down</option></select></td>' +
        '<td><select class="sent-sel" data-i="' + i + '" data-tf="d1"><option value="0">-</option><option value="1">\u2191 Up</option><option value="-1">\u2193 Down</option></select></td>' +
        '<td><select class="sent-sel" data-i="' + i + '" data-tf="h4"><option value="0">-</option><option value="1">\u2191 Up</option><option value="-1">\u2193 Down</option></select></td>' +
        '<td class="num sent-sub" data-i="' + i + '">0</td>' +
        '<td class="muted small">' + esc(row.bull) + '</td>' +
        '<td class="muted small">' + esc(row.bear) + '</td>' +
        '</tr>';
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
      '</div>' +

      '<div class="card">' +
      '<h2 style="margin-top:0">\ud83c\udf21\ufe0f Risk Market Sentiment Dashboard</h2>' +
      '<p class="muted small">Scoring : Up = +1, Down = -1. Certains indicateurs sont invers\u00e9s (DXY, US10Y, Gold, VIX).<br>' +
      'Total : <b>+3 \u00e0 +6 \u2192 RISK-ON</b> | <b>-3 \u00e0 -6 \u2192 RISK-OFF</b> | <b>-2 \u00e0 +2 \u2192 Neutral</b></p>' +
      '<div class="twrap" style="max-height:none"><table><thead><tr>' +
      '<th>Indicator</th><th>W1</th><th>D1</th><th>H4</th><th class="num">Sub</th><th>Bullish Effect</th><th>Bearish Effect</th>' +
      '</tr></thead><tbody>' + sentimentHTML + '</tbody>' +
      '<tfoot><tr><td colspan="4" style="text-align:right;font-weight:700">TOTAL SCORE</td>' +
      '<td class="num" id="sent-total" style="font-size:20px;font-weight:700">0</td>' +
      '<td colspan="2" id="sent-verdict" style="font-weight:700">-</td></tr></tfoot></table></div>' +
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

    // Sentiment dashboard logic
    var INVERT = [false, true, true, true, true, false, false]; // DXY, US10Y, Gold, VIX are inverted

    function calcSentiment() {
      var total = 0;
      document.querySelectorAll('.sent-sub').forEach(function(cell) {
        var i = +cell.dataset.i;
        var sub = 0;
        document.querySelectorAll('.sent-sel[data-i="' + i + '"]').forEach(function(sel) {
          var v = +sel.value;
          sub += INVERT[i] ? -v : v;
        });
        cell.textContent = sub > 0 ? '+' + sub : sub;
        cell.className = 'num sent-sub ' + (sub > 0 ? 'pos' : sub < 0 ? 'neg' : '');
        total += sub;
      });

      var el = $('#sent-total');
      el.textContent = total > 0 ? '+' + total : total;
      el.className = 'num ' + (total >= 3 ? 'pos' : total <= -3 ? 'neg' : '');

      var verdict = $('#sent-verdict');
      if (total >= 3) { verdict.textContent = '\ud83d\udfe2 RISK-ON'; verdict.style.color = 'var(--win)'; }
      else if (total <= -3) { verdict.textContent = '\ud83d\udd34 RISK-OFF'; verdict.style.color = 'var(--loss)'; }
      else { verdict.textContent = '\ud83d\udfe1 Neutral / Choppy'; verdict.style.color = 'var(--be)'; }
    }

    document.querySelectorAll('.sent-sel').forEach(function(sel) {
      sel.onchange = calcSentiment;
    });
    calcSentiment();
  }


  /* ---------- DONNÉES ---------- */
  function download(name, text, mime) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  function toCSV() {
    const cols = ['n', 'date', 'instrument', 'direction', 'session', 'duration', 'entry', 'sl', 'tp', 'risk', 'ret', '_result', '_cum', '_dd', '_grade', 'planFollow', 'fomo', 'management', 'mistakes', 'notes', 'bias', 'poi', 'killzone', 'sweep', 'rr'];
    const q = v => { v = v === null || v === undefined ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
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
      <h2>Listes proposées dans le formulaire</h2>
      <div class="card"><div class="form">${LISTS.map(([k, l]) => `<label>${l} (une valeur par ligne)<textarea id="l-${k}" style="min-height:110px">${esc(list(k).join('\n'))}</textarea></label>`).join('')}</div><div class="actions"><button class="btn primary" id="l-save">Enregistrer les listes</button></div>
      <p class="muted small">Les valeurs déjà utilisées dans vos trades sont toujours proposées en plus de ces listes.</p></div>`;
    $('#x-json').onclick = () => download(`backtest-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(DB, null, 1), 'application/json');
    $('#x-csv').onclick = () => download(`backtest-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(), 'text/csv');
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
    $('#l-save').onclick = async () => { LISTS.forEach(([k]) => DB.lists[k] = $('#l-' + k).value.split('\n').map(s => s.trim()).filter(Boolean)); await save('Listes enregistrées'); };
  }

  /* ---------- routage ---------- */
  const VIEWS = ['dashboard', 'compare', 'journal', 'reviews', 'guardrails', 'news', 'plan', 'calc', 'data'];
  function render() {
    $('#dbname').textContent = (DB.meta && DB.meta.name) || 'Journal de backtest';
    document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.v === view));
    ({ dashboard: renderDashboard, compare: renderCompare, journal: renderJournal, reviews: renderReviews, guardrails: renderGuardrails, news: renderNews, plan: renderTradingPlan, calc: renderCalculator, data: renderData }[view] || renderDashboard)();
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
