/* ============================================================
   PORTRAIT SAMPLER — turns a photograph into a particle cloud
   ------------------------------------------------------------
   The subject is separated from the backdrop by colour distance
   rather than brightness, so a dark-clothed subject on a light
   studio background survives (a luminance threshold would keep
   the backdrop and throw away the person).

   Returns positions centred on the world origin plus a per
   particle luminance used by the shader for colour and alpha.
   ============================================================ */

const WORK_MAX = 480;          // sampling resolution — detail vs. cost
const BG_TOLERANCE = 0.16;     // colour distance that counts as "not backdrop"
const BG_SOFT = 0.30;          // fully-subject beyond this distance

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:\/\//i.test(src) && !src.startsWith(location.origin)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`portrait: could not load ${src}`));
    img.src = src;
  });
}

function readPixels(img) {
  const scale = Math.min(1, WORK_MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(2, Math.round(img.naturalWidth * scale));
  const h = Math.max(2, Math.round(img.naturalHeight * scale));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h };
}

/* Backdrop colour taken from the four corner patches — in a portrait
   crop those are backdrop even when the subject reaches the bottom edge. */
function estimateBackdrop(data, w, h) {
  const px = Math.max(2, Math.round(Math.min(w, h) * 0.06));
  const corners = [[0, 0], [w - px, 0], [0, h - px], [w - px, h - px]];
  const samples = [[], [], []];
  for (const [ox, oy] of corners) {
    for (let y = oy; y < oy + px; y++) {
      for (let x = ox; x < ox + px; x++) {
        const i = (y * w + x) * 4;
        samples[0].push(data[i]);
        samples[1].push(data[i + 1]);
        samples[2].push(data[i + 2]);
      }
    }
  }
  return samples.map((ch) => {
    ch.sort((a, b) => a - b);
    return ch[ch.length >> 1] / 255;      // median resists a stray corner object
  });
}

function luminance(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * @param {object}  opts
 * @param {string}  opts.src     image url
 * @param {number}  opts.count   particles to place (exact)
 * @param {number}  opts.height  world height of the subject
 * @param {number}  opts.depth   bas-relief depth driven by luminance
 * @returns {Promise<{positions: Float32Array, lum: Float32Array}>}
 */
export async function samplePortrait({ src, count, height = 9.2, depth = 0.6 }) {
  const img = await loadImage(src);
  const { data, w, h } = readPixels(img);      // throws SecurityError if tainted
  const [bgR, bgG, bgB] = estimateBackdrop(data, w, h);

  const n = w * h;
  const mask = new Float32Array(n);
  const lum = new Float32Array(n);

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = data[p] / 255, g = data[p + 1] / 255, b = data[p + 2] / 255;
    const dr = r - bgR, dg = g - bgG, db = b - bgB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db) / Math.SQRT2;
    const t = (dist - BG_TOLERANCE) / (BG_SOFT - BG_TOLERANCE);
    mask[i] = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    lum[i] = luminance(data[p], data[p + 1], data[p + 2]);
  }

  /* Edge magnitude biases particles toward features — jawline, eyes,
     folds in a sleeve — so the face reads at a low particle budget. */
  const weight = new Float32Array(n);
  let total = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (mask[i] <= 0) continue;
      const gx = lum[i + 1] - lum[i - 1];
      const gy = lum[i + w] - lum[i - w];
      const edge = Math.min(1, Math.sqrt(gx * gx + gy * gy) * 3.2);
      const wgt = mask[i] * (0.55 + 0.45 * edge);
      weight[i] = wgt;
      total += wgt;
    }
  }
  if (total <= 0) throw new Error('portrait: no subject found against the backdrop');

  /* Subject bounds, so framing is driven by the person and not by
     however much headroom the photograph happens to have. */
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] < 0.5) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const boxW = Math.max(1, maxX - minX);
  const boxH = Math.max(1, maxY - minY);
  const unit = height / boxH;                 // world units per working pixel
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  /* Inverse-CDF sampling gives exactly `count` particles distributed by weight. */
  const cdf = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += weight[i];
    cdf[i] = acc;
  }

  const positions = new Float32Array(count * 3);
  const outLum = new Float32Array(count);

  for (let k = 0; k < count; k++) {
    const target = Math.random() * acc;
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const px = lo % w;
    const py = (lo / w) | 0;

    // jitter inside the pixel so the sampling grid never shows through
    const jx = px + Math.random() - 0.5;
    const jy = py + Math.random() - 0.5;

    positions[k * 3] = (jx - cx) * unit;
    positions[k * 3 + 1] = -(jy - cy) * unit;          // image y grows downward
    outLum[k] = lum[lo];
  }

  /* Stretch the subject's own luminance range across the full palette.
     Without this a subject in dark clothes lands entirely in the darkest
     stop and disappears against the page — the backdrop, which would have
     supplied the bright end, has already been masked away. */
  const ranked = Float32Array.from(outLum).sort();
  const black = ranked[Math.floor(count * 0.04)];
  const white = ranked[Math.floor(count * 0.985)];
  const span = Math.max(0.08, white - black);
  for (let k = 0; k < count; k++) {
    const norm = Math.min(1, Math.max(0, (outLum[k] - black) / span));
    outLum[k] = Math.pow(norm, 0.75);                  // lift the midtones
    // bas-relief: lit surfaces sit nearer the camera
    positions[k * 3 + 2] = (outLum[k] - 0.5) * depth + (Math.random() - 0.5) * 0.14;
  }

  return { positions, lum: outLum, aspect: boxW / boxH };
}
