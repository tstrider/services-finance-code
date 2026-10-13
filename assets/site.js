/* Tick & Tie. Core helpers and the hero. Everything below the hero loads after the window does. */
(function () {
  'use strict';
  const V = 4;
  const doc = document, root = doc.documentElement;
  const STATIC = /[?&]static=1/.test(location.search) || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (STATIC) root.classList.add('static');

  const $ = (s, n) => (n || doc).querySelector(s);
  const $$ = (s, n) => Array.from((n || doc).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function el(tag, cls, html) { const n = doc.createElement(tag); if (cls) n.className = cls; if (html !== undefined) n.innerHTML = html; return n; }
  const icon = (id, cls) => '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"><use href="#' + id + '"/></svg>';
  const stamp = (text) => '<span class="stamp">' + icon('tick') + '<span>' + esc(text) + '</span></span>';
  const pencil = (text) => '<span class="pencil">' + icon('cross') + '<span>' + text + '</span></span>';

  /* restart a one-shot CSS animation without reading layout */
  function flash(node, cls) {
    cls = cls || 'flash';
    node.classList.remove(cls);
    requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add(cls)));
  }
  function setText(node, text) { if (node.textContent !== text) { node.textContent = text; flash(node); } }

  function onSeen(node, fn, margin) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: margin || '0px' });
    io.observe(node);
  }

  /* segmented control. opts: [{k, t, bad}] */
  function seg(label, opts, on, cur) {
    const box = el('div', 'seg');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', label);
    opts.forEach((o) => {
      const b = el('button', 'seg-b' + (o.bad ? ' seg-b--bad' : ''), esc(o.t));
      b.type = 'button';
      b.dataset.k = o.k;
      b.addEventListener('click', () => box.set(o.k, true));
      box.appendChild(b);
    });
    box.set = (k, user) => {
      $$('.seg-b', box).forEach((b) => { const is = b.dataset.k === String(k); b.classList.toggle('is-on', is); b.setAttribute('aria-pressed', is ? 'true' : 'false'); });
      box.dataset.v = k;
      if (on) on(String(k), !!user);
    };
    box.set(cur === undefined ? opts[0].k : cur, false);
    return box;
  }
  function field(caption, control) { const f = el('div', 'field'); f.appendChild(el('p', 'field-cap', esc(caption))); f.appendChild(control); return f; }
  function hint(node, text) { const h = el('span', 'hint', esc(text)); h.setAttribute('aria-hidden', 'true'); node.classList.add('has-hint'); node.appendChild(h); return h; }

  /* the tally in the nav: one red tick for each demo the visitor has used */
  const ORDER = ['hero', 'report', 'tape', 'split', 'rows', 'rates', 'cph', 'util', 'burn', 'wip', 'cut', 'gvn', 'target', 'approve', 'mask', 'sec', 'gates', 'tiers', 'console', 'guides'];
  const used = {};
  const marks = $('#tally-marks');
  ORDER.forEach((id) => { const m = el('i', 'tm', icon('tick')); m.dataset.id = id; marks.appendChild(m); });
  function tick(id) {
    const sec = doc.getElementById(id);
    if (sec) $$('.hint', sec).forEach((h) => h.classList.add('is-gone'));
    if (used[id]) return;
    used[id] = 1;
    const m = $('.tm[data-id="' + id + '"]', marks);
    if (m) m.classList.add('is-on');
    $('#tally-n').textContent = Object.keys(used).length;
    if (Object.keys(used).length === ORDER.length) $('#tally').classList.add('is-done');
    $('#tally').classList.add('is-live');
    const next = ORDER.find((k) => !used[k]);
    $('#tally').setAttribute('href', '#' + (next || 'install'));
  }

  /* ---------------------------------------------------------------- hero */
  const H = window.TT_HERO;
  const hs = { h: '1', j: '1', r: '1' };
  const hMargin = $('#h-margin'), hVerdict = $('#h-verdict'), hTable = $('#h-table'), hSheet = $('#hero-sheet');

  let rollId = 0;
  function roll(node, to) {
    const from = Number(node.textContent), t0 = performance.now();
    cancelAnimationFrame(rollId);
    if (STATIC || from === to) { node.textContent = to; return; }
    const step = (now) => { const p = Math.min(1, (now - t0) / 420), e = 1 - Math.pow(1 - p, 3); node.textContent = Math.round(from + (to - from) * e); if (p < 1) rollId = requestAnimationFrame(step); };
    rollId = requestAnimationFrame(step);
  }
  function heroRender(user) {
    const key = hs.h + hs.j + hs.r, run = H.runs[key], good = key === '111';
    if (user) roll(hMargin, Number(run.margin)); else hMargin.textContent = run.margin;
    hSheet.classList.toggle('is-bad', !good);
    let v;
    if (good) {
      v = stamp('Ties to the income statement');
    } else {
      const f = [];
      if (hs.h === '0') f.push('Cost per hour was divided by 2,080 paid hours. Every hour looks ' + H.cheaper + '% cheaper than it is.');
      if (hs.j === '0') f.push('The join dropped ' + H.unassigned.rows + ' time entries. $' + H.unassigned.value + ' of work is gone.');
      if (hs.r === '0') f.push("July and August were priced at September's rates. That adds $" + H.rate_gap + ' nobody billed.');
      v = pencil('It ran without an error.') + '<ul class="v-faults">' + f.map((t) => '<li>' + t + '</li>').join('') + '</ul>';
    }
    hVerdict.innerHTML = v;
    if (user) flash(hVerdict, 'pop');
    $('#tb-a').textContent = '$' + run.revenue;
    $('#tb-b').textContent = '$' + H.pnl;
    const mid = $('#tb-mid');
    mid.className = 'tb-mid' + (run.ties ? '' : ' is-bad');
    mid.innerHTML = run.ties ? icon('tick') + '<span>Ties</span>' : icon('cross') + '<span>$' + run.gap + (run.over ? ' over' : ' short') + '</span>';
    if (user) flash(mid, 'pop');
    let rows = run.table.map((t) => '<tr' + (t.client === 'Unassigned' ? ' class="is-un"' : '') + '><th scope="row">' + esc(t.client) + '</th><td>' + t.revenue + '</td><td>' +
      (t.cost || '') + '</td><td>' + (t.margin ? t.margin + '%' : '<em>kept, not yet mapped</em>') + '</td></tr>').join('');
    if (hs.j === '0') rows += '<tr class="is-drop"><th scope="row">Unassigned</th><td colspan="3"><em>' + H.unassigned.rows + ' entries dropped, no warning</em></td></tr>';
    hTable.innerHTML = '<table class="ledger"><thead><tr><th scope="col">Client</th><th scope="col">Revenue</th><th scope="col">Cost</th><th scope="col">Margin</th></tr></thead><tbody>' + rows +
      '</tbody><tfoot><tr><th scope="row">Total</th><td>' + run.revenue + '</td><td>' + run.cost + '</td><td>' + run.margin + '%</td></tr></tfoot></table>';
  }

  const hsw = $('#h-switches');
  [['h', 'Cost per hour divided by', '1,800 hours', '2,080 hours'],
   ['j', 'Time with no matching rate', 'Kept', 'Dropped'],
   ['r', 'Rates looked up by', 'Work date', "Today's date"]].forEach((s, i) => {
    const f = field(s[1], seg(s[1], [{ k: '1', t: s[2] }, { k: '0', t: s[3], bad: true }], (k, user) => { hs[s[0]] = k; if (user) { heroRender(true); tick('hero'); } }));
    if (i === 0) hint(f, 'Flip a switch');
    hsw.appendChild(f);
  });
  heroRender(false);

  /* ---------------------------------------------------------------- downloads and copy buttons */
  doc.addEventListener('click', (e) => {
    const dl = e.target.closest('a.dl');
    if (dl) setTimeout(() => { const t = $('#install'); if (t) t.scrollIntoView({ behavior: STATIC ? 'auto' : 'smooth', block: 'start' }); }, 400);
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      const text = doc.getElementById(cp.dataset.copy).textContent;
      const done = () => { cp.textContent = 'Copied'; setTimeout(() => { cp.textContent = 'Copy'; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {}); else done();
    }
  });

  /* ---------------------------------------------------------------- live Python: the real money.py, in the browser */
  const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/';
  const py = { state: 'idle', bridge: null, waiters: [] };
  function pyState(s) {
    py.state = s;
    root.dataset.py = s;
    const text = { loading: 'Python is starting', ready: 'Live. money.py is running in this tab.', failed: 'Live Python did not load. These answers came from money.py when the page was built.' }[s] || '';
    $$('.py-state').forEach((n) => { n.textContent = text; });
    $$('[data-live]').forEach((n) => { n.disabled = s !== 'ready'; });
    if (s === 'ready' || s === 'failed') py.waiters.splice(0).forEach((fn) => fn(s === 'ready'));
  }
  function loadScript(src) { return new Promise((ok, bad) => { const s = doc.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('load ' + src)); doc.head.appendChild(s); }); }
  py.start = function () {
    if (py.state !== 'idle') return;
    pyState('loading');
    loadScript(PYODIDE + 'pyodide.js')
      .then(() => window.loadPyodide({ indexURL: PYODIDE }))
      .then((rt) => Promise.all(['money.py', 'bridge.py'].map((f) => fetch('assets/' + f + '?v=' + V).then((r) => { if (!r.ok) throw new Error(f); return r.text(); }).then((t) => rt.FS.writeFile('/home/pyodide/' + f, t)))).then(() => rt))
      .then((rt) => { py.bridge = rt.pyimport('bridge'); pyState('ready'); })
      .catch(() => pyState('failed'));
  };
  py.when = (fn) => { if (py.state === 'ready') fn(true); else if (py.state === 'failed') fn(false); else py.waiters.push(fn); };
  py.call = function (name) { return JSON.parse(py.bridge[name].apply(null, Array.prototype.slice.call(arguments, 1))); };

  window.TT = { V, STATIC, $, $$, el, esc, icon, stamp, pencil, flash, setText, onSeen, seg, field, hint, tick, py, pyState };

  /* ---------------------------------------------------------------- each section rises into view once */
  $$('.sec').forEach((sec) => onSeen(sec, () => {
    sec.classList.add('is-shown');
    setTimeout(() => $$('.verdict', sec).forEach((v) => { if ($('.stamp', v)) flash(v, 'pop'); }), 380);
  }, '0px 0px -18% 0px'));

  /* ---------------------------------------------------------------- everything else, after the first paint */
  function late() {
    loadScript('assets/data.js?v=' + V).then(() => loadScript('assets/demos.js?v=' + V)).then(() => loadScript('assets/demos-b.js?v=' + V)).catch(() => {});
  }
  if (doc.readyState === 'complete') late(); else window.addEventListener('load', late);
})();
