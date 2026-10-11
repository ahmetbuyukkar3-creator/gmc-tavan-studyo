// GMC Tavan Stüdyo · Kuyumcu vitrini modülü (saf hesap, DOM yok; node ile de test edilir)
// 1) Yerleşim önerisi: gmcled.com'daki "Kuyumcu Vitrin LED Tasarım Stüdyosu" (gmc-kuyumcu v0.3.0) ile birebir aynı hesap.
// 2) Ölçüyle kesin kalibrasyon: ışıkların takılacağı tavan bilinen G × D dikdörtgen; 4 köşeden kamera konumu,
//    yönü ve lens hesaplanır (tavan alttan eğik görüldüğü için lens fotoğraftan iyi belirlenir).

/* ---------------- küçük vektör yardımcıları ---------------- */
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a); return l > 1e-12 ? mul(a, 1 / l) : [0, 0, 0]; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function nelderMead(fn, x0, step, iters = 400) {
  const n = x0.length;
  let P = [x0, ...x0.map((_, i) => x0.map((v, j) => v + (i === j ? step[j] : 0)))].map(x => ({ x, v: fn(x) }));
  for (let it = 0; it < iters; it++) {
    P.sort((a, b) => a.v - b.v);
    const c = Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += P[i].x[j] / n;
    const w = P[n], lerp = t => c.map((cj, j) => cj + t * (w.x[j] - cj));
    const r = lerp(-1), rv = fn(r);
    if (rv < P[0].v) { const e = lerp(-2), ev = fn(e); P[n] = ev < rv ? { x: e, v: ev } : { x: r, v: rv }; }
    else if (rv < P[n - 1].v) P[n] = { x: r, v: rv };
    else { const k = lerp(.5), kv = fn(k); if (kv < w.v) P[n] = { x: k, v: kv }; else P = P.map((p, i) => i ? { x: p.x.map((v, j) => P[0].x[j] + (v - P[0].x[j]) / 2), v: 0 } : p).map(p => ({ x: p.x, v: fn(p.x) })); }
  }
  P.sort((a, b) => a.v - b.v);
  return P[0];
}

