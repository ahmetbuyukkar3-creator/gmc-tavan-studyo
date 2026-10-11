// GMC Tavan Stüdyo · maskeden dörtgen (saf hesap, DOM yok; node ile de test edilir)
// Dokun-seç: yapay zekâ dokunulan yüzeyin maskesini verir (banko üstü, vitrin tavanı). Buradan 4 köşe çıkarılır:
// 1) dokunulan noktayı içeren parça, 2) dış sınırın dışbükey zarfı (üstteki takılar, tepsiler deliği kapatır),
// 3) zarfın içine sığan en büyük dörtgen, 4) her kenar sınır noktalarına doğru olarak oturtulur, köşeler kesişimlerden.

// Dokunulan noktayı içeren bağlı parça (4 komşu). mask: Uint8Array (w*h, 0/1). Dönen: Uint8Array aynı boyut.
export function component(mask, w, h, sx, sy) {
  const out = new Uint8Array(w * h);
  let s = (sy | 0) * w + (sx | 0);
  if (!mask[s]) {                                           // nokta maskenin hemen dışındaysa en yakın maske pikseli
    let best = -1, bd = Infinity;
    for (let y = Math.max(0, sy - 30 | 0); y < Math.min(h, sy + 30 | 0); y++) for (let x = Math.max(0, sx - 30 | 0); x < Math.min(w, sx + 30 | 0); x++)
      if (mask[y * w + x]) { const d = (x - sx) ** 2 + (y - sy) ** 2; if (d < bd) { bd = d; best = y * w + x; } }
    if (best < 0) return out; s = best;
  }
  const st = [s]; out[s] = 1;
  while (st.length) {
    const p = st.pop(), x = p % w, y = (p - x) / w;
    if (x > 0 && mask[p - 1] && !out[p - 1]) { out[p - 1] = 1; st.push(p - 1); }
    if (x < w - 1 && mask[p + 1] && !out[p + 1]) { out[p + 1] = 1; st.push(p + 1); }
    if (y > 0 && mask[p - w] && !out[p - w]) { out[p - w] = 1; st.push(p - w); }
    if (y < h - 1 && mask[p + w] && !out[p + w]) { out[p + w] = 1; st.push(p + w); }
  }
  return out;
}

// Parçanın dış sınır noktaları: her satırın ve her sütunun uç pikselleri
export function boundary(comp, w, h) {
  const pts = [];
  for (let y = 0; y < h; y++) { let a = -1, b = -1; for (let x = 0; x < w; x++) if (comp[y * w + x]) { if (a < 0) a = x; b = x; } if (a >= 0) { pts.push([a, y]); if (b !== a) pts.push([b + 1, y]); } }
  for (let x = 0; x < w; x++) { let a = -1, b = -1; for (let y = 0; y < h; y++) if (comp[y * w + x]) { if (a < 0) a = y; b = y; } if (a >= 0) { pts.push([x, a]); if (b !== a) pts.push([x, b + 1]); } }
  return pts;
}

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
export function hull(pts) {                                // monoton zincir, saat yönünün tersine
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const area2 = (a, b, c) => Math.abs(cross(a, b, c));

// Dışbükey çokgenin içine sığan en büyük alanlı dörtgen (köşeler çokgen köşelerinden). O(n²), n küçük tutulur.
export function maxQuad(H) {
  const n = H.length; if (n < 4) return null;
  let best = null, bv = -1;
  for (let i = 0; i < n; i++) {
    let j = i + 1, l = i + 3;
    for (let k = i + 2; k < n; k++) {
      // i–k köşegeninin bir yanında j (i<j<k), öbür yanında l (k<l<n+i): her biri köşegenden en uzak nokta (alan tek tepeli)
      if (j <= i || j >= k) j = i + 1;
      while (j + 1 < k && area2(H[i], H[j + 1], H[k]) >= area2(H[i], H[j], H[k])) j++;
      if (l <= k || l >= n + i) l = k + 1;
      while (l + 1 < n + i && area2(H[i], H[(l + 1) % n], H[k]) >= area2(H[i], H[l % n], H[k])) l++;
      if (l >= n + i) continue;
      const v = area2(H[i], H[j], H[k]) + area2(H[i], H[l % n], H[k]);
      if (v > bv) { bv = v; best = [H[i], H[j], H[k], H[l % n]]; }
    }
  }
  return best;
}
// Zarfı seyrelt (yakın noktalar birleşsin): hız için
function thin(H, minD) { const out = []; for (const p of H) if (!out.length || Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) >= minD) out.push(p); return out; }

// Noktalara en iyi oturan doğru (toplam en küçük kareler): [nx, ny, c] ile nx*x + ny*y = c
function fitLine(P) {
  let mx = 0, my = 0; for (const [x, y] of P) { mx += x; my += y; } mx /= P.length; my /= P.length;
  let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of P) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
  const th = .5 * Math.atan2(2 * sxy, sxx - syy), dx = Math.cos(th), dy = Math.sin(th), nx = -dy, ny = dx;
  return [nx, ny, nx * mx + ny * my];
}
const meet = (a, b) => { const d = a[0] * b[1] - a[1] * b[0]; return Math.abs(d) < 1e-9 ? null : [(a[2] * b[1] - a[1] * b[2]) / d, (a[0] * b[2] - a[2] * b[0]) / d]; };

