/* Calculs du journal (réplique les formules du classeur Excel). Fonctionne dans le navigateur et sous Node. */
(function (root) {
  const YN = v => v === 'Yes' ? 1 : 0;
  const filled = v => v !== undefined && v !== null && v !== '';
  /* ---- distribution de Student (loi bêta incomplète régularisée) ---- */
  function lgamma(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -t + Math.log(2.5066282746310005 * ser / x);
  }
  function betacf(a, b, x) {
    const FPMIN = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
    for (let m = 1; m <= 300; m++) {
      const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
      const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-15) break;
    }
    return h;
  }
  function ibeta(x, a, b) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  const tPvalue = (t, df) => df < 1 || !isFinite(t) ? (isFinite(t) ? NaN : 0) : ibeta(df / (df + t * t), df / 2, 0.5);   // bilatérale
  function tcrit(df) {                       // quantile 97,5 % de Student, par dichotomie
    if (df < 1) return NaN; let lo = 0, hi = 200;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (tPvalue(mid, df) > 0.05) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  /* test des signes exact (bilatéral) : robuste aux distributions asymétriques ; les écarts nuls sont écartés */
  function signTest(d) {
    const pos = d.filter(x => x > 0).length, neg = d.filter(x => x < 0).length, m = pos + neg;
    if (!m) return { p: 1, pos, neg, m };
    const k = Math.min(pos, neg); let tail = 0;
    for (let i = 0; i <= k; i++) tail += Math.exp(lgamma(m + 1) - lgamma(i + 1) - lgamma(m - i + 1) - m * Math.LN2);
    return { p: Math.min(1, 2 * tail), pos, neg, m };
  }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  /* bootstrap percentile de la moyenne (graine fixe => résultat reproductible) */
  function bootstrapMean(d, B, seed) {
    if (d.length < 2) return { lo: null, hi: null, pPos: null };
    B = B || 10000; const rnd = mulberry32(seed || 20240601), n = d.length, ms = new Float64Array(B);
    for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < n; i++) s += d[Math.floor(rnd() * n)]; ms[b] = s / n; }
    ms.sort(); let pos = 0; for (let b = 0; b < B; b++) if (ms[b] > 0) pos++;
    return { lo: ms[Math.floor(0.025 * B)], hi: ms[Math.floor(0.975 * B) - 1], pPos: pos / B };
  }

  const result = t => !filled(t.ret) ? '' : t.ret > 0 ? 'Win' : t.ret < 0 ? 'Loss' : 'Breakeven';
  const criteria = t => [t.bias, t.poi, t.killzone, t.sweep, t.rr];
  const setupScore = t => criteria(t).every(filled) ? criteria(t).reduce((a, v) => a + YN(v), 0) : null;
  const grade = t => { const s = setupScore(t); return s === null ? '' : s === 5 ? 'A+' : s === 4 ? 'A' : s === 3 ? 'B' : 'C'; };
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

  function maxConsecLosses(rs) { let m = 0, c = 0; rs.forEach(r => { if (r < 0) { c++; m = Math.max(m, c); } else c = 0; }); return m; }
  const hasAgg = t => t.agg && filled(t.agg.ret) && filled(t.ret);
  const pairedRows = trades => trades.filter(hasAgg).sort((a, b) => a.n - b.n);
  const isNoEntry = e => !e || /^no entry$/i.test(String(e).trim());
  const taken = t => !isNoEntry(t.entry) && t.risk !== 0;

  /* comparaison appariée sur les mêmes trades : Δ = Return aggressive − Return conservative */
  function comparePaired(rows) {
    const n = rows.length, C = rows.map(t => Number(t.ret)), A = rows.map(t => Number(t.agg.ret)), D = A.map((a, i) => a - C[i]);
    const sC = summary(rows.map(t => ({ n: t.n, ret: t.ret, planFollow: t.planFollow }))), sA = summary(rows.map(t => ({ n: t.n, ret: t.agg.ret })));
    const mean = n ? D.reduce((a, b) => a + b, 0) / n : null;
    const sd = n > 1 ? Math.sqrt(D.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null;
    const se = sd !== null ? sd / Math.sqrt(n) : null, df = n - 1;
    const t = se ? mean / se : null, p = t !== null ? tPvalue(t, df) : null, tc = n > 1 ? tcrit(df) : null;
    const sign = signTest(D), boot = bootstrapMean(D);
    let cc = 0, ca = 0;
    return {
      n, rows, C, A, D, cons: sC, agg: sA, mean, sd, se, df, t, p, dz: sd ? mean / sd : null,
      ci: se !== null ? [mean - tc * se, mean + tc * se] : [null, null], pSign: sign.p, signPos: sign.pos, signNeg: sign.neg, tie: n - sign.m, boot,
      mde: se !== null ? 2.8016 * se : null,                                   // écart minimal détectable (α 5 %, puissance 80 %)
      nNeeded: sd && mean ? Math.ceil((2.8016 * sd / Math.abs(mean)) ** 2) : null,
      lossStreakC: maxConsecLosses(C), lossStreakA: maxConsecLosses(A),
      cumC: C.map(r => cc += r), cumA: A.map(r => ca += r),
    };
  }

  const api = { tPvalue, tcrit, signTest, bootstrapMean, ibeta, comparePaired, pairedRows, hasAgg, taken, isNoEntry, maxConsecLosses, filled, result, setupScore, grade, discipline, enrich, summary, groupBy, histogram, period, shiftPeriod, inPeriod, dayName, imageUrl, wilson, addDays };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Stats = api;
})(typeof window !== 'undefined' ? window : globalThis);
