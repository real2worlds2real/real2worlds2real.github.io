// Scroll-driven reconstruction of the demo tabletop scene.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

const BASE = 'assets/scene/';
const GLOW = new THREE.Color(0x8fe9ff);
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const seg = (p, a, b) => clamp01((p - a) / (b - a));

// order and scroll window in which each object materialises
const ORDER = [
  ['robot', 0.250, 0.340, 'Dexmate robot'],
  ['potted_plant', 0.345, 0.405, 'Potted plant'],
  ['storage_box', 0.395, 0.445, 'Storage box'],
  ['water_bottle', 0.440, 0.495, 'Bottle · threaded neck'],
  ['bottle_cap', 0.485, 0.530, 'Cap · mating threads'],
  ['blue_cup', 0.525, 0.570, 'Blue cup'],
  ['white_cup', 0.560, 0.605, 'White cup'],
  ['diffuser', 0.600, 0.655, 'Reed diffuser'],
  ['fruit_plate', 0.650, 0.695, 'Plate'],
  ['fruit_1', 0.690, 0.720, 'Fruit'], ['fruit_2', 0.700, 0.730, 'Fruit'], ['fruit_3', 0.710, 0.740, 'Fruit'],
  ['fruit_4', 0.720, 0.750, 'Fruit'], ['fruit_5', 0.730, 0.760, 'Fruit'],
  ['wipes', 0.760, 0.815, 'Wipes dispenser · hinged lid'],
];
// camera keys: [p, position, target, roll(deg), fov]
const KEYS = [
  [0.00, [0.13, 1.47, 1.04], [0.236, 0.941, -0.888], 2, 62],
  [0.105, [0.2, 1.5, 1.1], [0.236, 0.941, -0.888], 2, 60],
  [0.185, [2.3, 2.65, 1.95], [0.2, 1.0, -1.1], 11, 50],
  [0.27, [0.8, 1.8, 1.2], [0.2, 1.12, -1.2], 2, 44],
  [0.36, [0.1, 1.42, 0.5], [0.12, 1.18, -1.3], 0, 44],
  [0.50, [-0.22, 1.27, -0.2], [-0.1, 1.08, -0.9], 0, 44],
  [0.63, [0.2, 1.3, -0.1], [0.2, 1.07, -0.85], 0, 44],
  [0.78, [0.72, 1.3, -0.05], [0.66, 1.05, -0.8], 0, 44],
  [0.87, [0.14, 1.5, 1.0], [0.236, 0.941, -0.888], 1, 47],
  [1.00, [0.13, 1.47, 1.04], [0.236, 0.941, -0.888], 2, 48],
];
// The real capture this scene was rebuilt from: one rectified video frame with its solved camera
// (session posed_frames, frame 24; world -> three is (x, z, -y)). The 3D camera is pinned to this pose
// at both ends of the scroll so the photo and the twin line up pixel for pixel.
const REAL = { src: (window.innerWidth * (window.devicePixelRatio || 1) > 1700 ? 'assets/media/real/capture.jpg' : 'assets/media/real/capture_2k.jpg'),   // 4K frame on large / dense screens
  aspect: 16 / 9, tanHalfV: 1080 / 1603.4647,
  pos: [0.1316, 1.46962, 1.03852], quat: [-0.133696, -0.024448, 0.014274, 0.990618] };

