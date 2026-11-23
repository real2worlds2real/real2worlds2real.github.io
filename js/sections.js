const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const M = 'assets/media/';
const inView = (node, cb, opt = { threshold: .25 }) => new IntersectionObserver(es => es.forEach(e => cb(e.isIntersecting)), opt).observe(node);

export function initSections() {
  document.documentElement.classList.add('js');
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .1 });
  $$('.rv').forEach(e => io.observe(e));
  // nav highlight
  const navA = $$('.nav-links a');
  const sio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) navA.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
  $$('section[id]').forEach(s => sio.observe(s));
  // autoplay loops only while visible
  $$('video[data-autoplay]').forEach(v => inView(v, on => on ? v.play().catch(() => { }) : v.pause(), { threshold: .35 }));
  $('#copy').onclick = e => { navigator.clipboard?.writeText($('#bib').textContent); e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy', 1400); };
  for (const f of [trace, attempts, regen, geometry, physics, showcase, tasksWall, pipeline, pair, realBars, skills, scaling]) { try { f(); } catch (e) { console.error(f.name, e); } }
}

/* ================= 01 · agent trace ================= */
function trace() {
  const TOOLS = ['SAM3', 'Camera solve', 'Inpainting', 'Layout', 'Blender', 'PhysX', 'RTX render', 'Photo compare'];
  const STEPS = [
    { t: 'Observe', d: 'One photo, one instruction: “Insert the peg into the hole.”', img: 't_photo', tools: [], cap: ['input · 1 RGB photo'] },
    { t: 'Segment the scene', d: 'Every instance is separated; the agent decides which ones the task needs.', img: 't_seg', tools: ['SAM3'], cap: ['SAM3 · instance masks'] },
    { t: 'Complete the room', d: 'Unseen surroundings are completed into a full 360° environment.', img: 't_pano', tools: ['Inpainting', 'Layout'], cap: ['360° environment'], contain: 1 },
    { t: 'Write the task object', d: 'Peg and socket are written as code: ⌀ 20 mm peg, ⌀ 22 mm hole.', img: 't_asset', tools: ['Blender'], cap: ['Blender · parametric asset'] },
    { t: 'Test it in physics', d: 'Pull the peg out, re-insert it: it seats within 0.7 mm.', img: 't_split', tools: ['PhysX'], cap: ['PhysX · insertion check', ['re-seat error 0.68 mm ✓', 'good']] },
    { t: 'Place the robot', d: 'From the nominal pose. The render disagrees with the photo.', img: 't_pose0', tools: ['RTX render', 'Photo compare'], cap: ['photo | render', ['mismatch ✗', 'bad']], fail: 1, contain: 1 },
    { t: 'Regenerate', d: 'Re-fit the base pose against the photo silhouette, then render again.', img: 't_pose1', tools: ['Camera solve', 'RTX render', 'Photo compare'], cap: ['photo | render', ['silhouette Dice 0.84 ✓', 'good']], contain: 1 },
    { t: 'Audit unseen views', d: 'Render what the photo never showed; look for holes and floaters.', img: 't_oblique', tools: ['RTX render'], cap: ['novel view'] },
    { t: 'Twin accepted', d: 'Robot, table, and task object, rendered from the capture camera.', img: 't_final', tools: ['RTX render'], cap: ['twin · capture camera', ['accepted ✓', 'good']] },
    { t: 'Hand it to policy development', d: 'The same task now runs inside the twin.', img: 't_rollout', vid: 1, dur: 15500, tools: ['PhysX'], cap: ['rollout in the twin', ['peg inserted ✓', 'good']] },
  ];
  const DUR = 4200;
  const stage = $('#tr-stage'), cap = $('#tr-cap'), list = $('#tr-steps'), dots = $('#tr-dots'), toolsEl = $('#tr-tools'), st = $('#tr-st');
  TOOLS.forEach(t => toolsEl.append(el('span', 'tool', t)));
  const imgs = STEPS.map(s => { const i = el(s.vid ? 'video' : 'img'); if (s.vid) Object.assign(i, { muted: true, loop: true, playsInline: true, preload: 'none', poster: `${M}worlds/${s.img}.jpg`, src: `${M}worlds/${s.img}.mp4` }); else { i.alt = s.t; i.loading = 'lazy'; i.src = `${M}worlds/${s.img}.jpg`; } if (s.contain) i.classList.add('contain'); stage.prepend(i); return i; });
  STEPS.forEach((s, i) => {
    const li = el('li', s.fail ? 'failstep' : '', `<span class="n">${i + 1}</span><span><b>${s.t}</b><span class="t">${s.d}</span>${s.tools.length ? `<code>${s.tools.join(' · ')}</code>` : ''}</span>`);
    li.onclick = () => go(i, true); list.append(li);
    const d = el('i'); d.onclick = () => go(i, true); dots.append(d);
  });
  let cur = -1, timer = null, playing = false, visible = false;
  function go(i, user) {
    cur = (i + STEPS.length) % STEPS.length; const s = STEPS[cur];
    imgs.forEach((im, j) => { im.classList.toggle('on', j === cur); if (im.tagName === 'VIDEO') { if (j === cur && visible) { im.currentTime = 0; im.play().catch(() => { }); } else im.pause(); } });
    [...list.children].forEach((li, j) => { li.classList.toggle('on', j === cur); li.classList.toggle('done', j < cur); li.classList.toggle('fail', j <= cur && !!STEPS[j].fail && j !== cur || (j === cur && !!s.fail)); });
    [...dots.children].forEach((d, j) => { d.classList.remove('on'); d.classList.toggle('done', j < cur); d.style.setProperty('--dur', (STEPS[j].dur || DUR) + 'ms'); });
    void dots.offsetWidth; if (playing) dots.children[cur].classList.add('on');
    const used = new Set(STEPS.slice(0, cur).flatMap(x => x.tools));
    [...toolsEl.children].forEach(t => { t.classList.toggle('on', s.tools.includes(t.textContent)); t.classList.toggle('used', used.has(t.textContent)); });
    cap.innerHTML = s.cap.map(c => Array.isArray(c) ? `<span class="${c[1]}">${c[0]}</span>` : `<span>${c}</span>`).join('');
    st.textContent = s.fail ? 'revising' : cur === STEPS.length - 1 ? 'done' : s.tools.length ? 'working' : 'observing';
    list.children[cur].scrollIntoView({ block: 'nearest', behavior: 'smooth', inline: 'nearest' });
    clearTimeout(timer); if (playing && visible) timer = setTimeout(() => go(cur + 1), s.dur || (user ? DUR * 1.6 : DUR));
  }
  const btn = $('#tr-play');
  const setPlay = p => { playing = p; btn.textContent = p ? '❚❚' : '▶'; go(Math.max(cur, 0)); };
  btn.onclick = () => setPlay(!playing);
  // do not let scrollIntoView move the page: only scroll inside the list
  list.children[0].scrollIntoView = function () { list.scrollTop = 0; };
  [...list.children].forEach(li => { li.scrollIntoView = function () { const t = li.offsetTop - list.offsetTop; if (t < list.scrollTop || t + li.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = t - 8; }; });
  inView($('#trace'), on => { visible = on; if (on && cur < 0) setPlay(true); else if (on && playing) go(cur); else clearTimeout(timer); }, { threshold: .35 });
}

/* ================= 01 · attempts ================= */
function attempts() {
  const SETS = {
    cup: { ref: 'cup_ref', items: [
      ['Attempt 1', 'cup_a1', 0, ['Lathed cup from four photos; scale inferred: 108 mm tall, 80 mm mouth.', 'Review stage overexposes it; colour reads white.']],
      ['Attempt 2', 'cup_a2', 0, ['>Height 108 → 112 mm from a four-view silhouette fit.', '>Author review lights and a desk-coloured ground; solve the four reference cameras.']],
      ['Attempt 3', 'cup_a3', 0, ['>Height 112 → 110 mm, base radius 28 → 25 mm.', '>Lighter colour, more fill light; re-solve cameras.']],
      ['Attempt 4', 'cup_a4', 0, ['Same change, re-rendered against the re-solved cameras.']],
      ['Attempt 5', 'cup_a5', 0, ['>Base radius 25 → 26 mm: a compromise between sharp close views and blurred far views.', '>Roughness 0.42 → 0.50.']],
      ['Attempt 6', 'cup_a6', 0, ['Final render washes the pale blue out.', '>Scale review light energy × 0.55; geometry unchanged.']],
      ['Attempt 7', 'cup_a7', 0, ['>Base colour (0.27, 0.43, 0.74) → (0.16, 0.33, 0.70).', 'Physics review fails once, then passes.']],
      ['Attempt 8', 'cup_a8', 1, ['>Collision proxies separated from the visual mesh.', 'Accepted: 110 mm tall, 2 mm wall, open cavity that nests.']],
    ] },
    bottle: { ref: 'bottle_final', refCap: 'Delivered asset', items: [
      ['Attempt 1', 'bottle_a1', 0, ['Hollow bottle and cap with single-start threads: 4.5 mm lead, 0.22 mm radial clearance.', 'Smoke material renders grey and noisy.']],
      ['Attempt 2', 'bottle_a2', 0, ['>Correct the female groove so the entry keeps full depth; add a 0.7 mm chamfer.', '>Darker smoke surface and volume absorption.']],
      ['Attempt 3', 'bottle_a3', 0, ['>Partition the cap surface to measure it: ⌀ 50 mm cap, 190 mm closed height.']],
      ['Contact test', 'bottle_screw', 1, ['Real concave-mesh contact: unscrew, disengage, re-engage, screw to the stop.', 'Axial travel matches the thread lead. ✓'], 'video'],
    ] },
  };
  const view = $('#att-view'), strip = $('#att-strip'), notes = $('#att-notes'), cap = $('#att-cap'), verdict = $('#att-verdict'), ref = $('#att-ref');
  let set = null, cur = 0, timer = null, visible = false, key = 'cup';
  function load(k) {
    key = k; set = SETS[k]; view.innerHTML = ''; strip.innerHTML = '';
    ref.src = `${M}worlds/${set.ref}.jpg`; ref.nextElementSibling.textContent = set.refCap || 'Reference photo';
    set.items.forEach(([name, src, ok, n, kind], i) => {
      const m = kind === 'video' ? Object.assign(el('video'), { src: `${M}worlds/${src}.mp4`, muted: true, loop: true, playsInline: true, preload: 'metadata' }) : Object.assign(el('img'), { src: `${M}worlds/${src}.jpg`, alt: name });
      view.append(m);
      const b = el('button', '', `<img src="${M}worlds/${src}.jpg" alt="">${name.replace('Attempt ', 'v')}`); b.onclick = () => go(i, true); strip.append(b);
    });
    go(0);
  }
  function go(i, user) {
    cur = i % set.items.length; const [name, , ok, n] = set.items[cur];
    [...view.children].forEach((m, j) => { m.classList.toggle('on', j === cur); if (m.tagName === 'VIDEO') j === cur ? m.play().catch(() => { }) : m.pause(); });
    [...strip.children].forEach((b, j) => b.classList.toggle('on', j === cur));
    cap.textContent = name; verdict.textContent = ok ? 'accepted ✓' : 'revise'; verdict.classList.toggle('ok', !!ok);
    notes.innerHTML = n.map((t, j) => `<li class="${t[0] === '>' ? 'act' : ''}" style="animation-delay:${j * .18}s">${t.replace(/^>/, '')}</li>`).join('');
    clearTimeout(timer); if (visible) timer = setTimeout(() => go(cur + 1), (ok ? 6500 : 3400) * (user ? 1.8 : 1));
  }
  $$('#att-tabs button').forEach(b => b.onclick = () => { $$('#att-tabs button').forEach(x => x.classList.toggle('on', x === b)); load(b.dataset.k); });
  load('cup');
  inView($('#att'), on => { visible = on; clearTimeout(timer); if (on) timer = setTimeout(() => go(cur + 1), 3000); });
}

/* ================= 01 · regeneration compare ================= */
function regen() {
  const V = [
    ['fixed', 'Ours w/o agent', 'fixed pipeline', [12.3, .54, .10, .47]],
    ['norefine', 'Ours w/o adaptive refinement', '', [15.7, .37, .24, .23]],
    ['full', 'Ours', '', [23.8, .69, .63, .58], 1],
  ];
  const MET = [['PSNR ↑', 30, 1], ['Object F1 ↑', 1, 2], ['Stability ↑', 1, 2], ['Support recall ↑', 1, 2]];
  const tabs = $('#rg-tabs'), met = $('#rg-metrics'), b = $('#cmp-b'), name = $('#cmp-name');
  met.innerHTML = MET.map(m => `<div class="mrow"><span>${m[0]}</span><span class="trk"><span class="fill" style="width:0"></span></span><span class="val"></span></div>`).join('');
  function pick(v, btn) {
    $$('button', tabs).forEach(x => x.classList.toggle('on', x === btn));
    b.style.opacity = 0; const im = new Image(); im.onload = () => { b.src = im.src; b.style.opacity = 1; }; im.src = `${M}worlds/fruits_${v[0]}.jpg`;
    name.textContent = v[1];
    $$('.mrow', met).forEach((r, i) => { $('.fill', r).style.width = (v[3][i] / MET[i][1] * 100) + '%'; $('.fill', r).style.background = v[4] ? 'var(--world-b)' : 'rgba(238,244,248,.4)'; $('.val', r).textContent = v[3][i].toFixed(MET[i][2]); });
  }
  let first = null, ours = null;
  V.forEach(v => {
    if (!v) return tabs.append(el('div', 'sep', 'Other methods, same capture'));
    const btn = el('button', v[4] ? 'ours' : '', `<span>${v[1]}</span><small>${v[2]}</small>`); btn.onclick = () => { clearInterval(auto); pick(v, btn); }; tabs.append(btn);
    if (!first) first = [v, btn]; if (v[4]) ours = [v, btn];
  });
  pick(...first);
  // auto-walk the three stages once visible
  let auto = null, k = 0; const seq = [...tabs.children].filter(x => x.tagName === 'BUTTON').slice(0, 3);
  inView($('#cmp'), on => { clearInterval(auto); if (on) auto = setInterval(() => { k = (k + 1) % 3; pick(V[k], seq[k]); }, 3200); }, { threshold: .5 });
  // divider drag
  const cmp = $('#cmp'), a = $('#cmp-a'), bar = $('#cmp-bar'), ai = $('img', a);
  const set = x => { const r = cmp.getBoundingClientRect(), f = Math.min(.98, Math.max(.02, (x - r.left) / r.width)); a.style.width = (f * 100) + '%'; bar.style.left = (f * 100) + '%'; ai.style.width = r.width + 'px'; ai.style.height = r.height + 'px'; };
  const fit = () => { const r = cmp.getBoundingClientRect(); ai.style.width = r.width + 'px'; ai.style.height = r.height + 'px'; };
  new ResizeObserver(fit).observe(cmp); fit();
  let drag = false;
  cmp.addEventListener('pointerdown', e => { drag = true; cmp.setPointerCapture(e.pointerId); set(e.clientX); });
  cmp.addEventListener('pointermove', e => { if (drag) set(e.clientX); });
  ['pointerup', 'pointercancel'].forEach(n => cmp.addEventListener(n, () => drag = false));
}

/* ================= 01 · geometry the simulator touches ================= */
function geometry() {
  const G = { gear: [['ours', 'Real2Worlds2Real', '', 93.3], ['polaris', 'PolaRiS', '', 60.0], ['simfoundry', 'SimFoundry', 'Reconstructs the gears without teeth and with inaccurate shaft spacing.', 40.0]],
    peg: [['ours', 'Real2Worlds2Real', '', 100], ['polaris', 'PolaRiS', '', 83.3], ['simfoundry', 'SimFoundry', '', 73.3]] };
  const grid = $('#geo-grid');
  let geoOn = false; const playGeo = () => $$('video', grid).forEach(v => geoOn ? v.play().catch(() => { }) : v.pause());
  const show = k => { grid.innerHTML = G[k].map(([m, n, d, v], i) => `<figure class="geo-c${i ? '' : ' ours'}"><video src="${M}worlds/geo_${k}_${m}.mp4" poster="${M}worlds/geo_${k}_${m}.jpg" muted loop playsinline preload="metadata" aria-label="${n}: ${k} geometry, turning"></video><figcaption><div><b>${n}</b>${d ? `<span>${d}</span>` : ''}</div><div class="geo-n"><b>${v % 1 ? v.toFixed(1) : v}<small>%</small></b><span>real success</span></div></figcaption></figure>`).join(''); playGeo(); };
  inView(grid, on => { geoOn = on; playGeo(); }, { threshold: .2 });
  $$('#geo-tabs button').forEach(b => b.onclick = () => { $$('#geo-tabs button').forEach(x => x.classList.toggle('on', x === b)); show(b.dataset.k); });
  show('gear');
  barTable($('#geo-table'), { tasks: ['PSNR', 'Object F1', 'Surface F-score', 'Stability', 'Penetration', 'Support recall'], short: ['PSNR', 'Obj. F1', 'F-score', 'Stable', 'Penetr.', 'Support'], sub: ['visual', 'geometry', '@ 1 cm', 'physics', 'quality', 'scene'], max: [30, 1, .15, 1, 1, 1], lw: 150,
    fmt: (v, i) => i === 0 ? v.toFixed(1) : i === 2 ? v.toFixed(3) : v.toFixed(2),
    rows: [['ACDC', [9.5, .05, 0, 0, 0, 0]], ['SimFoundry', [10.4, .26, .002, .17, 0, .01]], ['PolaRiS', [21.5, .58, .037, .28, .09, .16]], ['Real2Worlds2Real', [23.8, .69, .108, .63, .55, .58], 1]] });
}

/* ================= bar table ================= */
function barTable(root, { tasks, rows, max, sub, fmt, lw, short }) {
  let h = `<div class="bt-in" style="--n:${tasks.length};${lw ? `--lw:${lw}px` : ''}"><div class="bt-r head"><span></span>${tasks.map((t, i) => `<span><b>${short ? `<span class="lg">${t}</span><span class="sm">${short[i]}</span>` : t}</b>${sub ? `<small>${sub[i]}</small>` : ''}</span>`).join('')}</div>`;
  rows.forEach(r => {
    if (typeof r === 'string') { h += `<div class="bt-r grp"><span>${r}</span></div>`; return; }
    const [m, vals, ours] = r;
    h += `<div class="bt-r${ours ? ' ours' : ''}"><span class="m">${m}</span>` + vals.map((val, ti) => {
      if (val == null) return '<span class="cell"><span></span><span class="val">–</span></span>';
      const mx = max ? max[ti] : 100, over = val > mx;
      return `<span class="cell"><span class="trk"><span class="fill${over ? ' over' : ''}" data-w="${Math.min(100, val / mx * 100)}"></span></span><span class="val">${fmt ? fmt(val, ti) : val.toFixed(1) + '%'}</span></span>`;
    }).join('') + '</div>';
  });
  root.innerHTML = h + '</div>';
  const fill = () => requestAnimationFrame(() => requestAnimationFrame(() => $$('.fill', root).forEach(f => f.style.width = f.dataset.w + '%')));
  inView(root, on => on && fill(), { threshold: .15 });
}
function physics() {
  barTable($('#phys-table'), { tasks: ['Parameter error ↓', 'Prediction error ↓'], short: ['Param. error ↓', 'Predict. error ↓'], max: [120, 120], lw: 190, fmt: v => (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + '%', rows: [
    'Default parameters', ['PhysX default', [119.4, 83.1]], ['LLM handbook values', [25.0, 18.3]],
    'Video-based system identification', ['NIRPI', [48.4, 17.1]], ['Garcia et al.', [3702, 515]],
    'Single-pass inference', ['2D tracking + analytic', [24.4, 13.1]], ['Qwen3-VL-8B', [48.2, 23.6]], ['Claude Opus 5.5', [25.4, 15.4]],
    ['Real2Worlds2Real', [4.2, 2.6], 1]] });
}

/* ================= 02 · all eight tasks ================= */
function tasksWall() {
  const T = [['peg', 'Peg insertion', 'Insert a peg into a hole.', 100, 66.7, 1], ['cup', 'Cup stacking', 'Place a blue cup onto a white cup.', 100, 53.3, 1],
    ['gear', 'Gear insertion', 'Insert a gear onto a board.', 93.3, 43.3, 1], ['wipe', 'Tissue retrieval and wiping', 'Open a container, extract a tissue, and wipe the table.', 70.0, 46.7, 1],
    ['cap', 'Bottle-cap tightening', 'Pick up a loose cap, place it on the bottle, and screw it tight.', 93.3, 53.3, 1], ['lift', 'Cup lifting', 'Lift a light-blue cup at least 10 cm above its starting height.', 100, 56.7, 1],
    ['place', 'Cup pick-and-place', 'Pick up a blue cup and place it upright to the right of the white cup.', 90.0, 50.0, 1], ['nut', 'Nut tightening', 'Tighten a nut on a fixed bolt by turning it five full rotations.', 73.3, 40.0, 1]];
  const root = $('#tw');
  root.innerHTML = T.map(([k, n, d, ours, act, real]) => `<article class="twc" data-k="${k}" data-v="${real ? 'real' : 'sim'}">
    <div class="twv"><video muted loop playsinline preload="none" poster="${M}tasks/${k}_${real ? 'real' : 'sim'}.jpg" src="${M}tasks/${k}_${real ? 'real' : 'sim'}.mp4"></video>
      <div class="twseg">${real ? '<button data-v="real" class="on">Real</button>' : ''}<button data-v="sim"${real ? '' : ' class="on"'}>Twin</button></div></div>
    <div class="twb"><div><b>${n}</b><span>${d}</span></div><div class="twn"><b>${ours % 1 ? ours.toFixed(1) : ours}<small>%</small></b><span>ACT ${act.toFixed(1)}%</span></div></div>
    <div class="twbar"><i style="--w:${act}%"></i><i class="o" style="--w:${ours}%"></i></div></article>`).join('');
  let visible = false;
  $$('.twc', root).forEach(c => $$('.twseg button', c).forEach(b => b.onclick = () => {
    if (b.classList.contains('on')) return; $$('.twseg button', c).forEach(x => x.classList.toggle('on', x === b));
    const v = $('video', c); v.poster = `${M}tasks/${c.dataset.k}_${b.dataset.v}.jpg`; v.src = `${M}tasks/${c.dataset.k}_${b.dataset.v}.mp4`; c.dataset.v = b.dataset.v; if (visible) v.play().catch(() => { });
  }));
  inView(root, on => { visible = on; $$('video', root).forEach(v => on ? v.play().catch(() => { }) : v.pause()); root.classList.toggle('in', on); }, { threshold: .12 });
}

/* ================= 01 · other physics ================= */
function showcase() {
  const S = [['cucumber', 'Cutting', ''], ['sand', 'Scraping sand', ''], ['rope', 'Shaping a rope', ''], ['honey', 'Pouring honey', ''], ['cup', 'Breaking a cup', ''], ['turntable', 'Operating a turntable', '']];
  const root = $('#show');
  root.innerHTML = S.map(([k, n, d]) => `<article class="shc"><div class="shv"><video class="op" muted loop playsinline preload="none" poster="${M}showcase/${k}_op.jpg" src="${M}showcase/${k}_op.mp4"></video>
    <video class="sc" muted loop playsinline preload="none" src="${M}showcase/${k}_scene.mp4"></video><button aria-pressed="false">Wide shot</button></div><div class="shb"><b>${n}</b>${d ? `<span>${d}</span>` : ''}</div></article>`).join('');
  let visible = false;
  const sync = () => $$('.shc', root).forEach(c => { const wide = c.classList.contains('wide'); const on = $(wide ? '.sc' : '.op', c), offv = $(wide ? '.op' : '.sc', c); offv.pause(); visible ? on.play().catch(() => { }) : on.pause(); });
  $$('.shc', root).forEach(c => $('button', c).onclick = e => { const w = c.classList.toggle('wide'); e.currentTarget.setAttribute('aria-pressed', w); e.currentTarget.textContent = w ? 'Close-up' : 'Wide shot'; sync(); });
  inView(root, on => { visible = on; sync(); }, { threshold: .12 });
}

/* ================= 02 · pipeline ================= */
function pipeline() {
  const TOOLS = [['import', 'Real-world demonstrations'], ['demos', 'Generate demonstrations'], ['act', 'Train ACT'], ['prog', 'Code-as-policy'],
    ['rl', 'State-based RL'], ['res', 'Residual RL decorator'], ['dagger', 'DAgger'], ['mpc', 'MPC']];
  // notes: Sec. 3.3 of the paper, the sentence that describes the step each route ends with
  const TASKS = [
    { n: 'Peg insertion', order: ['import', 'act', 'dagger'], real: '100%', realSub: 'ACT 66.7%',
      note: 'When a compatible expert can provide corrective actions at states visited by the current policy, the agent can apply DAgger-style refinement, adding these corrections to the demonstration set for further training.',
      runs: [['tasks/peg_sim', 'Simulation', 1], ['tasks/peg_real', 'Real robot', 1]] },
    { n: 'Cup stacking', order: ['import', 'act', 'res'], real: '100%', realSub: 'ACT 53.3%',
      note: 'It can also train an RL decorator through simulated interactions, learning residual action corrections from task rewards while keeping the base policy frozen.',
      runs: [['cup_act', 'ACT', 0], ['cup_ck060', 'RL decorator · checkpoint 60', 0], ['cup_ck100', 'Checkpoint 100', 0], ['cup_ck500', 'Checkpoint 500', 1]] },
    { n: 'Gear insertion', order: ['rl', 'demos', 'act', 'res'], real: '93.3%', realSub: 'ACT 43.3%',
      note: 'Both control programs and state-based RL policies can serve directly as task policies or generate demonstrations for subsequent learning.',
      runs: [['tasks/gear_sim', 'Simulation', 1], ['tasks/gear_real', 'Real robot', 1]] },
    { n: 'Tissue retrieval and wiping', order: ['prog', 'mpc'], real: '70.0%', realSub: 'ACT 46.7%',
      note: 'Control programs can segment and localize task objects from visual observations, then invoke model predictive control (MPC) to update actions using state feedback.',
      runs: [['wipe', 'Program + MPC', 1]] },
    { n: 'Bottle-cap tightening', order: ['import', 'act', 'rl'], real: '93.3%', realSub: 'ACT 53.3%',
      note: 'It can also train state-based reinforcement learning (RL) policies with task-specific rewards constructed from task objectives and simulation states.',
      runs: [['wb_random', 'RL · random policy', 0], ['wb_ep100', 'Epoch 100', 0], ['wb_ep200', 'Epoch 200', 0], ['wb_ep400', 'Epoch 400', 1]] },
    { n: 'Cup lifting', order: ['act', 'prog'], real: '100%', realSub: 'ACT 56.7%',
      note: 'It selects suitable tools and learning methods to construct policies or refine existing ones.',
      runs: [['tasks/lift_sim', 'Simulation', 1], ['tasks/lift_real', 'Real robot', 1]] },
    { n: 'Cup pick-and-place', order: ['prog'], real: '90.0%', realSub: 'ACT 50.0%',
      note: 'The agent can synthesize executable control programs in a code-as-policy paradigm, combining BODex-style grasp optimization with motion planning through cuRobo.',
      runs: [['tasks/place_sim', 'Simulation', 1], ['tasks/place_real', 'Real robot', 1]] },
    { n: 'Nut tightening', order: ['prog', 'res'], real: '73.3%', realSub: 'ACT 40.0%',
      note: 'Simulation feedback helps the agent revise program logic and tool parameters.',
      runs: [['nut', 'Program + RL decorator', 1]] },
  ];
  const tasksEl = $('#pipe-tasks'), toolsEl = $('#pipe-tools'), run = $('#pipe-run'), real = $('#pipe-real'), note = $('#pipe-note');
  TOOLS.forEach(([k, n]) => { const t = el('div', 'pt', `${n}<span class="ord"></span>`); t.dataset.k = k; toolsEl.append(t); });
  let visible = false, cur = 0;
  function show(i) {
    cur = i; const t = TASKS[i];
    [...tasksEl.children].forEach((b, j) => b.classList.toggle('on', j === i));
    [...toolsEl.children].forEach(p => { const o = t.order.indexOf(p.dataset.k); p.classList.toggle('on', o >= 0); $('.ord', p).textContent = o >= 0 ? o + 1 : ''; p.style.transitionDelay = o >= 0 ? (o * .15) + 's' : '0s'; });
    real.innerHTML = `${t.real}<small>${t.realSub}</small>`; note.textContent = t.note;
    run.style.setProperty('--n', Math.max(2, t.runs.length)); run.innerHTML = '';
    t.runs.forEach(([src, a, ok]) => { const r = el('div', 'run', `<span class="mark ${ok ? 'ok' : ''}">${ok ? '✓ success' : '✗ fails'}</span><video src="${M}${src.includes('/') ? src : 'policy/' + src}.mp4" poster="${M}${src.includes('/') ? src : 'policy/' + src}.jpg" muted loop playsinline preload="metadata"></video><div class="rc"><b>${a}</b></div>`); if (t.runs.length === 1) r.style.gridColumn = '1 / -1'; run.append(r); });
    if (t.runs.length === 1) { run.style.setProperty('--n', 2); $('video', run).style.aspectRatio = '16/7'; }
    if (visible) $$('video', run).forEach(v => v.play().catch(() => { }));
  }
  TASKS.forEach((t, i) => { const b = el('button', '', t.n); b.onclick = () => show(i); tasksEl.append(b); });
  show(1);
  inView($('#pipe'), on => { visible = on; $$('video', run).forEach(v => on ? v.play().catch(() => { }) : v.pause()); }, { threshold: .2 });
}

/* ================= 02 · real | twin ================= */
function pair() {
  const a = $('#pv-real'), b = $('#pv-twin'), btn = $('#pair-play'), seek = $('#pair-seek'), t = $('#pair-t');
  $$('#pair-tabs button').forEach(x => x.onclick = () => { $$('#pair-tabs button').forEach(y => y.classList.toggle('on', y === x)); const k = x.dataset.k, was = playing; [[a, 'real'], [b, 'twin']].forEach(([v, n]) => { v.poster = `${M}pair/${k}_${n}.jpg`; v.src = `${M}pair/${k}_${n}.mp4`; }); seek.value = 0; if (was) play(true); });
  const mm = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  let playing = false, seeking = false;
  const play = p => { playing = p; btn.textContent = p ? '❚❚' : '▶'; [a, b].forEach(v => p ? v.play().catch(() => { }) : v.pause()); };
  btn.onclick = () => play(!playing);
  a.addEventListener('timeupdate', () => { if (Math.abs(b.currentTime - a.currentTime) > .2) b.currentTime = a.currentTime; if (!seeking && a.duration) seek.value = a.currentTime / a.duration * 1000; t.textContent = mm(a.currentTime); });
  a.addEventListener('ended', () => { a.currentTime = 0; b.currentTime = 0; if (playing) play(true); });
  seek.addEventListener('input', () => { seeking = true; const s = seek.value / 1000 * (a.duration || 0); a.currentTime = s; b.currentTime = s; });
  seek.addEventListener('change', () => seeking = false);
  inView($('#pair'), on => play(on), { threshold: .5 });
}

/* ================= 02 · real bars ================= */
function realBars() {
  const REAL = {
    a: { tasks: ['Peg insertion', 'Cup stacking', 'Gear insertion', 'Tissue retrieval and wiping', 'Bottle-cap tightening'], short: ['Peg', 'Cup', 'Gear', 'Wipe', 'Cap'],
      rows: [['ACT (imitation)', [66.7, 53.3, 43.3, 46.7, 53.3]], ['Real-world training', [86.7, 96.7, 86.7, 60.0, 93.3]], ['PolaRiS', [83.3, 66.7, 60.0, 50.0, 63.3]], ['SimFoundry', [73.3, 83.3, 40.0, 46.7, 56.7]], ['Real2Worlds2Real', [100, 100, 93.3, 70.0, 93.3], 1]],
      foot: 'Table 1(a). Every method refines the same ACT base policy (60 real demonstrations) with the same RL procedure and equal data; only the world differs.' },
    b: { tasks: ['Cup lifting', 'Cup pick-and-place', 'Nut tightening', 'Cup stacking'], short: ['Lift', 'PickPlace', 'Nut', 'Cup'],
      rows: [['ACT (imitation)', [56.7, 50.0, 40.0, 53.3]], ['ENPIRE', [76.7, 83.3, 53.3, 80.0]], ['ASPIRE', [90.0, 86.7, 63.3, 80.0]], ['Real2Worlds2Real', [100, 90.0, 73.3, 100], 1]],
      foot: 'Table 1(b). All agentic methods use our simulation worlds and the same 60 real demonstrations; only the way the policy is developed differs.' } };
  const show = k => { barTable($('#realbars'), REAL[k]); $('#realfoot').textContent = REAL[k].foot; };
  $$('#realseg button').forEach(b => b.onclick = () => { $$('#realseg button').forEach(x => x.classList.toggle('on', x === b)); show(b.dataset.k); });
  show('a');
}

/* ================= line chart ================= */
function lineChart(root, cfg) {
  root.classList.add('chart'); const tip = el('div', 'tip');
  const col = c => c.startsWith('--') ? css(c) : c;
  function draw() {
    const W = root.clientWidth || 480, H = cfg.h || 290, m = { l: 42, r: cfg.padR ?? 52, t: 30, b: 42 };
    const X = v => m.l + (v - cfg.x.min) / (cfg.x.max - cfg.x.min) * (W - m.l - m.r), Y = v => H - m.b - (v - cfg.y.min) / (cfg.y.max - cfg.y.min) * (H - m.t - m.b);
    const f = cfg.fmt || (v => v + '%');
    let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${cfg.title}">`;
    cfg.y.ticks.forEach(t => s += `<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="tick" x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${t}</text>`);
    cfg.x.ticks.forEach(t => s += `<text class="tick" x="${X(t)}" y="${H - m.b + 17}" text-anchor="middle">${t.toLocaleString('en-US')}</text>`);
    s += `<text class="axl" x="${(m.l + W - m.r) / 2}" y="${H - 3}" text-anchor="middle">${cfg.x.label}</text><text class="axl" x="${m.l - 34}" y="${m.t - 14}">${cfg.y.label}</text>`;
    (cfg.refs || []).forEach(r => s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(r.y)}" y2="${Y(r.y)}" stroke="${css('--ink3')}" stroke-dasharray="4 4"/><text class="ref" x="${m.l + 6}" y="${Y(r.y) + 14}">${r.label}</text>`);
    const ring = cfg.dark ? css('--night2') : '#fff';
    const mark = (x, y, c, sh, hollow) => sh === 'sq' ? `<rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" rx="1.5" fill="${hollow ? ring : c}" stroke="${hollow ? c : ring}" stroke-width="2"/>` : `<circle cx="${x}" cy="${y}" r="4.6" fill="${hollow ? ring : c}" stroke="${hollow ? c : ring}" stroke-width="2"/>`;
    const path = pts => pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]) + ' ' + Y(p[1])).join(' ');
    const ends = [], upto = cfg.upto;
    cfg.series.forEach(se => {
      const c = col(se.color), pts = upto != null && !se.ghost ? se.pts.slice(0, upto + 1) : se.pts;
      if (upto != null && !se.dash) s += `<path d="${path(se.pts)}" fill="none" stroke="${c}" stroke-width="2" opacity=".18"/>`;
      s += `<path d="${path(pts)}" fill="none" stroke="${c}" stroke-width="${se.dash ? 2 : 2.5}" stroke-linejoin="round" stroke-linecap="round" ${se.dash ? 'stroke-dasharray="5 5"' : ''}/>`;
      if (!se.nomark) pts.forEach(p => s += mark(X(p[0]), Y(p[1]), c, se.shape));
      else if (se.hollow) { const p = pts.at(-1); s += mark(X(p[0]), Y(p[1]), c, se.shape, true); }
      if (se.end !== false) { const p = pts.at(-1); ends.push({ x: X(p[0]) + 10, y: Y(p[1]) + 4, t: f(p[1]) }); }
    });
    ends.sort((a, b) => a.y - b.y); for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
    ends.forEach(e => s += `<text class="lbl" x="${e.x}" y="${e.y}">${e.t}</text>`);
    (cfg.annots || []).forEach(a => s += `<text class="lbl" x="${X(a.x) + (a.dx || 0)}" y="${Y(a.y) + (a.dy || -10)}" text-anchor="${a.anchor || 'middle'}">${a.t}</text>`);
    (cfg.xnotes || []).forEach(a => s += `<text class="tick" x="${X(a.x)}" y="${m.t - 2}" text-anchor="middle">${a.t}</text>`);
    if (cfg.sel != null) { const p = cfg.series[0].pts[cfg.sel]; s += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="11" fill="none" stroke="${col(cfg.series[0].color)}" stroke-width="2" opacity=".5"/>`; }
    s += `<line class="cross" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}" stroke="${css('--ink3')}" stroke-width="1" opacity="0"/><rect class="hit" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent"/></svg>`;
    root.innerHTML = s; root.append(tip);
    const xs = [...new Set(cfg.series.flatMap(se => se.pts.map(p => p[0])))].sort((a, b) => a - b), cross = $('.cross', root), hit = $('.hit', root);
    hit.onmousemove = e => {
      const px = e.clientX - root.getBoundingClientRect().left; let best = xs[0]; xs.forEach(x => { if (Math.abs(X(x) - px) < Math.abs(X(best) - px)) best = x; });
      const rows = cfg.series.map(se => { const p = se.pts.find(p => p[0] === best); return p ? `<div><i style="--k:${col(se.color)}"></i>${se.name} <b>${f(p[1])}</b></div>` : ''; }).join('');
      tip.innerHTML = `<div class="th">${cfg.x.tip || cfg.x.label}: ${best.toLocaleString('en-US')}</div>${rows}`;
      const ys = cfg.series.map(se => se.pts.find(p => p[0] === best)).filter(Boolean).map(p => Y(p[1]));
      tip.style.left = Math.min(Math.max(X(best), 90), W - 90) + 'px'; tip.style.top = (Math.min(...ys) - 12) + 'px'; tip.style.opacity = 1;
      cross.setAttribute('x1', X(best)); cross.setAttribute('x2', X(best)); cross.setAttribute('opacity', .6);
    };
    hit.onmouseleave = () => { tip.style.opacity = 0; cross.setAttribute('opacity', 0); };
  }
  draw(); new ResizeObserver(draw).observe(root.parentElement); return { redraw: draw, cfg };
}
const yPct = { min: 0, max: 100, ticks: [0, 20, 40, 60, 80, 100], label: 'Success rate (%)' };

/* ================= 03 · skills ================= */
async function skills() {
  const data = await (await fetch(M + 'si/si.json')).json();
  const feat = $('#si-feat'), wall = $('#si-wall'), chips = $('#si-chips'), count = $('#si-count'), big = $('#si-big'), plot = $('#si-plot');
  const KS = data.policy_chart.x, pc = data.policy_chart, wc = data.world_chart, mk = a => a.map((v, i) => [KS[i], v]);
  const MODES = {
    world: { cols: data.world.slice(0, 3), steps: 4, title: 'Tokens to rebuild a held-out scene', sub: 'Cut Lemon · same inputs and acceptance checks', legend: '',
      note: `Fidelity is unchanged: SSIM ${wc.ssim[0].toFixed(3)} with no skills, ${wc.ssim[3].toFixed(3)} with three.`,
      count: s => `${s} skill${s === 1 ? '' : 's'}`, big: s => `${wc.tokens[s].toFixed(1)}<small>M tokens</small>`, colAt: s => s,
      chart: () => ({ title: 'Tokens vs skills', h: 250, fmt: v => v.toFixed(1) + 'M', x: { min: 0, max: 3, ticks: [0, 1, 2, 3], label: 'Skills in the library', tip: 'Skills' }, y: { min: 0, max: 30, ticks: [0, 10, 20, 30], label: 'Tokens (millions)' },
        series: [{ name: 'Tokens', color: '--skill', pts: wc.tokens.map((v, i) => [i, +v.toFixed(2)]) }] }) },
    policy: { cols: data.policy, steps: 8, title: 'Long-horizon task success', sub: 'LIBERO-Pro Long · 20 tasks × 50 held-out starts',
      legend: `<span><i style="--k:var(--skill)"></i>Overall</span><span><i style="--k:var(--policy)"></i>Task perturbation</span><span><i style="--k:var(--world)"></i>Position perturbation</span><span><i class="d" style="--k:var(--ink3)"></i>Zero-shot mean</span>`,
      note: 'Prior methods without a skill library (π0.5, CaP-Agent0) stay at or below 8%. Clips show the skill families on our robot in simulation.',
      count: s => `${KS[s]} skills`, big: s => `${pc.overall[s].toFixed(1)}<small>% overall</small>`, colAt: s => Math.min(s, 8),
      chart: () => ({ title: 'LIBERO-Pro Long success vs skills', h: 270, x: { min: 0, max: 136, ticks: [0, 21, 39, 57, 88, 102, 122, 136], label: 'Skills in the library', tip: 'Skills' }, y: yPct,
        series: [{ name: 'Zero-shot mean', color: css('--ink3'), dash: 1, nomark: 1, pts: mk(pc.zeroshot) }, { name: 'Position perturbation', color: '--world', pts: mk(pc.pos) }, { name: 'Task perturbation', color: '--policy', shape: 'sq', pts: mk(pc.task) }, { name: 'Overall', color: '--skill', pts: mk(pc.overall) }],
        refs: [{ y: 8, label: 'Prior methods ≤ 8%' }] }) },
  };
  let mode = null, step = 0, chart = null, timer = null, visible = false, key = 'world';
  const vid = (src, label) => `<video src="${M}si/${src}.mp4" poster="${M}si/${src}.jpg" muted loop playsinline autoplay preload="metadata"></video>${label ? `<span class="lb">${label}</span>` : ''}`;
  function load(k) {
    key = k; mode = MODES[k]; step = 0; chips.innerHTML = '';
    mode.cols.forEach((c, i) => { const b = el('button', '', c.skill); b.onclick = () => go(Math.min(mode.steps - 1, i + 1), true); chips.append(b); });
    $('#si-ct').textContent = mode.title; $('#si-cs').textContent = mode.sub; $('#si-legend').innerHTML = mode.legend; $('#si-note').textContent = mode.note;
    $('#si-target').style.display = k === 'world' ? '' : 'none'; if (k === 'world') $('#si-target video').play().catch(() => { });
    plot.innerHTML = ''; const cfg = mode.chart(); cfg.upto = 0; chart = lineChart(plot, cfg); go(0);
  }
  function go(s, user) {
    step = s; const n = mode.colAt(s), cols = mode.cols;
    [...chips.children].forEach((b, i) => { b.classList.toggle('got', i < n); b.classList.toggle('on', i === n - 1); });
    count.textContent = mode.count(s); big.innerHTML = mode.big(s);
    chart.cfg.upto = s; chart.redraw();
    if (n === 0) { feat.innerHTML = `<div class="si-feat-h"><b>Empty library</b><span>from scratch</span></div>` + [0, 1, 2].map(() => '<div class="ft" style="background:repeating-linear-gradient(-45deg,rgba(15,26,35,.04) 0 10px,transparent 10px 20px)"></div>').join(''); wall.innerHTML = ''; }
    else {
      const c = cols[n - 1];
      feat.innerHTML = `<div class="si-feat-h"><b>${c.skill}</b><span>${c.badge || c.method || c.sub || ''}</span></div>` + c.tiles.map(t => `<div class="ft">${vid(t.src, t.label)}</div>`).join('');
      wall.innerHTML = cols.slice(0, n - 1).flatMap(x => x.tiles).map(t => `<div class="wt">${vid(t.src)}</div>`).join('');
    }
    clearTimeout(timer); if (visible) timer = setTimeout(() => go((step + 1) % mode.steps), (step === mode.steps - 1 ? 6000 : 3600) * (user ? 2 : 1));
  }
  $$('#siseg button').forEach(b => b.onclick = () => { $$('#siseg button').forEach(x => x.classList.toggle('on', x === b)); load(b.dataset.k); });
  load('world');
  inView($('#si'), on => { visible = on; clearTimeout(timer); $$('#si video').forEach(v => on ? v.play().catch(() => { }) : v.pause()); if (on) timer = setTimeout(() => go((step + 1) % mode.steps), 2200); }, { threshold: .2 });
}

/* ================= 04 · scaling ================= */
function scaling() {
  // The first 100 worlds are real rendered rollouts (10 rooms x 10 object / layout variations). The experiment
  // goes on to 1,000; tiles past the hundredth are variations of the reconstructed scene rendered live in the page.
  const STOPS = [10, 100, 200, 500, 1000], SUCC = [17, 46, 57, 64, 71], BOX = [[10, 10], [10, 10], [20, 10], [25, 20], [40, 25]], GW = 40, GH = 25, CW = 64, CH = 36;
  const ENV = [['primary_bedroom', 'Bedroom'], ['home_library', 'Library'], ['family_living_room', 'Living room'], ['professional_office', 'Office'], ['design_studio', 'Design studio'],
    ['electronics_bench', 'Electronics bench'], ['recording_room', 'Recording room'], ['garden_sunroom', 'Sunroom'], ['home_kitchen', 'Kitchen'], ['espresso_bar', 'Espresso bar']];
  const wall = $('#wall'), view = $('#wall-view'), world = $('#wall-world'), ten = $('#wall-ten'), nEl = $('#wall-n'), vEl = $('#wall-v'), stopsEl = $('#stops'), tip = $('#wall-tip');
  world.style.width = GW * CW + 'px'; world.style.height = GH * CH + 'px';
  const off = k => [Math.floor((GW - BOX[k][0]) / 2), Math.floor((GH - BOX[k][1]) / 2)];
  // ten rooms, large
  ten.innerHTML = ENV.map(([f, n]) => `<figure><video src="${M}cousin/${f}.mp4" muted loop playsinline preload="none"></video><figcaption>${n}</figcaption></figure>`).join('');
  // worlds 101..1000: every tile is rendered live from the reconstructed scene (objects, layout, materials, light
  // and camera vary per tile). Two canvases: the whole lattice, and a sharper one for the 200-world box.
  let seed = 4242; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const ringOf = (x, y) => { for (let k = 2; k < BOX.length; k++) { const [ox, oy] = off(k); if (x >= ox && x < ox + BOX[k][0] && y >= oy && y < oy + BOX[k][1]) return k; } return BOX.length - 1; };
  const cells = []; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) cells.push({ x, y, k: ringOf(x, y), r: rnd() });
  cells.sort((a, b) => a.k - b.k || a.r - b.r);
  { const perm = [...Array(100).keys()]; for (let i = 99; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
    cells.forEach((c, i) => { c.real = i % 10 === 3 ? perm[(i / 10) | 0] : -1; }); }     // 20 / 30 / 50 of them per ring
  const sprite = new Image(); sprite.src = M + 'cousin/grid100.jpg';                    // one frame of the 10 x 10 cousin grid
  const mk = (k, cw, ch) => { const [ox, oy] = k < 0 ? [0, 0] : off(k), [w, h] = k < 0 ? [GW, GH] : BOX[k], c = el('canvas'); c.width = w * cw; c.height = h * ch;
    Object.assign(c.style, { left: ox * CW + 'px', top: oy * CH + 'px', width: w * CW + 'px', height: h * CH + 'px' }); world.append(c); return { c, ctx: c.getContext('2d'), ox, oy, cw, ch }; };
  const L0 = mk(-1, 64, 36), L1 = mk(2, 128, 72);
  L0.ctx.fillStyle = 'rgba(238,244,248,.04)'; for (const c of cells) L0.ctx.fillRect(c.x * 64 + 2, c.y * 36 + 2, 60, 32);
  const atlas = (w, h, tw, th, ox, oy) => { const c = document.createElement('canvas'); c.width = w * tw; c.height = h * th; return { c, ctx: c.getContext('2d'), tw, th, ox, oy }; };
  const A0 = atlas(GW, GH, 80, 45, 0, 0), A1 = atlas(BOX[2][0], BOX[2][1], 160, 90, ...off(2));
  for (const c of cells) { c.w = .22 + rnd() * .3; c.p = rnd() * 6.283; }               // drift speed and phase per tile
  const lite = matchMedia('(max-width:720px)').matches, still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the hundred rendered cousins: one video, 10 rooms x 10 variations, on its own layer
  const hundred = el('div', 'wall-hundred', '<div class="wh-in"><span class="ax-x">10 object, placement and layout variations each</span><span class="ax-y">10 rooms</span></div>'); view.append(hundred);
  const grid = el('video', 'wall-grid'); Object.assign(grid, { muted: true, loop: true, playsInline: true, preload: 'none', poster: M + 'cousin/grid100.jpg' });
  grid.src = M + (matchMedia('(max-width:720px)').matches ? 'cousin/grid100_m.mp4' : 'cousin/grid100.mp4');
  $('.wh-in', hundred).append(grid);
  const curtain = el('div', 'wall-curtain'); world.append(curtain);
  let stop = 0, auto = true, lastStop = 0, visible = false, chart = null, done = 0;
  function fit() {                                     // centre the current box (not the whole lattice) in the view
    const k = Math.max(2, stop), [w, h] = BOX[k], [ox, oy] = off(k), sc = Math.min(view.clientWidth / (w * CW), view.clientHeight / (h * CH)) * .93;
    const dx = (GW / 2 - ox - w / 2) * CW * sc, dy = (GH / 2 - oy - h / 2) * CH * sc;
    world.style.transform = `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(${sc})`;
  }
  function setStop(k, user) {
    stop = k; lastStop = performance.now(); if (user) auto = false; fit();
    wall.dataset.stop = k;
    { const kk = Math.max(2, k), [ox, oy] = off(kk); Object.assign(curtain.style, { left: ox * CW + 'px', top: oy * CH + 'px', width: BOX[kk][0] * CW + 'px', height: BOX[kk][1] * CH + 'px' }); }
    nEl.textContent = STOPS[k].toLocaleString('en-US'); vEl.textContent = SUCC[k];
    [...stopsEl.children].forEach((b, j) => b.classList.toggle('on', j === k));
    if (chart) { chart.cfg.sel = k; chart.redraw(); }
    media(); tip.classList.remove('on'); requestAnimationFrame(tick); startAnim();
  }
  function media() {
    $$('video', ten).forEach(v => visible && stop === 0 ? v.play().catch(() => { }) : v.pause());
    visible && stop >= 1 ? grid.play().catch(() => { }) : grid.pause();
  }
  const need = k => k < 2 ? 0 : cells.filter(c => c.k <= k).length;      // tiles that must exist before stop k is complete
  let ticking = false;
  function tick() {                                    // render a few live tiles per frame into the atlases, within a small time budget
    ticking = false; if (!visible) return;
    const V = window.__hero && window.__hero.variants, want = need(Math.min(STOPS.length - 1, Math.max(2, stop + 1)));
    if (V && done < want) {
      const [mw, mh] = V.maxTile(), t0 = performance.now(); let began = false;
      while (done < want && performance.now() - t0 < 9) {
        const c = cells[done];
        if (c.real < 0) {
          if (!began) { V.begin(); began = true; }
          const A = c.k === 2 ? A1 : A0, rw = Math.min(mw, A.tw), rh = Math.min(mh, A.th);
          // a camera that ends up inside furniture gives a flat tile: draw another variation
          for (let t = 0; t < 3; t++) if (V.render(done + 100 + t * 5003, A.ctx, (c.x - A.ox) * A.tw, (c.y - A.oy) * A.th, A.tw, A.th, rw, rh) !== false) break;
        }
        done++;
      }
      if (began) V.end();
      if (!animOn) paint(performance.now() / 1000);
    }
    if (done < want && !ticking) { ticking = true; requestAnimationFrame(tick); }
  }
  function paint(t) {                                  // every finished cell: cousin cells show the video, live cells drift inside their oversize tile
    const src = grid.readyState >= 2 ? grid : (sprite.complete && sprite.naturalWidth ? sprite : null);
    const sw = src ? (src.videoWidth || src.naturalWidth) / 10 : 0, sh = src ? (src.videoHeight || src.naturalHeight) / 10 : 0;
    for (let i = 0; i < done; i++) {
      const c = cells[i], l = c.k === 2 ? L1 : L0, pad = l.cw / 32, dx = (c.x - l.ox) * l.cw + pad, dy = (c.y - l.oy) * l.ch + pad, dw = l.cw - 2 * pad, dh = l.ch - 2 * pad;
      if (c.real >= 0) { if (src) l.ctx.drawImage(src, (c.real % 10) * sw, ((c.real / 10) | 0) * sh, sw, sh, dx, dy, dw, dh); continue; }
      const A = c.k === 2 ? A1 : A0, k = still ? .5 : .5 + .5 * Math.sin(t * c.w + c.p), k2 = still ? .5 : .5 + .5 * Math.cos(t * c.w * .8 + c.p * 1.7);
      l.ctx.drawImage(A.c, (c.x - A.ox) * A.tw + A.tw * .2 * k, (c.y - A.oy) * A.th + A.th * .2 * k2, A.tw * .8, A.th * .8, dx, dy, dw, dh);
    }
  }
  let animOn = false, lastPaint = 0;
  function anim(now) {
    if (!(visible && stop >= 2) || still) { animOn = false; return; }
    requestAnimationFrame(anim); if (now - lastPaint < (lite ? 90 : 40)) return; lastPaint = now; paint(now / 1000);
  }
  const startAnim = () => { if (!animOn && visible && stop >= 2 && !still) { animOn = true; requestAnimationFrame(anim); } else if (still) paint(0); };
  STOPS.forEach((n, i) => { const b = el('button', '', n.toLocaleString('en-US')); b.onclick = () => setStop(i, true); stopsEl.append(b); });
  new ResizeObserver(fit).observe(view);
  // hover a tile of the hundred to see that rollout on its own
  const tv = $('video', tip), tl = $('span', tip); let cur = '';
  grid.addEventListener('pointermove', e => {
    if (stop !== 1) return; const r = grid.getBoundingClientRect(), cx = Math.min(9, Math.max(0, Math.floor((e.clientX - r.left) / r.width * 10))), cy = Math.min(9, Math.max(0, Math.floor((e.clientY - r.top) / r.height * 10)));
    const key = `${ENV[cy][0]}_${String(cx + 1).padStart(2, '0')}`, w = wall.getBoundingClientRect();
    if (key !== cur) { cur = key; tv.src = `${M}cousin/all/${key}.mp4`; tv.play().catch(() => { }); tl.textContent = `${ENV[cy][1]} · variation ${cx + 1}`; }
    tip.style.left = Math.min(w.width - 250, Math.max(10, e.clientX - w.left + 16)) + 'px'; tip.style.top = Math.min(w.height - 170, Math.max(10, e.clientY - w.top - 150)) + 'px'; tip.classList.add('on'); auto = false;
  });
  grid.addEventListener('pointerleave', () => tip.classList.remove('on'));
  chart = lineChart($('#ch-div'), { title: 'World-diversity scaling', dark: 1, h: 270, x: { min: 0, max: 1000, ticks: [0, 250, 500, 750, 1000], label: 'Training worlds', tip: 'Worlds' }, y: { min: 0, max: 80, ticks: [0, 20, 40, 60, 80], label: 'Success rate (%)' },
    series: [{ name: 'Unseen scenes', color: '--scale-b', pts: STOPS.map((n, i) => [n, SUCC[i]]) }], sel: 0 });
  lineChart($('#ch-data'), { title: 'Interaction-data scaling', dark: 1, h: 270, x: { min: 0, max: 3000, ticks: [0, 1000, 2000, 3000], label: 'Training demonstrations', tip: 'Demonstrations' }, y: yPct,
    series: [{ name: 'Seen scenes', color: '--world-b', pts: [[100, 4], [500, 54], [1000, 66], [2000, 76], [3000, 76]] }, { name: 'Unseen scenes', color: '--policy-b', shape: 'sq', pts: [[100, 3], [500, 43], [1000, 52], [2000, 49], [3000, 58]] },
      { name: 'Seen + DAgger', color: '--world-b', dash: 1, nomark: 1, hollow: 1, end: false, pts: [[2000, 76], [2600, 87]] }, { name: 'Unseen + DAgger', color: '--policy-b', dash: 1, nomark: 1, hollow: 1, shape: 'sq', end: false, pts: [[2000, 49], [2600, 73]] }],
    annots: [{ x: 2600, y: 87, t: '87%' }, { x: 2600, y: 73, t: '73%', dy: 20, dx: 6, anchor: 'start' }] });
  setStop(0);
  const A = ['tasks/cup_sim', 'si/p_pick_1', 'wall/r_05', 'tasks/peg_sim', 'si/p_open_lid_0', 'wall/r_02', 'si/p_tighten_2', 'tasks/wipe_sim', 'wall/r_07', 'tasks/lift_sim', 'si/p_chain_0'];
  const B = ['si/p_stack_0', 'wall/r_06', 'tasks/gear_sim', 'wall/r_01', 'si/p_open_lid_2', 'tasks/cap_sim', 'wall/r_08', 'tasks/nut_sim', 'si/p_wipe_2', 'wall/r_03', 'tasks/place_sim'];
  [['#reel-a', A], ['#reel-b', B]].forEach(([id, list]) => { $(id).innerHTML = [...list, ...list].map(f => `<video src="${M}${f}.mp4" poster="${M}${f}.jpg" muted loop playsinline preload="none"></video>`).join(''); });
  inView($('#reel'), on => $$('#reel video').forEach(v => on ? v.play().catch(() => { }) : v.pause()), { threshold: .05 });
  // walk 10 -> 1,000 once while the wall is on screen
  setInterval(() => { if (visible && auto && stop < STOPS.length - 1 && done >= need(stop + 1) && performance.now() - lastStop > (stop === 0 ? 4200 : 3000)) setStop(stop + 1); }, 400);
  inView(wall, on => { visible = on; if (on) { lastStop = performance.now(); requestAnimationFrame(tick); startAnim(); } media(); }, { threshold: .3 });
  document.addEventListener('hero-ready', () => { if (visible) requestAnimationFrame(tick); });
}
