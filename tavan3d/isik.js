// GMC Tavan Stüdyo · ışık ölçümü (saf hesap, DOM yok; node ile de test edilir)
// Uygulamadaki ışık modeliyle aynı: her kaynak bir konum, yön, şiddet (cd) ve yumuşak kenarlı koni.
// Şiddet, kaynağın akısı katalogdaki lümene birebir eşit olacak şekilde hesaplanır; yüzeydeki aydınlık (lüks) = cd · profil · cos / d².

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Kaynağın açısal profili: ct = ışık yönüyle aradaki açının kosinüsü. c0 → c1 yumuşak kenar, k: kosinüs üssü (1 = düz yüzey ışığı).
export function profile(ct, c0, c1, k) {
  if (ct <= 0) return 0;
  return (c1 > c0 ? smooth(c0, c1, ct) : 1) * (k ? Math.pow(ct, k) : 1);
}
// Katalogdaki ışın açısı (yarı şiddet açısı): kenarda şiddet tam %50 olacak şekilde yumuşak kenarlı koni [c0, c1] (kosinüs).
// İç kenar 0,55 × yarım açı; dış kenar, smoothstep ortası tam yarım açıya düşecek şekilde hesaplanır.
export function beamCone(deg) {
  const h = deg / 2 * Math.PI / 180, c1 = Math.cos(h * .55), c0 = Math.max(-1, 2 * Math.cos(h) - c1);
  return [c0, c1];
}
// Profilin küre üzerindeki integrali (steradyan). Akı = cd × bu değer. dΩ = 2π · d(cosθ) olduğu için 0..1 aralığında integral yeter.
const memo = new Map();
export function solidAngle(c0, c1, k) {
  const key = c0.toFixed(6) + '|' + c1.toFixed(6) + '|' + k;
  if (memo.has(key)) return memo.get(key);
  const n = 4000; let s = 0;
  for (let i = 0; i <= n; i++) { const u = i / n, w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2; s += w * profile(u, c0, c1, k); }
  const v = 2 * Math.PI * s / (3 * n);
  memo.set(key, v);
  return v;
}
// Verilen lümen için şiddet (cd)
export const candela = (lumen, c0, c1, k) => lumen / solidAngle(c0, c1, k);

// Bir noktadaki aydınlık (lx). em: {p:[x,y,z], d:[x,y,z] birim yön, cd, c0, c1, k}. N: yüzey normali.
// pass(em, P): ışığın noktaya ulaşma oranı (0-1): engel / cam geçirgenliği için.
export function illuminance(ems, P, N = [0, 1, 0], pass = null) {
  let E = 0;
  for (const e of ems) {
    const lx = e.p[0] - P[0], ly = e.p[1] - P[1], lz = e.p[2] - P[2];
    const d2 = lx * lx + ly * ly + lz * lz; if (d2 < 1e-6) continue;
    const inv = 1 / Math.sqrt(d2), Lx = lx * inv, Ly = ly * inv, Lz = lz * inv;
    const cosS = N[0] * Lx + N[1] * Ly + N[2] * Lz; if (cosS <= 0) continue;
    const ct = -(Lx * e.d[0] + Ly * e.d[1] + Lz * e.d[2]); if (ct <= 0) continue;
    const pr = profile(ct, e.c0, e.c1, e.k); if (!pr) continue;
    const t = pass ? pass(e, P) : 1; if (!t) continue;
    E += e.cd * pr * cosS / d2 * t;
  }
  return E;
}

// Yatay bir yüzeyde (y sabit) ızgara: ortalama, en düşük, en yüksek, düzgünlük. Hücre merkezleri örneklenir.
export function luxGrid(ems, { x0, x1, z0, z1, y }, step, pass = null) {
  const nx = Math.max(2, Math.round((x1 - x0) / step)), nz = Math.max(2, Math.round((z1 - z0) / step));
  const vals = new Float32Array(nx * nz);
  let sum = 0, min = Infinity, max = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const P = [x0 + (i + .5) / nx * (x1 - x0), y, z0 + (j + .5) / nz * (z1 - z0)];
    const E = illuminance(ems, P, [0, 1, 0], pass);
    vals[j * nx + i] = E; sum += E; if (E < min) min = E; if (E > max) max = E;
  }
  const avg = sum / vals.length;
  return { nx, nz, vals, avg, min, max, u0: avg > 0 ? min / avg : 0, rect: { x0, x1, z0, z1, y } };
}

// Isı haritası renk ölçeği (lüks). Vitrin ve oda için ayrı aralık; aynı aralık hep aynı renk.
export const SCALE = {
  vitrin: [[0, '#140b34'], [1000, '#420a68'], [2500, '#6a176e'], [5000, '#932667'], [7500, '#bc3754'], [10000, '#dd513a'], [15000, '#f37819'], [20000, '#fca50a'], [30000, '#f6d746'], [50000, '#fcffa4']],
  oda: [[0, '#140b34'], [25, '#420a68'], [50, '#6a176e'], [100, '#932667'], [150, '#bc3754'], [200, '#dd513a'], [300, '#f37819'], [500, '#fca50a'], [750, '#f6d746'], [1000, '#fcffa4']],
};
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export function luxColor(E, scale) {
  if (E <= scale[0][0]) return hex(scale[0][1]);
  for (let i = 1; i < scale.length; i++) if (E <= scale[i][0]) {
    const [a, ca] = scale[i - 1], [b, cb] = scale[i], t = (E - a) / (b - a), A = hex(ca), B = hex(cb);
    return A.map((v, k) => Math.round(v + (B[k] - v) * t));
  }
  return hex(scale[scale.length - 1][1]);
}
