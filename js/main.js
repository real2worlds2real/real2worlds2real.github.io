import { initHero } from './hero.js';
import { initStory } from './story.js';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp01 = x => Math.min(1, Math.max(0, x));
const Q = new URLSearchParams(location.search);

/* ================= hero ================= */
const heroEl = $('#hero'), title = $('#title'), cue = $('#cue'), tally = $('#tally'), tags = $('#tags'), hovertag = $('#hovertag'), hint = $('#hint');
const beats = $$('.beat'), rail = $$('#rail div'), nav = $('#nav');
const TALLY = ['Robot', 'Plant', 'Storage box', 'Bottle', 'Cap', 'Blue cup', 'White cup', 'Diffuser', 'Plate', 'Fruit ×5', 'Wipes'];
const TALLY_OF = { robot: 0, potted_plant: 1, storage_box: 2, water_bottle: 3, bottle_cap: 4, blue_cup: 5, white_cup: 6, diffuser: 7, fruit_plate: 8, fruit_1: 9, fruit_2: 9, fruit_3: 9, fruit_4: 9, fruit_5: 9, wipes: 10 };
const TALLY_AT = [0.31, 0.39, 0.43, 0.48, 0.52, 0.56, 0.595, 0.64, 0.685, 0.75, 0.805];
TALLY.forEach(t => { const s = document.createElement('span'); s.textContent = t; tally.append(s); });
let hero = null, story = null;
function heroProgress() { const r = heroEl.getBoundingClientRect(); return clamp01(-r.top / (r.height - innerHeight)); }
function hud(p) {
  const tf = clamp01(1 - p / 0.06);
  title.style.opacity = tf; title.style.transform = `translateY(calc(-54% - ${(1 - tf) * 40}px))`; title.style.visibility = tf <= 0 ? 'hidden' : '';
  cue.style.opacity = clamp01(1 - p / 0.03);
  beats.forEach(b => b.classList.toggle('on', p >= +b.dataset.a && p < +b.dataset.b));
  rail.forEach(d => d.classList.toggle('on', p >= +d.dataset.a && p < +d.dataset.b));
  [...tally.children].forEach((s, i) => s.classList.toggle('on', p >= TALLY_AT[i]));
  hint.classList.toggle('on', p > 0.835 && p < 0.972);
  realchip.style.opacity = clamp01(1 - p / 0.05);
}
const realchip = $('#realchip'), splitEl = $('#split');
const TOUCH = matchMedia('(hover: none), (pointer: coarse)').matches;
if (TOUCH) { hint.innerHTML = '<span><kbd>swipe ↔</kbd> turn</span><span><kbd>hold + drag</kbd> move</span><span><kbd>double-tap</kbd> reset</span>'; document.documentElement.classList.add('touch'); }
let splitX = null;
function placeSplit(x = splitX) { splitX = x; splitEl.classList.toggle('on', x != null && x > 0.02); if (x != null) splitEl.style.setProperty('--x', (x * 100) + '%'); }
{ // drag the divider between the real capture and the twin
  const knob = $('.knob', splitEl); let on = false;
  const to = e => { const r = heroEl.querySelector('.pin').getBoundingClientRect(); hero?.setSplit(Math.min(0.97, Math.max(0.03, (e.clientX - r.left) / r.width))); hero?.renderNow(); };
  knob.addEventListener('pointerdown', e => { on = true; knob.setPointerCapture(e.pointerId); e.preventDefault(); });
  knob.addEventListener('pointermove', e => { if (on) to(e); });
  const off = () => { on = false; }; knob.addEventListener('pointerup', off); knob.addEventListener('pointercancel', off);
  knob.addEventListener('keydown', e => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; hero?.setSplit((splitX ?? 0.5) + (e.key === 'ArrowLeft' ? -0.04 : 0.04)); hero?.renderNow(); });
}
function onScroll() {
  const p = heroProgress(); hero?.set(p); hud(p);
  const y = scrollY, filmTop = $('#film').offsetTop, lightTop = ($('#worlds') || { offsetTop: 1e9 }).offsetTop;
  nav.classList.toggle('hide', y < filmTop - innerHeight * 0.6 && y > innerHeight * 0.15);
  let light = false; $$('[data-nav]').forEach(s => { const r = s.getBoundingClientRect(); if (r.top < 60 && r.bottom > 60) light = s.dataset.nav === 'light'; });
  nav.classList.toggle('light', light);
}
addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);

const loader = $('#loader');
const webgl = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } })();
if (webgl) {
  initHero({
    canvas: $('#scene'),
    onProgress: f => { $('i', loader).style.width = (f * 100) + '%'; },
    onLabel: () => { },                                   // no pop-up name tags while objects appear
    onSplit: x => { if (x !== splitX) placeSplit(x); },
    onHover: (o, xy, mode) => { if (story && story.hover(mode === 'move' ? null : o) && mode !== 'move') return hovertag.classList.remove('on'); if (!o) return hovertag.classList.remove('on'); hovertag.textContent = (mode === 'move' ? 'Moving · ' : '') + o.label; hovertag.classList.toggle('mv', mode === 'move'); hovertag.style.left = xy[0] + 'px'; hovertag.style.top = (xy[1] - 16) + 'px'; hovertag.classList.add('on'); },
  }).then(h => {
    hero = h; window.__hero = h; story = initStory({ hero: h, pin: heroEl.querySelector('.pin') }); window.__story = story; document.dispatchEvent(new Event('hero-ready')); h.set(Q.has('p') ? +Q.get('p') : heroProgress(), true); loader.classList.add('done'); document.documentElement.dataset.hero = 'ready';
    if (Q.has('p')) { hud(+Q.get('p')); removeEventListener('scroll', onScroll); }
  }).catch(e => { console.error(e); loader.classList.add('done'); document.documentElement.dataset.hero = 'failed'; });
} else { loader.classList.add('done'); document.documentElement.dataset.hero = 'nowebgl'; }
onScroll();

/* ================= film ================= */
const demo = $('#demo'), chEl = $('#chapters');
$('#film-play').onclick = () => { demo.paused ? demo.play().catch(() => { }) : demo.pause(); };
const CHAPTERS = [[0, 'World building'], [46, 'Policy development'], [68, 'Simulation capability'], [94, 'Self-improvement'], [136, 'Scaling']];
const mmss = t => Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
CHAPTERS.forEach(([t, n], i) => { const b = document.createElement('button'); b.innerHTML = `<span class="t">${mmss(t)}</span><span class="n">${n}</span>`; b.onclick = () => { demo.currentTime = t + .05; demo.play(); }; if (!i) b.classList.add('on'); chEl.append(b); });
demo.addEventListener('timeupdate', () => { let k = 0; CHAPTERS.forEach(([t], i) => { if (demo.currentTime >= t) k = i; }); [...chEl.children].forEach((b, i) => b.classList.toggle('on', i === k)); });
new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) demo.pause(); }), { threshold: .1 }).observe(demo);   // plays only when the reader presses play

/* ================= sections ================= */
import('./sections.js').then(m => m.initSections()).catch(e => console.warn('sections', e));
