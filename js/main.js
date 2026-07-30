/* ============================================================
   OBSIDIAN OBSERVATORY — particle morph engine
   15,000 particles · 5 procedural shapes · GPU morphing
   galaxy → neural core → torus knot → data grid → helix
   Scroll: Lenis — velocity feeds the shader, bloom, and camera
   ============================================================ */

import * as THREE from 'three';
import Lenis from 'lenis';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Imports resolved — the heaviest download on the page is done.
window.__obsBooted = true;
document.documentElement.classList.add('js');   // heal an early watchdog trip
window.__loader?.step('modules');

const COUNT = window.matchMedia('(max-width: 860px)').matches ? 7000 : 15000;
const SHAPES = 5;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- shape generators (each returns Float32Array COUNT*3) ---------- */

function makeGalaxy() {
  const arr = new Float32Array(COUNT * 3);
  const arms = 4;
  for (let i = 0; i < COUNT; i++) {
    const armIdx = i % arms;
    const t = Math.pow(Math.random(), 0.6);          // density toward center
    const radius = t * 7;
    const spin = radius * 0.9;
    const armAngle = (armIdx / arms) * Math.PI * 2;
    const spread = (1 - t) * 0.9;
    const angle = armAngle + spin + (Math.random() - 0.5) * spread * 2.5;
    arr[i * 3] = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.4;
    arr[i * 3 + 1] = (Math.random() - 0.5) * (1 - t) * 1.4;
    arr[i * 3 + 2] = Math.sin(angle) * radius + (Math.random() - 0.5) * 0.4;
  }
  return arr;
}

function makeNeuralCore() {
  // dense inner core + sparse outer shell with connection-like jitter
  const arr = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const shell = Math.random() < 0.35;
    const r = shell ? 3.4 + Math.random() * 0.25 : Math.pow(Math.random(), 0.33) * 2.4;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const jitter = shell ? 0.12 : 0.35;
    arr[i * 3] = r * Math.sin(phi) * Math.cos(theta) + (Math.random() - 0.5) * jitter;
    arr[i * 3 + 1] = r * Math.cos(phi) + (Math.random() - 0.5) * jitter;
    arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) + (Math.random() - 0.5) * jitter;
  }
  return arr;
}

function makeTorusKnot() {
  const arr = new Float32Array(COUNT * 3);
  const p = 2, q = 3, R = 2.6, tube = 0.85;
  for (let i = 0; i < COUNT; i++) {
    const t = (i / COUNT) * Math.PI * 2 * p;
    const cx = (R + Math.cos((q / p) * t)) * Math.cos(t);
    const cy = (R + Math.cos((q / p) * t)) * Math.sin(t);
    const cz = Math.sin((q / p) * t);
    const a = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * tube;
    arr[i * 3] = cx + Math.cos(a) * rr;
    arr[i * 3 + 1] = cy * 0.85 + Math.sin(a) * rr;
    arr[i * 3 + 2] = cz * 1.4 + (Math.random() - 0.5) * rr;
  }
  return arr;
}

function makeDataGrid() {
  const arr = new Float32Array(COUNT * 3);
  const side = Math.ceil(Math.sqrt(COUNT));
  for (let i = 0; i < COUNT; i++) {
    const gx = (i % side) / side - 0.5;
    const gz = Math.floor(i / side) / side - 0.5;
    const x = gx * 11;
    const z = gz * 11;
    const y = Math.sin(gx * 14) * Math.cos(gz * 14) * 1.1;
    arr[i * 3] = x;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = z;
  }
  return arr;
}

function makeHelix() {
  const arr = new Float32Array(COUNT * 3);
  const turns = 5, height = 9, R = 2.0;
  for (let i = 0; i < COUNT; i++) {
    const strand = i % 2;
    const isRung = (i % 23) < 4;                      // some particles form rungs
    const t = i / COUNT;
    const angle = t * Math.PI * 2 * turns + strand * Math.PI;
    const y = (t - 0.5) * height;
    if (isRung) {
      const k = Math.random();
      const a0 = t * Math.PI * 2 * turns;
      arr[i * 3] = Math.cos(a0) * R * (k * 2 - 1);
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = Math.sin(a0) * R * (k * 2 - 1);
    } else {
      arr[i * 3] = Math.cos(angle) * R + (Math.random() - 0.5) * 0.18;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = Math.sin(angle) * R + (Math.random() - 0.5) * 0.18;
    }
  }
  return arr;
}

/* ---------- scene ---------- */

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x060807, 0.045);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.2, 11);

/* ---------- geometry: all 5 shapes as attributes ---------- */

const geometry = new THREE.BufferGeometry();
const shapeArrays = [makeGalaxy(), makeNeuralCore(), makeTorusKnot(), makeDataGrid(), makeHelix()];
geometry.setAttribute('position', new THREE.BufferAttribute(shapeArrays[0], 3));
for (let s = 0; s < SHAPES; s++) {
  geometry.setAttribute(`aShape${s}`, new THREE.BufferAttribute(shapeArrays[s], 3));
}
const rand = new Float32Array(COUNT);
for (let i = 0; i < COUNT; i++) rand[i] = Math.random();
geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
window.__loader?.step('geometry');