/* ---------------- 1) yerleşim (sitedeki araçla aynı) ---------------- */
// Ölçüler cm. Sitede ETNA 26 = 34 × 18 cm; yön '0': uzun kenar vitrin genişliği boyunca, '1': derinlik boyunca.
export const LIMITS = { width: [40, 1000], depth: [25, 300], height: [60, 400], table: [0, 350], cols: [1, 30], rows: [1, 10] };
export function foot(prod, rot) { return rot === '1' ? [prod.widthCm, prod.lengthCm] : [prod.lengthCm, prod.widthCm]; }
export const maxByGap = (dim, item, gap, max) => Math.max(1, Math.min(max, Math.floor((dim - gap) / (item + gap))));
export function arrangement(v, prod, cols, rows, label, desc) {
  const [a, b] = foot(prod, v.rot);
  cols = Math.max(1, Math.min(30, cols)); rows = Math.max(1, Math.min(10, rows));
  const gx = (v.width - cols * a) / (cols + 1), gz = (v.depth - rows * b) / (rows + 1);
  if (gx < 0 || gz < 0) return null;
  return { cols, rows, label, desc, count: cols * rows, gx, gz };
}
// Ferah / Önerilen / Yoğun (yaklaşık 8 cm ve 4 cm boşluk). Cam önü montajda tek sıra.
export function suggestions(v, prod) {
  if (v.width < 40 || v.width > 1000 || v.depth < 25 || v.depth > 300) return [];
  const [a, b] = foot(prod, v.rot), one = v.place !== 'ic';   // cam önü ve banko üstü: tek sıra
  const rc = maxByGap(v.width, a, 8, 30), rr = one ? 1 : maxByGap(v.depth, b, 8, 10);
  const dc = maxByGap(v.width, a, 4, 30), dr = one ? 1 : maxByGap(v.depth, b, 4, 10);
  const out = [];
  const airy = arrangement(v, prod, Math.max(1, rc - 1), one ? 1 : Math.max(1, rr - 1), 'Daha ferah', 'Daha geniş ürün aralıkları');
  const rec = arrangement(v, prod, rc, rr, 'Önerilen', 'Ölçüye göre dengeli yerleşim');
  const dense = arrangement(v, prod, dc, dr, 'Daha yoğun', 'Vitrinde daha fazla ürün');
  [airy, rec, dense].forEach(o => { if (o && !out.some(x => x.cols === o.cols && x.rows === o.rows)) out.push(o); });
  return out;
}
// Sitedeki doğrulama mesajlarıyla aynı
export function validate(v, prod) {
  if (v.place === 'banko') {                                // banko üstü: vitrin tavanı yok; mağaza tavanı bankonun üstünde
    for (const k of ['width', 'depth', 'table', 'cols']) { const [lo, hi] = LIMITS[k]; if (!Number.isFinite(v[k]) || v[k] < lo || v[k] > hi) return 'Lütfen ölçü ve adet alanlarına belirtilen aralıkta değer girin.'; }
    if (!Number.isInteger(v.cols)) return 'Ürün adedi tam sayı olmalıdır.';
    if (!(v.store >= v.table + 60)) return 'Mağaza tavanı bankodan en az 60 cm yüksek olmalı.';
    if (!(Math.abs(v.off || 0) <= 200)) return 'Bankonun ortasından uzaklık en fazla 200 cm olabilir.';
    if (!arrangement(v, prod, v.cols, 1)) return 'Bu düzen bankoya sığmıyor. Adedi azaltın, yönü değiştirin veya otomatik yerleştirin.';
    return '';
  }
  for (const k of ['width', 'depth', 'height', 'table', 'cols', 'rows']) {
    const [lo, hi] = LIMITS[k];
    if (!Number.isFinite(v[k]) || v[k] < lo || v[k] > hi) return 'Lütfen ölçü ve adet alanlarına belirtilen aralıkta değer girin.';
  }
  if (!Number.isInteger(v.cols) || !Number.isInteger(v.rows)) return 'Ürün ve sıra adetleri tam sayı olmalıdır.';
  if (v.table >= v.height - 30) return 'Tabla ile vitrin tavanı arasında en az 30 cm bırakın.';
  if (!arrangement(v, prod, v.cols, v.place === 'onu' ? 1 : v.rows)) return 'Bu düzen vitrine sığmıyor. Adedi azaltın, yönü değiştirin veya otomatik yerleştirin.';
  if (v.place === 'onu' && !(v.store >= v.height + 5)) return 'Mağaza tavanı vitrin tavanından yüksek olmalı.';
  return '';
}
// Ürün merkezleri, metre. x: tavanın sol kenarından; z: tavanın arka kenarından (vitrin tarafı) sana doğru.
export function positions(v, prod) {
  const one = v.place !== 'ic', o = arrangement(v, prod, v.cols, one ? 1 : v.rows); if (!o) return [];
  const [a, b] = foot(prod, v.rot), out = [];
  // cam önü: tavanın arka kenarı (cam) + uzaklık; banko: bankonun ortası + tavandaki kaydırma (mağaza tavanında)
  const z1 = v.place === 'banko' ? (v.depth / 2 + (v.off || 0)) / 100 : one ? v.front / 100 : null;
  for (let r = 0; r < o.rows; r++) for (let c = 0; c < o.cols; c++)
    out.push([(o.gx + a / 2 + c * (a + o.gx)) / 100, one ? z1 : (o.gz + b / 2 + r * (b + o.gz)) / 100]);
  return out;
}