export async function initHero({ canvas, onProgress, onLabel, onReady, onHover, onSplit }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const BG = new THREE.Color(0x070b10);
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 14, 38);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.03, 80);
  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x3a3226, 0.55); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff3e2, 2.3);
  key.position.set(1.6, 4.2, 1.4); key.target.position.set(0.2, 1.0, -0.9);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03;
  Object.assign(key.shadow.camera, { left: -1.8, right: 1.8, top: 1.8, bottom: -1.8, near: 0.5, far: 9 }); key.shadow.camera.updateProjectionMatrix();
  key.shadow.radius = 5;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xbcd6ff, 0.9); fill.position.set(-3, 2.5, 2); scene.add(fill);

  const draco = new DRACOLoader().setDecoderPath('vendor/three/addons/libs/draco/gltf/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const man = await (await fetch(BASE + 'manifest.json')).json();
  const names = ['env', 'table', 'robot', ...man.objects.map(o => o.name).filter(n => n !== 'table')];
  let done = 0;
  const glbs = {};
  await Promise.all(names.map(async n => { glbs[n] = (await loader.loadAsync(BASE + n + '.glb')).scene; onProgress?.(++done / names.length); }));

  // ---------- reveal shader patches ----------
  const C = new THREE.Vector2(0.2, -0.85);                       // reveal centre (table)
  const envU = { uCut: { value: 0 }, uBand: { value: 1.1 }, uGlow: { value: GLOW }, uC: { value: C } };
  function patch(mat, U, radial) {
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvRW=(modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRW;uniform float uCut;uniform float uBand;uniform vec3 uGlow;uniform vec2 uC;')
        .replace('#include <clipping_planes_fragment>', `float rv=${radial ? 'distance(vRW.xz,uC)' : 'vRW.y'};if(rv>uCut)discard;\n#include <clipping_planes_fragment>`)
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\nfloat re=smoothstep(uCut-uBand,uCut,rv);gl_FragColor.rgb+=uGlow*re*re*re*1.6;');
    };
    mat.customProgramCacheKey = () => radial ? 'rvR' : 'rvH';
  }

  // ---------- environment + table ----------
  const env = glbs.env, table = glbs.table;
  const tinfo = man.objects.find(o => o.name === 'table'); table.position.fromArray(tinfo.pos);
  for (const root of [env, table]) root.traverse(o => {
    if (!o.isMesh) return;
    o.receiveShadow = true; o.castShadow = root === table;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.envMapIntensity = 0.6; patch(m, envU, true); });
  });
  scene.add(env, table);
  const TABLE_Y = tinfo.size[1];

  // ---------- point-cloud ghost of the room ----------
  const ghost = buildGhost(env, 230000);
  scene.add(ghost.points);

  // ---------- objects ----------
  const objs = {};
  const pickables = [];
  const wireBase = new THREE.MeshBasicMaterial({ color: 0xbfefff, wireframe: true, transparent: true, opacity: 0, depthWrite: false });
  for (const [name, a, b, label] of ORDER) {
    const info = name === 'robot' ? man.robot : man.objects.find(o => o.name === name);
    const root = glbs[name];
    const pivot = new THREE.Group(); pivot.position.fromArray(info.pos); pivot.add(root); scene.add(pivot);
    const U = { uCut: { value: -1 }, uBand: { value: Math.max(0.012, info.size[1] * 0.12) }, uGlow: { value: GLOW }, uC: { value: C } };
    const wire = wireBase.clone(); const WU = { uCut: { value: -1 }, uBand: { value: 0.001 }, uGlow: { value: new THREE.Color(0) }, uC: { value: C } };
    patch(wire, WU, false);
    const solids = [], wires = [];
    // the scene file carries a clear preview material for the bottle; the real one (and the film) is dark amber glass
    const glass = name === 'water_bottle' ? new THREE.MeshPhysicalMaterial({ color: 0x1b0f07, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, opacity: 0.94 }) : null;
    root.traverse(o => {
      if (!o.isMesh) return;
      if (glass) o.material = glass;
      o.castShadow = false; o.receiveShadow = true; o.userData.pick = name;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.envMapIntensity = glass ? 2.6 : 0.9; patch(m, U, false); });
      solids.push(o);
    });
    for (const s of solids) { const w = new THREE.Mesh(s.geometry, wire); w.renderOrder = 2; w.raycast = () => {}; s.parent.add(w); w.position.copy(s.position); w.quaternion.copy(s.quaternion); w.scale.copy(s.scale); wires.push(w); }
    objs[name] = { name, a, b, label, info, pivot, root, U, WU, wire, solids, wires, r: -1, home: { p: pivot.position.clone(), q: pivot.quaternion.clone() }, said: false, wo: THREE.MathUtils.clamp(0.55 * Math.sqrt(3000 / info.tris), 0.07, 0.7) };
    if (name !== 'robot') pickables.push(...solids);
  }

  // ---------- the real capture, drawn over the scene ----------
  const photoTex = await new THREE.TextureLoader().loadAsync(REAL.src);
  photoTex.colorSpace = THREE.SRGBColorSpace; photoTex.generateMipmaps = true; photoTex.minFilter = THREE.LinearMipmapLinearFilter; photoTex.anisotropy = 4;
  const photoU = { uTex: { value: photoTex }, uRes: { value: new THREE.Vector2(1, 1) }, uImg: { value: new THREE.Vector2(1, 1) }, uD: { value: 0 }, uSplit: { value: 2 },
    uTime: { value: 0 }, uFeather: { value: 0 }, uDim: { value: 1 }, uBlur: { value: 0 }, uLod: { value: 0 }, uGlow: { value: GLOW } };
  const photoMat = new THREE.ShaderMaterial({ uniforms: photoU, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: 'void main(){gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader: `uniform sampler2D uTex;uniform vec2 uRes,uImg;uniform float uD,uSplit,uTime,uFeather,uDim,uBlur,uLod;uniform vec3 uGlow;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 px=gl_FragCoord.xy; vec2 uv=(px-0.5*uRes)/uImg+0.5;
        if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) discard;
        float sx=px.x/uRes.x; if(sx>uSplit) discard;
        float cell=max(3.0,uRes.y/230.0); vec2 g=floor(px/cell); float rnd=hash(g);
        float rad=clamp(distance(uv,vec2(0.49,0.5))*1.45,0.0,1.0);
        float th=rnd*0.5+(1.0-rad)*0.5;                         // far cells go first, the table last
        float k=smoothstep(th,th+0.16,uD*1.34);                 // 0 intact .. 1 gone
        vec2 drift=vec2((hash(g+3.1)-0.5)*0.012,0.02+0.03*rnd)*k*k;
        vec3 col=textureLod(uTex,uv-drift,uLod+uBlur+uD*2.5+k*2.0).rgb;
        vec2 f=fract(px/cell)-0.5; float dotr=mix(0.78,0.16,k);
        float dotm=1.0-smoothstep(dotr-0.1,dotr,length(f));
        float a=(1.0-k)*mix(1.0,dotm,smoothstep(0.0,0.3,uD));
        col=col*uDim+uGlow*k*(1.0-k)*2.4;
        float e=1.0; if(uFeather>0.0){e=smoothstep(0.0,uFeather,uv.y)*smoothstep(0.0,uFeather,1.0-uv.y);}
        float line=1.0-smoothstep(0.0,1.6,abs(px.x-uSplit*uRes.x)/max(1.0,uRes.y/900.0)-0.4);
        col=mix(col,vec3(1.0),line*step(uSplit,1.0));
        gl_FragColor=vec4(col,a*e);
        #include <colorspace_fragment>
      }` });
  const photoScene = new THREE.Scene(), photoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const photoQuad = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)), photoMat);
  photoQuad.frustumCulled = false; photoScene.add(photoQuad);
  // Opening: the photo is the backdrop and the rebuilt room grows over it from the table outwards (same camera,
  // so the twin lands exactly on the real pixels); what the room does not cover defocuses and breaks into dots.
  // Ending: the photo comes back on top, left of a draggable divider.
  let split = 0.5, splitUser = false, photoOn = false, photoBack = false, splitNow = 2;
  function applyPhoto(p) {
    const d = smooth(seg(p, 0.066, 0.104)), endA = smooth(seg(p, 0.89, 0.922));
    if (p < 0.5) { photoOn = d < 1; photoBack = true; photoU.uD.value = d; photoU.uSplit.value = splitNow = 2; photoU.uDim.value = 0.82 + 0.18 * smooth(seg(p, 0.0, 0.03)); photoU.uBlur.value = 3.4 * smooth(seg(p, 0.02, 0.09)); }
    else { if (p < 0.86) splitUser = false; photoOn = endA > 0; photoBack = false; photoU.uD.value = 0; photoU.uDim.value = 1; photoU.uBlur.value = 0; photoU.uSplit.value = splitNow = (splitUser ? split : 0.5) * endA; }
    photoQuad.visible = photoOn; if (!photoOn) return;
    const fit = photoFit(p), pr = renderer.getPixelRatio();
    photoU.uRes.value.set(canvas.clientWidth * pr, canvas.clientHeight * pr); photoU.uImg.value.set(fit.wd * pr, fit.hd * pr); photoU.uFeather.value = fit.band ? 0.07 : 0;
    photoU.uLod.value = Math.max(0, Math.log2(photoTex.image.width / (fit.wd * pr)) - 0.35);   // pick the mip that matches the screen, biased sharp
  }
  function draw() {
    renderer.autoClear = false; renderer.setClearColor(BG, 1); renderer.clear();
    const back = photoOn && photoBack;
    if (back) renderer.render(photoScene, photoCam);
    scene.background = null; renderer.render(scene, camera); scene.background = BG;
    if (photoOn && !photoBack) renderer.render(photoScene, photoCam);
    renderer.autoClear = true; onSplit?.(photoOn && splitNow <= 1 ? splitNow : null);
  }

  // ---------- camera path ----------
  const kp = KEYS.map(k => k[0]);
  const posC = new THREE.CatmullRomCurve3(KEYS.map(k => new THREE.Vector3(...k[1])), false, 'catmullrom', 0.35);
  const tgtC = new THREE.CatmullRomCurve3(KEYS.map(k => new THREE.Vector3(...k[2])), false, 'catmullrom', 0.35);
  const vp = new THREE.Vector3(), vt = new THREE.Vector3();
  const realPos = new THREE.Vector3().fromArray(REAL.pos), realQuat = new THREE.Quaternion().fromArray(REAL.quat);
  let camOverride = null;                                          // debug: pin the camera to an exact pose
  function setCamera(p) {
    if (camOverride) { camera.position.fromArray(camOverride.pos); camera.quaternion.fromArray(camOverride.quat); camera.fov = camOverride.fov; camera.updateProjectionMatrix(); return; }
    let i = 0; while (i < kp.length - 2 && p > kp[i + 1]) i++;
    const f = smooth((p - kp[i]) / (kp[i + 1] - kp[i]));
    const u = (i + f) / (kp.length - 1);
    posC.getPoint(u, vp); tgtC.getPoint(u, vt);
    const roll = THREE.MathUtils.lerp(KEYS[i][3], KEYS[i + 1][3], f), fov = THREE.MathUtils.lerp(KEYS[i][4], KEYS[i + 1][4], f);
    const w = Math.max(1 - smooth(seg(p, 0.095, 0.17)), smooth(seg(p, 0.815, 0.875)));   // weight of the real pose
    const portrait = camera.aspect < 0.9 ? 1 + 0.35 * (1 - w) : 1;   // pull back a little on phones
    camera.position.copy(vp).sub(vt).multiplyScalar(portrait).add(vt);
    camera.up.set(0, 1, 0); camera.lookAt(vt); camera.rotateZ(THREE.MathUtils.degToRad(roll));
    let f2 = fov;
    if (w > 0) {
      camera.position.lerp(realPos, w); camera.quaternion.slerp(realQuat, w);
      f2 = THREE.MathUtils.lerp(fov, THREE.MathUtils.radToDeg(2 * Math.atan(REAL.tanHalfV * photoFit(p).k)), w);
    }
    if (Math.abs(camera.fov - f2) > 0.005) { camera.fov = f2; camera.updateProjectionMatrix(); }
  }
  // How the photo is laid over the viewport: cover on wide screens, a centred band on tall ones.
  // Returns displayed photo size in CSS px and k = viewportHeight / displayedHeight (drives the matched fov).
  function photoFit(p) {
    const W = canvas.clientWidth || 1, H = canvas.clientHeight || 1, end = p > 0.5;
    const cover = Math.max(W, H * REAL.aspect), limit = W / 0.56;      // never show less than 56% of the photo's width
    const band = cover > limit * 1.01;
    const zoom = band ? 1.04 : (end ? 1.5 : 1.06);
    const wd = Math.min(cover, limit) * zoom, hd = wd / REAL.aspect;
    return { wd, hd, k: H / hd, band };
  }

  // ---------- timeline ----------
  let target = 0, cur = 0, time = 0, dirty = true;
  function apply(p) {
    setCamera(p);
    applyPhoto(p);
    const er = smooth(seg(p, 0.012, 0.10)), e2 = smooth(seg(p, 0.10, 0.27));     // near field while the photo is up, then the rest of the floor
    envU.uCut.value = er <= 0 ? 0 : 9 * Math.pow(er, 1.7) + 25 * e2 * e2 + 0.01; envU.uBand.value = Math.min(0.3 + 0.8 * e2, envU.uCut.value * 0.3);
    ghost.mat.uniforms.uBase.value = smooth(seg(p, 0.06, 0.11));
    ghost.mat.uniforms.uCut.value = envU.uCut.value;
    ghost.mat.uniforms.uAlpha.value = 1 - smooth(seg(p, 0.24, 0.32));
    ghost.points.visible = ghost.mat.uniforms.uAlpha.value > 0.01;
    scene.environmentIntensity = 0.04 + 0.09 * er; key.intensity = 0.3 + 3.4 * er; hemi.intensity = 0.05 + 0.1 * er;
    for (const o of Object.values(objs)) {
      const r = seg(p, o.a, o.b);
      if (r === o.r) continue; o.r = r;
      const y0 = o.pivot.position.y - 0.01, h = o.info.size[1] * 1.25 + 0.03;
      o.pivot.visible = r > 0;
      o.WU.uCut.value = y0 + h * clamp01(r / 0.45);
      o.wire.opacity = o.wo * smooth(r / 0.12) * (1 - smooth((r - 0.62) / 0.38));
      o.U.uCut.value = r >= 1 ? 1e6 : y0 + h * clamp01((r - 0.3) / 0.7);
      o.wires.forEach(w => w.visible = o.wire.opacity > 0.01);
      o.solids.forEach(s => s.castShadow = r >= 1);
      const s = 1 + 0.06 * Math.sin(Math.PI * clamp01(r)) ; o.root.scale.setScalar(s);
      if (r > 0.15 && r < 1 && !o.said) { o.said = true; onLabel?.(o, screenOf(o)); }
      if (r <= 0) o.said = false;
    }
    renderer.shadowMap.needsUpdate = true;
  }

  // ---------- interaction: rotate / move objects, without letting them pass through each other ----------
  // Every object carries a sparse set of surface points. Moving or turning one projects those points onto the
  // table plane, takes the convex outline of the part that shares a height range with each neighbour, and
  // pushes the dragged object out along the shortest separating direction. Turned objects are dropped back so
  // their lowest point rests on the support.
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hover = null, drag = null;
  const SUP = objs.water_bottle ? objs.water_bottle.home.p.y : TABLE_Y;       // height the table top supports objects at
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SUP);
  const isFruit = o => /^fruit_\d/.test(o.name);
  const plate = objs.fruit_plate || null;
  const tv = new THREE.Vector3();
  function sample(root, frame, n) {                 // points in `frame`'s local space (or world when frame is null)
    root.updateWorldMatrix(true, true); const inv = frame ? frame.matrixWorld.clone().invert() : null;
    let total = 0; root.traverse(m => { if (m.isMesh && m.userData.pick !== undefined) total += m.geometry.attributes.position.count; });
    const out = []; const step = Math.max(1, Math.floor(total / n));
    root.traverse(m => {
      if (!m.isMesh || m.userData.pick === undefined) return;
      const a = m.geometry.attributes.position;
      for (let i = (Math.random() * step) | 0; i < a.count; i += step) { tv.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); if (inv) tv.applyMatrix4(inv); out.push(tv.x, tv.y, tv.z); }
    });
    return new Float32Array(out);
  }
  for (const o of Object.values(objs)) {
    o.pivot.updateWorldMatrix(true, true);
    o.pts = sample(o.root, o.name === 'robot' ? null : o.pivot, o.name === 'robot' ? 5000 : 700);
    o.rot = new Float32Array(o.pts.length); o.rotQ = new THREE.Quaternion(NaN, 0, 0, 1); o.minY = 0; o.maxY = o.info.size[1]; o.base = 0;
    if (o.name !== 'robot') { let lo = 1e9; for (let i = 1; i < o.pts.length; i += 3) lo = Math.min(lo, o.pts[i]); o.base = lo; }   // sampled floor at rest
  }
  const robot = objs.robot;
  function refresh(o) {                              // rotated points (pivot-relative) + vertical extent, cached per orientation
    if (o === robot || o.rotQ.equals(o.pivot.quaternion)) return;
    const p = o.pts, r = o.rot, q = o.pivot.quaternion; let lo = 1e9, hi = -1e9;
    for (let i = 0; i < p.length; i += 3) { tv.set(p[i], p[i + 1], p[i + 2]).applyQuaternion(q); r[i] = tv.x; r[i + 1] = tv.y; r[i + 2] = tv.z; if (tv.y < lo) lo = tv.y; if (tv.y > hi) hi = tv.y; }
    o.minY = lo; o.maxY = hi; o.rotQ.copy(q);
  }
  const yRange = o => { if (o === robot) return [-1e9, 1e9]; refresh(o); return [o.pivot.position.y + o.minY, o.pivot.position.y + o.maxY]; };
  function outline(o, y0, y1) {                      // convex outline (world xz) of the part of o between heights y0..y1
    const P = []; let r, ox = 0, oy = 0, oz = 0;
    if (o === robot) r = o.pts; else { refresh(o); r = o.rot; ox = o.pivot.position.x; oy = o.pivot.position.y; oz = o.pivot.position.z; }
    for (let i = 0; i < r.length; i += 3) { const y = r[i + 1] + oy; if (y >= y0 && y <= y1) P.push([r[i] + ox, r[i + 2] + oz]); }
    if (!P.length) return null;
    if (P.length < 3) { const [x, z] = P[0]; return [[x - .004, z - .004], [x + .004, z - .004], [x + .004, z + .004], [x - .004, z + .004]]; }
    P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const L = [], U = [];
    for (const p of P) { while (L.length >= 2 && cr(L[L.length - 2], L[L.length - 1], p) <= 0) L.pop(); L.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (U.length >= 2 && cr(U[U.length - 2], U[U.length - 1], p) <= 0) U.pop(); U.push(p); }
    L.pop(); U.pop(); const H = L.concat(U); return H.length >= 3 ? H : null;
  }
  function mtv(A, B) {                               // shortest move of convex A out of convex B, or null if apart
    let best = 1e9, bx = 0, bz = 0;
    for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length]; let nx = b[1] - a[1], nz = a[0] - b[0]; const l = Math.hypot(nx, nz); if (l < 1e-9) continue; nx /= l; nz /= l;
      let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
      for (const p of A) { const d = p[0] * nx + p[1] * nz; if (d < a0) a0 = d; if (d > a1) a1 = d; }
      for (const p of B) { const d = p[0] * nx + p[1] * nz; if (d < b0) b0 = d; if (d > b1) b1 = d; }
      const o1 = a1 - b0, o2 = b1 - a0; if (o1 <= 0 || o2 <= 0) return null;
      if (o1 < best) { best = o1; bx = -nx; bz = -nz; } if (o2 < best) { best = o2; bx = nx; bz = nz; }
    }
    return [bx * (best + 0.0015), bz * (best + 0.0015)];
  }
  const plateFlat = () => plate && plate.pivot.visible && new THREE.Vector3(0, 1, 0).applyQuaternion(plate.pivot.quaternion).y > 0.995;
  const PR = plate ? Math.max(plate.info.size[0], plate.info.size[2]) / 2 : 0;
  function supportOf(o) {                            // height the lowest point of o should rest at
    if (!isFruit(o)) return o.home.p.y;
    if (!plateFlat()) return SUP;
    const d = Math.hypot(o.pivot.position.x - plate.pivot.position.x, o.pivot.position.z - plate.pivot.position.z);
    const floorY = plate.pivot.position.y + (o.home.p.y - plate.home.p.y), rimY = plate.pivot.position.y + plate.info.size[1] + 0.002;
    const a = PR - 0.05, b = PR - 0.008, c = PR + Math.max(o.info.size[0], o.info.size[2]) * 0.5;
    if (drag && drag.o === o && drag.move) {         // a fruit in the hand is carried above the plate and the fruit in it
      const liftY = plate.pivot.position.y + plate.info.size[1] + 0.045;
      return d <= b ? liftY : d < c + 0.03 ? liftY + (SUP - liftY) * smooth((d - b) / (c + 0.03 - b)) : SUP;
    }
    if (d <= a) return floorY; if (d < b) return floorY + (rimY - floorY) * smooth((d - a) / (b - a));
    if (d < c) return rimY + (SUP - rimY) * smooth((d - b) / (c - b)); return SUP;
  }
  const inPlate = f => plate && isFruit(f) && f.pivot.visible && Math.hypot(f.pivot.position.x - plate.pivot.position.x, f.pivot.position.z - plate.pivot.position.z) < PR && f.pivot.position.y < plate.pivot.position.y + 0.14;
  function rest(o) { if (isFruit(o) && !plateFlat() && inPlate(o)) return; refresh(o); o.pivot.position.y = supportOf(o) - (o.minY - o.base); }
  const T0 = [tinfo.pos[0] - tinfo.size[0] / 2 + 0.015, tinfo.pos[0] + tinfo.size[0] / 2 - 0.015, tinfo.pos[2] - tinfo.size[2] / 2 + 0.015, tinfo.pos[2] + tinfo.size[2] / 2 - 0.015];
  function onTable(o) {                              // keep the part touching the support inside the table top
    const [y0] = yRange(o), H = outline(o, y0 - 1e-4, y0 + 0.02); if (!H) return;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of H) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    const P = o.pivot.position;
    if (x1 - x0 < T0[1] - T0[0]) { if (x0 < T0[0]) P.x += T0[0] - x0; else if (x1 > T0[1]) P.x -= x1 - T0[1]; }
    if (z1 - z0 < T0[3] - T0[2]) { if (z0 < T0[2]) P.z += T0[2] - z0; else if (z1 > T0[3]) P.z -= z1 - T0[3]; }
  }
  function hitAny(o, group, push) {                  // true if o overlaps something; with push, moves o out as it goes
    let hit = false;
    for (const b of Object.values(objs)) {
      if (b === o || group.includes(b) || !b.pivot.visible || b.r < 1) continue;
      if (isFruit(o) && b === plate && plateFlat()) continue;      // fruit may sit in the plate
      if (o === plate && inPlate(b)) continue;
      const ra = yRange(o), rb = yRange(b), e = 0.002;
      const A = outline(o, rb[0] + e, rb[1] - e), B = A && outline(b, ra[0] + e, ra[1] - e); if (!A || !B) continue;
      const m = mtv(A, B); if (!m) continue;
      hit = true; if (!push) return true;
      o.pivot.position.x += m[0]; o.pivot.position.z += m[1];
    }
    return hit;
  }
  function settle(o, group) {                        // resolve o to a free pose; false if it cannot be freed
    for (let i = 0; i < 6; i++) { onTable(o); rest(o); if (!hitAny(o, group, true)) { onTable(o); rest(o); return !hitAny(o, group, false); } }
    return false;
  }
  const carried = o => o === plate ? Object.values(objs).filter(inPlate) : [];
  function tryPose(d, mutate) {                      // apply a change to the dragged object; keep it only if it ends up free
    const o = d.o, p0 = o.pivot.position.clone(), q0 = o.pivot.quaternion.clone();
    mutate(o); const ok = settle(o, d.group);
    if (!ok && d.free) { o.pivot.position.copy(p0); o.pivot.quaternion.copy(q0); rest(o); }
    else d.free = ok || d.free;
    const inv = d.q0inv, dq = o.pivot.quaternion.clone().multiply(inv);
    for (const g of d.group) { g.o.pivot.quaternion.copy(dq).multiply(g.q); g.o.pivot.position.copy(g.rel).applyQuaternion(dq).add(o.pivot.position); }
  }
  const hit = e => {
    const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    if (photoOn && (splitNow > 1 || (e.clientX - r.left) / r.width < splitNow)) return null;      // the photo is on top there
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(pickables.filter(m => objs[m.userData.pick].r >= 1), false)[0];
    if (h) return objs[h.object.userData.pick];
    if (e.pointerType !== 'touch') return null;
    // a fingertip is wider than a cup on a phone screen: take the nearest object within reach of the touch
    let best = null, bd = 36; const v = new THREE.Vector3();
    for (const o of Object.values(objs)) {
      if (o === robot || o.r < 1 || !o.pivot.visible) continue;
      v.copy(o.pivot.position); v.y += o.info.size[1] / 2; v.project(camera);
      const d = Math.hypot((v.x + 1) / 2 * r.width - (e.clientX - r.left), (1 - v.y) / 2 * r.height - (e.clientY - r.top));
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  };
  const setHover = o => { if (o === hover) return; hover = o; canvas.style.cursor = o ? 'grab' : ''; onHover?.(o, o ? screenOf(o) : null); dirty = true; };
  function screenOf(o) { const v = o.pivot.position.clone(); v.y += o.info.size[1] + 0.03; v.project(camera); const r = canvas.getBoundingClientRect(); return [(v.x + 1) / 2 * r.width, (1 - v.y) / 2 * r.height]; }
  canvas.addEventListener('pointermove', e => {
    if (drag) {
      let dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      if (drag.touch && !drag.move) {
        if (!drag.armed) {                             // still deciding: sideways turns the object, vertical is the page's scroll
          const tx = e.clientX - drag.sx, ty = e.clientY - drag.sy; if (Math.hypot(tx, ty) < 7) return;
          drag.moved = true; clearTimeout(drag.hold);
          if (Math.abs(tx) <= Math.abs(ty)) return;
          drag.armed = true;
        }
        dy = 0;                                        // a finger turns it about the vertical axis only
      }
      if (drag.move) {
        const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera);
        const pt = new THREE.Vector3(); if (ray.ray.intersectPlane(plane, pt)) {
          pt.sub(drag.off);
          // walk towards the pointer in short steps so a fast drag cannot jump over a neighbour
          const from = drag.o.pivot.position, n = Math.max(1, Math.ceil(Math.hypot(pt.x - from.x, pt.z - from.z) / 0.03)), sx = (pt.x - from.x) / n, sz = (pt.z - from.z) / n;
          for (let i = 0; i < n; i++) tryPose(drag, o => { o.pivot.position.x += sx; o.pivot.position.z += sz; });
        }
      } else {
        const c = new THREE.Vector3(0, drag.o.info.size[1] / 2, 0);
        const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.012);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); right.y = 0; right.normalize();
        const qx = new THREE.Quaternion().setFromAxisAngle(right, dy * 0.012);
        const q = qy.multiply(qx);
        tryPose(drag, o => {                         // rotate about the object's centre, not its base
          const before = c.clone().applyQuaternion(o.pivot.quaternion); o.pivot.quaternion.premultiply(q).normalize();
          const after = c.clone().applyQuaternion(o.pivot.quaternion); o.pivot.position.x += before.x - after.x; o.pivot.position.z += before.z - after.z;
        });
      }
      for (const f of Object.values(objs)) if (isFruit(f) && f !== drag.o && !drag.group.some(g => g.o === f) && f.r >= 1) rest(f);
      onHover?.(drag.o, screenOf(drag.o)); dirty = true; return;
    }
    setHover(hit(e));
  });
  canvas.addEventListener('pointerdown', e => {
    const o = hit(e); if (!o) return;
    const move = e.shiftKey || e.button === 2 || e.altKey;
    const off = new THREE.Vector3();
    if (move) { const pt = new THREE.Vector3(); if (ray.ray.intersectPlane(plane, pt)) off.copy(pt).sub(o.pivot.position).setY(0); }
    const q0inv = o.pivot.quaternion.clone().invert();
    const group = carried(o).map(f => ({ o: f, rel: f.pivot.position.clone().sub(o.pivot.position), q: f.pivot.quaternion.clone() }));
    const touch = e.pointerType === 'touch';
    drag = { o, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, move, off, group, q0inv, free: false, touch, armed: !touch, moved: false, hold: 0, t0: performance.now() };
    if (touch) {
      const d = drag, pt = new THREE.Vector3(), has = ray.ray.intersectPlane(plane, pt);
      d.hold = setTimeout(() => {                      // held still: pick it up, the finger now slides it over the table
        if (drag !== d || d.moved || !has) return;
        d.move = true; d.off.copy(pt).sub(o.pivot.position).setY(0); navigator.vibrate?.(12); onHover?.(o, screenOf(o), 'move'); dirty = true;
      }, 340);
      onHover?.(o, screenOf(o));
    }
    const gl = group.map(g => g.o); drag.free = !hitAny(o, gl, false);
    // hitAny/settle take the carried objects as a plain list
    drag.group = Object.assign(group, { includes: b => gl.includes(b) });
    canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; e.preventDefault();
  });
  let lastTap = { o: null, t: 0 };
  function resetObj(o) {
    const back = [o, ...(o === plate ? Object.values(objs).filter(isFruit) : [])];
    for (const b of back) { b.pivot.position.copy(b.home.p); b.pivot.quaternion.copy(b.home.q); }
    for (const b of back) if (hitAny(b, back, false)) settle(b, back);
    for (const f of Object.values(objs)) if (isFruit(f) && !back.includes(f) && f.r >= 1) rest(f);
    dirty = true;
  }
  const end = e => {
    if (!drag) return; const d = drag, o = d.o; clearTimeout(d.hold); drag = null;
    if (isFruit(o)) { settle(o, []); dirty = true; }
    if (d.touch) {
      const now = performance.now();
      if (e.type === 'pointerup' && !d.moved && !d.move && now - d.t0 < 300) {       // a tap; two on the same object reset it
        if (lastTap.o === o && now - lastTap.t < 380) { resetObj(o); lastTap = { o: null, t: 0 }; } else lastTap = { o, t: now };
      }
      setTimeout(() => { if (!drag) onHover?.(null); }, 900);
    }
    canvas.style.cursor = hover ? 'grab' : '';
  };
  // once a touch has become a turn or a move, the page must not scroll under it
  canvas.addEventListener('touchmove', e => { if (drag && drag.touch && (drag.move || drag.armed) && e.cancelable) e.preventDefault(); }, { passive: false });
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { if (!drag) setHover(null); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('dblclick', e => { const o = hit(e); if (o && performance.now() - lastTap.t > 500) resetObj(o); });

  // ---------- loop ----------
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true;
  }
  new ResizeObserver(resize).observe(canvas); resize();
  let visible = true, last = performance.now();
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(canvas);
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    if (!visible) return;
    const d = target - cur; if (Math.abs(d) > 1e-5) { cur += d * Math.min(1, dt * 7); dirty = true; }
    const anim = ghost.points.visible || Object.values(objs).some(o => o.r > 0 && o.r < 1);
    if (!dirty && !anim) return;
    ghost.mat.uniforms.uTime.value = time;
    photoU.uTime.value = time; apply(cur); draw(); dirty = false;
  }
  apply(0); renderer.compile(scene, camera); requestAnimationFrame(frame);
  onReady?.();
  return {
    set(p, instant) { target = clamp01(p); if (instant) cur = target; dirty = true; },
    get progress() { return cur; },
    renderNow() { apply(cur); draw(); },
    setSplit(x) { split = clamp01(x); splitUser = true; dirty = true; },
    get split() { return photoOn && splitNow <= 1 ? splitNow : null; },
    debugCam(c) { camOverride = c; apply(cur); draw(); },
    variants: makeVariants(),
    // screen position (canvas px) just above an object, or null while it is hidden, unbuilt, or under the photo
    anchor(name) {
      const o = objs[name]; if (!o || o.r < 1 || !o.pivot.visible) return null;
      const v = o.pivot.position.clone(); refresh(o); v.y += o.maxY + 0.02; v.project(camera); if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) return null;
      const r = canvas.getBoundingClientRect(), x = (v.x + 1) / 2 * r.width, y = (1 - v.y) / 2 * r.height;
      if (photoOn && (splitNow > 1 || x / r.width < splitNow)) return null;
      return [x, y];
    },
    _objs: objs,
    _pt(name) { const o = objs[name], v = o.pivot.position.clone(); refresh(o); v.y += (o.minY + o.maxY) / 2; v.project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; },
    _overlaps() { const out = []; for (const o of Object.values(objs)) if (o !== robot && o.r >= 1 && hitAny(o, [], false)) out.push(o.name); return out; },
    _low(name) { const o = objs[name]; refresh(o); return +(o.pivot.position.y + o.minY).toFixed(4); },
  };

  // ---------- world variations (used by the scaling wall) ----------
  function makeVariants() {
    const cam2 = new THREE.PerspectiveCamera(40, 1.6, 0.05, 60);
    const mats = root => { const r = []; root.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!m.userData.c0) m.userData.c0 = m.color.clone(); if (!r.includes(m)) r.push(m); }); }); return r; };
    const envMats = mats(env), tableMats = mats(table);
    const movable = Object.values(objs).filter(o => o.name !== 'robot' && !/^fruit_\d/.test(o.name));
    const fruits = Object.values(objs).filter(o => /^fruit_\d/.test(o.name));
    movable.concat(fruits).forEach(o => { o.mats = mats(o.root); });
    const T = c => new THREE.Color(c[0], c[1], c[2]);
    const TINTS = [[1, 1, 1], [1, .9, .76], [.76, .9, 1], [.6, .64, .72], [.88, 1, .9], [1, .8, .8], [.46, .47, .52], [1, .95, .62], [.7, .8, .7]].map(T);
    const TABLES = [[1, 1, 1], [.58, .4, .32], [.34, .29, .28], [.85, .92, 1], [1, .84, .6], [.5, .62, .5], [1, 1, 1], [.75, .75, .78]].map(T);
    const rng = seed => { let a = (seed * 2654435761) >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
    let saved = null, probe = null;
    function begin() {
      saved = { bg: scene.background.clone(), envI: scene.environmentIntensity, ki: key.intensity, kc: key.color.clone(), kp: key.position.clone(), hi: hemi.intensity, ex: renderer.toneMappingExposure,
        objs: Object.values(objs).map(o => ({ o, p: o.pivot.position.clone(), q: o.pivot.quaternion.clone(), v: o.pivot.visible })), cut: envU.uCut.value, gv: ghost.points.visible };
      envU.uCut.value = 1e6; ghost.points.visible = false;
      for (const o of Object.values(objs)) { o.U.uCut.value = 1e6; o.wires.forEach(w => w.visible = false); o.pivot.visible = true; o.root.scale.setScalar(1); o.solids.forEach(m => m.castShadow = true); }
    }
    function end() {
      if (!saved) return;
      scene.background.copy(saved.bg); scene.environmentIntensity = saved.envI; key.intensity = saved.ki; key.color.copy(saved.kc); key.position.copy(saved.kp); hemi.intensity = saved.hi; renderer.toneMappingExposure = saved.ex;
      for (const s of saved.objs) { s.o.pivot.position.copy(s.p); s.o.pivot.quaternion.copy(s.q); s.o.pivot.visible = s.v; s.o.pivot.scale.setScalar(1); s.o.r = -1; s.o.mats?.forEach(m => m.color.copy(m.userData.c0)); }
      envMats.forEach(m => m.color.copy(m.userData.c0)); tableMats.forEach(m => m.color.copy(m.userData.c0));
      envU.uCut.value = saved.cut; ghost.points.visible = saved.gv; saved = null;
      renderer.setScissorTest(false); const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setViewport(0, 0, w, h); dirty = true;
    }
    function render(seed, ctx, dx, dy, dw, dh, rw, rh) {
      const R = rng(seed + 7), t = tinfo;
      const et = TINTS[(R() * TINTS.length) | 0]; envMats.forEach(m => m.color.copy(m.userData.c0).multiply(et));
      const tt = TABLES[(R() * TABLES.length) | 0]; tableMats.forEach(m => m.color.copy(m.userData.c0).multiply(tt));
      const placed = []; let plate = null;
      for (const o of movable) {
        if (o.name === 'potted_plant') { o.pivot.visible = R() > .3; o.pivot.position.copy(o.home.p); continue; }
        o.pivot.visible = o.name === 'blue_cup' || o.name === 'white_cup' || R() > .22;
        const rad = Math.max(o.info.size[0], o.info.size[2]) * .6 + .03; let x, z, ok, tries = 0;
        do { x = t.pos[0] + (R() - .5) * (t.size[0] - .34); z = t.pos[2] + (R() - .5) * (t.size[2] - .3); ok = placed.every(p => Math.hypot(p[0] - x, p[1] - z) > p[2] + rad); } while (!ok && ++tries < 24);
        placed.push([x, z, rad]); o.pivot.position.set(x, o.home.p.y, z); o.pivot.rotation.set(0, R() * 6.283, 0); o.pivot.scale.setScalar(.85 + R() * .35);
        o.mats.forEach(m => { m.color.copy(m.userData.c0); if (R() < .55) m.color.offsetHSL(R(), 0, (R() - .5) * .14); });
        if (o.name === 'fruit_plate') plate = o;
      }
      for (const f of fruits) { f.pivot.visible = plate.pivot.visible; f.pivot.position.copy(f.home.p).sub(plate.home.p).multiplyScalar(plate.pivot.scale.x).add(plate.pivot.position); f.pivot.scale.copy(plate.pivot.scale); f.mats.forEach(m => { m.color.copy(m.userData.c0); if (R() < .5) m.color.offsetHSL(R() * .2 - .1, 0, 0); }); }
      const az = R() * 6.283, el = .55 + R() * .7; key.position.set(.2 + Math.cos(az) * 3 * Math.cos(el), 1 + 3.4 * Math.sin(el), -.9 + Math.sin(az) * 3 * Math.cos(el));
      key.intensity = 1.5 + R() * 2.6; key.color.setRGB(1, .84 + R() * .16, .66 + R() * .34); hemi.intensity = .05 + R() * .32; scene.environmentIntensity = .05 + R() * .22; renderer.toneMappingExposure = .78 + R() * .45;
      scene.background.setHSL(R(), .3, .03 + R() * .08);
      const ca = (R() - .5) * 1.15, ce = .38 + R() * .62, cd = 1.35 + R() * .75, tx = .2 + (R() - .5) * .5, tz = -.85 + (R() - .5) * .25;
      cam2.position.set(tx + Math.sin(ca) * cd * Math.cos(ce), 1.05 + cd * Math.sin(ce), tz + Math.cos(ca) * cd * Math.cos(ce)); cam2.lookAt(tx, 1.05, tz); cam2.aspect = rw / rh; cam2.updateProjectionMatrix();
      const pr = renderer.getPixelRatio(), cw = rw / pr, ch = rh / pr;
      renderer.setViewport(0, 0, cw, ch); renderer.setScissor(0, 0, cw, ch); renderer.setScissorTest(true);
      renderer.render(scene, cam2);
      ctx.drawImage(renderer.domElement, 0, renderer.domElement.height - rh, rw, rh, dx, dy, dw, dh);
      // one row through the middle: if it is nearly uniform the camera is inside something and the caller re-rolls
      const gl = renderer.getContext(), n = Math.max(4, rw | 0); if (!probe || probe.length < n * 4) probe = new Uint8Array(n * 4);
      gl.readPixels(0, (rh / 2) | 0, n, 1, gl.RGBA, gl.UNSIGNED_BYTE, probe);
      let lo = 765, hi = 0; for (let i = 0; i < n * 4; i += 16) { const v = probe[i] + probe[i + 1] + probe[i + 2]; if (v < lo) lo = v; if (v > hi) hi = v; }
      return hi - lo > 45;
    }
    return { begin, end, render, maxTile: () => [Math.min(256, renderer.domElement.width), Math.min(160, renderer.domElement.height)] };
  }

  // ---------- helpers ----------
  function buildGhost(root, N) {
    root.updateMatrixWorld(true);
    const items = []; let total = 0;
    root.traverse(o => {
      if (!o.isMesh) return;
      const g = o.geometry, mats = Array.isArray(o.material) ? o.material : [o.material];
      const groups = g.groups.length ? g.groups : [{ start: 0, count: (g.index ? g.index.count : g.attributes.position.count), materialIndex: 0 }];
      for (const gr of groups) {
        const sub = new THREE.BufferGeometry();
        for (const k of ['position', 'normal', 'uv']) if (g.attributes[k]) sub.setAttribute(k, g.attributes[k]);
        if (g.index) sub.setIndex(new THREE.BufferAttribute(g.index.array.slice(gr.start, gr.start + gr.count), 1));
        else sub.setDrawRange(gr.start, gr.count);
        const m = new THREE.Mesh(sub, mats[gr.materialIndex]); m.matrixWorld.copy(o.matrixWorld);
        const sampler = new MeshSurfaceSampler(m).build();
        const area = sampler.distribution ? sampler.distribution[sampler.distribution.length - 1] : 0;
        if (area > 0) { items.push({ sampler, area, m }); total += area; }
      }
    });
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), rnd = new Float32Array(N);
    const p = new THREE.Vector3(), nrm = new THREE.Vector3(), cc = new THREE.Color(), uv = new THREE.Vector2();
    const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true }); const texCache = new Map();
    const texData = t => { if (texCache.has(t)) return texCache.get(t); let d = null; try { const im = t.image; cv.width = Math.min(256, im.width); cv.height = Math.min(256, im.height); cx.drawImage(im, 0, 0, cv.width, cv.height); d = { w: cv.width, h: cv.height, d: cx.getImageData(0, 0, cv.width, cv.height).data }; } catch (e) {} texCache.set(t, d); return d; };
    let n = 0;
    for (const it of items) {
      const k = Math.min(N - n, Math.max(1, Math.round(N * it.area / total)));
      const mat = it.m.material, td = mat.map ? texData(mat.map) : null, hasUV = !!it.m.geometry.attributes.uv;
      for (let i = 0; i < k; i++, n++) {
        it.sampler.sample(p, nrm, undefined, hasUV ? uv : undefined); p.applyMatrix4(it.m.matrixWorld);
        pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
        cc.copy(mat.color);
        if (td && hasUV) { const x = Math.floor(((uv.x % 1) + 1) % 1 * (td.w - 1)), y = Math.floor(((uv.y % 1) + 1) % 1 * (td.h - 1)), j = (y * td.w + x) * 4; cc.setRGB(td.d[j] / 255, td.d[j + 1] / 255, td.d[j + 2] / 255, THREE.SRGBColorSpace).multiply(mat.color); }
        col[n * 3] = cc.r; col[n * 3 + 1] = cc.g; col[n * 3 + 2] = cc.b; rnd[n] = Math.random();
      }
      if (n >= N) break;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, n * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, n * 3), 3));
    g.setAttribute('rnd', new THREE.BufferAttribute(rnd.subarray(0, n), 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uCut: { value: 0 }, uAlpha: { value: 1 }, uTime: { value: 0 }, uBase: { value: 1 }, uC: { value: C }, uPx: { value: renderer.getPixelRatio() } },
      vertexShader: `attribute float rnd;varying vec3 vCol;varying float vA;uniform float uCut,uTime,uPx,uBase;uniform vec2 uC;
        void main(){vec3 p=position;float d=distance(p.xz,uC);
          float ahead=smoothstep(uCut-0.2,uCut+0.25,d);                // points survive only ahead of the mesh front
          float front=1.0-smoothstep(0.0,2.4,abs(d-uCut));
          p.y+=sin(uTime*1.3+rnd*40.0)*0.012*(1.0-front);
          vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;
          float tw=0.55+0.45*sin(uTime*2.0+rnd*50.0);
          vCol=mix(color*1.25+0.05,vec3(0.56,0.91,1.0),front*0.75);vA=ahead*(0.42*uBase+0.58*front*min(1.0,uCut*2.5+uBase))*tw;
          gl_PointSize=uPx*(1.4+rnd*1.6+front*2.2)*clamp(7.0/-mv.z,0.35,3.0);}`,
      fragmentShader: `varying vec3 vCol;varying float vA;uniform float uAlpha;
        void main(){vec2 c=gl_PointCoord-0.5;float r=dot(c,c);if(r>0.25)discard;gl_FragColor=vec4(vCol,vA*uAlpha*(1.0-r*3.2));}`,
      vertexColors: true,
    });
    const points = new THREE.Points(g, mat); points.frustumCulled = false; points.renderOrder = 3;
    return { points, mat };
  }
}
