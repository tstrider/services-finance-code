/* Tick & Tie. Demos 2 to 11. Every number comes from data.js, which build.py wrote with the skill's money.py. */
(function () {
  'use strict';
  const TT = window.TT, D = window.TT_DATA;
  const { $, $$, el, esc, icon, stamp, pencil, flash, setText, seg, field, hint, tick, py } = TT;
  const demos = TT.demos = {};

  function ledger(head, rows, foot) {
    const tr = (cells, tag) => '<tr>' + cells.map((c, i) => (i === 0 ? '<th scope="row">' + c + '</th>' : '<' + tag + '>' + c + '</' + tag + '>')).join('') + '</tr>';
    return '<table class="ledger"><thead><tr>' + head.map((h) => '<th scope="col">' + h + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map((r) => tr(r, 'td')).join('') + '</tbody>' + (foot ? '<tfoot>' + tr(foot, 'td') + '</tfoot>' : '') + '</table>';
  }
  function verdict(node, bad, html) { node.innerHTML = html; node.classList.toggle('is-bad', !!bad); flash(node, 'pop'); }
  function ctl(box) { const c = el('div', 'ctl'); for (let i = 1; i < arguments.length; i++) c.appendChild(arguments[i]); box.appendChild(c); return c; }
  function button(text, cls) { const b = el('button', 'btn ' + (cls || ''), esc(text)); b.type = 'button'; return b; }
  TT.kit = { ledger, verdict, ctl, button };

  /* ---------------------------------------------------------------- 2. the plain-English report */
  demos.report = function (box) {
    const R = D.report;
    const lines = [
      ['bottom', 'Bottom line', 'Q3 gross margin was ' + R.margin + '%, and the numbers tie to your P&L.'],
      ['ties', 'Ties to', 'Q3 revenue ($' + R.revenue + ') matches the income statement exactly.'],
      ['assumed', 'Assumed', "1,800 billable hours per person per year. Tell me your firm's number if it's different."],
      ['needs', 'Needs you', R.rows + ' time entries ($' + R.value + ') have a role missing from the rate card. I kept them as "Unassigned" instead of dropping them. Two clients look worse than they are until they\'re mapped.'],
      ['not', 'Not checked', "Hours logged after Oct 5 aren't included."]
    ];
    const proof = {
      bottom: () => ledger(['Client', 'Revenue', 'Cost', 'Margin'], R.table.map((t) => [esc(t.client), t.revenue, t.cost, t.margin ? t.margin + '%' : '<em>not yet mapped</em>']),
          ['Total', R.revenue, R.total_cost, R.margin + '%']),
      ties: () => '<pre class="block">' + esc(R.tie) + '</pre>',
      assumed: () => ledger(['Role', 'Loaded cost a year', 'Cost per billable hour'], R.roles.map((r) => [esc(r.role), '$' + r.loaded, '$' + r.cost])),
      needs: () => ledger(['Client', 'Entries', 'Hours', 'Value', 'Margin now', 'Once mapped'], R.needs.map((n) => [esc(n.client), n.rows, n.hours, '$' + n.value, n.margin_now + '%', n.margin_mapped + '%'])),
      not: () => '<p class="pf-say">' + R.late.rows + ' entries for Q3 work were logged after Oct 5. That is ' + R.late.hours + ' hours, worth $' + R.late.value + '.</p>'
    };
    box.innerHTML = '<div class="rp-grid"><div class="sheet sheet--stack rp-card"><div class="ask"><b>Claude</b></div><div class="rp-lines"></div></div>' +
      '<div class="sheet rp-proof"><p class="cap">Proof</p><div class="rp-body" aria-live="polite"></div></div></div>';
    const list = $('.rp-lines', box), body = $('.rp-body', box);
    function pick(k, user) {
      $$('.rp-line', list).forEach((b) => { const is = b.dataset.k === k; b.classList.toggle('is-on', is); b.setAttribute('aria-pressed', is ? 'true' : 'false'); });
      body.innerHTML = proof[k]();
      flash(body, 'wipe');
      if (user) tick('report');
    }
    lines.forEach((l, i) => {
      const b = el('button', 'rp-line', '<span class="rp-k">' + l[1] + '</span><span class="rp-t">' + esc(l[2]) + '</span>');
      b.type = 'button';
      b.dataset.k = l[0];
      b.addEventListener('click', () => pick(l[0], true));
      if (i === 0) hint(b, 'Pick a line');
      list.appendChild(b);
    });
    pick('ties', false);
  };

  /* ---------------------------------------------------------------- 3. exact money math: the adding tape */
  demos.tape = function (box) {
    const T = D.tape, LAST = T.steps.length - 1;
    let n = 0, mode = 'once';
    box.innerHTML = '<div class="tp-grid"><div class="tp-paper"><ul class="tp-lines" id="tp-lines"></ul>' +
      '<div class="tp-total"><span id="tp-count"></span><b class="num" id="tp-total"></b></div></div>' +
      '<div class="tp-side"><div class="tp-ledger"><p class="cap">The ledger says</p><b class="num" id="tp-ledger"></b></div><div class="verdict" id="tp-v" aria-live="polite"></div>' + '</div></div>';
    const lines = $('#tp-lines', box), total = $('#tp-total', box), count = $('#tp-count', box), led = $('#tp-ledger', box), v = $('#tp-v', box);
    function render(user) {
      const s = T.steps[n], N = (n + 1) * 100;
      let html = '';
      for (let i = N - 6; i < N; i++) {
        const l = T.lines[i % T.lines.length];
        html += '<li><span>' + l.h + ' h × ' + l.r + '</span><b>' + (mode === 'each' ? l.cents : l.exact) + '</b></li>';
      }
      lines.innerHTML = html;
      if (user) flash(lines, 'feed');
      count.textContent = s.n + ' lines';
      setText(total, mode === 'once' ? s.ledger : mode === 'each' ? s.rounded : s.float);
      led.textContent = '$' + s.ledger;
      if (mode === 'once') verdict(v, false, stamp('Ties to the ledger'));
      else if (mode === 'each') verdict(v, true, pencil('Off by $' + s.gap + ' after ' + s.n + ' lines.'));
      else verdict(v, true, pencil(s.float_ties ? 'It rounds to the ledger this time.' : 'It rounds to $' + s.float_cents + '. Off by $' + s.float_gap + '.') + '<p class="v-line">Ordinary computer math cannot hold cents exactly.</p>');
      add.disabled = n >= LAST;
    }
    const add = button('Add 100 lines', 'btn--ivory'), reset = button('Start over', 'btn--ghost');
    add.addEventListener('click', () => { if (n < LAST) n++; render(true); tick('tape'); });
    reset.addEventListener('click', () => { n = 0; render(true); });
    const modes = seg('How the tape adds', [{ k: 'once', t: 'Rounded once' }, { k: 'each', t: 'Every line rounded', bad: true }, { k: 'float', t: 'Ordinary computer math', bad: true }], (k, user) => { mode = k; if (user) { render(true); tick('tape'); } });
    const c = ctl(box, modes, add, reset);
    hint(add, 'Add lines');
    c.classList.add('ctl--wrap');
    render(false);
  };

  /* ---------------------------------------------------------------- 4. a split that adds back */
  demos.split = function (box) {
    const S = D.split, PRE = { USD: '100.00', JPY: '100', KWD: '100.000' };
    let cur = 'USD', n = 3, mode = 'skill', amt = PRE.USD;
    box.innerHTML = '<div class="sheet sheet--stack sp-sheet"><div class="sp-top"><label class="inp"><span>Amount</span><input id="sp-amt" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-live disabled value="100.00"></label>' +
      '<div class="step"><span>Parts</span><div class="step-in"><button type="button" class="step-b" data-d="-1" aria-label="One part fewer">&minus;</button><b id="sp-n">3</b><button type="button" class="step-b" data-d="1" aria-label="One part more">+</button></div></div></div>' +
      '<div class="sp-bar" id="sp-bar"></div><div class="sp-sum verdict" id="sp-sum" aria-live="polite"></div></div>';
    const input = $('#sp-amt', box), bar = $('#sp-bar', box), sum = $('#sp-sum', box), nOut = $('#sp-n', box);
    function result() {
      if (amt === PRE[cur]) return S[cur][n];
      if (py.state !== 'ready') { amt = PRE[cur]; input.value = amt; return S[cur][n]; }
      return py.call('split', amt, n, cur);
    }
    function render(user) {
      const r = result();
      nOut.textContent = n;
      if (!r.ok) { bar.innerHTML = ''; verdict(sum, true, pencil(esc(r.err)) + '<p class="v-line">That is the error message from money.py.</p>'); return; }
      const parts = mode === 'skill' ? r.parts : r.naive, low = parts[parts.length - 1];
      bar.innerHTML = parts.map((p) => '<span class="sp-part' + (p !== low ? ' is-extra' : '') + '"><b class="num">' + p + '</b></span>').join('');
      bar.dataset.n = parts.length;
      if (user) flash(bar, 'pop');
      if (mode === 'skill') verdict(sum, false, '<span class="num sp-eq">= ' + r.total + '</span>' + stamp('Adds back'));
      else verdict(sum, !r.naive_ties, '<span class="num sp-eq">= ' + r.naive_total + '</span>' + (r.naive_ties ? '<p class="v-line">It tied this time. It will not tie every time.</p>' : pencil('Off by ' + r.naive_gap + '. The total was ' + r.whole + '.')));
    }
    input.addEventListener('input', () => { amt = input.value.trim(); render(true); tick('split'); });
    $$('.step-b', box).forEach((b) => b.addEventListener('click', () => { n = Math.max(2, Math.min(8, n + Number(b.dataset.d))); render(true); tick('split'); }));
    const curs = seg('Currency', [{ k: 'USD', t: 'US dollar' }, { k: 'JPY', t: 'Yen, no cents' }, { k: 'KWD', t: 'Kuwaiti dinar, three decimals' }], (k, user) => { cur = k; amt = PRE[k]; input.value = amt; if (user) { render(true); tick('split'); } });
    const modes = seg('How it splits', [{ k: 'skill', t: "The skill's split" }, { k: 'naive', t: 'Divide and round', bad: true }], (k, user) => { mode = k; if (user) { render(true); tick('split'); } });
    ctl(box, curs, modes).classList.add('ctl--wrap');
    hint($('.step', box), 'Change the parts');
    render(false);
  };

  /* ---------------------------------------------------------------- 5. no dropped rows */
  demos.rows = function (box, sec) {
    const R = D.rows, DOTS = 160, UN = Math.round(R.n_un / R.n_in * DOTS);
    let mode = 'keep', raf = 0, t0 = 0, W = 0, Hh = 0, seen = false;
    box.innerHTML = '<div class="rw-stage" id="rw-stage"><canvas id="rw-cv" aria-hidden="true"></canvas>' +
      '<div class="rw-lab rw-in"><b class="num">' + R.rows_in + '</b><span>time entries in</span></div>' +
      '<div class="rw-lab rw-gate"><span>Match to the rate card</span></div>' +
      '<div class="rw-lab rw-ok"><b class="num" id="rw-ok">0</b><span>priced</span></div>' +
      '<div class="rw-lab rw-un"><b class="num" id="rw-un">0</b><span id="rw-unl"></span></div></div>' +
      '<div class="rw-out"><pre class="block" id="rw-pre"></pre><div class="verdict" id="rw-v" aria-live="polite"></div></div>';
    const stage = $('#rw-stage', box), cv = $('#rw-cv', box), g = cv.getContext('2d');
    const ok = $('#rw-ok', box), un = $('#rw-un', box), unl = $('#rw-unl', box), pre = $('#rw-pre', box), v = $('#rw-v', box);
    const dots = [];
    let ui = 0, mi = 0;
    for (let i = 0; i < DOTS; i++) {
      const isUn = i % Math.round(DOTS / UN) === 7 && ui < UN;
      const sx = 0.06 + (i % 10) * 0.0163, sy = 0.15 + Math.floor(i / 10) * 0.045;
      let ex, ey;
      if (isUn) { ex = 0.715 + ui * 0.0245; ey = 0.87; ui++; }
      else { ex = 0.715 + (mi % 15) * 0.0163; ey = 0.15 + Math.floor(mi / 15) * 0.058; mi++; }
      dots.push({ un: isUn, sx, sy, ex, ey, at: i / DOTS * 2300 });
    }
    const TRAVEL = 900, END = 2300 + TRAVEL + 200;
    function draw(t) {
      g.clearRect(0, 0, W, Hh);
      let okN = 0, unN = 0;
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(244,239,226,.16)';
      g.beginPath(); g.moveTo(W * 0.5, Hh * 0.08); g.lineTo(W * 0.5, Hh * 0.92); g.stroke();
      const rad = Math.max(2.2, Math.min(4.2, W / 260));
      g.fillStyle = 'rgba(244,239,226,.13)';
      for (const d of dots) { g.beginPath(); g.arc(W * d.sx, Hh * d.sy, rad, 0, 6.2832); g.fill(); }
      for (const d of dots) {
        const p = Math.max(0, Math.min(1, (t - d.at) / TRAVEL)), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        let x, y, a = 0.92;
        if (d.un && mode === 'drop' && p > 0.5) {
          const q = (p - 0.5) * 2;
          x = W * (0.5 + q * 0.05); y = Hh * (0.5 + q * q * 0.6); a = 0.92 * (1 - q);
        } else {
          const u = 1 - e;
          x = W * (u * u * d.sx + 2 * u * e * 0.5 + e * e * d.ex);
          y = Hh * (u * u * d.sy + 2 * u * e * 0.5 + e * e * d.ey);
        }
        if (p >= 1) { if (d.un) unN++; else okN++; }
        g.globalAlpha = a;
        g.fillStyle = d.un ? (mode === 'drop' ? '#E8695B' : '#F2C46B') : '#F4EFE2';
        g.beginPath(); g.arc(x, y, rad, 0, 6.2832); g.fill();
      }
      g.globalAlpha = 1;
      const done = t >= END - 200;
      ok.textContent = done ? R.matched : Math.round(okN / (DOTS - UN) * (R.n_in - R.n_un)).toLocaleString('en-US');
      un.textContent = done ? R.unassigned : Math.round(unN / UN * R.n_un).toLocaleString('en-US');
    }
    function frame(now) { const t = now - t0; draw(t); raf = t < END ? requestAnimationFrame(frame) : 0; }
    function play() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (TT.STATIC || !W) { draw(END); return; }
      t0 = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function render(user) {
      stage.classList.toggle('is-bad', mode === 'drop');
      unl.textContent = mode === 'keep' ? 'kept as "Unassigned"' : 'dropped, no warning';
      pre.textContent = mode === 'keep' ? R.good : R.bad;
      if (mode === 'keep') verdict(v, false, stamp('Ties exactly'));
      else verdict(v, true, pencil('Does not tie.'));
      if (seen) play();
    }
    new ResizeObserver((es) => {
      const r = es[0].contentRect, dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = r.width; Hh = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!raf) draw(seen ? END : 0);
    }).observe(stage);
    const modes = seg('How the join treats rows with no match', [{ k: 'keep', t: 'Keep and count them' }, { k: 'drop', t: 'Drop them quietly', bad: true }], (k, user) => { mode = k; render(user); if (user) tick('rows'); });
    hint(ctl(box, modes), 'Switch it');
    TT.onSeen(stage, () => { seen = true; play(); }, '-80px');
  };

  /* ---------------------------------------------------------------- 6. rates by service date */
  demos.rates = function (box) {
    const R = D.rates, MAX = R.days - 1;
    let day = 13, mode = 'service', w = 0, left = 0, queued = false;
    box.innerHTML = '<div class="sheet sheet--stack rt-sheet"><div class="rt-track" id="rt-track">' +
      '<div class="rt-bands"><div class="rt-band" style="flex:' + R.change_day + '"><b class="num">$' + R.old_rate + '</b><span>an hour, through Aug 31</span></div>' +
      '<div class="rt-band rt-band--new" style="flex:' + (R.days - R.change_day) + '"><b class="num">$' + R.new_rate + '</b><span>from Sep 1</span></div></div>' +
      '<div class="rt-axis"><span style="flex:31">July</span><span style="flex:31">August</span><span style="flex:30">September</span></div>' +
      '<div class="rt-entry" id="rt-entry" role="slider" tabindex="0" aria-label="Date of the work" aria-valuemin="0" aria-valuemax="' + MAX + '"><i class="rt-pin"></i>' +
      '<div class="rt-card"><b id="rt-date"></b><span>' + R.hours + ' hours, ' + esc(R.role) + '</span></div></div></div>' +
      '<div class="rt-read"><p class="rt-math num" id="rt-math"></p><div class="verdict" id="rt-v" aria-live="polite"></div></div></div>';
    const track = $('#rt-track', box), entry = $('#rt-entry', box), date = $('#rt-date', box), math = $('#rt-math', box), v = $('#rt-v', box);
    function place() { queued = false; entry.style.transform = 'translate3d(' + (day / MAX * w).toFixed(1) + 'px,0,0)'; }
    function render(user) {
      const old = day < R.change_day, useOld = mode === 'service' && old;
      date.textContent = new Date(Date.UTC(2026, 6, 1 + day)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
      entry.setAttribute('aria-valuenow', day);
      entry.setAttribute('aria-valuetext', date.textContent);
      const text = R.hours + ' h × $' + (useOld ? R.old_rate : R.new_rate) + ' = $' + (useOld ? R.old_value : R.new_value);
      if (math.textContent !== text) { math.textContent = text; if (user) flash(math); }
      const key = mode + (old ? 'o' : 'n');
      if (v.dataset.k !== key) {
        v.dataset.k = key;
        if (mode === 'service') verdict(v, false, stamp('The rate in effect that day'));
        else if (old) verdict(v, true, pencil('Overstated by $' + R.gap + '.'));
        else verdict(v, false, '<p class="v-line">Same answer from Sep 1.</p>');
      }
      if (!queued) { queued = true; requestAnimationFrame(place); }
    }
    function fromX(x) { const d = Math.max(0, Math.min(MAX, Math.round((x - left) / w * MAX))); if (d !== day) { day = d; render(true); tick('rates'); } }
    new ResizeObserver(() => { const r = track.getBoundingClientRect(); w = r.width; left = r.left + window.scrollX; place(); }).observe(track);
    let drag = false;
    track.addEventListener('pointerdown', (e) => { drag = true; track.setPointerCapture(e.pointerId); track.classList.add('is-drag'); fromX(e.pageX); });
    track.addEventListener('pointermove', (e) => { if (drag) fromX(e.pageX); });
    const end = () => { drag = false; track.classList.remove('is-drag'); };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    entry.addEventListener('keydown', (e) => {
      const step = { ArrowLeft: -1, ArrowRight: 1, PageDown: -7, PageUp: 7 }[e.key];
      if (!step) return;
      e.preventDefault();
      day = Math.max(0, Math.min(MAX, day + step)); render(true); tick('rates');
    });
    hint($('.rt-card', box), 'Drag');
    const modes = seg('Which rate card', [{ k: 'service', t: 'The rate on the day of the work' }, { k: 'current', t: "Today's rate card", bad: true }], (k, user) => { mode = k; render(user); if (user) tick('rates'); });
    ctl(box, modes);
  };

  /* ---------------------------------------------------------------- 7. cost per billable hour */
  demos.cph = function (box) {
    const C = D.cph, M = D.cphMeta, LO = 800, HI = 2080;
    let hours = 1800;
    const at = (v) => ((v - LO) / (HI - LO) * 100).toFixed(2) + '%';
    box.innerHTML = '<div class="sheet sheet--stack cp-sheet"><p class="cp-in"><label class="inp inp--in"><span class="sr">Salary</span><i>$</i><input id="cp-sal" type="text" inputmode="decimal" value="120000" size="7" data-live disabled autocomplete="off" spellcheck="false"></label><span>salary, plus</span>' +
      '<label class="inp inp--in"><span class="sr">Benefits and taxes, percent</span><input id="cp-pct" type="text" inputmode="decimal" value="25" size="3" data-live disabled autocomplete="off" spellcheck="false"><i>%</i></label><span>benefits and taxes, is</span><b class="num" id="cp-loaded"></b><span>a year.</span></p>' +
      '<div class="cp-main"><div class="cp-fig"><p class="bignum"><i>$</i><b id="cp-cost"></b></p><p class="cap">per billable hour, at <span id="cp-h"></span> hours</p></div>' +
      '<div class="cp-scope"><p class="cap">A scope billed at $' + M.bill + ' an hour</p><div class="verdict" id="cp-v" aria-live="polite"></div></div></div>' +
      '<p class="cp-say" id="cp-say"></p>' +
      '<div class="ruler"><div class="ruler-in"><div class="ruler-marks"><span style="left:' + at(1800) + '"><b>1,800</b>the default</span><span class="is-bad" style="left:' + at(2080) + '"><b>2,080</b>every paid hour</span></div></div>' +
      '<input type="range" id="cp-range" min="800" max="2080" step="20" value="1800" aria-label="Billable hours per person per year"></div>' +
      '</div>';
    const sal = $('#cp-sal', box), pct = $('#cp-pct', box), range = $('#cp-range', box);
    const cost = $('#cp-cost', box), loaded = $('#cp-loaded', box), hOut = $('#cp-h', box), say = $('#cp-say', box), v = $('#cp-v', box);
    function result() {
      const custom = sal.value.trim() !== '120000' || pct.value.trim() !== '25';
      if (!custom) return C[hours];
      if (py.state !== 'ready') { sal.value = '120000'; pct.value = '25'; return C[hours]; }
      return py.call('cph', sal.value.trim(), pct.value.trim(), String(hours), M.bill);
    }
    function render(user) {
      const r = result();
      hOut.textContent = hours.toLocaleString('en-US');
      if (!r.ok) { say.innerHTML = pencil(esc(r.err)); say.className = 'cp-say is-bad'; return; }
      setText(cost, r.cost);
      loaded.textContent = '$' + r.loaded;
      say.className = 'cp-say' + (hours === 2080 ? ' is-bad' : '');
      say.innerHTML = hours === 1800 ? "<q>Using 1,800 billable hours per person per year. Tell me your firm's number if it's different.</q>" :
        hours === 2080 ? pencil('2,080 is every paid hour, with nothing taken out. Each hour looks ' + M.cheaper + '% cheaper than it is.') :
          'Using ' + hours.toLocaleString('en-US') + ' billable hours per person per year.';
      const key = hours === 2080 ? 'looks' : r.earns ? 'earns' : 'loses';
      v.dataset.k = key;
      if (key === 'looks') verdict(v, true, pencil('Looks like it earns $' + r.gap + ' an hour.'));
      else if (key === 'earns') verdict(v, false, '<p class="v-big num">Earns $' + r.gap + ' an hour</p>');
      else verdict(v, false, '<p class="v-big num">Loses $' + r.gap + ' an hour</p>');
    }
    range.addEventListener('input', () => { hours = Number(range.value); render(true); tick('cph'); });
    [sal, pct].forEach((i) => i.addEventListener('input', () => { render(true); tick('cph'); }));
    hint($('.ruler', box), 'Drag the hours');
    render(false);
  };

  /* ---------------------------------------------------------------- 8. utilization and realization, defined */
  demos.util = function (box) {
    const U = D.util, bill = parseFloat(U.billing_pct) / 100, coll = bill * parseFloat(U.collection_pct) / 100;
    box.innerHTML = '<div class="ut-grid"><div class="sheet ut-card"><p class="cap">Utilization</p>' +
      '<p class="bignum"><b id="ut-pct"></b><i>%</i></p><p class="ut-def" id="ut-def"></p>' +
      '<div class="ut-bar"><span class="ut-s ut-s1" style="flex:' + U.shares[0] + '"><b class="num">' + U.billable + '</b>billable</span><span class="ut-s ut-s2" style="flex:' + U.shares[1] + '"><b class="num">' + U.other + '</b>other work</span>' +
      '<span class="ut-s ut-s3" style="flex:' + U.shares[2] + '"><b class="num">' + U.leave + '</b>leave</span></div>' +
      '<div class="ut-brk"><i id="ut-brk"></i></div><p class="ut-den num" id="ut-den"></p><div class="ctl ctl--in" id="ut-c1"></div></div>' +
      '<div class="sheet ut-card"><p class="cap">Realization</p><p class="bignum"><b id="re-pct"></b><i>%</i></p><p class="ut-def" id="re-def"></p>' +
      '<div class="re-bars" id="re-bars"><div class="re-row" data-k="standard"><span>Standard value of the hours worked</span><i style="--w:1"></i><b class="num">$' + U.standard + '</b></div>' +
      '<div class="re-row" data-k="billed"><span>Billed</span><i style="--w:' + bill + '"></i><b class="num">$' + U.billed + '</b></div>' +
      '<div class="re-row" data-k="collected"><span>Collected</span><i style="--w:' + coll + '"></i><b class="num">$' + U.collected + '</b></div></div><div class="ctl ctl--in" id="ut-c2"></div></div></div>';
    const p1 = $('#ut-pct', box), d1 = $('#ut-def', box), brk = $('#ut-brk', box), den = $('#ut-den', box), p2 = $('#re-pct', box), d2 = $('#re-def', box), bars = $('#re-bars', box);
    const avail = 1 - parseFloat(U.shares[2]);
    $('#ut-c1', box).appendChild(seg('Utilization basis', [{ k: 'cap', t: 'Capacity basis' }, { k: 'avail', t: 'Available basis' }], (k, user) => {
      setText(p1, k === 'cap' ? U.cap_pct : U.avail_pct);
      d1.textContent = k === 'cap' ? 'Billable hours, divided by standard hours.' : 'Billable hours, divided by capacity minus PTO and holidays.';
      den.textContent = U.billable + ' ÷ ' + (k === 'cap' ? U.capacity : U.available);
      brk.style.transform = 'scaleX(' + (k === 'cap' ? 1 : avail) + ')';
      if (user) tick('util');
    }));
    $('#ut-c2', box).appendChild(seg('Which realization', [{ k: 'billing', t: 'Billing realization' }, { k: 'collection', t: 'Collection realization' }], (k, user) => {
      setText(p2, k === 'billing' ? U.billing_pct : U.collection_pct);
      d2.textContent = k === 'billing' ? 'Billed value, divided by the standard value of the hours worked.' : 'Collected value, divided by billed value.';
      bars.dataset.k = k;
      if (user) tick('util');
    }));
    hint($('#ut-c1', box), 'Switch the basis');
  };

  /* ---------------------------------------------------------------- 9. fee burn */
  demos.burn = function (box) {
    const Bn = D.burn, N = Bn.days.length, SCALE = 130;
    let day = 75, basis = 'p';
    box.innerHTML = '<div class="sheet sheet--stack bn-sheet"><div class="bn-top"><p class="bn-date"><b id="bn-date"></b><span id="bn-day"></span></p><p class="bn-val"><b class="num" id="bn-val"></b><span>delivered, against a $' + Bn.fee + ' fixed fee</span></p></div>' +
      '<div class="bn-bars"><div class="bn-row"><span>Fee used</span><div class="bn-rail"><i id="bn-b1"></i><em style="left:' + (100 / SCALE * 100).toFixed(2) + '%"></em></div><b class="num" id="bn-p1"></b></div>' +
      '<div class="bn-row bn-row--time"><span>Time passed</span><div class="bn-rail"><i id="bn-b2"></i><em style="left:' + (100 / SCALE * 100).toFixed(2) + '%"></em></div><b class="num" id="bn-p2"></b></div></div>' +
      '<div class="verdict" id="bn-v" aria-live="polite"></div>' +
      '<div class="scrub"><div class="scrub-marks"><span style="left:' + ((Bn.flag - 1) / (N - 1) * 100).toFixed(2) + '%">first day ahead</span></div><input type="range" id="bn-range" min="1" max="' + N + '" step="1" value="' + day + '" aria-label="Day of the scope"></div></div>';
    const date = $('#bn-date', box), dn = $('#bn-day', box), val = $('#bn-val', box), b1 = $('#bn-b1', box), b2 = $('#bn-b2', box), p1 = $('#bn-p1', box), p2 = $('#bn-p2', box), v = $('#bn-v', box), range = $('#bn-range', box);
    function render(user) {
      const d = Bn.days[day - 1], r = d[basis];
      date.textContent = d.date;
      dn.textContent = 'Day ' + day + ' of ' + N;
      val.textContent = '$' + d.value;
      p1.textContent = r.burn + '%';
      p2.textContent = r.elapsed + '%';
      b1.style.transform = 'scaleX(' + Math.min(parseFloat(r.burn), SCALE) / SCALE + ')';
      b2.style.transform = 'scaleX(' + parseFloat(r.elapsed) / SCALE + ')';
      const key = basis + (r.ahead ? 'a' : 'b');
      const text = basis === 'c' ? pencil('Burn looks ' + r.variance + ' points ' + (r.ahead ? 'ahead of' : 'behind') + ' the calendar.') + '<p class="v-line">Hours at cost, fee at price. Burn looks lower than it is.</p>' :
        r.ahead ? pencil('Burning ' + r.variance + ' points ahead of the calendar.') :
          '<p class="v-big">' + r.variance + ' points behind the calendar</p>';
      v.innerHTML = text;
      v.classList.toggle('is-bad', basis === 'c' || r.ahead);
      if (v.dataset.k !== key) { v.dataset.k = key; if (user) flash(v, 'pop'); }
    }
    range.addEventListener('input', () => { day = Number(range.value); render(true); tick('burn'); });
    const modes = seg('How delivered hours are valued', [{ k: 'p', t: 'Hours valued at price' }, { k: 'c', t: 'Hours valued at cost', bad: true }], (k, user) => { basis = k; render(user); if (user) tick('burn'); });
    ctl(box, modes);
    hint($('.scrub', box), 'Drag the day');
  };

  /* ---------------------------------------------------------------- 10. billing and revenue are two schedules */
  demos.wip = function (box) {
    const Wd = D.wip, TOP = 64;
    const cols = [['unbilled', 'Unbilled receivable', 'We did the work and can bill it. We just have not.', 'The WIP report ties to this line.'],
      ['asset', 'Contract asset', 'We did the work but cannot bill yet.', ''], ['deferred', 'Deferred revenue', 'We were paid ahead.', '']];
    let m = 0, mode = 'apart';
    const num = (t) => parseFloat(t.replace(/,/g, ''));
    const sched = (i) => '<div class="wp-sched">' + Wd.at.map((a, k) => '<span data-m="' + k + '"><i style="--h:' + num(a.earned[i]) / 90000 + '"></i><i class="inv" style="--h:' + num(a.invoiced[i]) / 90000 + '"></i><em>' + Wd.months[k][0] + '</em></span>').join('') + '</div>';
    box.innerHTML = '<div class="sheet sheet--stack wp-sheet"><p class="cap">Each month: work earned in green, invoices sent in black</p><div class="wp-cols" id="wp-cols">' + cols.map((c, i) => '<div class="wp-col wp-col--' + c[0] + '"><p class="wp-scope">' + esc(Wd.scopes[i]) + '</p>' + sched(i) + '<div class="wp-well"><i></i></div><b class="num"></b><h3>' + c[1] + '</h3><p>' + c[2] + '</p></div>').join('') +
      '<div class="wp-net"><div class="wp-well"><i></i></div><b class="num"></b><h3>One net number</h3><div class="verdict is-bad">' + pencil('One number hides three different balances.') + '</div></div></div>' + '</div>';
    const wrap = $('#wp-cols', box);
    function render(user) {
      const a = Wd.at[m];
      wrap.dataset.mode = mode;
      cols.forEach((c, i) => {
        const col = $('.wp-col--' + c[0], wrap);
        setText($('b', col), '$' + a[c[0]]);
        $('.wp-well i', col).style.transform = 'scaleY(' + Math.max(0.012, parseFloat(a.bars[i]) / TOP) + ')';
      });
      $$('.wp-sched span', wrap).forEach((c) => { const k = Number(c.dataset.m); c.classList.toggle('is-future', k > m); c.classList.toggle('is-now', k === m); });
      const net = $('.wp-net', wrap);
      setText($('b', net), '$' + a.net);
      $('.wp-well i', net).style.transform = 'scaleY(' + Math.max(0.012, parseFloat(a.net.replace(/,/g, '')) / 1000 / 100) + ')';
      if (user) tick('wip');
    }
    const months = seg('Month-end', Wd.months.map((t, i) => ({ k: i, t })), (k, user) => { m = Number(k); render(user); });
    const modes = seg('How the balances are shown', [{ k: 'apart', t: 'Kept apart' }, { k: 'net', t: 'Netted into one', bad: true }], (k, user) => { mode = k; render(user); });
    ctl(box, months, modes).classList.add('ctl--wrap');
    hint(months, 'Step through');
  };

  /* ---------------------------------------------------------------- 11. the cut-off */
  demos.cut = function (box) {
    const C = D.cut, N = C.days.length, top = Math.max.apply(null, C.days.map((d) => d.n));
    let i = C.default;
    box.innerHTML = '<div class="sheet sheet--stack ct-sheet"><p class="cap">Q3 time entries, by the day they were logged</p><div class="ct-strip" id="ct-strip">' +
      C.days.map((d, k) => '<div class="ct-day" data-k="' + k + '"><i style="--h:' + Math.sqrt(d.n / top).toFixed(3) + '"></i><b>' + d.short + '</b></div>').join('') +
      '<div class="ct-line" id="ct-line"><span>Cut-off</span></div><input type="range" id="ct-range" min="0" max="' + (N - 1) + '" step="1" value="' + i + '" aria-label="Cut-off date"></div>' +
      '<div class="ct-months"><span>Sep</span><span>Oct</span></div>' +
      '<p class="ct-read" id="ct-read" aria-live="polite"></p><pre class="block block--one" id="ct-pre"></pre></div>';
    const strip = $('#ct-strip', box), line = $('#ct-line', box), read = $('#ct-read', box), pre = $('#ct-pre', box), range = $('#ct-range', box);
    function render(user) {
      const d = C.days[i];
      $$('.ct-day', strip).forEach((n, k) => n.classList.toggle('is-late', k > i));
      line.style.left = ((i + 1) / N * 100).toFixed(3) + '%';
      read.innerHTML = '<b class="num">' + d.rows + '</b> entries, <b class="num">' + d.hours + '</b> hours, <b class="num">$' + d.value + '</b> of work logged after ' + d.label + '.';
      pre.textContent = 'Not checked: Hours logged after ' + d.label + " aren't included.";
      if (user) { flash(pre); tick('cut'); }
    }
    range.addEventListener('input', () => { i = Number(range.value); render(true); });
    hint(line, 'Drag');
    render(false);
  };
})();
