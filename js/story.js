// "How it was rebuilt": a + beacon on the objects that needed more than one attempt, and a panel that replays
// the agent's calibration loop for that object. Lives beside the hero; it only reads the hero's public API
// (anchor / progress) and never changes the scene.
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const M = 'assets/media/story/';

// s: 'bad' = something the agent saw that is wrong, 'act' = what it changed, 'ok' = verified. m: media for that step.
const STORIES = {
  cap: { objs: ['bottle_cap', 'water_bottle'], anchor: 'bottle_cap', kicker: 'Geometry calibration', title: 'Bottle cap · mating threads', label: 'How the threads were rebuilt', light: 1,
    steps: [
      { s: 'bad', t: 'The bottle and cap have no threads.', d: 'The cap slides to the roof and spins without any screw coupling.', m: 'cap1', dur: 9000 },
      { s: 'act', t: 'Add threads to both surfaces.', d: 'Neck pitch 3.78 mm, cap pitch 7.57 mm.', m: 'cap2', dur: 5200 },
      { s: 'bad', t: 'The threads catch before the cap seats.', d: 'Contact jams 9.4 mm above the seat.', m: 'cap2', dur: 5800 },
      { s: 'act', t: 'Align the mating threads.', d: 'One pitch and depth for both parts, 0.12 mm radial clearance.', m: 'cap_sections', img: 1, dur: 5200 },
      { s: 'ok', t: 'The cap screws down to its seat.', d: 'Contact alone drives the full 19.4 mm descent.', m: 'cap3', dur: 11000 },
    ] },
  vase: { objs: ['diffuser'], anchor: 'diffuser', kicker: 'Physics calibration', title: 'Reed diffuser · mass and friction', label: 'How its physics was inferred', real: 'vase_real',
    steps: [
      { s: 'bad', t: 'The bottle stops too soon.', d: 'Friction 0.30: it slides 0.16 m, the recording shows far more.', m: 'vase_c1' },
      { s: 'act', t: 'Try a different mass and friction.', d: 'Mass 0.15 kg, friction 0.80.', m: 'vase_c2' },
      { s: 'bad', t: 'The bottle tips instead of sliding.', d: 'It ends on its side, 90° from the recording.', m: 'vase_c2' },
      { s: 'act', t: 'Restore the mass prior and adjust friction.', d: 'Friction 0.145.', m: 'vase_b' },
      { s: 'ok', t: 'The upright slide matches the recording.', d: 'It travels 0.66 m and stays upright.', m: 'vase_b' },
    ] },
  wipe: { objs: ['wipes'], anchor: 'wipes', kicker: 'Material calibration', title: 'Wet wipe in the dispenser · bending stiffness', label: 'How the wipe was tuned', cover: 1,
    steps: [
      { s: 'bad', t: 'The soft wipe collapses against the bottle.', d: 'Released under gravity, the sheet has no body.', m: 'wipe1' },
      { s: 'act', t: 'Increase resistance to bending.', d: '', m: 'wipe2' },
      { s: 'bad', t: 'The wipe barely bends after release.', d: 'The stiff edge stands away from the canister.', m: 'wipe2' },
      { s: 'act', t: 'Use a more flexible fold.', d: '', m: 'wipe3' },
      { s: 'ok', t: 'The released wipe holds the observed fold.', d: 'The free edge settles where the capture shows it.', m: 'wipe3' },
    ] },
};
const STATE = { bad: 'inspecting', act: 'refining', ok: 'verified' };
const DUR = 4200;