/* ---------------- 2) ölçüyle kalibrasyon ---------------- */
function solveLin(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const k = M[r][c] / M[c][c]; for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
// Düzlem (u, v) -> görüntü (x, y), 4 nokta
export function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [u, v] = src[i], [x, y] = dst[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
  }
  const h = solveLin(A, b);
  return h && [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
}
// Eksen-açı döndürmesi (Rodrigues)
function rotv(v, w) {
  const th = len(w); if (th < 1e-12) return v;
  const k = mul(w, 1 / th), c = Math.cos(th), s = Math.sin(th);
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
}
function poseFromH(Hm, f) {
  const col = j => [Hm[0][j] / f, Hm[1][j] / f, Hm[2][j]];
  const a1 = col(0), a2 = col(1), a3 = col(2);
  let l = 2 / (len(a1) + len(a2)); if (a3[2] * l < 0) l = -l;
  const r1 = norm(mul(a1, l)), r2 = norm(sub(mul(a2, l), mul(r1, dot(mul(a2, l), r1))));
  return { r1, r2, r3: cross(r1, r2), t: mul(a3, l) };
}

/* Tavandan kalibrasyon. Kullanıcı ışıkların takılacağı tavanın 4 köşesini işaretler.
   Kamera koordinatı: x sağ, y aşağı, z ileri; görüntü merkezi asal nokta.
   Dünya: x tavan genişliği (sol 0), y yukarı (tavan y = H), z arka kenardan (vitrin tarafı, 0) sana doğru (ön kenar z = D).
   corners: {TL: sol arka, TR: sağ arka, BR: sağ ön, BL: sol ön} görüntü pikseli.
   W: ölçülen genişlik (kesin). D: ölçülen derinlik; fixD ise kesin kabul edilir, değilse fotoğraftan hesaplanır.
   fPrior: lens tahmini (piksel); fixedF: lens sabit (kullanıcı elle verdi). */
export function calibrateCeiling({ corners, imgW, imgH, W, D, H, fixD = true, fPrior, fixedF, iters = 700, depthErr = false }) {
  const L = Math.max(imgW, imgH), cx = imgW / 2, cy = imgH / 2;
  const img = ['TL', 'TR', 'BR', 'BL'].map(k => corners[k]);
  const planeOf = d => [[0, 0], [W, 0], [W, d], [0, d]];      // (x, z)
  const Hm = homography(planeOf(D), img.map(([x, y]) => [x - cx, y - cy]));
  if (!Hm) return null;
  const p0 = poseFromH(Hm, fPrior);
  if (!(p0.t[2] > 0)) return null;
  const R0 = [p0.r1, p0.r2], t0 = p0.t, ts = Math.max(.05, len(t0));
  // x: [döndürme 3, öteleme 3, log lens, log derinlik]
  const unpack = x => ({ r1: rotv(R0[0], [x[0], x[1], x[2]]), r2: rotv(R0[1], [x[0], x[1], x[2]]),
    t: [t0[0] + x[3] * ts, t0[1] + x[4] * ts, t0[2] + x[5] * ts],
    f: fPrior * Math.exp(x[6] || 0), d: D * Math.exp(x[7] || 0) });      // sabit olanlar için çağıran 0 verir
  const dataCost = q => {
    let e = 0; const pl = planeOf(q.d);
    for (let i = 0; i < 4; i++) {
      const c = add(add(mul(q.r1, pl[i][0]), mul(q.r2, pl[i][1])), q.t);
      if (c[2] < .05) return 1e3;
      const dx = cx + q.f * c[0] / c[2] - img[i][0], dy = cy + q.f * c[1] / c[2] - img[i][1];
      e += (dx * dx + dy * dy) / (L * L);
    }
    return e;
  };
  // Zayıf ön bilgiler: lens (EXIF / 26 mm) ve derinlik (girilen). Fotoğraf belirliyorsa veri baskın gelir.
  const PRIOR = 2e-6;
  const solve = (fixF, fixDD) => {
    const cost = x => {
      const q = unpack([...x.slice(0, 6), fixF ? 0 : x[6], fixDD ? 0 : x[7]]);
      if (q.f < .25 * L || q.f > 2.5 * L || q.d < .05) return 1e3;
      return dataCost(q) + (fixF ? 0 : PRIOR * x[6] ** 2) + (fixDD ? 0 : PRIOR * x[7] ** 2);
    };
    const step = [.03, .03, .03, .03, .03, .03, .15, .15];
    let best = nelderMead(cost, Array(8).fill(0), step, iters);
    best = nelderMead(cost, best.x, step.map(v => v / 4), iters);
    return { x: [...best.x.slice(0, 6), fixF ? 0 : best.x[6], fixDD ? 0 : best.x[7]], v: best.v };
  };
  const best = solve(fixedF, fixD), q = unpack(best.x);
  // Lens fotoğraftan belirlendi mi? Lensi %25 değiştirip yeniden uydur; hata belirgin artıyorsa evet.
  let lensFromPhoto = false;
  if (!fixedF) {
    const lf = best.x[6] + Math.log(1.25);
    const c2 = x => dataCost(unpack([...x, lf, best.x[7]]));
    const alt = nelderMead(c2, best.x.slice(0, 6), [.015, .015, .015, .015, .015, .015], iters);
    lensFromPhoto = Math.sqrt(alt.v / 4) * L - Math.sqrt(dataCost(q) / 4) * L > 1.5;
  }
  // Kontrol: derinlik serbest bırakılınca fotoğraf kaç cm diyor? (sadece lens fotoğraftan belirliyse anlamlı)
  let photoD = null, photoDerr = null;
  if (fixD && (lensFromPhoto || fixedF)) {
    const fr = solve(fixedF, false); photoD = D * Math.exp(fr.x[7]);
    // Güvenilirlik (isteğe bağlı, ~1 sn): her köşe koordinatı 1 px oynatılır, türevden 2 px işaretleme hatasının etkisi.
    // Blender test sahnesinde: banko ±1,3 cm (gerçek dağılım 1,0), önden vitrin ±22 cm (gerçek 14,6).
    if (depthErr) {
      const img0 = img.map(p => [...p]); let s2 = 0;
      for (let i = 0; i < 4; i++) for (let a = 0; a < 2; a++) {
        img[i] = [...img0[i]]; img[i][a] += 1;
        const r2 = solve(fixedF, false); s2 += (2 * (D * Math.exp(r2.x[7]) - photoD)) ** 2;
        img[i] = [...img0[i]];
      }
      photoDerr = Math.sqrt(s2);
    }
  }
  const ex = q.r1, n3 = q.r2, up = cross(n3, ex);             // y = z × x
  // project(): kamera = ex*(x+xL) + up*(y+yF) + n*(z+z0); tavan köşesi (0, H, 0) kamerada t'ye denk
  const tc = sub(q.t, mul(up, H));
  const xL = dot(tc, ex), yF = dot(tc, up), z0 = dot(tc, n3);
  const cam = [-xL, -yF, -z0];
  return { f: q.f, ex, up, n: n3, xL, yF, z0, cam, D: q.d, rms: Math.sqrt(dataCost(q) / 4) * L, lensFromPhoto, photoD, photoDerr };
}

// Görüntü pikseli -> dünya noktası (doğrulama ve sentetik çizim için)
export function projectWith(c, X, imgW, imgH) {
  const a = X[0] + c.xL, b = X[1] + c.yF, z = X[2] + c.z0;
  const v = [c.ex[0] * a + c.up[0] * b + c.n[0] * z, c.ex[1] * a + c.up[1] * b + c.n[1] * z, c.ex[2] * a + c.up[2] * b + c.n[2] * z];
  if (v[2] < .02) return null;
  return [imgW / 2 + c.f * v[0] / v[2], imgH / 2 + c.f * v[1] / v[2]];
}

// Göz noktası + bakılan nokta -> project() ile uyumlu kamera (sentetik vitrin görseli için)
export function lookAtCam(eye, target, f) {
  const fwd = norm(sub(target, eye)), right = norm(cross(fwd, [0, 1, 0])), down = cross(fwd, right);
  const ex = [right[0], down[0], fwd[0]], up = [right[1], down[1], fwd[1]], n = [right[2], down[2], fwd[2]];
  const tc = [-dot(right, eye), -dot(down, eye), -dot(fwd, eye)];
  return { f, ex, up, n, xL: dot(tc, ex), yF: dot(tc, up), z0: dot(tc, n), cam: [...eye] };
}
