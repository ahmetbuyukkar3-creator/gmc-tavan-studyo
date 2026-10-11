// GMC Tavan Stüdyo · ölçüsü bilinen kutuyu fotoğraftaki gövde maskesine oturtma (saf hesap, DOM yok; node ile de test edilir)
// Dokun-seç: kullanıcı bankonun (ya da vitrin alt dolabının) herhangi bir yerine dokunur, yapay zekâ gövdenin maskesini verir.
// Uzunluk × derinlik × yükseklik bilinen kutunun görüntüdeki dış hattı (6 köşeli) maskenin dış hattına oturana kadar kamera aranır.
// Sonuç: üst yüzün 4 köşesi (uygulamanın TL/TR/BR/BL sırası) + kamera; köşeler bugünkü işaretleme akışına aynen girer.
import { component, boundary, hull } from './dortgen.js';
import { nelderMead } from './vitrin.js';

const cross2 = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
function rot(v, w) {                                       // Rodrigues
  const th = Math.hypot(w[0], w[1], w[2]); if (th < 1e-12) return v;
  const k = [w[0] / th, w[1] / th, w[2] / th], c = Math.cos(th), s = Math.sin(th), kv = crs(k, v), d = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d];
}

// Dünya: x 0..W (uzunluk, soldan), y 0..Hb (yerden yukarı), z 0..D (arka kenar 0, müşteri tarafı D)
export function boxCorners(W, D, Hb) {
  const P = []; for (const y of [0, Hb]) for (const z of [0, D]) for (const x of [0, W]) P.push([x, y, z]); return P;
}
// p = [yatay açı, yükseklik açısı, log uzaklık, döndürme 3, log lens]; kamera kutu merkezine bakar, sonra küçük döndürme
export function camOf(p, W, D, Hb, f0) {
  const C = [W / 2, Hb / 2, D / 2], d = Math.exp(p[2]), ce = Math.cos(p[1]);
  const eye = [C[0] + d * ce * Math.sin(p[0]), C[1] + d * Math.sin(p[1]), C[2] + d * ce * Math.cos(p[0])];
  let fwd = nrm(sub(C, eye)), right = nrm(crs(fwd, [0, 1, 0])), down = crs(fwd, right);
  const w = [p[3], p[4], p[5]]; fwd = rot(fwd, w); right = rot(right, w); down = rot(down, w);
  return { eye, fwd, right, down, f: f0 * Math.exp(p[6] || 0) };
}
export function project(cam, X, cx, cy) {
  const v = sub(X, cam.eye), z = dot(v, cam.fwd);
  if (z < .05) return null;
  return [cx + cam.f * dot(v, cam.right) / z, cy + cam.f * dot(v, cam.down) / z];
}

// Çokgen kenarı üzerinde yaklaşık her `step` pikselde bir nokta
function sampleEdges(P, step) {
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}
function distToPoly(p, P) {
  let best = Infinity;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], ex = b[0] - a[0], ey = b[1] - a[1], L2 = ex * ex + ey * ey;
    const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / L2)) : 0;
    const d = Math.hypot(p[0] - a[0] - t * ex, p[1] - a[1] - t * ey); if (d < best) best = d;
  }
  return best;
}

// Kapalı çokgeni sadeleştir (Douglas–Peucker, tol piksel): dış hat yüzlerce merdiven köşesinden birkaç düz kenara iner
function simplify(P, tol) {
  if (P.length < 5) return P;
  let far = 0, fd = -1; for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[0][0], P[i][1] - P[0][1]); if (d > fd) { fd = d; far = i; } }
  const dp = (A) => {
    if (A.length < 3) return A;
    const a = A[0], b = A[A.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let k = -1, kd = tol; for (let i = 1; i < A.length - 1; i++) { const d = Math.abs((b[0] - a[0]) * (a[1] - A[i][1]) - (a[0] - A[i][0]) * (b[1] - a[1])) / L; if (d > kd) { kd = d; k = i; } }
    return k < 0 ? [a, b] : dp(A.slice(0, k + 1)).slice(0, -1).concat(dp(A.slice(k)));
  };
  const A = dp(P.slice(0, far + 1)), B = dp(P.slice(far).concat([P[0]]));
  return A.slice(0, -1).concat(B.slice(0, -1));
}