/* ---------- shader ---------- */

const uniforms = {
  uTime: { value: 0 },
  uMorph: { value: 0 },
  uVel: { value: 0 },                               // scroll velocity from Lenis
  uSize: { value: renderer.getPixelRatio() * 2.2 },
  uColorA: { value: new THREE.Color('#c8ff00') },   // acid
  uColorB: { value: new THREE.Color('#3a5a40') },   // deep moss
  uColorC: { value: new THREE.Color('#e8e6df') },   // bone highlights
};

const material = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `
    attribute vec3 aShape0;
    attribute vec3 aShape1;
    attribute vec3 aShape2;
    attribute vec3 aShape3;
    attribute vec3 aShape4;
    attribute float aRand;
    uniform float uTime;
    uniform float uMorph;
    uniform float uVel;
    uniform float uSize;
    varying float vRand;
    varying float vDepth;
    varying float vVel;

    float ease(float t) { return t * t * (3.0 - 2.0 * t); }

    void main() {
      vRand = aRand;
      vVel = uVel;

      // staggered morph: each particle leads/lags slightly for organic flow
      float lag = (aRand - 0.5) * 0.3;
      float m = uMorph + lag;
      vec3 p = mix(aShape0, aShape1, ease(clamp(m, 0.0, 1.0)));
      p = mix(p, aShape2, ease(clamp(m - 1.0, 0.0, 1.0)));
      p = mix(p, aShape3, ease(clamp(m - 2.0, 0.0, 1.0)));
      p = mix(p, aShape4, ease(clamp(m - 3.0, 0.0, 1.0)));

      // breathing wobble
      float w = uTime * 0.6 + aRand * 6.2831;
      p += vec3(sin(w * 1.3), cos(w * 0.9), sin(w * 1.7)) * 0.045;

      // scroll-velocity turbulence: fast scrolling shakes the field apart
      p += vec3(sin(w * 3.1), cos(w * 2.3), sin(w * 4.7)) * uVel * (0.2 + aRand * 0.6);
      // vertical smear — motion-blur feel in the scroll direction
      p.y += (aRand - 0.5) * uVel * 1.4;

      // slow global rotation
      float rot = uTime * 0.05;
      float c = cos(rot), s = sin(rot);
      p.xz = mat2(c, -s, s, c) * p.xz;

      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
      gl_PointSize = uSize * (0.6 + aRand * 0.9) * (1.0 + uVel * 0.45) * (10.0 / -mv.z);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uColorC;
    varying float vRand;
    varying float vDepth;
    varying float vVel;

    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      if (d > 0.5) discard;
      float glow = 1.0 - smoothstep(0.0, 0.5, d);
      glow = pow(glow, 2.2);

      vec3 col = mix(uColorB, uColorA, smoothstep(0.25, 0.85, vRand));
      col = mix(col, uColorC, step(0.96, vRand));     // rare bone-white sparks
      col += uColorA * vVel * 0.25;                   // hot flash while scrolling fast

      float fade = smoothstep(26.0, 6.0, vDepth);
      gl_FragColor = vec4(col, glow * fade * 0.85);
    }
  `,
});

const points = new THREE.Points(geometry, material);
scene.add(points);

/* ---------- post-processing ---------- */

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.9,    // strength
  0.7,    // radius
  0.05    // threshold
);
composer.addPass(bloom);

// Compile before the first frame so the shader cost lands inside the loader
// instead of stalling the reveal.
renderer.compile(scene, camera);
window.__loader?.step('shaders');

/* ============================================================
   LENIS — smooth scroll drives everything
   ============================================================ */

let scrollTarget = 0;     // morph target (0..SHAPES-1)
let scrollCurrent = 0;
let velTarget = 0;        // |velocity| → shader turbulence
let velSmooth = 0;
let rollTarget = 0;       // signed velocity → camera roll
let rollSmooth = 0;

const progressBar = document.getElementById('scrollProgress');

function applyScrollState(progress, velocity) {
  scrollTarget = progress * (SHAPES - 1);
  velTarget = Math.min(Math.abs(velocity) * 0.02, 1.1);
  rollTarget = THREE.MathUtils.clamp(velocity * 0.001, -0.055, 0.055);
  progressBar.style.transform = `scaleX(${progress})`;
}

let lenis = null;
if (!reducedMotion) {
  lenis = new Lenis({
    lerp: 0.09,            // scroll interpolation — the "weight" of the page
    wheelMultiplier: 1.0,
    touchMultiplier: 1.4,
  });
  lenis.on('scroll', (e) => applyScrollState(e.progress, e.velocity));

  // eased anchor navigation through Lenis instead of native jumps
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, {
        duration: 1.7,
        easing: (t) => 1 - Math.pow(1 - t, 4),       // quartic out — heavy launch, soft landing
      });
    });
  });
} else {
  // native scroll fallback, no velocity effects
  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    applyScrollState(max > 0 ? window.scrollY / max : 0, 0);
  }, { passive: true });
}

