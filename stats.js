/* Calculs du journal (réplique les formules du classeur Excel). Fonctionne dans le navigateur et sous Node. */
(function (root) {
  const YN = v => v === 'Yes' ? 1 : 0;
  const filled = v => v !== undefined && v !== null && v !== '';
  const T95 = [0,12.706,4.303,3.182,2.776,2.571,2.447,2.365,2.306,2.262,2.228,2.201,2.179,2.160,2.145,2.131,2.120,2.110,2.101,2.093,2.086,2.080,2.074,2.069,2.064,2.060,2.056,2.052,2.048,2.045,2.042];
  const tcrit = df => df < 1 ? NaN : df <= 30 ? T95[df] : df <= 60 ? 2.0 : 1.96;

  const result = t => !filled(t.ret) ? '' : t.ret > 0 ? 'Win' : t.ret < 0 ? 'Loss' : 'Breakeven';
  const criteria = t => [t.bias, t.poi, t.killzone, t.sweep];   // « RR asymétrique » retiré (V3)
  const setupScore = t => criteria(t).every(filled) ? criteria(t).reduce((a, v) => a + YN(v), 0) : null;
  const grade = t => { const s = setupScore(t); return s === null ? '' : s === 4 ? 'A+' : s === 3 ? 'A' : s === 2 ? 'B' : 'C'; };
  const discipline = t => [t.planFollow, t.riskRespected, t.invalidation].every(filled)
    ? YN(t.planFollow) + YN(t.riskRespected) + YN(t.invalidation) : null;

  /* trades triés par n ; ajoute résultat, R cumulé, pic, drawdown, grade, plan-follow glissant (10) */
  function enrich(trades) {
    const sorted = trades.slice().sort((a, b) => a.n - b.n);
    let cum = 0, peak = 0;
    return sorted.map((t, i) => {
      const hasRet = filled(t.ret);
      if (hasRet) { cum += Number(t.ret); peak = Math.max(peak, cum); }
      const win = sorted.slice(Math.max(0, i - 9), i + 1).filter(x => filled(x.planFollow));
      return Object.assign({}, t, {
        _result: result(t), _cum: hasRet ? cum : null, _peak: hasRet ? peak : null, _dd: hasRet ? peak - cum : null,
        _score: setupScore(t), _grade: grade(t), _disc: discipline(t),
        _roll: win.length ? win.filter(x => x.planFollow === 'Yes').length / win.length : null,
      });
    });
  }

  function wilson(k, n) {
    if (!n) return [null, null];
    const z = 1.96, p = k / n, d = 1 + z * z / n;
    const c = (p + z * z / (2 * n)) / d, m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [Math.max(0, c - m), Math.min(1, c + m)];
  }

  function summary(trades) {
    const rs = trades.filter(t => filled(t.ret)).sort((a, b) => a.n - b.n).map(t => Number(t.ret));
    const n = rs.length;
    const wins = rs.filter(r => r > 0), losses = rs.filter(r => r < 0);
    const sum = a => a.reduce((x, y) => x + y, 0);
    const net = sum(rs), mean = n ? net / n : null;
    const sd = n > 1 ? Math.sqrt(sum(rs.map(r => (r - mean) ** 2)) / (n - 1)) : null;
    let cum = 0, peak = 0, maxDD = 0;
    rs.forEach(r => { cum += r; peak = Math.max(peak, cum); maxDD = Math.max(maxDD, peak - cum); });
    const gl = Math.abs(sum(losses));
    const se = sd !== null ? sd / Math.sqrt(n) : null;
    const pf = trades.filter(t => filled(t.planFollow));
    return {
      n, wins: wins.length, losses: losses.length, be: n - wins.length - losses.length,
      winRate: n ? wins.length / n : null, winCI: wilson(wins.length, n),
      net, exp: mean, sd, se,
      expCI: se !== null ? [mean - tcrit(n - 1) * se, mean + tcrit(n - 1) * se] : [null, null],
      sharpe: sd ? mean / sd : null,
      avgWin: wins.length ? sum(wins) / wins.length : null,
      avgLoss: losses.length ? sum(losses) / losses.length : null,
      profitFactor: gl ? sum(wins) / gl : (wins.length ? Infinity : null),
      maxDD, best: n ? Math.max(...rs) : null, worst: n ? Math.min(...rs) : null,
      planRate: pf.length ? pf.filter(t => t.planFollow === 'Yes').length / pf.length : null,
      ruleBreaks: trades.filter(t => t.planFollow === 'No' || t.riskRespected === 'No' || t.invalidation === 'No').length,
      fomo: trades.filter(t => t.fomo === 'Yes').length,
    };
  }

  function groupBy(trades, keyFn) {
    const m = new Map();
    trades.forEach(t => { const k = keyFn(t); if (k === '' || k === null || k === undefined) return; (m.get(k) || m.set(k, []).get(k)).push(t); });
    return [...m.entries()].map(([key, ts]) => Object.assign({ key }, summary(ts))).sort((a, b) => b.net - a.net);
  }

  function histogram(rs, step) {
    if (!rs.length) return [];
    step = step || 0.5;
    const lo = Math.floor(Math.min(...rs) / step) * step, hi = Math.ceil((Math.max(...rs) + 1e-9) / step) * step;
    const bins = [];
    for (let a = lo; a < hi - 1e-9; a += step) bins.push({ from: a, to: a + step, count: 0 });
    rs.forEach(r => { const b = bins.find(b => r >= b.from - 1e-9 && r < b.to - 1e-9) || bins[bins.length - 1]; b.count++; });
    return bins;
  }

  /* périodes (dates ISO 'YYYY-MM-DD', calculs en UTC pour éviter les décalages de fuseau) */
  const d2s = d => d.toISOString().slice(0, 10);
  const s2d = s => new Date(s + 'T00:00:00Z');
  const addDays = (s, n) => { const d = s2d(s); d.setUTCDate(d.getUTCDate() + n); return d2s(d); };
  function period(type, anchor) {
    const d = s2d(anchor), y = d.getUTCFullYear(), m = d.getUTCMonth();
    if (type === 'weekly') { const dow = (d.getUTCDay() + 6) % 7; const st = addDays(anchor, -dow); return { start: st, end: addDays(st, 6) }; }
    if (type === 'monthly') return { start: d2s(new Date(Date.UTC(y, m, 1))), end: d2s(new Date(Date.UTC(y, m + 1, 0))) };
    if (type === 'quarterly') { const q = Math.floor(m / 3) * 3; return { start: d2s(new Date(Date.UTC(y, q, 1))), end: d2s(new Date(Date.UTC(y, q + 3, 0))) }; }
    return { start: y + '-01-01', end: y + '-12-31' };
  }
  function shiftPeriod(type, start, dir) {
    const d = s2d(start);
    if (type === 'weekly') return period(type, addDays(start, 7 * dir));
    if (type === 'monthly') return period(type, d2s(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1))));
    if (type === 'quarterly') return period(type, d2s(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3 * dir, 1))));
    return period(type, (d.getUTCFullYear() + dir) + '-01-01');
  }
  const inPeriod = (trades, p) => trades.filter(t => t.date >= p.start && t.date <= p.end);
  const dayName = s => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][s2d(s).getUTCDay()];

  /* URL TradingView /x/ID/ -> image directe s3.tradingview.com/snapshots/<1re lettre en minuscule>/ID.png */
  function imageUrl(u) {
    if (!u) return null;
    let m = u.match(/^https?:\/\/(?:www\.)?tradingview\.com\/x\/([A-Za-z0-9]+)\/?/);
    if (m) return 'https://s3.tradingview.com/snapshots/' + m[1][0].toLowerCase() + '/' + m[1] + '.png';
    if (/^data:image\//.test(u) || /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(u)) return u;
    return null;
  }

  const api = { filled, result, setupScore, grade, discipline, enrich, summary, groupBy, histogram, period, shiftPeriod, inPeriod, dayName, imageUrl, wilson, addDays };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Stats = api;
})(typeof window !== 'undefined' ? window : globalThis);