export function initStory({ hero, pin }) {
  const hud = $('.hud', pin), root = $('#story'), card = $('.story-card', root), stage = $('#story-stage'), list = $('#story-steps'), dots = $('#story-dots');
  // the panel lives at the top level as a fixed overlay: inside the sticky, clipped hero pin Safari can cut it off
  document.body.append(root);
  const byObj = {}; const beacons = {};
  const layer = el('div', 'beacons'); hud.append(layer);
  for (const [key, st] of Object.entries(STORIES)) {
    st.objs.forEach(o => byObj[o] = key);
    const b = el('button', 'beacon', `<i aria-hidden="true"></i><span>${st.label}</span>`); b.type = 'button'; b.setAttribute('aria-label', st.label);
    b.addEventListener('click', e => { e.stopPropagation(); open(key, b); });
    b.addEventListener('pointerenter', () => { clearTimeout(cool[key]); b.classList.add('hot'); });
    b.addEventListener('pointerleave', () => { cool[key] = setTimeout(() => b.classList.remove('hot'), 500); });
    layer.append(b); beacons[key] = b;
  }
  const cool = {};
  // the expanded width of each label is measured once the fonts are in, and set explicitly:
  // Safari sizes the flex button too narrow on its own and cuts the label mid-word
  const sizeLabels = () => Object.values(beacons).forEach(b => { const sp = b.querySelector('span'); b.style.setProperty('--lw', Math.ceil(sp.scrollWidth) + 'px'); });
  sizeLabels(); (document.fonts ? document.fonts.ready : Promise.resolve()).then(sizeLabels);

  // ---- beacons follow their objects while the finished scene is on screen
  let on = false;
  function place() {
    requestAnimationFrame(place);
    const p = hero.progress, live = p > 0.8 && p < 0.985 && !root.classList.contains('on');
    if (!live && !on) return; on = live;
    for (const [key, st] of Object.entries(STORIES)) {
      const b = beacons[key], a = live ? hero.anchor(st.anchor) : null;
      b.classList.toggle('vis', !!a); if (a) b.style.transform = `translate(${a[0]}px,${a[1] - 30}px)`;
    }
  }
  requestAnimationFrame(place);

  // ---- the panel
  let cur = null, idx = -1, timer = 0, playing = true, openY = 0, vids = {}, lastM = null;
  const mm = (st, id) => `<video muted loop playsinline preload="auto" poster="${M}${id}.jpg" src="${M}${id}.mp4" data-m="${id}"></video>`;
  function open(key, from) {
    const st = STORIES[key]; cur = st; idx = -1; lastM = null; playing = true;
    $('#story-k').textContent = st.kicker; $('#story-title').textContent = st.title;
    const ids = [...new Set(st.steps.map(s => s.m))];
    stage.className = 'story-stage' + (st.light ? ' light' : '') + (st.real ? ' duo' : '') + (st.cover ? ' cover' : '');
    stage.innerHTML = (st.real ? `<figure class="sv real"><video muted loop playsinline preload="auto" poster="${M}${st.real}.jpg" src="${M}${st.real}.mp4"></video><figcaption>Real recording</figcaption></figure>` : '')
      + `<figure class="sv sim">${ids.map(id => st.steps.find(s => s.m === id).img ? `<img alt="" src="${M}${id}.jpg" data-m="${id}">` : mm(st, id)).join('')}${st.real ? '<figcaption>Simulation trial</figcaption>' : ''}</figure>`;
    vids = {}; stage.querySelectorAll('[data-m]').forEach(v => vids[v.dataset.m] = v);
    list.innerHTML = st.steps.map(s => `<li class="${s.s}"><i></i><span><b>${s.t}</b>${s.d ? `<em>${s.d}</em>` : ''}</span></li>`).join('');
    [...list.children].forEach((li, i) => li.onclick = () => go(i, true));
    dots.innerHTML = st.steps.map(() => '<i></i>').join(''); [...dots.children].forEach((d, i) => d.onclick = () => go(i, true));
    if (from) { const r = from.getBoundingClientRect(); card.style.transformOrigin = `${r.left - card.offsetLeft + r.width / 2}px ${r.top - card.offsetTop}px`; }
    root.classList.add('on'); root.setAttribute('aria-hidden', 'false'); pin.classList.add('story-open'); openY = scrollY;
    const rv = stage.querySelector('.real video'); if (rv) rv.play().catch(() => { });
    $('#story-play').textContent = '❚❚'; go(0); $('.story-x', root).focus({ preventScroll: true });
  }
  function close() {
    if (!cur) return; clearTimeout(timer); cur = null; root.classList.remove('on'); root.setAttribute('aria-hidden', 'true'); pin.classList.remove('story-open');
    stage.querySelectorAll('video').forEach(v => v.pause());
  }
  function go(i, user) {
    if (!cur) return; const n = cur.steps.length; idx = (i + n) % n; const s = cur.steps[idx];
    [...list.children].forEach((li, j) => { li.classList.toggle('on', j === idx); li.classList.toggle('seen', j <= idx); });
    const d = s.dur || DUR;
    [...dots.children].forEach((x, j) => { x.classList.remove('on'); x.classList.toggle('done', j < idx); x.style.setProperty('--dur', d + 'ms'); });
    void dots.offsetWidth; if (playing) dots.children[idx].classList.add('on');
    for (const [id, v] of Object.entries(vids)) { v.classList.toggle('on', id === s.m); if (v.tagName === 'VIDEO') { if (id === s.m) { if (lastM !== id) v.currentTime = 0; v.play().catch(() => { }); } else v.pause(); } }
    lastM = s.m;
    $('#story-st').textContent = STATE[s.s]; $('#story-st').className = 'st ' + s.s;
    $('#story-trial').textContent = `Step ${idx + 1} of ${n}`;
    clearTimeout(timer); if (playing) timer = setTimeout(() => go(idx + 1), user ? d * 1.3 : d);
  }
  $('#story-play').onclick = () => { playing = !playing; $('#story-play').textContent = playing ? '❚❚' : '▶'; go(idx); if (!playing) { clearTimeout(timer); dots.children[idx].classList.remove('on'); } };
  $('.story-x', root).onclick = close; $('.story-scrim', root).onclick = close;
  addEventListener('keydown', e => { if (!cur) return; if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(idx + 1, true); else if (e.key === 'ArrowLeft') go(idx - 1, true); });
  addEventListener('scroll', () => { if (cur && Math.abs(scrollY - openY) > 80) close(); }, { passive: true });

  return {
    // called by the page's hover handler: true when the object has a story (its beacon then carries the label)
    hover(o) {
      for (const [key, b] of Object.entries(beacons)) { const hit = o && byObj[o.name] === key; if (hit) { clearTimeout(cool[key]); b.classList.add('hot'); } else if (b.classList.contains('hot') && !b.matches(':hover')) { clearTimeout(cool[key]); cool[key] = setTimeout(() => b.classList.remove('hot'), 900); } }
      return !!(o && byObj[o.name]);
    },
    open, close, get isOpen() { return !!cur; },
  };
}