/* ---------- mouse parallax ---------- */

const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('pointermove', (e) => {
  mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
  mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
});

/* ---------- render loop (single rAF drives Lenis + GL) ---------- */

const clock = new THREE.Clock();
let painted = false;

function tick(time) {
  lenis?.raf(time);                                  // Lenis needs ms timestamps

  const t = clock.getElapsedTime();
  uniforms.uTime.value = reducedMotion ? 0 : t;

  scrollCurrent += (scrollTarget - scrollCurrent) * 0.06;
  uniforms.uMorph.value = scrollCurrent;

  velSmooth += (velTarget - velSmooth) * 0.08;
  velTarget *= 0.92;                                 // decay when scroll events stop
  uniforms.uVel.value = velSmooth;
  bloom.strength = 0.9 + velSmooth * 0.7;            // bloom pumps with scroll speed

  mouse.x += (mouse.tx - mouse.x) * 0.04;
  mouse.y += (mouse.ty - mouse.y) * 0.04;
  camera.position.x = mouse.x * 1.4;
  camera.position.y = 1.2 - mouse.y * 1.0 - scrollCurrent * 0.15;
  camera.lookAt(0, 0, 0);
  rollSmooth += (rollTarget - rollSmooth) * 0.07;
  camera.rotation.z += rollSmooth;                   // subtle banking on fast scroll

  composer.render();
  if (!painted) { painted = true; window.__loader?.step('frame'); }
  requestAnimationFrame(tick);
}

/* ---------- resize ---------- */

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

/* ============================================================
   DOM LAYER — loader, cursor, reveals, counters, indicator
   ============================================================ */

/* ---------- loader ----------
   Progress is reported from the real milestones above and finished by the
   first painted frame; the controller itself lives in <head> so it survives
   this module failing to load. */

/* ---------- custom cursor ---------- */

const cursor = document.getElementById('cursor');
const ring = document.getElementById('cursorRing');
const ringPos = { x: innerWidth / 2, y: innerHeight / 2 };
let cursorRaf = null;

window.addEventListener('pointermove', (e) => {
  cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%,-50%)`;
  ringPos.tx = e.clientX;
  ringPos.ty = e.clientY;
  if (!cursorRaf) cursorRaf = requestAnimationFrame(ringTick);
});

function ringTick() {
  ringPos.x += ((ringPos.tx ?? ringPos.x) - ringPos.x) * 0.18;
  ringPos.y += ((ringPos.ty ?? ringPos.y) - ringPos.y) * 0.18;
  ring.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px) translate(-50%,-50%)`;
  cursorRaf = requestAnimationFrame(ringTick);
}

document.querySelectorAll('a, button, .project').forEach((el) => {
  el.addEventListener('pointerenter', () => ring.classList.add('hovering'));
  el.addEventListener('pointerleave', () => ring.classList.remove('hovering'));
});

/* ---------- magnetic elements ---------- */

document.querySelectorAll('[data-magnetic]').forEach((el) => {
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${dx * 0.25}px, ${dy * 0.25}px)`;
  });
  el.addEventListener('pointerleave', () => {
    el.style.transform = '';
    el.style.transition = 'transform 0.5s cubic-bezier(0.16,1,0.3,1)';
    setTimeout(() => (el.style.transition = ''), 500);
  });
});

/* ---------- project card glow follows mouse ---------- */

document.querySelectorAll('.project').forEach((card) => {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  });
});

/* ---------- scroll reveals ---------- */

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

/* ---------- animated counters ---------- */

const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = el.dataset.count;
      counterObserver.unobserve(el);
      if (isNaN(Number(target))) return;            // skip ∞
      const end = Number(target);
      const start = performance.now();
      const dur = 1400;
      function step(now) {
        const k = Math.min((now - start) / dur, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  },
  { threshold: 0.6 }
);
document.querySelectorAll('[data-count]').forEach((el) => counterObserver.observe(el));

/* ---------- section indicator ---------- */

const indicatorNum = document.getElementById('indicatorNum');
const panels = [...document.querySelectorAll('.panel')];
const panelObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const idx = panels.indexOf(entry.target) + 1;
        indicatorNum.textContent = String(idx).padStart(2, '0');
      }
    });
  },
  { threshold: 0.5 }
);
panels.forEach((p) => panelObserver.observe(p));

/* ---------- easter egg ---------- */

console.log(
  '%cOBSIDIAN OBSERVATORY %c\n15,000 particles · 5 shapes · 1 shader · smooth by Lenis\ngithub.com/pranav-pradeesh',
  'font-family:monospace;font-size:16px;color:#c8ff00;font-weight:bold',
  'font-family:monospace;color:#8a8d86'
);

requestAnimationFrame(tick);