// Ana fonksiyon. mask: Uint8Array (w*h); seed: dokunulan piksel; W, D, Hb metre; fPrior piksel; fixedF lens sabit mi.
// Dönen: { corners:{TL,TR,BR,BL}, cam, f, err (px, dış hat uyumu), sil (oturan dış hat) } ya da null
// Görünen yüzler: dış hat üst yüzün derinliğini zayıf belirler (yakın üst kenar dış hatta değil). Bu yüzden her görünen yüzün
// (taş üst, ahşap ön, yan) fotoğrafta kendi içinde tek renk olması istenir: yüzler arasındaki sınır, renklerin ayrıldığı yere oturur.
// Tek bir 'en güçlü çizgi' aramaktan sağlamdır (tepsi kenarı, tabla kalınlığı gibi yakındaki başka çizgilere kapılmaz).
// Köşe sırası boxCorners: i = y*4 + z*2 + x. Yüz: [eksen, 0/1]
const FACES = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]];
const bitOf = (i, ax) => ax === 0 ? i & 1 : ax === 2 ? (i >> 1) & 1 : (i >> 2) & 1;
export function visibleFaces(eye, W, D, Hb) {
  const S = [W, Hb, D], out = [];
  for (const [ax, v] of FACES) {
    if (!(v ? eye[ax] > S[ax] : eye[ax] < 0)) continue;
    const [a1, a2] = [0, 1, 2].filter(k => k !== ax), id = (u, w) => { let i = 0; for (const [k, b] of [[ax, v], [a1, u], [a2, w]]) i |= b << (k === 0 ? 0 : k === 2 ? 1 : 2); return i; };
    out.push([id(0, 0), id(1, 0), id(1, 1), id(0, 1)]);
  }
  return out;
}
export function fitBox({ mask, w, h, seed, W, D, Hb, fPrior, fixedF = true, trunc = 12, rgb = null, regionW = 3000, ps = 2, init = null }) {
  const comp = component(mask, w, h, seed[0], seed[1]);
  let n = 0; for (let i = 0; i < comp.length; i++) n += comp[i]; if (n < 200) return null;
  const MH = simplify(hull(boundary(comp, w, h)), .75), L = Math.max(w, h), cx = w / 2, cy = h / 2;
  const step = L / 250, MS = sampleEdges(MH, step), BX = boxCorners(W, D, Hb);
  // Maske dış hattı ile kutunun dış hattı arasındaki karşılıklı uzaklık (kesik: üstteki takılar/büstler hattı şişirir)
  const sil = cam => { const Q = []; for (const X of BX) { const q = project(cam, X, cx, cy); if (!q) return null; Q.push(q); } return hull(Q); };
  const cost = p => {
    const cam = camOf(p, W, D, Hb, fPrior);
    if (cam.f < .25 * L || cam.f > 2.5 * L || cam.eye[1] < .05) return 1e9;
    const S = sil(cam); if (!S || S.length < 4) return 1e9;
    let e = 0; for (const q of MS) e += Math.min(distToPoly(q, S), trunc) ** 2;
    const SS = sampleEdges(S, step); let e2 = 0; for (const q of SS) e2 += Math.min(distToPoly(q, MH), trunc) ** 2;
    return e / MS.length + e2 / SS.length;
  };
  // Kaba tarama: kutu simetrik (180° döndürünce aynı), yatay açı 0–180 yeter. Uzaklık maske boyuna göre.
  let mx0 = Infinity, mx1 = -Infinity, my0 = Infinity, my1 = -Infinity, mcx = 0, mcy = 0;
  for (const [x, y] of MH) { mx0 = Math.min(mx0, x); mx1 = Math.max(mx1, x); my0 = Math.min(my0, y); my1 = Math.max(my1, y); }
  for (const [x, y] of MS) { mcx += x; mcy += y; } mcx /= MS.length; mcy /= MS.length;
  const msize = Math.hypot(mx1 - mx0, my1 - my0), starts = [];
  for (let az = 0; az < 180; az += 15) for (const el of [10, 25, 40, 55]) {
    const a = az * Math.PI / 180, e = el * Math.PI / 180;
    let p = [a, e, Math.log(4), 0, 0, 0, 0];
    const S = sil(camOf(p, W, D, Hb, fPrior)); if (!S) continue;
    let s0x = Infinity, s1x = -Infinity, s0y = Infinity, s1y = -Infinity;
    for (const [x, y] of S) { s0x = Math.min(s0x, x); s1x = Math.max(s1x, x); s0y = Math.min(s0y, y); s1y = Math.max(s1y, y); }
    const ssize = Math.hypot(s1x - s0x, s1y - s0y); if (!(ssize > 1)) continue;
    p[2] = Math.log(4 * ssize / msize);
    // kutu merkezi görüntü merkezinde; maske merkezine çevir (kamera ekseni etrafında küçük açılar)
    const cam = camOf(p, W, D, Hb, fPrior), ax = Math.atan((mcx - cx) / cam.f), ay = Math.atan((mcy - cy) / cam.f);
    // sağa bakmak: aşağı ekseni etrafında; aşağı bakmak: sağ ekseni etrafında
    const wv = [cam.down[0] * -ax + cam.right[0] * ay, cam.down[1] * -ax + cam.right[1] * ay, cam.down[2] * -ax + cam.right[2] * ay];
    const p2 = [p[0], p[1], p[2], wv[0], wv[1], wv[2], 0];
    starts.push({ p: p2, v: cost(p2) });
  }
  starts.sort((a, b) => a.v - b.v);
  // (init verilmişse tarama atlanır: önceki dış hat sonucundan yalnız ince ayar)
  const free = fixedF ? 6 : 7, stepv = [.08, .06, .08, .03, .03, .03, .1].slice(0, free);
  const wrap = x => fixedF ? [...x, 0] : x;
  let best = init ? { x: init, v: cost(init) } : null;
  for (const s of init ? [] : starts.slice(0, 4)) {
    const fn = x => cost(wrap(x));
    let r = nelderMead(fn, s.p.slice(0, free), stepv, 500);
    r = nelderMead(fn, r.x, stepv.map(v => v / 5), 500);
    if (!best || r.v < best.v) best = { x: wrap(r.x), v: r.v };
  }
  if (!best) return null;
  // İnce ayar: dış hat + yüzlerin renk tekdüzeliği (her ps pikselde bir örnek; rgb 0-255, 3 kanal)
  if (rgb) {
    const regionCost = p => {
      const cam = camOf(p, W, D, Hb, fPrior), F = visibleFaces(cam.eye, W, D, Hb);
      let sse = 0, N = 0;
      for (const face of F) {
        const Q = face.map(i => project(cam, BX[i], cx, cy)); if (Q.some(q => !q)) return 1;
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const [x, y] of Q) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        x0 = Math.max(0, Math.ceil(x0)); y0 = Math.max(0, Math.ceil(y0)); x1 = Math.min(w - 1, x1); y1 = Math.min(h - 1, y1);
        const sg = Math.sign(cross2(Q[0], Q[1], Q[2])) || 1;
        let n = 0, s0 = 0, s1 = 0, s2 = 0, q0 = 0, q1 = 0, q2 = 0;
        for (let y = y0; y <= y1; y += ps) for (let x = x0; x <= x1; x += ps) {
          let ins = true; for (let k = 0; k < 4 && ins; k++) if (sg * cross2(Q[k], Q[(k + 1) % 4], [x, y]) < 0) ins = false;
          if (!ins) continue;
          const j = ((y | 0) * w + (x | 0)) * 3, r = rgb[j] / 255, g = rgb[j + 1] / 255, b = rgb[j + 2] / 255;
          n++; s0 += r; s1 += g; s2 += b; q0 += r * r; q1 += g * g; q2 += b * b;
        }
        if (n) { sse += q0 - s0 * s0 / n + q1 - s1 * s1 / n + q2 - s2 * s2 / n; N += n; }
      }
      return N ? sse / N : 1;
    };
    const fn = x => { const p = wrap(x); return cost(p) + regionW * regionCost(p); };
    const stepv2 = stepv.map(v => v / 5);
    let r = nelderMead(fn, best.x.slice(0, free), stepv2, 400);
    r = nelderMead(fn, r.x, stepv2.map(v => v / 3), 300);
    best = { x: wrap(r.x), v: cost(wrap(r.x)), ve: regionCost(wrap(r.x)) };
  }
  let cam = camOf(best.x, W, D, Hb, fPrior);
  // Müşteri tarafı = kameraya yakın uzun kenar (z = D). Kamera arkadaysa kutuyu 180° çevirerek adlandır.
  const flip = cam.eye[2] < D / 2, T = ([x, y, z]) => flip ? [W - x, y, D - z] : [x, y, z];
  const P = X => project(cam, T(X), cx, cy);
  const corners = { TL: P([0, Hb, 0]), TR: P([W, Hb, 0]), BR: P([W, Hb, D]), BL: P([0, Hb, D]) };
  return { x: best.x, corners, cam, f: cam.f, eyeH: cam.eye[1], err: Math.sqrt(best.v / 2), regionVar: best.ve ?? null, sil: sil(cam), maskHull: MH };
}