// Ana fonksiyon: maske → 4 köşe (sırasız, döngüsel). seed: dokunulan nokta (maske pikselinde).
export function quadFromMask(mask, w, h, seed) {
  const comp = component(mask, w, h, seed[0], seed[1]);
  let n = 0; for (let i = 0; i < comp.length; i++) n += comp[i]; if (n < 50) return null;
  const B = boundary(comp, w, h), Hf = hull(B), H = thin(Hf, Math.max(2, Math.hypot(w, h) / 300));
  const q = maxQuad(H); if (!q) return null;
  // İnce ayar: her kenara, zarf üstünde o kenarın orta %70'ine düşen ve kenara yakın sınır noktalarıyla doğru oturt
  const lines = [];
  for (let e = 0; e < 4; e++) {
    const a = q[e], b = q[(e + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 5) return { corners: q, area: n };
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, tol = Math.max(2, L * .03);
    const P = Hf.concat(B).filter(([x, y]) => { const t = (x - a[0]) * ux + (y - a[1]) * uy, d = Math.abs(-(x - a[0]) * uy + (y - a[1]) * ux); return t > L * .15 && t < L * .85 && d < tol; });
    lines.push(P.length >= 6 ? fitLine(P) : null);
  }
  const corners = q.map((c, i) => { const A = lines[(i + 3) % 4], Bq = lines[i]; if (!A || !Bq) return c; const m = meet(A, Bq); return m && Math.hypot(m[0] - c[0], m[1] - c[1]) < Math.hypot(w, h) * .05 ? m : c; });
  return { corners, area: n };
}

// Kenarları fotoğraftaki gerçek çizgiye yapıştır: her kenar boyunca örnek noktalardan dik doğrultuda ±r px içinde
// en güçlü parlaklık geçişi aranır (kenarın beklenen yönüne göre), bu noktalara sağlam doğru oturtulur, köşeler kesişimden.
// gray: Float32Array (w*h, 0-1). İki tur yapılır; doğru bulunamayan kenar olduğu gibi kalır.
export function snapToEdges(corners, gray, w, h, { r = 14, tur = 2 } = {}) {
  const G = (x, y) => { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)); const x0 = x | 0, y0 = y | 0, x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), fx = x - x0, fy = y - y0;
    return (gray[y0 * w + x0] * (1 - fx) + gray[y0 * w + x1] * fx) * (1 - fy) + (gray[y1 * w + x0] * (1 - fx) + gray[y1 * w + x1] * fx) * fy; };
  let q = corners.map(p => [...p]);
  for (let it = 0; it < tur; it++) {
    const lines = [];
    for (let e = 0; e < 4; e++) {
      const a = q[e], b = q[(e + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 20) { lines.push(null); continue; }
      const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy, ny = ux, R = it ? r / 2 : r;
      const pts = [];
      const N = Math.max(12, Math.min(80, L / 6 | 0));
      for (let i = 0; i < N; i++) {
        const t = .12 + .76 * (i + .5) / N, px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
        let best = 0, bo = 0;
        for (let o = -R; o <= R; o += .5) {                // dik doğrultuda türev (merkezi fark)
          const g = Math.abs(G(px + nx * (o + 1), py + ny * (o + 1)) - G(px + nx * (o - 1), py + ny * (o - 1)));
          if (g > best) { best = g; bo = o; }
        }
        if (best > .03) pts.push([px + nx * bo, py + ny * bo]);
      }
      if (pts.length < Math.max(6, N * .4)) { lines.push(null); continue; }
      // Sağlam oturtma: önce hepsi, sonra uzak %30'u at, yeniden
      let ln = fitLine(pts);
      const res = pts.map(p => Math.abs(ln[0] * p[0] + ln[1] * p[1] - ln[2])).sort((x, y) => x - y), cut = res[Math.floor(res.length * .7)];
      const keep = pts.filter(p => Math.abs(ln[0] * p[0] + ln[1] * p[1] - ln[2]) <= cut + .5);
      if (keep.length >= 5) ln = fitLine(keep);
      // Yön çok saparsa (başka bir çizgiye kaydıysa) kabul etme
      const ang = Math.abs(ln[0] * nx + ln[1] * ny);
      lines.push(ang > .97 ? ln : null);
    }
    q = q.map((c, i) => { const A = lines[(i + 3) % 4], B = lines[i]; if (!A || !B) return c; const m = meet(A, B); return m && Math.hypot(m[0] - c[0], m[1] - c[1]) < 3 * r ? m : c; });
  }
  return q;
}

// Dört köşeyi uygulamanın sırasına koy (TL sol uzak/arka, TR sağ uzak, BR sağ yakın, BL sol yakın).
// Hangi kenarın "uzak" olduğu tek fotoğraftan belli değildir; girilen ölçülerle 8 olası sıranın hepsi denenir,
// ölçülere en iyi uyan (en küçük piksel hatası) ve fiziksel olarak geçerli olan seçilir. calib(sıralı köşeler) → { err, ok }
export function orderCorners(q, calib) {
  let best = null;
  for (const dir of [1, -1]) for (let s = 0; s < 4; s++) {
    const o = [0, 1, 2, 3].map(k => q[((s + dir * k) % 4 + 4) % 4]);
    const pts = { TL: o[0], TR: o[1], BR: o[2], BL: o[3] }, r = calib(pts);
    if (r && r.ok && (!best || r.err < best.err)) best = { pts, err: r.err };
  }
  return best;
}
