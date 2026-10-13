/* Tick & Tie. Demos 12 to 20, then the boot. Rules and wording come from the skill's own files. */
(function () {
  'use strict';
  const TT = window.TT, D = window.TT_DATA, demos = TT.demos;
  const { $, $$, el, esc, icon, stamp, pencil, flash, setText, seg, hint, tick, py } = TT;
  const { ledger, verdict, ctl, button } = TT.kit;

  /* ---------------------------------------------------------------- 12. gross versus net */
  demos.gvn = function (box) {
    const G = D.gvn, num = (t) => parseFloat(t.replace(/,/g, ''));
    let pick = '', mode = 'ask';
    box.innerHTML = '<div class="gv-grid"><div class="sheet gv-flag"><p class="gv-deal">A <b class="num">$' + G.fee + '</b> fee, plus <b class="num">$' + G.pass + '</b> of media bought for the client.</p>' +
      '<div class="verdict" id="gv-v" aria-live="polite"></div>' +
      '<ol class="gv-ind"><li><b>Who is responsible for delivering the work?</b></li><li><b>Who carries the inventory risk, before or after it reaches the client?</b></li><li><b>Who sets the price the client pays?</b></li></ol>' +
      '<div class="gv-pick" id="gv-pick"><p class="cap">You decide</p></div></div>' +
      '<div class="sheet sheet--stack gv-pl"><p class="cap">This contract on the income statement</p><div class="gv-bars"><div class="gv-bar"><span>Revenue</span><div><i id="gv-b1"></i></div></div><div class="gv-bar gv-bar--p"><span>Profit</span><div><i id="gv-b2"></i></div></div></div><div id="gv-pl"></div><pre class="block block--one" id="gv-code" hidden></pre><p class="v-line" id="gv-say"></p></div></div>';
    const v = $('#gv-v', box), pl = $('#gv-pl', box), code = $('#gv-code', box), say = $('#gv-say', box), pickBox = $('#gv-pick', box);
    const gross = button('We are the principal. Report gross.', 'btn--ink'), net = button('We are the agent. Report net.', 'btn--ink');
    pickBox.appendChild(gross); pickBox.appendChild(net);
    function render(user) {
      const shown = mode === 'guess' ? 'gross' : pick;
      gross.disabled = net.disabled = mode === 'guess';
      gross.classList.toggle('is-on', pick === 'gross' && mode === 'ask');
      net.classList.toggle('is-on', pick === 'net' && mode === 'ask');
      if (mode === 'guess') verdict(v, true, pencil('It picked gross on its own.') + '<p class="v-line">If the data changes, the answer flips.</p>');
      else if (!pick) verdict(v, false, '<p class="v-flag">No decision is on file for gross or net. I did not guess.</p>');
      else verdict(v, false, stamp('Decided by the controller') + '<p class="v-line">Stored with a date and a reason.</p>');
      const full = num(G.gross_rev);
      $('#gv-b1', box).style.transform = 'scaleX(' + (shown ? num(shown === 'gross' ? G.gross_rev : G.net_rev) / full : 0) + ')';
      $('#gv-b2', box).style.transform = 'scaleX(' + num(G.profit) / full + ')';
      const wait = '<em>waiting for the controller</em>';
      const rows = [['Revenue', shown ? '$' + (shown === 'gross' ? G.gross_rev : G.net_rev) : wait]];
      if (shown === 'gross') rows.push(['Media bought for the client', '($' + G.pass + ')']);
      rows.push(['Delivery cost', '($' + G.labor + ')']);
      pl.innerHTML = ledger(['', 'Q3'], rows, ['Profit', '$' + G.profit]) + '<p class="gv-margin">Margin <b class="num">' + (shown ? (shown === 'gross' ? G.gross_margin : G.net_margin) + '%' : '?') + '</b></p>';
      code.textContent = mode === 'guess' ? "presentation = 'gross' if contract.has_pass_through_costs else 'net'\n# the treatment flips when the data changes" :
        shown ? "contract.revenue_presentation = '" + shown + "'\n# set by accounting, dated, with a reason" : 'contract.revenue_presentation is missing\n# flagged, never defaulted';
      say.textContent = shown ? 'Either way, profit is $' + G.profit + '. Only revenue moves, by $' + G.swing + '.' : 'Profit is $' + G.profit + ' either way. Revenue differs by $' + G.swing + '.';
      if (user) { flash(pl, 'wipe'); tick('gvn'); }
    }
    gross.addEventListener('click', () => { pick = 'gross'; render(true); });
    net.addEventListener('click', () => { pick = 'net'; render(true); });
    const modes = seg('Who decides', [{ k: 'ask', t: 'Asks the controller' }, { k: 'guess', t: 'Guesses from the data', bad: true }], (k, user) => { mode = k; render(user); });
    ctl(box, modes);
    hint(pickBox, 'Make the call');
  };

  /* ---------------------------------------------------------------- 13. never plugs to a target */
  demos.target = function (box) {
    const T = D.target, M = D.targetMeta, LO = 20, HI = 60;
    let goal = M.default, mode = 'show';
    const at = (p) => (parseFloat(p) - LO) / (HI - LO);
    const now = T[goal].now;
    box.innerHTML = '<div class="sheet sheet--stack tg-sheet"><p class="cap">A scope billed at $' + T[goal].rate + ' an hour</p>' +
      '<div class="tg-scale" id="tg-scale"><div class="tg-ticks">' + [20, 30, 40, 50, 60].map((t) => '<span>' + t + '%</span>').join('') + '</div>' +
      '<div class="tg-mark tg-mark--model" id="tg-model"><b></b><i></i></div><div class="tg-mark tg-mark--goal" id="tg-goal"><b></b><i></i></div>' +
      '<input type="range" id="tg-range" min="' + LO + '" max="' + HI + '" step="0.5" value="' + goal + '" aria-label="Target margin, percent"></div>' +
      '<div class="tg-out verdict" id="tg-out" aria-live="polite"></div></div>';
    const model = $('#tg-model', box), goalM = $('#tg-goal', box), out = $('#tg-out', box), range = $('#tg-range', box), scale = $('#tg-scale', box);
    let w = 0;
    new ResizeObserver((es) => { w = es[0].contentRect.width; render(false); }).observe(scale);
    function render(user) {
      const r = T[goal], plug = mode === 'plug';
      const shownModel = plug ? r.goal : now;
      model.style.transform = 'translate3d(' + (at(shownModel) * w).toFixed(1) + 'px,0,0)';
      goalM.style.transform = 'translate3d(' + (at(r.goal) * w).toFixed(1) + 'px,0,0)';
      $('b', model).textContent = 'The model: ' + shownModel + '%';
      $('b', goalM).textContent = 'Target: ' + r.goal + '%';
      model.classList.toggle('is-bad', plug && !r.met);
      let html;
      if (r.met) html = '<p class="v-big">The model already clears ' + r.goal + '%.</p>';
      else if (plug) html = pencil('The model now says ' + r.goal + '%.') + '<p class="v-line">It moved billable hours from ' + r.hours + ' to ' + r.need_hours + ' and did not say so.</p>';
      else html = '<p class="v-big">To reach ' + r.goal + '%, one of these would have to be true.</p>' +
        '<ul class="tg-need"><li>The bill rate is <b class="num">$' + r.need_rate + '</b> an hour. It is $' + r.rate + ' now.</li><li>Each person bills <b class="num">' + r.need_hours + '</b> hours a year. The model uses ' + r.hours + '.' +
        (r.over_paid_year ? ' That is more than every paid hour in a year.' : '') + '</li></ul>';
      out.innerHTML = html;
      out.classList.toggle('is-bad', plug && !r.met);
      if (user) tick('target');
    }
    range.addEventListener('input', () => { goal = String(Number(range.value)); render(true); });
    const modes = seg('What it does with a target', [{ k: 'show', t: 'Shows what must be true' }, { k: 'plug', t: 'Changes the model to fit', bad: true }], (k, user) => { mode = k; render(user); if (user) flash(out, 'pop'); });
    ctl(box, modes);
    hint(scale, 'Drag the target');
  };

  /* ---------------------------------------------------------------- 14. the approval */
  demos.approve = function (box) {
    const A = D.approve;
    let state = 'wait', ver = 0, mode = 'ask';
    const log = [];
    box.innerHTML = '<div class="sheet sheet--stack ap-sheet t2"><div class="ap-head"><p class="cap">Invoice run, ' + A.period + '</p><p class="ap-status" id="ap-status"></p></div><div id="ap-table"></div>' +
      '<div class="ap-act" id="ap-act"></div><ol class="audit" id="ap-log" aria-live="polite"></ol></div>';
    const status = $('#ap-status', box), table = $('#ap-table', box), act = $('#ap-act', box), logBox = $('#ap-log', box);
    const hold = el('button', 'btn btn--hold', '<i></i><span>Hold to approve</span>'), again = button('Run it again', 'btn--ghost-ink'), change = button('Change a line', 'btn--ghost-ink');
    hold.type = 'button';
    function render(user) {
      const run = A.versions[ver], posted = mode === 'post', written = state === 'done' || posted;
      status.innerHTML = posted ? pencil('It posted the invoices before anyone saw them.') : written ? '' : '<span class="chip">Nothing written yet.</span>';
      table.innerHTML = ledger(['Invoice', 'Client', 'Hours', 'Amount', 'Status'], run.invoices.map((i) => [i.no, esc(i.client), i.hours, '$' + i.total, written ? '<span class="tagd">created</span>' : '<span class="tagw">will be created</span>']),
        ['3 invoices', '', '', '$' + run.total, '']) + (written && !posted ? '<div class="ap-stamp"><span class="stamp">' + icon('tick') + '<span>Approved</span></span></div>' : '');
      act.innerHTML = '';
      if (!posted && state === 'wait') act.appendChild(hold);
      if (!posted && state === 'done') { act.appendChild(again); act.appendChild(change); change.disabled = ver >= A.versions.length - 1; }
      logBox.innerHTML = (posted ? [] : log).map((l) => '<li>' + l + '</li>').join('');
      if (user) tick('approve');
    }
    function approve() {
      state = 'done';
      const run = A.versions[ver];
      log.push('You approved version ' + (ver + 1) + '.', '3 invoices created.', 'Read back and compared. All 3 match.');
      render(true);
      flash(table, 'pop');
    }
    let timer = 0;
    const stop = () => { clearTimeout(timer); timer = 0; hold.classList.remove('is-holding'); };
    const start = (e) => {
      if (e.type === 'keydown' && (e.repeat || (e.key !== ' ' && e.key !== 'Enter'))) return;
      if (e.type === 'keydown') e.preventDefault();
      if (timer) return;
      if (TT.STATIC) { approve(); return; }
      hold.classList.add('is-holding');
      timer = setTimeout(() => { stop(); approve(); }, 1100);
    };
    hold.addEventListener('pointerdown', start);
    hold.addEventListener('keydown', start);
    ['pointerup', 'pointerleave', 'pointercancel', 'keyup', 'blur'].forEach((t) => hold.addEventListener(t, stop));
    again.addEventListener('click', () => { log.push('Run again. 0 created. All 3 already exist.'); render(true); });
    change.addEventListener('click', () => { ver++; state = 'wait'; log.push('A line changed. Version ' + (ver + 1) + ' needs a new yes.'); render(true); });
    const modes = seg('When it writes', [{ k: 'ask', t: 'Waits for your yes' }, { k: 'post', t: 'Posts straight away', bad: true }], (k, user) => { mode = k; render(user); });
    ctl(box, modes);
    hint(act, 'Press and hold');
  };

  /* ---------------------------------------------------------------- 15. masking */
  demos.mask = function (box) {
    const Mk = D.mask;
    let peek = false, where = 'screen';
    box.innerHTML = '<div class="sheet sheet--stack mk-sheet t2"><div id="mk-table"></div>' +
      '<div class="mk-try"><label class="inp"><span>Mask any value</span><input id="mk-in" type="text" autocomplete="off" spellcheck="false" data-live disabled value="' + Mk[0].raw + '"></label><span class="mk-arrow" aria-hidden="true">→</span><b class="num" id="mk-out">' + Mk[0].masked + '</b></div></div>';
    const table = $('#mk-table', box), input = $('#mk-in', box), out = $('#mk-out', box);
    function render() {
      table.innerHTML = ledger(['Who', 'Field', 'Shown as'], Mk.map((m) => [esc(where === 'screen' ? m.name : m.alias), m.field, '<span class="mk-val' + (peek ? ' is-raw' : '') + '">' + esc(peek ? m.raw : m.masked) + '</span>']));
      table.classList.toggle('is-peek', peek);
    }
    const peekB = button('Hold to peek', 'btn--ivory');
    const on = (e) => { if (e.type === 'keydown' && (e.repeat || (e.key !== ' ' && e.key !== 'Enter'))) return; peek = true; render(); tick('mask'); };
    const off = () => { if (peek) { peek = false; render(); } };
    peekB.addEventListener('pointerdown', on);
    peekB.addEventListener('keydown', on);
    ['pointerup', 'pointerleave', 'pointercancel', 'keyup', 'blur'].forEach((t) => peekB.addEventListener(t, off));
    input.addEventListener('input', () => { if (py.state !== 'ready') return; const r = py.call('mask', input.value, 4); out.textContent = r.ok ? r.out : r.err; tick('mask'); });
    const wh = seg('Where it is shown', [{ k: 'screen', t: 'In your own analysis' }, { k: 'shared', t: 'In anything that leaves the folder' }], (k, user) => { where = k; render(); if (user) tick('mask'); });
    ctl(box, peekB, wh).classList.add('ctl--wrap');
    hint(peekB, 'Hold');
  };

  /* ---------------------------------------------------------------- 16. the security check */
  demos.sec = function (box) {
    const PARTS = [['A', 'Sensitive data'], ['B', 'Secrets'], ['C', 'Injection'], ['D', 'Untrusted content'], ['E', 'Access control'], ['F', 'Configuration'], ['G', 'Software supply chain'],
      ['H', 'Cryptography'], ['I', 'Authentication and sessions'], ['J', 'Integrity of data and code'], ['K', 'Logging and alerting'], ['L', 'Errors and failure'], ['M', 'Fraud controls']];
    const JOBS = {
      quick: { t: 'A quick margin script', map: 'It reads one export and writes one spreadsheet, on one laptop.',
        na: { E: 'one person runs it on their own machine', F: 'no web endpoints, the script runs locally', G: 'no new packages', H: 'no encryption, passwords, or tokens', I: 'no logins', J: 'it writes nothing to a financial system', K: 'nothing posts, pays, or exports in bulk', M: 'no vendors, payments, or bank details' } },
      invoice: { t: 'The monthly invoice run', map: 'It reads time and rates, then creates invoices in the accounting system.',
        na: { F: 'no web endpoints, the job runs on a schedule', G: 'no new packages', I: 'no logins of its own', M: 'no vendors, payments, or bank details' } },
      tool: { t: 'A pricing tool for the deal team', map: 'It has many users and logins, with rates and cost data behind it.',
        na: { M: 'no vendors, payments, or bank details' } }
    };
    box.innerHTML = '<div class="sheet sheet--stack sc-sheet"><ol class="sc-list" id="sc-list"></ol><p class="sc-sum" id="sc-sum" aria-live="polite"></p>' +
      '<p class="sc-end"><q>This is not a substitute for a professional security review or penetration test.</q></p></div>';
    const list = $('#sc-list', box), sum = $('#sc-sum', box);
    const jobs = seg('The job', [{ k: 'quick', t: JOBS.quick.t }, { k: 'invoice', t: JOBS.invoice.t }, { k: 'tool', t: JOBS.tool.t }], (k, user) => {
      const J = JOBS[k], n = Object.keys(J.na).length;
      list.innerHTML = PARTS.map((p, i) => { const na = J.na[p[0]]; return '<li class="' + (na ? 'is-na' : 'is-on') + '" style="--i:' + i + '"><b>' + p[0] + '</b><span>' + p[1] + '</span>' + (na ? '<em>n/a: ' + na + '</em>' : '<em>' + icon('tick') + 'checked</em>') + '</li>'; }).join('');
      sum.textContent = (13 - n) + ' sections checked. ' + n + ' marked n/a, each with its reason. None skipped.';
      flash(list, 'run');
      if (user) tick('sec');
    });
    const top = ctl(box, jobs);
    top.classList.add('ctl--top');
    box.insertBefore(top, box.firstChild);
    hint(jobs, 'Pick a job');
  };

  /* ---------------------------------------------------------------- 17. the gates */
  demos.gates = function (box) {
    const GATES = [['Formatting'], ['Types'], ['Tests'], ['Leaked passwords'], ['Risky packages'], ['Security scan'], ['Tie-out']];
    let tools = 'yes', tie = 'ok';
    box.innerHTML = '<div class="gt-ask sheet"><p class="cap">It asks once, in plain words</p><q>To run the standard checks I need ruff, mypy, pytest, pip-audit, detect-secrets, and semgrep. They\'d install inside this project folder only, not system-wide. OK to install?</q><div class="ctl ctl--in" id="gt-ans"></div></div>' +
      '<ol class="gt-row" id="gt-row">' + GATES.map((g, i) => '<li class="gt-gate' + (i === 6 ? ' gt-gate--tie' : '') + '"><span class="gt-node"><b>' + (i + 1) + '</b>' + icon('tick') + icon('cross') + '</span><h3>' + g[0] + '</h3><span class="gt-state"></span></li>').join('') + '</ol>' +
      '<div class="gt-out verdict" id="gt-out" aria-live="polite"></div>';
    const row = $('#gt-row', box), out = $('#gt-out', box);
    function render(user) {
      $$('.gt-gate', row).forEach((g, i) => {
        const st = i === 6 ? (tie === 'ok' ? 'pass' : 'fail') : tools === 'yes' ? 'pass' : 'skip';
        g.dataset.s = st;
        $('.gt-state', g).textContent = st === 'pass' ? 'passed' : st === 'fail' ? 'does not tie' : 'not checked';
      });
      if (tie === 'bad') verdict(out, true, pencil('Not done.') + '<p class="v-line">' + (tools === 'yes' ? 'Six checks pass and the number still does not tie.' : 'The number does not tie.') + '</p>');
      else if (tools === 'yes') verdict(out, false, stamp('Done'));
      else verdict(out, false, '<p class="v-big">The six checks it could not run are listed under “Not checked”.</p>');
      if (user) tick('gates');
    }
    $('#gt-ans', box).appendChild(seg('Your answer', [{ k: 'yes', t: 'Yes, in this folder only' }, { k: 'no', t: 'Not allowed on this laptop' }], (k, user) => { tools = k; render(user); }));
    const ties = seg('The tie-out', [{ k: 'ok', t: 'The number ties' }, { k: 'bad', t: 'The number does not tie', bad: true }], (k, user) => { tie = k; render(user); });
    ctl(box, ties);
    hint($('#gt-ans', box), 'Answer it');
  };

  /* ---------------------------------------------------------------- 18. the tiers */
  demos.tiers = function (box) {
    const TIERS = [
      { name: 'Quick look', ex: '“What did we bill Acme last quarter?”', adds: ['Ties to a control total', 'States the period, basis, entities, currency, and every filter', 'Counts the rows in and the rows out'] },
      { name: 'Repeat run', ex: 'A monthly margin pack. A forecast refresh.', adds: ['Reruns from a saved source', 'Writes its assumptions into the output', 'Keeps the old versions', 'Is safe to run twice'] },
      { name: 'Books, bills, or pays', ex: 'Invoice generation. Journal entries.', adds: ['Passes all seven checks', 'Gets your approval before any write', 'Never edits a posted record', 'Keeps an audit trail', 'Separates who prepares from who approves'] },
      { name: 'Finance tool', ex: 'A pricing calculator your team uses.', adds: ['Controls who can see and change what', 'Is safe for many users at once', 'Versions its calculation logic'] }
    ];
    let t = 0, bumped = false;
    box.innerHTML = '<div class="tr-grid"><div class="sheet tr-card"><p class="cap">Tier</p><p class="bignum"><b id="tr-n">0</b></p><h3 id="tr-name"></h3><p class="tr-ex" id="tr-ex"></p><p class="tr-miss" id="tr-miss"></p><div class="tr-bump" id="tr-bump"></div></div>' +
      '<div class="sheet sheet--stack tr-stack"><ol id="tr-list">' + TIERS.map((T, i) => '<li class="tr-tier" data-i="' + i + '"><span class="tr-tag">Tier ' + i + '</span><ul>' + T.adds.map((a) => '<li>' + icon('tick') + a + '</li>').join('') + '</ul></li>').join('') + '</ol></div></div>' +
      '<div class="dial"><input type="range" id="tr-range" min="0" max="3" step="1" value="0" aria-label="Tier"><div class="dial-marks">' + TIERS.map((T, i) => '<span><b>' + i + '</b>' + T.name + '</span>').join('') + '</div></div>';
    const n = $('#tr-n', box), name = $('#tr-name', box), ex = $('#tr-ex', box), miss = $('#tr-miss', box), bump = $('#tr-bump', box), range = $('#tr-range', box);
    const sched = button('Schedule it to run every month', 'btn--ink');
    function render(user) {
      setText(n, String(t));
      name.textContent = TIERS[t].name;
      ex.textContent = TIERS[t].ex;
      miss.textContent = t < 2 ? 'If a fact is missing, it uses a stated default, names it, and keeps going.' : 'If a fact is missing, it stops and asks before it assumes anything.';
      $$('.tr-tier', box).forEach((li, i) => { li.classList.toggle('is-on', i <= t); li.classList.toggle('is-new', i === t); });
      bump.innerHTML = '';
      if (t === 0) bump.appendChild(sched);
      else if (bumped && t === 1) bump.innerHTML = '<p class="v-line">A quick look that gets scheduled is now Tier 1. Tiers only go up.</p>';
      range.value = t;
      if (user) tick('tiers');
    }
    range.addEventListener('input', () => { t = Number(range.value); bumped = false; render(true); });
    sched.addEventListener('click', () => { t = 1; bumped = true; render(true); });
    hint($('.dial', box), 'Move the dial');
    render(false);
  };

  /* ---------------------------------------------------------------- 19. money.py, live */
  demos.console = function (box) {
    const C = D.console;
    const hist = [];
    box.innerHTML = '<div class="cn-grid"><div class="cn-term"><div class="cn-chips" id="cn-chips"></div><div class="cn-out" id="cn-out" aria-live="polite"></div>' +
      '<form class="cn-line" id="cn-form"><span aria-hidden="true">&gt;&gt;&gt;</span><input id="cn-in" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="A line of Python, run against money.py"><button type="submit" class="btn btn--ivory">Run</button></form><p class="py-state"></p></div>' +
      '<div class="sheet cn-facts"><p class="bignum"><b>' + C.tests + '</b></p><p class="cap">of its own tests pass</p>' +
      '<dl class="facts facts--ink"><div><dt>Outside packages</dt><dd>0</dd></div><div><dt>Internet access</dt><dd>none</dd></div><div><dt>File access</dt><dd>none</dd></div><div><dt>Lines your IT team reads</dt><dd>' + C.lines + '</dd></div></dl>' + '</div></div>';
    const out = $('#cn-out', box), input = $('#cn-in', box), chips = $('#cn-chips', box);
    function show(code, r) {
      hist.push('<div class="cn-item"><p class="cn-code">&gt;&gt;&gt; ' + esc(code) + '</p><p class="cn-res' + (r.ok ? '' : ' is-err') + '">' + (r.ok ? '' : esc(r.kind) + ': ') + esc(r.out) + '</p></div>');
      out.innerHTML = hist.slice(-3).join('');
      flash(out, 'feed');
    }
    function run(code, preset) {
      if (!code) return;
      if (py.state === 'ready') show(code, py.call('repl', code));
      else if (preset) show(code, preset);
      else show(code, { ok: false, kind: 'Not yet', out: py.state === 'failed' ? 'Live Python did not load. The buttons above still show answers from money.py.' : 'Python is still starting. Try again in a moment.' });
      tick('console');
    }
    C.presets.forEach((p) => { const b = el('button', 'chipb', esc(p.label)); b.type = 'button'; b.addEventListener('click', () => { input.value = p.code; run(p.code, p); }); chips.appendChild(b); });
    $('#cn-form', box).addEventListener('submit', (e) => { e.preventDefault(); run(input.value.trim(), C.presets.find((p) => p.code === input.value.trim())); });
    input.value = C.presets[0].code;
    show(C.presets[0].code, C.presets[0]);
    hint(chips, 'Pick one');
  };

  /* ---------------------------------------------------------------- 20. the guides */
  demos.guides = function (box) {
    const SHELF = [
      ['Services finance', [['Pricing and margin', 'Rate cards, cost per billable hour, utilization, realization, fee burn, over-servicing, scope pricing, floor price.'],
        ['Billing and revenue', 'Billing schedules, WIP and unbilled, invoices, time-based billing, revenue recognition for services, cash application, aging.'],
        ['FP&A', 'Driver-based forecasts, headcount and capacity, forecast versions, variance bridges, scenarios.']]],
      ['Getting the number right', [['Money math', 'Exact decimals, rounding, splits, currencies, signs, blanks, and dates.'],
        ['Reconciliation and controls', 'Tie-outs, segregation of duties, audit trail, approvals.'],
        ['Accounting rules', 'US GAAP concepts that show up in code, where IFRS differs, and when to hand the call to a person.'],
        ['Data modeling', 'How to lay out accounts, dimensions, dated rates, and periods.'],
        ['Back office', 'Accounts payable, cash and treasury, close and controllership.']]],
      ['Building it well', [['Code standards', 'Clean code, and the common faults in AI-written code.'],
        ['Tooling', 'The checks, and how it installs tools inside one project.'],
        ['Testing', 'Test data agreed with you, and the edge cases that really happen.'],
        ['Security checklist', 'The full check, run on every job.'],
        ['Systems', 'QuickBooks, Xero, NetSuite, Sage Intacct, time and project tools, payroll, bank files.'],
        ['Finance tools', 'In-house tools other people use to do finance work.'],
        ['Workflows', 'Step-by-step runbooks for common jobs.'],
        ['Self-review', 'The checklist it runs before it reports.']]]
    ];
    const SYS = {
      qbo: ['QuickBooks Online', ['Ties to its own reports: profit and loss, balance sheet, trial balance, AR aging.', 'Treats the closing date as a period lock.', 'Tests every write in the free sandbox company first.']],
      xero: ['Xero', ['Ties to its own reports: trial balance, profit and loss, aged receivables.', 'Treats lock dates as period locks.', 'Tests every write in the Demo Company first.']],
      ns: ['NetSuite', ['Uses a saved search when one already holds the logic.', 'Checks the accounting period status before posting.', 'Labels whether figures are for one subsidiary or consolidated.']],
      si: ['Sage Intacct', ['Carries every dimension as its own column.', 'Reads how entities auto-balance before it reconciles.', 'Confirms what your subscription supports before it builds.']]
    };
    const RULES = {
      gaap: ['US GAAP', ['A loss with a range of equally likely amounts: accrue the low end.', 'An impairment loss on assets held and used is never reversed.', 'Leases are finance or operating. The class changes the expense pattern.']],
      ifrs: ['IFRS', ['A loss with a range of equally likely amounts: use the midpoint.', 'An impairment loss can be reversed, except on goodwill.', 'One lease model. Expense is front-loaded. Low-value assets can be exempt.']]
    };
    let sys = 'qbo', rules = 'gaap';
    box.innerHTML = '<div class="cab" id="gd-shelf">' + SHELF.map((g, gi) => g[1].map((b, bi) => '<button type="button" class="drawer gd-tab" data-g="' + gi + '" data-b="' + bi + '"><span class="dr-label"><b>' + esc(b[0]) + '</b></span><i class="dr-pull"></i></button>').join('')).join('') + '</div>' +
      '<div class="gd-grid"><div class="sheet sheet--stack gd-card"><p class="cap" id="gd-group"></p><h3 id="gd-name"></h3><p id="gd-covers"></p></div>' +
      '<div class="sheet gd-setup"><p class="cap">What it does for your setup</p><div class="ctl ctl--in" id="gd-c"></div><ul class="gd-facts" id="gd-sys"></ul><ul class="gd-facts gd-facts--rules" id="gd-rules"></ul></div></div>';
    const name = $('#gd-name', box), covers = $('#gd-covers', box);
    function open(gi, bi, user) {
      $$('.gd-tab', box).forEach((b) => b.classList.toggle('is-on', b.dataset.g === String(gi) && b.dataset.b === String(bi)));
      $('#gd-group', box).textContent = SHELF[gi][0];
      name.textContent = SHELF[gi][1][bi][0];
      covers.textContent = SHELF[gi][1][bi][1];
      if (user) { flash($('.gd-card', box), 'pop'); tick('guides'); }
    }
    function setup(user) {
      $('#gd-sys', box).innerHTML = SYS[sys][1].map((t) => '<li>' + icon('tick') + t + '</li>').join('');
      $('#gd-rules', box).innerHTML = RULES[rules][1].map((t) => '<li>' + icon('tick') + t + '</li>').join('');
      if (user) tick('guides');
    }
    $('#gd-shelf', box).addEventListener('click', (e) => { const b = e.target.closest('.gd-tab'); if (b) open(Number(b.dataset.g), Number(b.dataset.b), true); });
    const c = $('#gd-c', box);
    c.appendChild(seg('Accounting system', Object.keys(SYS).map((k) => ({ k, t: SYS[k][0] })), (k, user) => { sys = k; setup(user); }));
    c.appendChild(seg('Accounting rules', Object.keys(RULES).map((k) => ({ k, t: RULES[k][0] })), (k, user) => { rules = k; setup(user); }));
    open(0, 0, false);
    hint($('#gd-shelf', box), 'Open a drawer');
  };

  /* ---------------------------------------------------------------- boot */
  $$('section[data-demo]').forEach((sec) => {
    const id = sec.dataset.demo;
    if (id === 'hero' || !demos[id]) return;
    TT.onSeen(sec, () => { demos[id]($('.wrap:not(.head)', sec), sec); sec.classList.add('is-in'); TT.pyState(py.state); }, '600px');
  });
  TT.onSeen($('#tape'), py.start, '300px');
  document.documentElement.classList.add('is-booted');
})();
