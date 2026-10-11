// GMC Tavan Stüdyo · Faz 0
// Akış: fotoğraf -> arka duvar + yan çizgilerden kamera hesabı (oda kutusu) -> fotoğrafı kutuya yansıt -> ürün ışıklarını üstüne ekle.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import * as VIT from './vitrin.js';
import * as ISIK from './isik.js';
import * as URUN from './urunler.js';
const { nelderMead } = VIT;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// Lümeni bilinmeyen ürün için yedek (artık her üründe lm var; urunler.js) [Tahmin]
const LM_PER_W = 90;
// Magnet ürünler: gmcled.com (kod, ad, görsel) + katalogdaki eşdeğer seri (lümen, ışık açısı) — urunler.js; fam = hangi ray ailesine takılır
const PRODUCTS = URUN.MAGNET.map(p => ({ ...p, aim: p.type === 'spot' || p.type === 'hareketli' }));
// Kuyumcu vitrin serisi: gömme, raysız. [Kesin] GMCLED_KATALOG.pdf s.50-51 (güç, lümen, ölçü, açılar)
const ETNA = [
  { sku: 'ETNA-6', name: 'ETNA 6', watts: 10, lm: 1770, lengthCm: 34, widthCm: 6.5, rows: [6] },
  { sku: 'ETNA-12', name: 'ETNA 12', watts: 21, lm: 3717, lengthCm: 34, widthCm: 11.7, rows: [6, 6] },
  { sku: 'ETNA-26', name: 'ETNA 26', watts: 44, lm: 7788, lengthCm: 34, widthCm: 18, rows: [9, 8, 9] },
];
// Ürün fotoğrafından kesilmiş doku + fotoğraftan otomatik bulunan mercek merkezleri (u, v, yarıçap; 0-1)
const ETNA_LENS = {"etna-6":[[0.866,0.48,0.0233],[0.426,0.5,0.023],[0.278,0.5,0.0214],[0.13,0.5,0.0233],[0.718,0.48,0.0214],[0.57,0.48,0.023]],"etna-12":[[0.132,0.319,0.0272],[0.132,0.681,0.0272],[0.715,0.319,0.0236],[0.86,0.681,0.026],[0.569,0.319,0.0256],[0.569,0.669,0.0217],[0.86,0.319,0.0244],[0.278,0.319,0.0256],[0.423,0.319,0.0256],[0.278,0.681,0.0217],[0.699,0.693,0.0307],[0.423,0.681,0.0205]],"etna-26":[[0.152,0.475,0.0291],[0.217,0.596,0.0296],[0.315,0.307,0.0279],[0.31,0.652,0.0279],[0.843,0.251,0.0279],[0.594,0.287,0.0337],[0.406,0.688,0.0307],[0.619,0.449,0.0337],[0.685,0.312,0.0279],[0.222,0.373,0.0307],[0.396,0.297,0.0307],[0.499,0.272,0.0279],[0.773,0.596,0.0279],[0.383,0.52,0.0337],[0.602,0.693,0.0337],[0.763,0.373,0.0307],[0.687,0.652,0.0296],[0.285,0.475,0.0279],[0.7,0.485,0.0337],[0.526,0.525,0.0307],[0.833,0.48,0.0307],[0.149,0.708,0.0279],[0.848,0.723,0.0307],[0.149,0.256,0.0307],[0.466,0.449,0.0307],[0.506,0.703,0.0307]]};
for (const e of ETNA) { e.tex = 'assets/' + e.sku.toLowerCase() + '-tex.png'; e.lensPos = ETNA_LENS[e.sku.toLowerCase()]; }
for (const e of ETNA) PRODUCTS.push({ ...e, fam: 'gomme', type: 'gomme', lenses: e.rows.reduce((a, b) => a + b), beam: 34, beamOpts: [24, 34, 48], tiltOpts: [0, 25, 38],
  aim: true, real: true, src: 'assets/' + e.sku.toLowerCase() + '.jpg', note: 'Kuyumcu vitrin serisi · 220V kendi sürücüsü' });
for (const p of URUN.SPOTS) PRODUCTS.push({ ...p, note: `Gömme · kesim ${p.cut} · 220V kendi sürücüsü` });
for (const p of URUN.KUYUMCU) PRODUCTS.push({ ...p, note: `${p.mount === 'sivaustu' ? 'Sıva üstü' : p.mount === 'sarkit' ? 'Sarkıt' : 'Gömme'} · ${p.cut} · 220V kendi sürücüsü` });
const bySku = Object.fromEntries(PRODUCTS.map(p => [p.sku, p]));
for (const [o, n] of Object.entries(URUN.ALIAS)) bySku[o] = bySku[n];   // eski kodla kaydedilmiş projeler
const TYPE_TR = { spot: 'Ray spot', mercek: 'Mercek lensli', hareketli: 'Hareketli mercekli', lineer: 'Lineer', sarkit: 'Sarkıt', gomme: 'Gömme (ETNA)', downlight: 'Gömme spot' };
// Lümen yazısı: katalogda doğrudan var / katalogdaki eşdeğer seriden / tahmin
const lmText = (p, kisa) => p.real ? `${p.lm.toLocaleString('tr-TR')} lm${kisa ? '' : ' (katalog' + (p.kat ? ' ' + p.kat : '') + ')'}`
  : p.esd ? `≈${p.lm.toLocaleString('tr-TR')} lm${kisa ? '' : ' (katalog eşdeğeri: ' + p.esd + ')'}` : `~${Math.round(lumenOf(p))} lm${kisa ? '' : ' (tahmini)'}`;
// Ürün grubu: ray ürünleri, kuyumcu ETNA, gömme spot (son ikisi raysız, tavanda serbest)
const grpOf = p => p.fam !== 'gomme' ? 'ray' : p.grp === 'spot' ? 'spot' : 'gomme';
const lumenOf = p => p.lm || p.watts * LM_PER_W;

// Ray sistemleri (Codex/gmcled.com ile aynı). Slim raya slim ürünler, diğer üçüne standart ürünler takılır.
const SYSTEMS = [
  { id: 'standard', name: 'Sıva Üstü Magnet Ray', note: '27 × 51 mm profil', fam: 'standard', w: .027, drop: .051, recessed: false, img: 'siva-ustu-magnet-ray-hd.webp' },
  { id: 'slim', name: 'Slim Sıva Üstü Magnet Ray', note: 'İnce profil', fam: 'slim', w: .02, drop: .03, recessed: false, img: 'slim-siva-ustu-magnet-ray-hd.webp' },
  { id: 'recessed_spring', name: 'Sıva Altı Kulaklı (Yaylı)', note: 'Gömme, ince kulak görünür', fam: 'standard', w: .027, drop: 0, recessed: true, flange: .008, img: 'siva-alti-yayli-magnet-ray-hd.webp' },
  { id: 'trimless', name: 'Trimless Sıva Altı', note: 'Kanatlar sıva altında, sadece yarık', fam: 'standard', w: .027, drop: 0, recessed: true, flange: 0, img: 'trimless-siva-alti-magnet-ray-hd.webp' },
];
const SHAPES = [
  { id: 'straight', name: 'Düz', icon: '━', labels: ['Uzunluk'], def: [2] },
  { id: 'l', name: 'L', icon: '┗', labels: ['Yatay', 'Dikey'], def: [2, 1.5] },
  { id: 'u', name: 'U', icon: '∪', labels: ['Sol', 'Orta', 'Sağ'], def: [1.5, 2, 1.5] },
  { id: 'square', name: 'Kare', icon: '□', labels: ['Kenar'], def: [2] },
  { id: 'rectangle', name: 'Dikdörtgen', icon: '▭', labels: ['Uzun', 'Kısa'], def: [3, 2] },
];

const DEFAULT_PTS = { TL: [.25, .22], TR: [.75, .22], BR: [.75, .68], BL: [.25, .68], SL: [.06, .04], SR: [.94, .04] };
const SAMPLES = {
  salon: { src: 'ornek/salon.jpg', pts: { TL: [.0813, .1312], TR: [.575, .2948], BR: [.575, .584], BL: [.0742, .687], SL: [.0375, .0125], SR: [.9583, .18] } },
  mutfak: { src: 'ornek/mutfak.jpg', pts: null },
  // Vitrin: GMC'nin ETNA 26 tanıtım görselinden (sağ yarı). Kutu = vitrinin tamamı (üst tavan → alt tepsiler), iç yükseklik ~1,6 m [Tahmin].
  // Önden çekim olduğu için lens çizgilerden hesaplanamıyor; 26 mm sabit verildi.
  kuyumcu: { src: 'ornek/vitrin.jpg', ceilH: 1.6, lensMm: 26, group: 'gomme', credit: 'Görsel: GMC LED · ETNA 26 tanıtımı (tavan armatürleri silindi)',
    pts: { TL: [.0055, .2253], TR: [.9013, .2072], BR: [.9013, .7333], BL: [.0055, .7439], SL: [-.138, .168], SR: [.971, .086] } },
  // Kuyumcu modu örneği: aynı görsel; işaretlenen tavan vitrinin önündeki bej saçak (ETNA'lar oraya, cam önüne).
  // [Tahmin] Gerçek ölçüleri bilinmiyor (tanıtım görseli); görünen kısım için makul ölçüler verildi.
  vitrin: { src: 'ornek/vitrin.jpg', lensMm: 26, credit: 'Görsel: GMC LED · ETNA 26 tanıtımı (tavan armatürleri silindi)',
    vit: { width: 200, depth: 60, height: 200, table: 95, place: 'onu', store: 230, front: 25 }, pts: { TL: [.0219, .2262], TR: [.8991, .1615], BR: [.9737, .0404], BL: [-.0684, .1159] } },   // sol ön köşe kadraj dışında (perspektiften)
};
// Blender test sahnesi (test_sahne/): ölçüleri ve kamerası kesin bilinen ışıksız fotoğraflar. Köşeleri kullanıcı işaretler;
// ptsGercek sadece otomatik test / ekran görüntüsü için (?demo=testBanko&isaret=gercek).
Object.assign(SAMPLES, {
  testBanko: { src: '../test_sahne/cikti/banko.jpg', pts: null, ptsGercek: {"TL": [-0.00186, 0.49371], "TR": [0.72572, 0.36291], "BR": [0.85654, 0.41636], "BL": [-0.04815, 0.63508]},
    vit: { place: 'banko', width: 240, depth: 60, table: 95, store: 300, off: 0 }, credit: 'Blender test bankosu · gerçek: kamera yerden 162 cm, lens 26 mm' },
  testVitrin: { src: '../test_sahne/cikti/vitrin.jpg', pts: null, ptsGercek: {"TL": [0.24264, 0.29007], "TR": [0.70641, 0.30077], "BR": [0.8126, 0.2726], "BL": [0.19575, 0.25334]},
    vit: { place: 'ic', width: 200, depth: 80, height: 180, table: 45 }, credit: 'Blender test vitrini · gerçek: kamera tabladan 105 cm, lens 26 mm' },
});
// Kuyumcu vitrini modu (gmcled.com kuyumcu aracının alanları, cm). place: 'ic' vitrin tavanına, 'onu' mağaza tavanına cam önüne.
const VIT_DEF = { width: 200, depth: 80, height: 180, table: 45, rot: '0', cols: 4, rows: 2, sku: 'ETNA-26', place: 'ic', store: 280, front: 30, off: 0 };
// Banko üzeri bölgesine geçince ölçüler banko varsayılanlarına döner (dış vitrin ölçüleri saklanır)
const BANKO_DEF = { width: 240, depth: 60, table: 95, store: 300, off: 0 };

const S = {
  img: null, W: 0, H: 0, pts: structuredClone(DEFAULT_PTS), sideTouched: false, sideOff: false, placeIdx: 0, lensSource: 'tahmin', photoWarn: [],
  lensMm: 24, ceilH: 2.7, cal: null,
  fixtures: [], rails: [], sel: null, active: 'GMC6031', nextId: 1,
  prodGroup: 'ray', compare: false, split: .5, credit: '', guides: [], tool: null, drawing: null, ghost: null,
  system: 'standard', railShape: 'straight', railDims: Object.fromEntries(SHAPES.map(x => [x.id, [...x.def]])), filter: 'all', depthOverride: null,
  cct: 3000, on: true, day: 0.15, gain: 1, view: 'photo', step: 1,
  mode: 'oda', vit: { ...VIT_DEF }, lensPrior: 26, autoLaid: false,
  dims: true, luxMap: false, mView: 'persp', luxRes: null, foot: true, multi: [],
};

/* ---------------- küçük vektör yardımcıları (kalibrasyon) ---------------- */
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a); return l > 1e-12 ? mul(a, 1 / l) : [0, 0, 0]; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const px = k => [S.pts[k][0] * S.W, S.pts[k][1] * S.H];
// İki doğrunun (a-b, c-d) kesişimi = kaybolma noktası (homojen, sonsuzda olabilir)
const vp = (a, b, c, d) => cross(cross([...a, 1], [...b, 1]), cross([...c, 1], [...d, 1]));
const dirFromVP = (v, f) => norm([v[0] - S.W / 2 * v[2], v[1] - S.H / 2 * v[2], f * v[2]]);
const ray = (p, f) => [(p[0] - S.W / 2) / f, (p[1] - S.H / 2) / f, 1];
const longSide = () => Math.max(S.W, S.H);
const focalPx = () => S.lensMm / 36 * longSide();

function fFromPair(v1, v2) {
  const s1 = Math.hypot(v1[0], v1[1]), s2 = Math.hypot(v2[0], v2[1]);
  if (Math.abs(v1[2]) < 1e-9 * s1 || Math.abs(v2[2]) < 1e-9 * s2) return null;
  const a = [v1[0] / v1[2] - S.W / 2, v1[1] / v1[2] - S.H / 2];
  const b = [v2[0] / v2[2] - S.W / 2, v2[1] / v2[2] - S.H / 2];
  const f2 = -(a[0] * b[0] + a[1] * b[1]);
  if (!(f2 > 0)) return null;
  const f = Math.sqrt(f2);
  return f > .15 * longSide() && f < 3 * longSide() ? f : null;
}

// Mavi çizgiler (yan duvar–tavan) + arka duvar kenarlarından lens hesabı: dik iki yönün kaybolma noktaları
function autoLens() {
  const TL = px('TL'), TR = px('TR'), BR = px('BR'), BL = px('BL'), SL = px('SL'), SR = px('SR');
  const vh = vp(TL, TR, BL, BR), vd = vp(TL, SL, TR, SR), vv = vp(TL, BL, TR, BR);
  const f0 = fFromPair(vh, vd) ?? fFromPair(vv, vd) ?? fFromPair(vh, vv);
  const fit = fitOrientation(f0 ?? focalPx(), true);
  if (!fit) return false;
  S.lensMm = clamp(fit.f / longSide() * 36, 10, 60);
  return true;
}

/* Kamera yönü (sapma, eğim, yuvarlanma) + lens: tüm çizgilere birlikte en uygun çözüm.
   Her çizgi kendi yönünün kaybolma noktasına doğru uzanmalı; sapmaların karesi en aza indirilir. */
function rotDirs(yaw, pitch, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  // dünya (x sağ, y yukarı, z kameraya) -> kamera (x sağ, y aşağı, z ileri)
  const ap = v => { // Ry(yaw) -> Rx(pitch) -> Rz(roll) -> taban dönüşüm
    let [x, y, z] = v;
    [x, z] = [cy * x + sy * z, -sy * x + cy * z];
    [y, z] = [cp * y - sp * z, sp * y + cp * z];
    [x, y] = [cr * x - sr * y, sr * x + cr * y];
    return [x, -y, -z];
  };
  return { ex: ap([1, 0, 0]), up: ap([0, 1, 0]), dz: ap([0, 0, 1]) };
}
function lineErr(a, b, d, f) {
  const v = [f * d[0] + S.W / 2 * d[2], f * d[1] + S.H / 2 * d[2], d[2]];
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 1];
  const l = cross(m, v), k = Math.hypot(l[0], l[1]) || 1e-9;
  return Math.abs(dot(l, [a[0], a[1], 1])) / k / longSide();
}
function fitOrientation(f0, freeF) {
  const TL = px('TL'), TR = px('TR'), BR = px('BR'), BL = px('BL'), SL = px('SL'), SR = px('SR');
  const useSide = S.sideTouched && !S.sideOff;
  const cost = x => {
    const f = freeF ? f0 * Math.exp(x[3]) : f0, d = rotDirs(x[0], x[1], x[2]);
    if (d.up[1] > -0.3 || f < .15 * longSide() || f > 3 * longSide()) return 1e3;
    let e = 0;
    for (const [a, b] of [[TL, BL], [TR, BR]]) e += lineErr(a, b, d.up, f) ** 2;
    for (const [a, b] of [[TL, TR], [BL, BR]]) e += lineErr(a, b, d.ex, f) ** 2;
    if (useSide) for (const [a, b] of [[TL, SL], [TR, SR]]) e += 2 * lineErr(a, b, d.dz, f) ** 2;
    return e;
  };
  let best = null;
  for (const yaw of [-.9, -.5, -.2, .2, .5, .9]) for (const pitch of [-.25, .1]) {
    const r = nelderMead(cost, [yaw, pitch, 0, 0], [.15, .1, .05, .2]);
    if (!best || r.v < best.v) best = r;
  }
  if (!best || best.v >= 1e3) return null;
  const x = best.x, d = rotDirs(x[0], x[1], x[2]);
  return { f: freeF ? f0 * Math.exp(x[3]) : f0, ex: d.ex, up: d.up, err: best.v };
}

// Arka duvar dörtgeni + lens + tavan yüksekliği -> kamera konumu/yönü ve oda kutusu
function calibrate() {
  if (S.mode === 'vitrin') return calibrateVitrin();
  const f = focalPx();
  const TL = px('TL'), TR = px('TR'), BR = px('BR'), BL = px('BL');
  const fit = fitOrientation(f, false);
  if (!fit) return null;
  const up = fit.up;
  let ex = norm(sub(fit.ex, mul(up, dot(fit.ex, up))));
  if (len(ex) < .5) return null;
  if (dot(ex, sub(norm(ray(TR, f)), norm(ray(TL, f)))) < 0) ex = mul(ex, -1);
  const n = cross(ex, up);                               // duvardan kameraya doğru
  const onWall = p => { const r = ray(p, f), d = dot(n, r); return d < -1e-6 ? mul(r, -1 / d) : null; };
  const P = { TL: onWall(TL), TR: onWall(TR), BR: onWall(BR), BL: onWall(BL) };
  if (Object.values(P).some(v => !v)) return null;
  const hL = dot(sub(P.TL, P.BL), up), hR = dot(sub(P.TR, P.BR), up);
  if (!(hL > 0 && hR > 0)) return null;
  const D = S.ceilH / ((hL + hR) / 2);
  const w = v => [dot(v, ex) * D, dot(v, up) * D, dot(v, n) * D];
  const W = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, w(v)]));
  const xL = (W.TL[0] + W.BL[0]) / 2, xR = (W.TR[0] + W.BR[0]) / 2;
  const yF = (W.BL[1] + W.BR[1]) / 2, z0 = (W.TL[2] + W.TR[2] + W.BR[2] + W.BL[2]) / 4;
  const width = xR - xL;
  if (!(width > .3)) return null;
  const cam = [-xL, -yF, -z0];
  const depth = S.depthOverride ? Math.max(S.depthOverride, cam[2] + .3) : Math.max(cam[2] + 1.2, 3);
  return { f, ex, up, n, xL, yF, z0, width, H: S.ceilH, depth, cam, camH: cam[1], dist: cam[2], err: fit.err };
}

/* Kuyumcu vitrini: kullanıcı ışıkların takılacağı tavanın 4 köşesini işaretler (sol arka, sağ arka, sağ ön, sol ön).
   Vitrin tavanı: genişlik ve derinlik ölçüdür (kesin), yükseklik tabladan. Cam önü: mağaza tavanı; genişlik vitrin genişliği,
   derinlik fotoğraftan hesaplanır, yükseklik yerden. Dünya: x genişlik, y yukarı (tavan = H), z vitrin tarafından (0) sana doğru. */
const vitBox = () => {
  const v = S.vit, onu = v.place === 'onu';
  if (v.place === 'banko') return { W: v.width / 100, D: v.depth / 100, H: v.table / 100, fixD: true, banko: true };   // banko üstü yerden
  return { W: v.width / 100, D: onu ? 1 : v.depth / 100, H: onu ? v.store / 100 : (v.height - v.table) / 100, fixD: !onu };
};
function calibrateVitrin() {
  const { W, D, H, fixD, banko } = vitBox();
  if (!(W > .3 && D > .1 && H > (banko ? .1 : .2))) return null;
  const fixedF = S.lensSource === 'elle';
  const r = VIT.calibrateCeiling({ corners: { TL: px('TL'), TR: px('TR'), BR: px('BR'), BL: px('BL') }, imgW: S.W, imgH: S.H, W, D, H, fixD,
    fPrior: (fixedF ? S.lensMm : S.lensPrior) / 36 * longSide(), fixedF, depthErr: !dragKey });   // hata payı sürüklerken hesaplanmaz (yavaş)
  // Kamera tavanın altında olmalı; bankoda ise banko üstünü görmek için bankonun üstünde
  if (!r || !(banko ? r.cam[1] > H + .05 : r.cam[1] < H - .05) || !(r.D > .1 && r.D < 8)) return null;
  if (!fixedF) { S.lensMm = clamp(r.f / longSide() * 36, 10, 60); S.lensFit = r.lensFromPhoto; }
  const mid = [W / 2, H / 2, r.D / 2];
  // Banko: işaretlenen yüzey banko üstü (yerden H); ürünler mağaza tavanında, bankonun çevresinde serbest
  const bk = banko ? { banko: true, tTop: H, zone: { x0: -.6, x1: W + .6, z0: -1.2, z1: r.D + 1.2 } } : {};
  // Fotoğraftan derinlik sadece güvenilirse uyarı konusu olur: fark, 2 px işaretleme hatasının etkisinin 2 katından büyük olmalı
  const photoD = r.photoD != null && r.photoDerr != null && Math.abs(r.photoD - r.D) > Math.max(.05, r.D * .08, 2 * r.photoDerr) ? r.photoD : null;
  return { kind: 'vitrin', ...bk, f: r.f, ex: r.ex, up: r.up, n: r.n, xL: r.xL, yF: r.yF, z0: r.z0, width: W, H: banko ? S.vit.store / 100 : H, depth: r.D, fixD, photoD, photoDerr: r.photoDerr,
    cam: r.cam, camH: r.cam[1], dist: Math.hypot(r.cam[0] - mid[0], r.cam[1] - mid[1], r.cam[2] - mid[2]), err: r.rms, lensFromPhoto: r.lensFromPhoto };
}

// Dünya noktası -> fotoğraf pikseli (kalibrasyon çizimi için)
function project(c, X) {
  const a = X[0] + c.xL, b = X[1] + c.yF, z = X[2] + c.z0;
  const v = [c.ex[0] * a + c.up[0] * b + c.n[0] * z, c.ex[1] * a + c.up[1] * b + c.n[1] * z, c.ex[2] * a + c.up[2] * b + c.n[2] * z];
  if (v[2] < .05) return null;
  return [S.W / 2 + c.f * v[0] / v[2], S.H / 2 + c.f * v[1] / v[2]];
}

/* ---------------- geri al / ileri al ---------------- */
const hist = { stack: [], i: -1 };
const calibKey = () => JSON.stringify([S.pts, S.lensMm, S.ceilH, S.sideTouched, S.sideOff, S.placeIdx, S.depthOverride, S.lensSource, S.mode === 'vitrin' ? [S.vit.width, S.vit.depth, S.vit.height, S.vit.table, S.vit.place, S.vit.store] : 0]);
function snap() {
  return JSON.stringify({ pts: S.pts, lensMm: S.lensMm, ceilH: S.ceilH, sideTouched: S.sideTouched, sideOff: S.sideOff, placeIdx: S.placeIdx,
    depthOverride: S.depthOverride, system: S.system, rails: S.rails, guides: S.guides, vit: S.vit, lensSource: S.lensSource,
    fixtures: S.fixtures.map(({ p, ...r }) => ({ ...r, sku: p.sku })), sel: S.sel, multi: S.multi });
}
function pushHist() {
  const s = snap();
  if (hist.stack[hist.i] === s) return;
  hist.stack = hist.stack.slice(0, hist.i + 1); hist.stack.push(s);
  if (hist.stack.length > 120) hist.stack.shift();
  hist.i = hist.stack.length - 1; updUndo();
}
function resetHist() { hist.stack = []; hist.i = -1; pushHist(); }
function restore(s) {
  const o = JSON.parse(s), before = calibKey();
  Object.assign(S, { pts: o.pts, lensMm: o.lensMm, ceilH: o.ceilH, sideTouched: o.sideTouched, sideOff: o.sideOff, placeIdx: o.placeIdx, sel: o.sel, multi: o.multi || [],
    depthOverride: o.depthOverride, system: o.system, rails: o.rails, guides: o.guides || [], drawing: null, ghost: null, vit: o.vit || S.vit, lensSource: o.lensSource || S.lensSource });
  S.fixtures = o.fixtures.map(({ sku, ...r }) => ({ ...r, p: bySku[sku] }));
  syncLensUI(); renderPanel(); renderVit();
  if (calibKey() !== before) {
    S.cal = S.placeIdx >= ORDER.length ? calibrate() : null;
    if (S.step === 3 && !S.cal) goStep(2);
    else if (S.step === 3) startGL();
    else recalc();
  } else if (S.step === 3) buildFixtures();
  else recalc();
  updUndo();
}
function undo() { if (hist.i > 0) { hist.i--; restore(hist.stack[hist.i]); } }
function redo() { if (hist.i < hist.stack.length - 1) { hist.i++; restore(hist.stack[hist.i]); } }
function updUndo() { $('#undoBtn').disabled = hist.i <= 0; $('#redoBtn').disabled = hist.i >= hist.stack.length - 1; }
$('#undoBtn').addEventListener('click', undo);
$('#redoBtn').addEventListener('click', redo);
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || !(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === 'a' && S.step === 3) { e.preventDefault(); selectAll(); return; }
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
});

/* ---------------- adım 1: fotoğraf ---------------- */
// JPEG EXIF içinden 35 mm karşılığı odak uzaklığı (telefon fotoğraflarında genelde var)
function exifF35(buf) {
  try {
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xFFD8) return null;
    let o = 2;
    while (o < v.byteLength - 4) {
      const m = v.getUint16(o), L = v.getUint16(o + 2);
      if ((m & 0xFF00) !== 0xFF00 || m === 0xFFDA) return null;
      if (m === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10, le = v.getUint16(t) === 0x4949;
        const g16 = p => v.getUint16(p, le), g32 = p => v.getUint32(p, le);
        const ifd = p => { const n = g16(p), r = {}; for (let i = 0; i < n; i++) { const e = p + 2 + i * 12; r[g16(e)] = e + 8; } return r; };
        const i0 = ifd(t + g32(t + 4));
        if (!i0[0x8769]) return null;
        const i1 = ifd(t + g32(i0[0x8769]));
        const f = i1[0xA405] ? g16(i1[0xA405]) : 0;
        return f > 5 && f < 300 ? f : null;
      }
      o += 2 + L;
    }
  } catch { }
  return null;
}
// 35 mm karşılığı köşegene göre tanımlıdır; uygulamanın lens ölçüsü uzun kenara göre
const lensFromF35 = f35 => clamp(f35 * Math.hypot(S.W, S.H) / 43.27 / longSide() * 36, 10, 60);

function photoChecks() {
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const g = c.getContext('2d'); g.drawImage(S.img, 0, 0, 48, 48);
  const d = g.getImageData(0, 0, 48, 48).data; let lum = 0;
  for (let i = 0; i < d.length; i += 4) lum += .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2];
  lum /= d.length / 4;
  const w = [];
  if (Math.min(S.W, S.H) < 900) w.push('Fotoğraf çözünürlüğü düşük; köşeleri işaretlemek zorlaşabilir.');
  if (S.H > S.W) w.push('Dikey çekim: yatay çekim tavanı daha geniş gösterir.');
  if (lum < 55) w.push('Fotoğraf karanlık; gündüz çekilmiş fotoğraf daha iyi sonuç verir.');
  if (lum > 215) w.push('Fotoğraf çok parlak; ışık etkisi az görünebilir.');
  return w;
}

async function loadPhoto(src, preset, f35 = null, opts = {}) {
  if (S.mode === 'vitrin' && !opts.vit && vitErr()) { renderVit(); $('.vit-warn')?.scrollIntoView({ block: 'center' }); return; }
  const im = new Image();
  im.src = src;
  await im.decode();
  const k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  S.img = c; S.W = c.width; S.H = c.height;
  S.pts = structuredClone(preset || DEFAULT_PTS);
  S.placeIdx = preset ? ORDER.length : 0;
  S.sideTouched = !!preset; S.sideOff = false;
  S.fixtures = []; S.rails = []; S.guides = []; S.tool = null; S.drawing = null; S.ghost = null; S.sel = null; S.cal = null; S.depthOverride = null;
  $('#guideBtn')?.classList.remove('is-active');
  S.lensSource = f35 ? 'exif' : 'tahmin';
  S.ceilH = opts.ceilH || 2.7; S.credit = opts.credit || '';
  if (S.mode === 'vitrin' && opts.vit) { Object.assign(S.vit, opts.vit); pickRecommended(); renderVit(); }
  S.prodGroup = S.mode === 'vitrin' ? 'gomme' : opts.group || 'ray';
  S.active = S.mode === 'vitrin' ? S.vit.sku : S.prodGroup === 'gomme' ? 'ETNA-26' : S.prodGroup === 'spot' ? 'OPUS-6' : 'GMC6031'; renderProducts();
  S.autoLaid = false; S.lensFit = false;
  $('#credit').textContent = S.credit; $('#credit').hidden = !S.credit;
  S.lensMm = lensFromF35(f35 || 26);                     // EXIF yoksa telefon ana kamerası (~26 mm)
  S.photoWarn = opts.credit ? [] : photoChecks();      // hazır örneklerde yükleme uyarısı gösterme
  // Vitrin modunda örneğin lensi sadece başlangıç tahminidir; ölçüyle kalibrasyon fotoğraftan düzeltir
  if (opts.lensMm && (S.mode === 'oda' || opts.lensFixed)) { S.lensMm = opts.lensMm; S.lensSource = 'elle'; }
  else if (opts.lensMm) S.lensMm = opts.lensMm;
  else if (S.sideTouched && S.mode === 'oda') autoLens();
  S.lensPrior = S.lensMm;
  disposeGL();
  goStep(2);
  resetHist();
}

async function loadFile(f) {
  if (!f || !f.type.startsWith('image/')) return;
  let f35 = null;
  try { f35 = exifF35(await f.slice(0, 256 * 1024).arrayBuffer()); } catch { }
  loadPhoto(URL.createObjectURL(f), null, f35);
}
$('#fileInput').addEventListener('change', e => loadFile(e.target.files[0]));
const dz = $('#dropZone');
['dragenter', 'dragover'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.add('drag'); }));
['dragleave', 'drop'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.remove('drag'); }));
dz.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
$$('[data-sample]').forEach(b => b.addEventListener('click', () => { const s = SAMPLES[b.dataset.sample]; loadPhoto(s.src, s.pts, null, s); }));

function goStep(n) {
  S.step = n; document.body.dataset.step = n;
  [1, 2, 3].forEach(i => { $('#step' + i).hidden = i !== n; });
  $$('.steps button').forEach(b => {
    const i = +b.dataset.step;
    b.classList.toggle('is-active', i === n);
    b.disabled = i === 2 ? !S.img : i === 3 ? !S.cal : false;
  });
  $('#empty').hidden = !!S.img;
  $('#calibCanvas').hidden = n !== 2;
  $('#glHost').hidden = n !== 3;
  $('#stageBar').hidden = n !== 3;
  $('#undoBar').hidden = n === 1;
  $('#planCanvas').hidden = n !== 3 || S.view !== 'plan';
  if (n !== 3) $('#split').hidden = true;
  if (n === 2) { syncLensUI(); recalc(); }
  if (n === 3) { startGL(); renderRoom(); if (S.mode === 'vitrin' && !S.autoLaid && S.cal && !vitErr()) applyVitLayout(); }
}
$$('.steps button').forEach(b => b.addEventListener('click', () => goStep(+b.dataset.step)));

/* ---------------- adım 2: odayı işaretle ---------------- */
const ORDER_ODA = ['TL', 'TR', 'BR', 'BL', 'SL', 'SR'], ORDER_VIT = ['TL', 'TR', 'BR', 'BL'];
let ORDER = ORDER_ODA;
const PLACE = {
  TL: ['Arka duvarın SOL ÜST köşesi', 'Arka duvarın tavanla birleştiği sol köşeye dokun.'],
  TR: ['Arka duvarın SAĞ ÜST köşesi', 'Arka duvarın tavanla birleştiği sağ köşeye dokun.'],
  BR: ['Arka duvarın SAĞ ALT köşesi', 'Zeminle birleştiği sağ köşe. Mobilya arkasında kalıyorsa tahmini yerine dokun.'],
  BL: ['Arka duvarın SOL ALT köşesi', 'Zeminle birleştiği sol köşe. Mobilya arkasında kalıyorsa tahmini yerine dokun.'],
  SL: ['Sol duvar–tavan çizgisi', 'Sol duvarın tavanla birleştiği çizgi üzerinde, sana yakın bir noktaya dokun. Fotoğrafın dışında kalabilir.'],
  SR: ['Sağ duvar–tavan çizgisi', 'Sağ duvarın tavanla birleştiği çizgi üzerinde, sana yakın bir noktaya dokun. Fotoğrafın dışında kalabilir.'],
};
const LABELS = { TL: 'Tavan sol', TR: 'Tavan sağ', BR: 'Zemin sağ', BL: 'Zemin sol', SL: 'Sol çizgi', SR: 'Sağ çizgi' };
// Vitrin: ışıkların takılacağı tavanın 4 köşesi. Arka = vitrin tarafı (senden uzak), ön = sana yakın kenar.
const PLACE_VIT = {
  TL: ['Tavanın SOL ARKA köşesi', 'Işıkların takılacağı tavanın vitrin tarafındaki (senden uzak) sol köşesi.'],
  TR: ['Tavanın SAĞ ARKA köşesi', 'Aynı kenarın sağ ucu. Genişlik bu iki nokta arası (girdiğin ölçü).'],
  BR: ['Tavanın SAĞ ÖN köşesi', 'Sana yakın kenarın sağ ucu. Fotoğrafın dışında kalıyorsa tahmini yerine dokun.'],
  BL: ['Tavanın SOL ÖN köşesi', 'Sana yakın kenarın sol ucu.'],
};
const VIT_WHERE = { ic: 'Vitrin tavanı: camın arkasındaki iç tavan.', onu: 'Cam önü: vitrinin önündeki mağaza tavanı / saçak; arka kenar camın üstü.' };
const PLACE_BANKO = {
  TL: ['Banko üstünün SOL UZAK köşesi', 'Ürünlerin durduğu üst yüzeyin (cam kapak ya da tabla) senden uzak kenarının sol ucu.'],
  TR: ['Banko üstünün SAĞ UZAK köşesi', 'Aynı kenarın sağ ucu. Uzunluk bu iki nokta arası (girdiğin ölçü).'],
  BR: ['Banko üstünün SAĞ YAKIN köşesi', 'Sana yakın kenarın sağ ucu. Fotoğrafın dışında kalıyorsa tahmini yerine dokun.'],
  BL: ['Banko üstünün SOL YAKIN köşesi', 'Sana yakın kenarın sol ucu. Derinlik bu kenarla uzak kenar arası.'],
};
const LABELS_BANKO = { TL: 'Sol uzak', TR: 'Sağ uzak', BR: 'Sağ yakın', BL: 'Sol yakın' };
const LABELS_VIT = { TL: 'Sol arka', TR: 'Sağ arka', BR: 'Sağ ön', BL: 'Sol ön' };
const placeTxt = k => S.mode !== 'vitrin' ? PLACE[k] : S.vit.place === 'banko' ? PLACE_BANKO[k] : [PLACE_VIT[k][0], PLACE_VIT[k][1] + ' ' + VIT_WHERE[S.vit.place]];
const ptLabel = k => (S.mode !== 'vitrin' ? LABELS : S.vit.place === 'banko' ? LABELS_BANKO : LABELS_VIT)[k];
const cc = $('#calibCanvas'), cx2 = cc.getContext('2d');
let view = { s: 1, ox: 0, oy: 0, dpr: 1 }, dragKey = null, loupe = null, placeAt = null;
const placing = () => S.placeIdx < ORDER.length;
const visibleKeys = () => ORDER.slice(0, S.placeIdx).filter(k => !(S.sideOff && k[0] === 'S'));

function syncLensUI() {
  $('#lens').value = S.lensMm;
  $('#lensVal').textContent = S.lensMm.toFixed(1) + ' mm' + (S.mode === 'vitrin' ? (S.lensSource === 'elle' ? ' · elle' : S.lensFit ? ' · ölçüden hesaplandı' : S.lensSource === 'exif' ? ' · fotoğraf bilgisinden' : ' · tahmini')
    : S.lensSource === 'exif' && !S.sideTouched ? ' · fotoğraftan' : '');
  $('#autoLens').textContent = S.mode === 'vitrin' ? 'Lensi yeniden hesapla' : 'Mavi noktalardan hesapla';
  $('#ceilH').value = S.ceilH.toFixed(2);
}
$('#lens').addEventListener('input', e => { S.lensMm = +e.target.value; S.sideTouched = false; S.lensSource = 'elle'; syncLensUI(); recalc(); });
$('#lens').addEventListener('change', pushHist);
$('#ceilH').addEventListener('input', e => { const v = +e.target.value; if (v >= .4 && v <= 8) { S.ceilH = v; recalc(); } });   // vitrin içi için alçak değerler de
$('#ceilH').addEventListener('change', pushHist);
$('#autoLens').addEventListener('click', () => {
  if (S.mode === 'vitrin') { S.lensSource = 'tahmin'; recalc(); syncLensUI(); pushHist(); return; }
  if (S.sideOff) { flashInfo('Yan çizgiler atlandı; lens hesabı için "Baştan işaretle" ile yan çizgileri de işaretle.'); return; }
  S.sideTouched = true;
  if (!autoLens()) flashInfo('Mavi çizgiler arka duvar çizgileriyle hesap vermiyor; noktaları kontrol et.');
  syncLensUI(); recalc(); pushHist();
});
$('#toStep3').addEventListener('click', () => { if (S.cal) goStep(3); });
$('#restartMark').addEventListener('click', () => { S.placeIdx = 0; S.sideOff = false; S.sideTouched = false; S.cal = null; recalc(); pushHist(); });
$('#skipSide').addEventListener('click', () => {
  // Yan çizgi görünmüyorsa ikisi de bırakılır: lens EXIF/tahmin değerinde kalır, yön dikey + yatay kenarlardan bulunur
  S.sideOff = true; S.sideTouched = false; S.placeIdx = ORDER.length;
  recalc(); pushHist();
});

function flashInfo(t) { $('#calibInfo').innerHTML = `<span class="warn">${t}</span>`; }

function renderPlaceUI() {
  const on = placing(), k = ORDER[S.placeIdx];
  $('#placeBox').hidden = !on; $('#adjustBox').hidden = on;
  $('#skipSide').hidden = !(on && k && k[0] === 'S');
  if (on) {
    $('#placeNo').textContent = `${S.placeIdx + 1}/${ORDER.length}`;
    $('#placeText').textContent = placeTxt(k)[0];
    $('#placeHelp').textContent = placeTxt(k)[1];
  }
  const banner = $('#stageBanner');
  banner.hidden = !on || S.step !== 2;
  if (on) banner.innerHTML = `<b>${S.placeIdx + 1}/${ORDER.length}</b> ${placeTxt(k)[0]}${k[0] === 'S' ? ' <button type="button" id="skipSide2">Görünmüyor, atla</button>' : ''}`;
  $('#skipSide2')?.addEventListener('click', () => $('#skipSide').click());
  $('#photoWarn').innerHTML = (S.photoWarn || []).map(w => `<div class="pwarn">⚠ ${w}</div>`).join('');
}

function recalc() {
  S.cal = placing() ? null : calibrate();
  const c = S.cal, el = $('#calibInfo');
  if (placing()) el.innerHTML = 'Noktalar tamamlanınca oda ölçüleri burada görünecek.';
  else if (!c) el.innerHTML = S.mode === 'vitrin' ? '<span class="warn">Bu noktalarla tavan kurulamadı. Noktaları tavanın köşelerine taşı; sıra: sol arka, sağ arka, sağ ön, sol ön (arka = vitrin tarafı).</span>'
    : '<span class="warn">Bu noktalarla oda kurulamadı. Turuncu noktaları arka duvarın köşelerine taşı.</span>';
  else if (c.banko) {
    const warn = [], tol = Math.max(4, longSide() * .006);
    if (c.photoDerr != null && c.photoDerr > .1) warn.push(`Bu açıdan fotoğraf derinliği iyi gösteremiyor (±${Math.round(c.photoDerr * 100)} cm); girdiğin ölçü kullanılıyor, metreyle ölçtüğünden emin ol.`);
    if (c.err > tol) warn.push(`Noktalar girdiğin ölçülerle tam uyuşmuyor (${c.err.toFixed(0)} px sapma). Köşeleri büyüteçle kontrol et ya da ölçüyü düzelt.`);
    if (c.photoD && Math.abs(c.photoD - c.depth) > Math.max(.05, c.depth * .08))
      warn.push(`Fotoğrafa göre banko derinliği yaklaşık <b>${Math.round(c.photoD * 100)} cm</b> görünüyor, sen ${Math.round(c.depth * 100)} cm girdin. <button type="button" class="linkbtn" id="usePhotoD">Fotoğraftakini kullan</button>`);
    if (!c.lensFromPhoto && S.lensSource !== 'elle') warn.push('Lens fotoğraftan hesaplanamadı, tahmin kullanıldı. Bankoyu biraz yandan / yukarıdan çekersen hesap kesinleşir.');
    if (c.camH < c.tTop + .1 || c.camH > 3) warn.push('Kamera yüksekliği olağan dışı; köşeleri ya da banko yüksekliğini kontrol et.');
    el.innerHTML = `Banko kuruldu: uzunluk <b>${fmtM(c.width)}</b> · derinlik <b>${fmtM(c.depth)}</b> · yerden <b>${fmtM(c.tTop)}</b> (girdiğin) · mağaza tavanı <b>${fmtM(c.H)}</b><br>` +
      `Fotoğraf yerden <b>${fmtM(c.camH)}</b> yükseklikten çekilmiş · Lens <b>${S.lensMm.toFixed(1)} mm</b> · Uyum <b>±${c.err.toFixed(1)} px</b>` +
      warn.map(w => `<br><span class="warn">${w}</span>`).join('');
    $('#usePhotoD')?.addEventListener('click', () => { S.vit.depth = Math.round(c.photoD * 100); S.autoLaid = false; renderVit(); recalc(); pushHist(); });
  } else if (c.kind === 'vitrin') {
    const warn = [], tol = Math.max(4, longSide() * .006), onu = S.vit.place === 'onu';
    if (c.fixD && c.photoDerr != null && c.photoDerr > .1) warn.push(`Bu açıdan fotoğraf derinliği iyi gösteremiyor (±${Math.round(c.photoDerr * 100)} cm); girdiğin ölçü kullanılıyor, metreyle ölçtüğünden emin ol. Daha yandan / alttan çekersen fotoğraf da kontrol eder.`);
    if (c.err > tol) warn.push(`Noktalar girdiğin ölçülerle tam uyuşmuyor (${c.err.toFixed(0)} px sapma). Köşeleri büyüteçle kontrol et ya da ölçüyü düzelt.`);
    if (c.fixD && c.photoD && Math.abs(c.photoD - c.depth) > Math.max(.05, c.depth * .08))
      warn.push(`Fotoğrafa göre derinlik yaklaşık <b>${Math.round(c.photoD * 100)} cm</b> görünüyor, sen ${Math.round(c.depth * 100)} cm girdin. <button type="button" class="linkbtn" id="usePhotoD">Fotoğraftakini kullan</button>`);
    if (!c.lensFromPhoto && S.lensSource !== 'elle') warn.push('Lens fotoğraftan hesaplanamadı, tahmin kullanıldı. Tavanı biraz daha alttan / yandan çekersen hesap kesinleşir.');
    el.innerHTML = `Tavan kuruldu: genişlik <b>${fmtM(c.width)}</b> (girdiğin) · derinlik <b>${fmtM(c.depth)}</b> (${c.fixD ? 'girdiğin' : 'fotoğraftan'}) · tavan <b>${fmtM(c.H)}</b> ${onu ? 'yerden' : 'tabladan'}<br>` +
      `Fotoğraf ${onu ? 'yerden' : 'tabladan'} <b>${fmtM(c.camH)}</b> yükseklikten çekilmiş · Lens <b>${S.lensMm.toFixed(1)} mm</b> · Uyum <b>±${c.err.toFixed(1)} px</b>` +
      warn.map(w => `<br><span class="warn">${w}</span>`).join('');
    $('#usePhotoD')?.addEventListener('click', () => { S.vit.depth = Math.round(c.photoD * 100); S.autoLaid = false; renderVit(); recalc(); pushHist(); });
  } else {
    const warn = [];
    const lo = S.ceilH >= 2 ? .5 : .05, hi = S.ceilH >= 2 ? 2.1 : S.ceilH * 1.6;   // vitrin gibi alçak kutularda ölçekli
    if (c.camH < lo || c.camH > hi) warn.push('Kamera yüksekliği olağan dışı; lens açısını ya da noktaları kontrol et.');
    if (c.width > 14) warn.push('Arka duvar çok geniş çıktı.');
    if (c.err > 6e-4) warn.push('Çizgiler birbiriyle tam uyuşmuyor; noktaları büyüteçle kontrol et.');
    if (S.sideOff) warn.push('Yan çizgiler atlandı; lens fotoğraftan/tahminden. Mavi çizgiler duvarla örtüşmüyorsa lensi elle ayarla.');
    el.innerHTML = `Arka duvar eni <b>${c.width.toFixed(2)} m</b> · Kamera yüksekliği <b>${c.camH.toFixed(2)} m</b><br>Kameradan arka duvara <b>${c.dist.toFixed(2)} m</b> · Lens <b>${S.lensMm.toFixed(1)} mm</b>` +
      warn.map(w => `<br><span class="warn">${w}</span>`).join('');
  }
  $('#toStep3').disabled = !c;
  $$('.steps button')[2].disabled = !c;
  if (S.mode === 'vitrin') syncLensUI();
  renderPlaceUI();
  drawCalib();
}

function sizeCanvas(cv) {
  const r = $('#stage').getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  return dpr;
}

function drawCalib() {
  if (S.step !== 2 || !S.img) return;
  const dpr = sizeCanvas(cc), Wc = cc.width, Hc = cc.height;
  const s = Math.min(Wc * .84 / S.W, Hc * .84 / S.H);
  view = { s, ox: (Wc - S.W * s) / 2, oy: (Hc - S.H * s) / 2, dpr };
  const T = p => [view.ox + p[0] * s, view.oy + p[1] * s];
  cx2.clearRect(0, 0, Wc, Hc);
  cx2.drawImage(S.img, view.ox, view.oy, S.W * s, S.H * s);
  const c = S.cal;
  const line = (A, B, color, lw) => {
    cx2.strokeStyle = color; cx2.lineWidth = lw * dpr; cx2.setLineDash([]);
    cx2.beginPath(); let pen = false;
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, X = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
      const p = project(c, X);
      if (!p) { pen = false; continue; }
      const q = T(p);
      pen ? cx2.lineTo(q[0], q[1]) : cx2.moveTo(q[0], q[1]); pen = true;
    }
    cx2.stroke();
  };
  if (c) {
    const w = c.width, H = c.banko ? c.tTop : c.H, d = c.depth;
    for (let x = .5; x < w; x += .5) line([x, H, 0], [x, H, d], '#ffffff40', 1);
    for (let z = .5; z < d; z += .5) line([0, H, z], [w, H, z], '#ffffff40', 1);
    if (c.banko) {                                       // banko üstü (turuncu) + ön köşelerden zemine inen mavi çizgiler
      [[0, d], [w, d], [0, 0], [w, 0]].forEach(([x, z]) => line([x, H, z], [x, 0, z], '#1e9bff', 2.5));
      line([0, 0, d], [w, 0, d], '#1e9bff', 2.5);
      line([0, H, 0], [w, H, 0], '#f3a000', 2.5); line([w, H, 0], [w, H, d], '#f3a000', 2.5); line([w, H, d], [0, H, d], '#f3a000', 2.5); line([0, H, d], [0, H, 0], '#f3a000', 2.5);
    } else {
    if (c.kind !== 'vitrin') [[0, H], [w, H], [0, 0], [w, 0]].forEach(([x, y]) => line([x, y, 0], [x, y, d], '#1e9bff', 2.5));
    if (c.kind !== 'vitrin') {                           // odada işaretlenen yüz arka duvar
      line([0, 0, 0], [w, 0, 0], '#f3a000', 2.5); line([0, H, 0], [w, H, 0], '#f3a000', 2.5);
      line([0, 0, 0], [0, H, 0], '#f3a000', 2.5); line([w, 0, 0], [w, H, 0], '#f3a000', 2.5);
    }
    if (c.kind === 'vitrin') { line([0, 0, 0], [w, 0, 0], '#1e9bff', 2.5); line([0, 0, 0], [0, H, 0], '#1e9bff', 2.5); line([w, 0, 0], [w, H, 0], '#1e9bff', 2.5);
      line([0, H, 0], [w, H, 0], '#f3a000', 2.5); line([w, H, 0], [w, H, d], '#f3a000', 2.5); line([w, H, d], [0, H, d], '#f3a000', 2.5); line([0, H, d], [0, H, 0], '#f3a000', 2.5); }
    }
  }
  const keys = visibleKeys();
  const has = k => keys.includes(k);
  const seg = (a, b, col) => {
    if (!has(a) || !has(b)) return;
    const A = T(px(a)), B = T(px(b)); cx2.strokeStyle = col; cx2.lineWidth = 1.5 * dpr; cx2.setLineDash([5 * dpr, 4 * dpr]);
    cx2.beginPath(); cx2.moveTo(...A); cx2.lineTo(...B); cx2.stroke();
  };
  if (!c) { seg('TL', 'TR', '#f3a000cc'); seg('TR', 'BR', '#f3a000cc'); seg('BR', 'BL', '#f3a000cc'); seg('BL', 'TL', '#f3a000cc'); }
  seg('TL', 'SL', '#1e9bffcc'); seg('TR', 'SR', '#1e9bffcc');
  cx2.setLineDash([]);
  for (const k of keys) {
    const [x, y] = T(px(k)), side = k[0] === 'S', r = (side ? 8 : 10) * dpr;
    cx2.fillStyle = side ? '#1e9bff' : '#f3a000'; cx2.strokeStyle = k === dragKey ? '#202329' : '#fff'; cx2.lineWidth = 2.5 * dpr;
    cx2.beginPath(); cx2.arc(x, y, r, 0, Math.PI * 2); cx2.fill(); cx2.stroke();
    cx2.font = `700 ${11 * dpr}px Work Sans, sans-serif`; cx2.fillStyle = '#fff'; cx2.strokeStyle = '#000a'; cx2.lineWidth = 3 * dpr;
    cx2.strokeText(ptLabel(k), x + r + 4 * dpr, y + 4 * dpr); cx2.fillText(ptLabel(k), x + r + 4 * dpr, y + 4 * dpr);
  }
  if (placeAt) {                                         // yerleştirme önizlemesi (parmak kalkınca sabitlenir)
    const [x, y] = T(placeAt), side = ORDER[S.placeIdx][0] === 'S';
    cx2.strokeStyle = side ? '#1e9bff' : '#f3a000'; cx2.lineWidth = 2.5 * dpr;
    cx2.beginPath(); cx2.arc(x, y, 11 * dpr, 0, Math.PI * 2); cx2.stroke();
  }
  if (loupe) drawLoupe(T(loupe), loupe);
}

// Büyüteç: noktanın çevresini 3 kat büyütür; parmağın altında kalan yeri gösterir
function drawLoupe([x, y], p) {
  const d = view.dpr, R = 62 * d, Z = 3;
  // Üst, alt, sağ, sol: tamamen sığan ilk yer; hiçbiri sığmazsa en az taşan
  const g = R + 40 * d, m = 4 * d;
  const opts = [[x, y - g], [x, y + g], [x + g, y], [x - g, y]].map(([ax, ay]) => {
    const over = Math.max(0, R + m - ax) + Math.max(0, ax + R + m - cc.width) + Math.max(0, R + m - ay) + Math.max(0, ay + R + m - cc.height);
    return { ax, ay, over };
  });
  const pick = opts.find(o => o.over === 0) || opts.reduce((a, b) => (b.over < a.over ? b : a));
  const cx = clamp(pick.ax, R + m, cc.width - R - m), cy = clamp(pick.ay, R + m, cc.height - R - m);
  cx2.save();
  cx2.beginPath(); cx2.arc(cx, cy, R, 0, Math.PI * 2); cx2.closePath();
  cx2.fillStyle = '#1b1e22'; cx2.fill(); cx2.clip();
  const sw = (2 * R) / (view.s * Z);                     // kaynakta (fotoğraf pikseli) görünen genişlik
  cx2.drawImage(S.img, p[0] - sw / 2, p[1] - sw / 2, sw, sw, cx - R, cy - R, 2 * R, 2 * R);
  cx2.strokeStyle = '#f3a000'; cx2.lineWidth = 1.5 * d;
  cx2.beginPath(); cx2.moveTo(cx - R, cy); cx2.lineTo(cx - 6 * d, cy); cx2.moveTo(cx + 6 * d, cy); cx2.lineTo(cx + R, cy);
  cx2.moveTo(cx, cy - R); cx2.lineTo(cx, cy - 6 * d); cx2.moveTo(cx, cy + 6 * d); cx2.lineTo(cx, cy + R); cx2.stroke();
  cx2.restore();
  cx2.strokeStyle = '#fff'; cx2.lineWidth = 3 * d;
  cx2.beginPath(); cx2.arc(cx, cy, R, 0, Math.PI * 2); cx2.stroke();
}

function canvasPt(e) { const r = cc.getBoundingClientRect(); return [(e.clientX - r.left) * view.dpr, (e.clientY - r.top) * view.dpr]; }
const toPhoto = ([x, y]) => [clamp((x - view.ox) / view.s, -.6 * S.W, 1.6 * S.W), clamp((y - view.oy) / view.s, -.6 * S.H, 1.6 * S.H)];
const setPt = (k, p) => { S.pts[k] = [p[0] / S.W, p[1] / S.H]; };

cc.addEventListener('pointerdown', e => {
  const q = canvasPt(e);
  try { cc.setPointerCapture(e.pointerId); } catch { }
  if (placing()) { placeAt = toPhoto(q); loupe = placeAt; drawCalib(); return; }
  let best = null, bd = 28 * view.dpr;
  for (const k of visibleKeys()) {
    const p = px(k), d = Math.hypot(view.ox + p[0] * view.s - q[0], view.oy + p[1] * view.s - q[1]);
    if (d < bd) { bd = d; best = k; }
  }
  if (best) { dragKey = best; loupe = px(best); drawCalib(); }
});
cc.addEventListener('pointermove', e => {
  const q = canvasPt(e);
  if (placing()) {
    if (placeAt) placeAt = toPhoto(q);
    loupe = e.pointerType === 'mouse' || placeAt ? toPhoto(q) : null;   // farede gezinirken de büyüteç
    drawCalib(); return;
  }
  if (!dragKey) return;
  setPt(dragKey, toPhoto(q)); loupe = px(dragKey);
  if (dragKey[0] === 'S') S.sideTouched = true;
  if (S.sideTouched) { autoLens(); syncLensUI(); }
  recalc();
});
const endPointer = () => {
  if (placeAt && placing()) {
    const k = ORDER[S.placeIdx];
    setPt(k, placeAt); S.placeIdx++;
    if (k === 'SR') { S.sideTouched = true; autoLens(); syncLensUI(); }
    placeAt = null; loupe = null; recalc(); pushHist(); return;
  }
  if (dragKey) { dragKey = null; loupe = null; recalc(); pushHist(); }      // bırakınca tam hesap (derinlik hata payı dahil)
};
cc.addEventListener('pointerup', endPointer);
cc.addEventListener('pointercancel', () => { placeAt = null; dragKey = null; loupe = null; drawCalib(); });
cc.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !placeAt && !dragKey) { loupe = null; drawCalib(); } });

/* ---------------- adım 3: 3D sahne + ışık ---------------- */
const MAXE = 256;                                       // ışık kaynakları dokuda tutulur; telefon ekran kartlarında da sığar
let R = null; // renderer paketi

const CCT = { 3000: [1.32, .95, .55], 4000: [1.14, .98, .80], 6500: [.93, 1.0, 1.13] };
const EMIT_HEX = { 3000: '#ffe2b0', 4000: '#f2f6ff', 6500: '#e6efff' };

const VERT = `varying vec3 vW; varying vec3 vN;
void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const FRAG = `#define MAXE ${MAXE}
uniform sampler2D uPhoto; uniform sampler2D uEm; uniform mat4 uPhotoVP;
uniform float uDay; uniform float uExpo; uniform float uBounce; uniform float uBefore; uniform vec3 uTint; uniform int uCount;
varying vec3 vW; varying vec3 vN;
void main(){
  vec4 cp = uPhotoVP * vec4(vW, 1.0);
  vec3 src = vec3(0.59);
  if (cp.w > 0.0) {
    vec2 uv = cp.xy / cp.w * 0.5 + 0.5;
    if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) src = texture2D(uPhoto, uv).rgb;
  }
  if (uBefore > 0.5) { gl_FragColor = vec4(src, 1.0); return; }   // önce: fotoğrafın kendisi
  vec3 alb = pow(src, vec3(2.2));
  vec3 N = normalize(vN);
  vec3 E = uTint * uBounce;
  for (int i = 0; i < MAXE; i++) {
    if (i >= uCount) break;
    vec4 a = texelFetch(uEm, ivec2(i, 0), 0), b = texelFetch(uEm, ivec2(i, 1), 0), c = texelFetch(uEm, ivec2(i, 2), 0);
    vec3 Lv = a.xyz - vW; float d2 = max(dot(Lv, Lv), 0.04); vec3 L = Lv * inversesqrt(d2);
    float ct = dot(-L, b.xyz); if (ct <= 0.0) continue;
    float cone = smoothstep(b.w, c.w, ct) * pow(ct, a.w);
    E += c.rgb * cone * max(dot(N, L), 0.0) / d2;
  }
  vec3 col = alb * (uDay + E * uExpo);
  col = col / (1.0 + col * 0.22) * 1.22;
  gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}`;

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, '#ffffffff'); gr.addColorStop(.25, '#ffffff88'); gr.addColorStop(1, '#ffffff00');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function startGL() {
  if (R && R.calRef === S.cal) { resizeGL(); buildFixtures(); return; }
  disposeGL();
  const c = S.cal, host = $('#glHost');
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const photoCam = new THREE.PerspectiveCamera(2 * Math.atan(S.H / 2 / c.f) * 180 / Math.PI, S.W / S.H, .05, 100);
  photoCam.position.set(...c.cam);
  const right = new THREE.Vector3(c.ex[0], c.up[0], c.n[0]);
  const down = new THREE.Vector3(c.ex[1], c.up[1], c.n[1]);
  const fwd = new THREE.Vector3(c.ex[2], c.up[2], c.n[2]);
  photoCam.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, down.clone().negate(), fwd.clone().negate()));
  photoCam.updateMatrixWorld(); photoCam.updateProjectionMatrix();
  const photoVP = new THREE.Matrix4().multiplyMatrices(photoCam.projectionMatrix, photoCam.matrixWorldInverse);

  const freeCam = photoCam.clone();
  const controls = new OrbitControls(freeCam, renderer.domElement);
  // Hedef, fotoğraf kamerasının baktığı doğrultuda: serbest görünüm fotoğraf açısıyla aynı başlar
  controls.target.copy(photoCam.position).addScaledVector(fwd, c.dist * .8);
  controls.update();
  controls.enableDamping = false; controls.enabled = false;
  // Yakınlaştırma kamerayı yürütmez, objektif gibi büyütür: fotoğraf çekildiği noktadan bakıldığı için bozulmaz
  controls.enableZoom = false;
  renderer.domElement.addEventListener('wheel', e => {
    if (S.view !== 'free' || !R) return;
    e.preventDefault();
    R.freeCam.fov = clamp(R.freeCam.fov * Math.exp(e.deltaY * .0012), 6, R.photoCam.fov); R.freeCam.updateProjectionMatrix(); render();
  }, { passive: false });
  controls.addEventListener('change', () => render());

  const emData = new Float32Array(MAXE * 3 * 4);
  const emTex = new THREE.DataTexture(emData, MAXE, 3, THREE.RGBAFormat, THREE.FloatType);
  emTex.minFilter = emTex.magFilter = THREE.NearestFilter; emTex.needsUpdate = true;
  const tex = new THREE.CanvasTexture(S.img);
  tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const uniforms = {
    uPhoto: { value: tex }, uPhotoVP: { value: photoVP }, uDay: { value: 1 }, uExpo: { value: 1 / 220 }, uBounce: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) },
    uCount: { value: 0 }, uBefore: { value: 0 }, uEm: { value: emTex },
  };
  // Banko: duvarların yeri bilinmez; geniş bir kutu (zemin ve tavan gerçek yükseklikte) + gerçek ölçüde banko gövdesi
  const BX = c.banko ? 3 : 0, roomGeo = new THREE.BoxGeometry(c.width + 2 * BX, c.H, c.depth + 2 * BX, 1, 1, 1);
  roomGeo.translate(c.width / 2, c.H / 2, c.depth / 2);
  const nrm = roomGeo.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
  const room = new THREE.Mesh(roomGeo, new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide }));
  scene.add(room);
  if (c.banko) {
    const bg = new THREE.BoxGeometry(c.width, c.tTop, c.depth); bg.translate(c.width / 2, c.tTop / 2, c.depth / 2);
    scene.add(new THREE.Mesh(bg, new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.FrontSide })));
  } else if (c.kind === 'vitrin') {
    // Vitrinin çevresi (çerçeve, mağaza tavanı, alt dolap): cam düzleminde, açıklık hariç; fotoğraf aynen üstüne düşer
    const outer = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.FrontSide }), B = 30;
    const quad = (x0, x1, y0, y1) => { const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, c.depth); scene.add(new THREE.Mesh(g, outer)); };
    quad(-B, c.width + B, c.H, B); quad(-B, c.width + B, -B, 0); quad(-B, 0, 0, c.H); quad(c.width, c.width + B, 0, c.H);
  }
  const railGroup = new THREE.Group(); scene.add(railGroup);
  const fxGroup = new THREE.Group(); scene.add(fxGroup);
  const guideGroup = new THREE.Group(); scene.add(guideGroup);

  const luxGroup = new THREE.Group(); scene.add(luxGroup);
  const footGroup = new THREE.Group(); scene.add(footGroup);
  R = { renderer, scene, photoCam, freeCam, controls, uniforms, railGroup, fxGroup, guideGroup, luxGroup, footGroup, emData, emTex, glow: glowTexture(), calRef: S.cal };
  if (c.kind === 'vitrin') initModel();
  bindGL();
  resizeGL();
  buildFixtures();
  setView(S.view);
}

function disposeGL() {
  if (!R) return;
  R.controls.dispose(); R.mControls?.dispose(); R.renderer.dispose(); R.renderer.domElement.remove(); R = null;
  $('#dimCanvas').hidden = true;
}

function curCam() { return S.view === 'model' && R.mScene ? (S.mView === 'persp' ? R.mPersp : R.mOrtho) : S.view === 'free' ? R.freeCam : R.photoCam; }

function resizeGL() {
  if (!R) return;
  const r = $('#stage').getBoundingClientRect();
  // Fotoğraf oranında: kenarlarda fotoğrafın kapsamadığı gri alan çıkmasın
  const k = Math.min(r.width / S.W, r.height / S.H), w = S.W * k, h = S.H * k;
  R.renderer.setSize(Math.floor(w), Math.floor(h));
  render();
  if (S.view === 'plan') drawPlan();
}

function render() {
  if (!R || S.view === 'plan') return;
  const r = R.renderer, cam = curCam();
  if (S.view === 'model') { r.render(R.mScene, cam); drawDims(); return; }
  if (!S.compare) { r.render(R.scene, cam); drawDims(); return; }
  // Önce–sonra: solda ışıksız fotoğraf, sağda tasarım
  const sz = r.getSize(new THREE.Vector2()), cut = Math.round(sz.x * S.split);
  r.setScissorTest(true);
  R.uniforms.uBefore.value = 1; R.railGroup.visible = R.fxGroup.visible = false;
  r.setScissor(0, 0, cut, sz.y); r.render(R.scene, cam);
  R.uniforms.uBefore.value = 0; R.railGroup.visible = R.fxGroup.visible = true;
  r.setScissor(cut, 0, sz.x - cut, sz.y); r.render(R.scene, cam);
  r.setScissorTest(false);
  placeSplit(); drawDims();
}
const HINTS = {
  photo: 'Ürünü seç: ray ürününü rayın üstüne, gömme spotu ve ETNA\'yı tavanda istediğin yere tıkla. Sürükleyerek taşı.',
  plan: 'Üstten görünüm, ölçüler metre. Ray ve ürünleri buradan da taşıyabilirsin.',
  free: 'Döndürmek için boş yeri sürükle, yakınlaştırmak için tekerlek. Fotoğrafın çekildiği açıdan çok uzaklaşınca eşyalar gerilir (derinlik bilgisi yok).',
  model: 'Ölçülü model: aynı proje, gerçek ölçüler (cm). ETNA\'ları burada da sürükleyebilirsin; fotoğrafta da aynı yere gider.',
};
function setView(v) {
  if (v === 'model' && R && !R.mScene) v = 'photo';
  S.view = v; document.body.dataset.view = v;
  $('#mviewSeg').hidden = v !== 'model';
  if (v === 'model' && S.compare) { S.compare = false; $('#cmpBtn').classList.remove('is-active'); }
  $$('#viewSeg button').forEach(b => b.classList.toggle('is-active', b.dataset.view === v));
  $('#planCanvas').hidden = v !== 'plan' || S.step !== 3;
  if (v === 'plan' && S.compare) { S.compare = false; $('#cmpBtn').classList.remove('is-active'); }
  placeSplit();
  $('#hint').textContent = S.mode === 'vitrin' && v === 'photo' ? 'ETNA\'ları sürükleyerek taşı. Yeni eklemek için ürünü seç, tavana tıkla.' : HINTS[v];
  if (!R) return;
  R.renderer.domElement.style.visibility = v === 'plan' ? 'hidden' : '';
  R.controls.enabled = v === 'free';
  if (R.mControls) R.mControls.enabled = v === 'model' && S.mView === 'persp';
  if (v === 'model') fitModel();
  resizeGL();
  if (v === 'plan') $('#dimCanvas').hidden = true;
}
$$('#viewSeg button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

/* ---------------- raylar ---------------- */
const sysOf = () => SYSTEMS.find(s => s.id === S.system);
const railById = id => S.rails.find(r => r.id === id);
const isSel = (kind, id) => (S.sel && S.sel.kind === kind && S.sel.id === id) || (kind === 'fx' && multiOn() && S.multi.includes(id));
// Toplu seçim: S.multi birden fazla ürün içeriyorsa ve son tıklanan (S.sel) da içindeyse geçerli
const multiOn = () => S.sel?.kind === 'fx' && S.multi.length > 1 && S.multi.includes(S.sel.id);
const selFx = () => multiOn() ? S.fixtures.filter(f => S.multi.includes(f.id)) : S.sel?.kind === 'fx' ? S.fixtures.filter(f => f.id === S.sel.id) : [];
const fmtM = v => v.toFixed(2).replace('.', ',') + ' m';

// Şeklin yerel noktaları (plan: x sağa, z kameraya doğru)
function shapeLocal(shape, d) {
  switch (shape) {
    case 'straight': return { pts: [[0, 0], [d[0], 0]], closed: false };
    case 'l': return { pts: [[0, -d[1]], [0, 0], [d[0], 0]], closed: false };
    case 'u': return { pts: [[0, -d[0]], [0, 0], [d[1], 0], [d[1], -d[2]]], closed: false };
    case 'square': return { pts: [[0, 0], [d[0], 0], [d[0], d[0]], [0, d[0]]], closed: true };
    default: return { pts: [[0, 0], [d[0], 0], [d[0], d[1]], [0, d[1]]], closed: true };
  }
}
function railGeom(r) {
  const { pts, closed } = shapeLocal(r.shape, r.dims);
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  // 90° adımlar + fotoğrafa oturtmak için ince açı (derece)
  const t = r.rot * Math.PI / 2 + (r.fine || 0) * Math.PI / 180, co = Math.cos(t), si = Math.sin(t);
  const P = pts.map(([x, z]) => [r.x + (x - cx) * co - (z - cz) * si, r.z + (x - cx) * si + (z - cz) * co]);
  const list = closed ? [...P, P[0]] : P;
  const segs = []; let s0 = 0;
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i], b = list[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, len, s0, dir: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] });
    s0 += len;
  }
  const PX = P.map(p => p[0]), PZ = P.map(p => p[1]);
  return { pts: P, closed, segs, len: s0, corners: closed ? P.length : P.length - 2,
    box: { x0: Math.min(...PX), x1: Math.max(...PX), z0: Math.min(...PZ), z1: Math.max(...PZ) } };
}
function projectOnRail(g, x, z) {
  let best = null;
  for (const sg of g.segs) {
    const t = clamp((x - sg.a[0]) * sg.dir[0] + (z - sg.a[1]) * sg.dir[1], 0, sg.len);
    const d = Math.hypot(sg.a[0] + sg.dir[0] * t - x, sg.a[1] + sg.dir[1] * t - z);
    if (!best || d < best.d) best = { s: sg.s0 + t, d };
  }
  return best;
}
function poseAt(g, s) {
  const sg = g.segs.find(q => s <= q.s0 + q.len + 1e-9) || g.segs[g.segs.length - 1];
  const t = clamp(s - sg.s0, 0, sg.len);
  return { x: sg.a[0] + sg.dir[0] * t, z: sg.a[1] + sg.dir[1] * t, rot: Math.atan2(sg.dir[1], sg.dir[0]) };
}
function clampRail(r) {
  const c = S.cal, b = railGeom(r).box, m = .05;
  if (b.x1 - b.x0 <= c.width - 2 * m) r.x += Math.max(0, m - b.x0) - Math.max(0, b.x1 - (c.width - m)); else r.x = c.width / 2;
  if (b.z1 - b.z0 <= c.depth - 2 * m) r.z += Math.max(0, m - b.z0) - Math.max(0, b.z1 - (c.depth - m)); else r.z = c.depth / 2;
}

/* ---- ürünün raydaki yeri ---- */
const GAP = .01, END = .03;
// Rayda kapladığı boy: spot ve sarkıt sadece adaptör kadar yer tutar [Tahmin]
const fxLen = p => (p.type === 'spot' || p.type === 'sarkit' ? .07 : p.lengthCm / 100);
// İstenen konuma en yakın geçerli yer: tek bir düz parçada kalır (köşeye binmez), başka ürünle çakışmaz
function placeOnRail(fx, rail, want) {
  const g = railGeom(rail), L = fxLen(fx.p);
  let si = g.segs.findIndex(q => want >= q.s0 && want <= q.s0 + q.len);
  if (si < 0) si = want < 0 ? 0 : g.segs.length - 1;
  const order = g.segs.map((_, i) => i).sort((a, b) => Math.abs(a - si) - Math.abs(b - si));
  const others = S.fixtures.filter(o => o !== fx && o.rail === rail.id).map(o => [o.s, fxLen(o.p)]);
  for (const i of order) {
    const q = g.segs[i], lo = q.s0 + L / 2 + END, hi = q.s0 + q.len - L / 2 - END;
    if (hi < lo) continue;
    const free = s => s >= lo - 1e-9 && s <= hi + 1e-9 && others.every(([os, ol]) => Math.abs(os - s) >= (ol + L) / 2 + GAP - 1e-6);
    const cands = [clamp(want, lo, hi), lo, hi];
    for (const [os, ol] of others) { const k = (ol + L) / 2 + GAP; cands.push(os - k, os + k); }
    const ok = cands.filter(free).sort((a, b) => Math.abs(a - want) - Math.abs(b - want));
    if (ok.length) return ok[0];
  }
  return null;
}
function fxPose(fx) {
  if (fx.rail == null) return { x: fx.x, z: fx.z, rot: fx.rot || 0 };   // gömme ürün: tavanda serbest
  const r = railById(fx.rail); return r ? poseAt(railGeom(r), fx.s) : null;
}
// Ray değişince üstündeki ürünleri yeniden yerleştir; sığmayanları kaldır
function revalidate(railId) {
  const r = railById(railId), list = S.fixtures.filter(f => f.rail === railId).sort((a, b) => a.s - b.s);
  let removed = 0;
  for (const f of list) {
    const s = r ? placeOnRail(f, r, f.s) : null;
    if (s == null) { S.fixtures = S.fixtures.filter(x => x !== f); removed++; } else f.s = s;
  }
  return removed;
}

// Işık yönü: aşağıdan, ürünün yan tarafına doğru eğim (tilt) ve bu yönün ürün eksenine göre dönüşü (yaw)
function aimDir(fx, rot) {
  const t = (fx.tilt || 0) * Math.PI / 180, y = (fx.yaw || 0) * Math.PI / 180;
  const ax = [Math.cos(rot), Math.sin(rot)], pr = [-Math.sin(rot), Math.cos(rot)];
  const h = [Math.cos(y) * pr[0] + Math.sin(y) * ax[0], Math.cos(y) * pr[1] + Math.sin(y) * ax[1]];
  return new THREE.Vector3(Math.sin(t) * h[0], -Math.cos(t), Math.sin(t) * h[1]);
}

function placeSplit() {
  const h = $('#split'); h.hidden = !(S.compare && S.view !== 'plan' && S.view !== 'model' && R);
  if (h.hidden) return;
  const cr = R.renderer.domElement.getBoundingClientRect(), sr = $('#stage').getBoundingClientRect();
  h.style.left = (cr.left - sr.left + cr.width * S.split) + 'px';
  h.style.top = (cr.top - sr.top) + 'px'; h.style.height = cr.height + 'px';
}

function addFree(sku, x, z, rot = 0) {
  const p = bySku[sku];
  const zn = ceilZone();
  const fx = { id: S.nextId++, p, x: clamp(x, zn.x0 + .1, zn.x1 - .1), z: clamp(z, zn.z0 + .1, zn.z1 - .1), rot, beam: p.beam, tilt: 0, yaw: 0 };
  if (zn.y !== S.cal.H) fx.y = zn.y;
  S.fixtures.push(fx); S.sel = { kind: 'fx', id: fx.id };
  buildFixtures(); pushHist();
  return fx;
}

/* ---- ürünlerin ışık kaynakları ---- */
// Ürünün ışık veren yüzünün yüksekliği: sıva üstünde rayın altında, sıva altında tavan hizasında
function faceY(p, fx) {
  if (fx && fx.y != null) return fx.y - .002;           // cam önü montaj: mağaza tavanı
  if (p.fam === 'gomme') return S.cal.H - .002 - (p.drop || 0);
  const sys = sysOf(), base = S.cal.H - (sys.recessed ? 0 : sys.drop) - .002;
  if (p.type === 'spot') return base - .093;
  if (p.type === 'sarkit') return base - .5;
  return base;
}
function emittersFor(fx) {
  const p = fx.p, pose = fxPose(fx); if (!pose) return [];
  const lm = lumenOf(p), L = p.lengthCm / 100, out = [], beam = fx.beam || p.beam;
  const ax = [Math.cos(pose.rot), Math.sin(pose.rot)], pr = [-ax[1], ax[0]], y = faceY(p, fx);
  const at = (t, u = 0) => new THREE.Vector3(pose.x + ax[0] * t + pr[0] * u, y, pose.z + ax[1] * t + pr[1] * u);
  const down = new THREE.Vector3(0, -1, 0), dir = p.aim ? aimDir(fx, pose.rot) : down;
  // Koni kenarında şiddet %50 (katalogdaki ışın açısı); şiddet, akı katalog lümenine eşit olacak şekilde (isik.js)
  const cone = deg => ISIK.beamCone(deg);
  const coneCd = (lumen, deg) => { const [c0, c1] = ISIK.beamCone(deg); return ISIK.candela(lumen, c0, c1, 0); };
  const wide = lumen => ({ cd: ISIK.candela(lumen, 0, .02, 1), cone: [0, .02], k: 1 });
  if (p.type === 'spot') {
    const n = p.heads || 1;                                // ikili spot: iki gövde, ışık ikiye bölünür
    for (let i = 0; i < n; i++) out.push({ pos: at(n === 1 ? 0 : (i - (n - 1) / 2) * .08), dir, cd: coneCd(lm * .82 / n, beam), cone: cone(beam), k: 0 });
    out.push({ pos: at(0), dir: down, ...wide(lm * .18) });
  } else if (p.type === 'downlight') {
    // Gömme spot: opal (Opus) yumuşak geniş ışık; mercekli/çok gözlü (Rotun, Dark, Daisy, Midy) her göz ayrı koni
    const n = p.heads || 1;
    if (p.opal) out.push({ pos: at(0), dir: down, ...wide(lm) });
    else {
      const m = Math.min(n, 8);
      for (let i = 0; i < m; i++) {
        const a = i / m * Math.PI * 2, pos = m === 1 ? at(0) : p.shape === 'round' ? at(Math.cos(a) * L * .33, Math.sin(a) * L * .33) : at((-.5 + (i + .5) / m) * L * .8);
        out.push({ pos, dir: down, cd: coneCd(lm * .92 / m, beam), cone: cone(beam), k: 0 });
      }
      out.push({ pos: at(0), dir: down, ...wide(lm * .08) });
    }
  } else if (p.type === 'gomme') {
    // Mercek sıraları en fazla 3×3 kaynakla temsil edilir
    const rows = p.rows, n = rows.length, cols = 3, W = p.widthCm / 100, share = lm * .9 / (n * cols);
    rows.forEach((_, ri) => { for (let ci = 0; ci < cols; ci++) out.push({ pos: at((-.5 + (ci + .5) / cols) * L * .85, (n === 1 ? 0 : -.5 + ri / (n - 1)) * W * .6), dir, cd: coneCd(share, beam), cone: cone(beam), k: 0 }); });
    out.push({ pos: at(0), dir: down, ...wide(lm * .1) });
  } else if (p.opal && p.type === 'hareketli') {          // hareketli opal: yöne çevrilebilen geniş ışık
    for (let i = 0; i < 3; i++) out.push({ pos: at((-.5 + (i + .5) / 3) * L * .8), dir, cd: coneCd(lm / 3, Math.min(beam, 120)), cone: cone(Math.min(beam, 120)), k: 0 });
  } else if (p.type === 'mercek' || p.type === 'hareketli') {
    const n = Math.min(p.lenses || 1, 6);
    for (let i = 0; i < n; i++) out.push({ pos: at((n === 1 ? 0 : -.5 + i / (n - 1)) * L * .8), dir, cd: coneCd(lm * .85 / n, beam), cone: cone(beam), k: 0 });
    out.push({ pos: at(0), dir: down, ...wide(lm * .15) });
  } else if (p.type === 'sarkit') {
    if (p.opal) out.push({ pos: at(0), dir: down, ...wide(lm) });
    else { out.push({ pos: at(0), dir: down, cd: coneCd(lm * .9, beam), cone: cone(beam), k: 0 }); out.push({ pos: at(0), dir: down, ...wide(lm * .1) }); }
  } else {
    const n = 6;
    for (let i = 0; i < n; i++) out.push({ pos: at((-.5 + (i + .5) / n) * L), dir: down, ...wide(lm / n) });
  }
  return out;
}

function updateLights() {
  if (!R) return;
  const u = R.uniforms, tint = CCT[S.cct], d = R.emData;
  const em = S.on ? S.fixtures.flatMap(emittersFor) : [];
  if (em.length > MAXE) toast(`Çok fazla ürün: ilk ${MAXE} ışık kaynağı hesaplanıyor.`);
  em.slice(0, MAXE).forEach((e, i) => {
    // 3 satırlık doku: [konum, k] [yön, koni dış] [renk×şiddet, koni iç]
    d.set([e.pos.x, e.pos.y, e.pos.z, e.k], i * 4);
    d.set([e.dir.x, e.dir.y, e.dir.z, e.cone[0]], (MAXE + i) * 4);
    d.set([tint[0] * e.cd, tint[1] * e.cd, tint[2] * e.cd, e.cone[1]], (2 * MAXE + i) * 4);
  });
  R.emTex.needsUpdate = true;
  u.uCount.value = Math.min(em.length, MAXE);
  const c = S.cal, area = 2 * (c.width * c.H + c.depth * c.H + c.width * c.depth);
  const lm = S.on ? S.fixtures.reduce((a, f) => a + lumenOf(f.p), 0) : 0;
  u.uBounce.value = lm * .45 / area;                    // duvarlardan seken dolaylı ışık (kaba)
  u.uTint.value.set(...tint);
  u.uDay.value = .035 + .965 * Math.pow(S.day, 1.6);
  // Otomatik pozlama: ortalama aydınlık (lümen yöntemi) çok yükselirse kamera gibi kısar; salon gibi normal odalarda 220 lx sabit kalır
  const eAvg = lm * .5 / Math.max(.5, c.width * c.depth);
  u.uExpo.value = S.gain / Math.max(220, eAvg * 1.1);
  computeLux();
}

/* ---- 3D gövdeler: raylar + ürünler ---- */
function disposeGroup(g) {
  g.children.slice().forEach(o => { g.remove(o); o.traverse(m => { m.geometry?.dispose(); m.material?.dispose?.(); }); });
}
function horizPlane(w, d, mat, y) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = Math.PI / 2; m.position.y = y; return m; }

function buildRails() {
  const g = R.railGroup; disposeGroup(g);
  const H = S.cal.H, sys = sysOf();
  for (const r of S.rails) {
    const geo = railGeom(r), sel = isSel('rail', r.id);
    const body = new THREE.MeshBasicMaterial({ color: sel ? '#f3a000' : '#101113' });
    for (const sg of geo.segs) {
      const grp = new THREE.Group(), L = sg.len + sys.w;   // köşelerde boşluk kalmasın
      grp.position.set((sg.a[0] + sg.b[0]) / 2, H, (sg.a[1] + sg.b[1]) / 2);
      grp.rotation.y = -Math.atan2(sg.dir[1], sg.dir[0]);
      if (sys.recessed) {
        if (sys.flange) grp.add(horizPlane(L + 2 * sys.flange, sys.w + 2 * sys.flange, new THREE.MeshBasicMaterial({ color: sel ? '#c98400' : '#2b2e33' }), -.0008));
        grp.add(horizPlane(L, sys.w, body, -.0014));
      } else {
        const box = new THREE.Mesh(new THREE.BoxGeometry(L, sys.drop, sys.w), body);
        box.position.y = -sys.drop / 2; grp.add(box);
      }
      g.add(grp);
    }
  }
}

function buildFixtureMeshes(g = R.fxGroup) {
  disposeGroup(g);
  const emit = S.on ? EMIT_HEX[S.cct] : '#55595e';
  for (const fx of S.fixtures) {
    const pose = fxPose(fx); if (!pose) continue;
    const p = fx.p, L = p.lengthCm / 100, sel = isSel('fx', fx.id), y = faceY(p, fx);
    const grp = new THREE.Group();
    grp.position.set(pose.x, 0, pose.z); grp.rotation.y = -pose.rot;
    const black = new THREE.MeshBasicMaterial({ color: '#16181b' });
    // Yanan yüz: gerçekte beyaza yakın görünür (ışık rengi hafif tonla); turuncu/sarı leke gibi durmasın
    const light = new THREE.MeshBasicMaterial({ color: S.on ? new THREE.Color(emit).lerp(new THREE.Color('#ffffff'), .72) : emit });
    let foot = [L + .03, .05];
    if (p.type === 'gomme') {
      // ETNA: ürünün gerçek fotoğrafı doku olarak; ışık açıkken mercekler kendi yerlerinde parlar
      const W = p.widthCm / 100; foot = [L + .03, W + .03];
      R.texCache ||= {};
      if (!R.texCache[p.sku]) {
        const t = new THREE.TextureLoader().load(p.tex, () => render());
        t.colorSpace = THREE.NoColorSpace; t.anisotropy = R.renderer.capabilities.getMaxAnisotropy(); R.texCache[p.sku] = t;
      }
      const shade = .3 + .7 * Math.max(S.day, S.on ? .35 : 0);   // akşam gövde kararır
      const body = new THREE.Mesh(new THREE.BoxGeometry(L, .03, W), new THREE.MeshBasicMaterial({ color: '#c9ccd0' })); body.position.y = y + .015; grp.add(body);   // gövde (üstten bakınca da görünür)
      grp.add(horizPlane(L, W, new THREE.MeshBasicMaterial({ map: R.texCache[p.sku], color: new THREE.Color(shade, shade, shade) }), y - .0004));
      if (S.on) for (const [u, v, r] of p.lensPos) {
        const d = new THREE.Mesh(new THREE.CircleGeometry(r * L * .55, 16), light);
        d.rotation.x = Math.PI / 2; d.position.set((u - .5) * L, y - .0008, (.5 - v) * W); grp.add(d);
      }
    } else if (p.type === 'downlight') {
      // Gömme spot: tavanla aynı hizada beyaz çerçeve; opal yüz ışık açıkken parlar, mercekliler koyu yuva + gözler
      const Lx = p.lengthCm / 100, Wz = (p.widthCm || p.lengthCm) / 100, n = p.heads || 1; foot = [Lx + .03, Wz + .03];
      const trim = new THREE.MeshBasicMaterial({ color: '#eceef0' }), dark = new THREE.MeshBasicMaterial({ color: '#202328' });
      if (p.mount) {                                          // sıva üstü silindir ya da sarkıt (askı + silindir)
        const hb = p.mount === 'sarkit' ? .11 : p.drop, body = new THREE.Mesh(new THREE.CylinderGeometry(Lx / 2, Lx / 2, hb, 32), trim);
        body.position.y = y + hb / 2 + .001; grp.add(body);
        if (p.mount === 'sarkit') { const cable = new THREE.Mesh(new THREE.CylinderGeometry(.002, .002, p.drop - hb, 6), dark); cable.position.y = y + hb + (p.drop - hb) / 2; grp.add(cable); }
      }
      if (p.look === 'blade') {                               // Blade: beyaz çerçeve, siyah LED halkası, beyaz orta
        const ring = new THREE.Mesh(new THREE.CircleGeometry(Lx / 2, 48), trim); ring.rotation.x = Math.PI / 2; ring.position.y = y - .0005; grp.add(ring);
        const band = new THREE.Mesh(new THREE.RingGeometry(Lx * .27, Lx * .44, 48), dark); band.rotation.x = Math.PI / 2; band.position.y = y - .0015; grp.add(band);
        const k = Math.min(n, 24), rr = Lx * .355;
        for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2, d = new THREE.Mesh(new THREE.CircleGeometry(Math.min(Lx * .06, Math.PI * rr / k * .7), 12), S.on ? light : new THREE.MeshBasicMaterial({ color: '#8a7650' }));
          d.rotation.x = Math.PI / 2; d.position.set(Math.cos(a) * rr, y - .0025, Math.sin(a) * rr); grp.add(d); }
      } else if (p.look === 'line') {                         // lineer kuyumcu (Case Light, Flat/Moving Line): beyaz gövde + mercek sırası
        grp.add(horizPlane(Lx, Wz, trim, y - .0005));
        const k = Math.min(n, 30);
        for (let i = 0; i < k; i++) { const d = new THREE.Mesh(new THREE.CircleGeometry(Math.min(Wz * .22, Lx * .4 / k), 12), S.on ? light : dark);
          d.rotation.x = Math.PI / 2; d.position.set((-.5 + (i + .5) / k) * Lx * .9, y - .0025, 0); grp.add(d); }
      } else if (p.shape === 'round') {
        const ring = new THREE.Mesh(new THREE.CircleGeometry(Lx / 2, 40), trim); ring.rotation.x = Math.PI / 2; ring.position.y = y - .0005; grp.add(ring);
        // Opal: yüzün tamamı yanar. Mercekli (Rotun, Midy, Tiny): açık gri reflektör + LED gözleri
        const inner = new THREE.Mesh(new THREE.CircleGeometry(Lx * (p.opal ? .42 : .38), 40), p.opal ? (S.on ? light : new THREE.MeshBasicMaterial({ color: '#dfe2e5' })) : new THREE.MeshBasicMaterial({ color: '#b9bec4' }));
        inner.rotation.x = Math.PI / 2; inner.position.y = y - .0015; grp.add(inner);
        if (!p.opal && S.on) {                                  // LED gözleri halka üstünde
          const k = Math.max(1, Math.round(p.watts / 3)), rr = Lx * .22;
          for (let i = 0; i < Math.min(k, 12); i++) { const a = i / Math.min(k, 12) * Math.PI * 2, d = new THREE.Mesh(new THREE.CircleGeometry(Lx * .045, 12), light);
            d.rotation.x = Math.PI / 2; d.position.set(k === 1 ? 0 : Math.cos(a) * rr, y - .0025, k === 1 ? 0 : Math.sin(a) * rr); grp.add(d); }
        }
      } else {
        grp.add(horizPlane(Lx, Wz, trim, y - .0005));
        grp.add(horizPlane(Lx * .88, Wz * .62, dark, y - .0015));
        if (S.on) for (let i = 0; i < n; i++) { const d = new THREE.Mesh(new THREE.CircleGeometry(Math.min(Wz * .2, Lx * .4 / n), 14), light);
          d.rotation.x = Math.PI / 2; d.position.set(n === 1 ? 0 : (-.5 + (i + .5) / n) * Lx * .8, y - .0025, 0); grp.add(d); }
      }
    } else if (p.type === 'spot' || p.type === 'sarkit') {
      const base = S.cal.H - (sysOf().recessed ? 0 : sysOf().drop) - .002;
      const adapt = new THREE.Mesh(new THREE.BoxGeometry(.06, .02, .022), black); adapt.position.y = base + .01; grp.add(adapt);
      if (p.type === 'sarkit') { const cable = new THREE.Mesh(new THREE.CylinderGeometry(.002, .002, .4, 6), black); cable.position.y = base - .2; grp.add(cable); }
      // Gövde eğim yönüne döner: pivot adaptörde
      const head = new THREE.Group(); head.position.y = base;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.031, .031, .085, 24), black); body.position.y = y - base + .0425; head.add(body);
      const face = new THREE.Mesh(new THREE.CircleGeometry(.024, 24), light); face.rotation.x = Math.PI / 2; face.position.y = y - base - .0005; head.add(face);
      if (p.aim && fx.tilt) {
        const dw = aimDir(fx, pose.rot), local = new THREE.Vector3(dw.x, dw.y, dw.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), pose.rot);
        head.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), local.normalize());
      }
      grp.add(head); foot = [.09, .05];
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(L, .04, .021), black); body.position.y = y + .02; grp.add(body);
      if (p.type === 'lineer') grp.add(horizPlane(L * .94, .012, light, y - .0005));
      else {
        const n = p.lenses || 1, step = L * .9 / n;
        for (let i = 0; i < n; i++) {
          const d = new THREE.Mesh(new THREE.CircleGeometry(Math.min(.0065, step * .4), 14), light);
          d.rotation.x = Math.PI / 2; d.position.set(-L * .45 + step * (i + .5), y - .0005, 0); grp.add(d);
        }
      }
    }
    if (sel) grp.add(horizPlane(foot[0] + .02, foot[1] + .02, new THREE.MeshBasicMaterial({ color: '#f3a000', transparent: true, opacity: p.type === 'gomme' ? .45 : .75, depthWrite: false }), y - .003));
    // Ürünün etrafında hale (parlama) çizilmez: kaynak net görünür, sadece yüzeylere vuran ışık hesaplanır
    g.add(grp);
  }
}

// Her değişiklikten sonra: 3D + plan + panel
function buildFixtures() {
  if (!R) return;
  buildRails(); buildFixtureMeshes(); buildGuides(); updateLights(); buildFoot(); buildModel();
  renderSelTools(); renderMaterials();
  render();
  if (S.view === 'plan') drawPlan();
}

/* ---------------- plan (üstten) görünüm ---------------- */
const pc = $('#planCanvas'), pg = pc.getContext('2d');
let plan = { s: 1, ox: 0, oz: 0, dpr: 1 };
const TYPE_COL = { spot: '#f3a000', mercek: '#1e9bff', hareketli: '#7a5cff', lineer: '#e0b100', sarkit: '#1f8a45', gomme: '#f4f5f6', downlight: '#f4f5f6' };

function drawPlan() {
  if (S.view !== 'plan' || S.step !== 3 || !S.cal) return;
  const dpr = sizeCanvas(pc), W = pc.width, Hc = pc.height, c = S.cal;
  const vit = c.kind === 'vitrin', zTop = c.banko ? c.zone.z0 : vit && S.vit.place === 'onu' ? -vitGeo().vitD : 0, Z1 = (c.banko ? c.zone.z1 : c.depth) - zTop;
  const pad = 46 * dpr, s = Math.min((W - 2 * pad) / c.width, (Hc - 2 * pad) / Z1);
  const ox = (W - c.width * s) / 2, oz = (Hc - Z1 * s) / 2 - zTop * s;
  plan = { s, ox, oz, dpr };
  const T = (x, z) => [ox + x * s, oz + z * s], g = pg;
  const font = (px, w = 700) => { g.font = `${w} ${px * dpr}px Work Sans, sans-serif`; };
  g.fillStyle = '#eef0f2'; g.fillRect(0, 0, W, Hc);
  g.fillStyle = '#fff'; g.fillRect(ox, oz, c.width * s, c.depth * s);
  if (zTop < 0 && !c.banko) {                             // cam önü montaj: camın arkasındaki vitrin içi ve tabla
    g.fillStyle = '#f6f0e2'; g.fillRect(...T(0, zTop), c.width * s, -zTop * s);
    g.strokeStyle = '#b8964f'; g.lineWidth = 1.5 * dpr; g.strokeRect(...T(0, zTop), c.width * s, -zTop * s);
  }
  if (S.luxMap && S.luxRes && R?.luxCv) {
    const lr = S.luxRes.rect; g.save(); g.globalAlpha = .9; g.imageSmoothingEnabled = true;
    g.drawImage(R.luxCv, ...T(lr.x0, lr.z0), (lr.x1 - lr.x0) * s, (lr.z1 - lr.z0) * s); g.restore();
  }
  for (let x = .5; x < c.width; x += .5) { g.strokeStyle = Math.abs(x % 1) < 1e-6 ? '#dde1e5' : '#eef0f2'; g.lineWidth = dpr; g.beginPath(); g.moveTo(...T(x, 0)); g.lineTo(...T(x, c.depth)); g.stroke(); }
  for (let z = .5; z < c.depth; z += .5) { g.strokeStyle = Math.abs(z % 1) < 1e-6 ? '#dde1e5' : '#eef0f2'; g.lineWidth = dpr; g.beginPath(); g.moveTo(...T(0, z)); g.lineTo(...T(c.width, z)); g.stroke(); }
  g.strokeStyle = '#202329'; g.lineWidth = 2 * dpr; g.strokeRect(ox, oz, c.width * s, c.depth * s);
  g.fillStyle = '#202329'; g.fillRect(ox, oz - 5 * dpr, c.width * s, 5 * dpr);
  font(11); g.textAlign = 'center'; g.fillStyle = '#6f747c';
  g.fillText(c.banko ? `Banko (uzak kenar) · ${fmtM(c.width)}` : vit ? `${S.vit.place === 'onu' ? 'Vitrin camı' : 'Vitrin arkası'} · ${fmtM(c.width)}` : `Arka duvar (fotoğraftaki) · ${fmtM(c.width)}`, ox + c.width * s / 2, oz - 11 * dpr);

  g.save(); g.translate(ox - 12 * dpr, oz + c.depth * s / 2); g.rotate(-Math.PI / 2); g.fillText(`${c.banko ? 'Banko derinliği' : vit && zTop < 0 ? 'Cam önü tavan' : 'Derinlik'} ${fmtM(c.depth)}`, 0, 0); g.restore();
  if (zTop < 0 && !c.banko) { g.save(); g.translate(ox - 12 * dpr, oz + zTop * s / 2); g.rotate(-Math.PI / 2); g.fillStyle = '#8a6a2a'; g.fillText(`Vitrin içi · tabla ${fmtM(-zTop)}`, 0, 0); g.restore(); g.fillStyle = '#6f747c'; }

  // fotoğrafın çekildiği yer ve bakış açısı
  const [kx, kz] = T(c.cam[0], c.cam[2]), fwd = [c.ex[2], c.n[2]], fl = Math.hypot(fwd[0], fwd[1]) || 1;
  const yaw = Math.atan2(fwd[1] / fl, fwd[0] / fl), hf = Math.atan(S.W / 2 / c.f);
  g.fillStyle = '#1e9bff22'; g.beginPath(); g.moveTo(kx, kz);
  g.arc(kx, kz, Math.min(1.6, c.dist) * s, yaw - hf, yaw + hf); g.closePath(); g.fill();
  g.fillStyle = '#1e9bff'; g.beginPath(); g.arc(kx, kz, 6 * dpr, 0, Math.PI * 2); g.fill();
  font(10); g.fillText('📷 fotoğraf', kx, kz + 18 * dpr);

  // ışığın zemine düştüğü alan (yaklaşık)
  if (S.on) for (const fx of S.fixtures) {
    const ps = fxPose(fx); if (!ps) continue;
    const p = fx.p, h = faceY(p, fx), beam = fx.beam || p.beam, rad = beam ? h * Math.tan(beam / 2 * Math.PI / 180) * 1.25 : h * .9;
    const dir = p.aim ? aimDir(fx, ps.rot) : null, k = dir ? h / Math.max(.2, -dir.y) : 0;   // eğik ışık zeminde kayar
    const [x, z] = T(ps.x + (dir ? dir.x * k : 0), ps.z + (dir ? dir.z * k : 0)), gr = g.createRadialGradient(x, z, 0, x, z, rad * s);
    gr.addColorStop(0, S.cct === 3000 ? '#ffc04a55' : '#9cc8ff55'); gr.addColorStop(1, '#ffffff00');
    g.fillStyle = gr; g.beginPath(); g.arc(x, z, rad * s, 0, Math.PI * 2); g.fill();
  }

  // raylar + parça ölçüleri
  const sys = sysOf();
  for (const r of S.rails) {
    const geo = railGeom(r), sel = isSel('rail', r.id);
    g.strokeStyle = sel ? '#f3a000' : '#202329'; g.lineWidth = Math.max(4 * dpr, sys.w * s); g.lineJoin = 'miter'; g.lineCap = 'square';
    g.beginPath(); geo.pts.forEach((p, i) => (i ? g.lineTo(...T(...p)) : g.moveTo(...T(...p)))); if (geo.closed) g.closePath(); g.stroke();
    font(10); g.fillStyle = sel ? '#9a6500' : '#40444b';
    for (const q of geo.segs) {
      if (q.len * s < 46 * dpr) continue;                 // kısa parçada yazı sığmaz
      const mx = (q.a[0] + q.b[0]) / 2, mz = (q.a[1] + q.b[1]) / 2, nx = -q.dir[1], nz = q.dir[0];
      const [tx, tz] = T(mx + nx * .16, mz + nz * .16); g.textAlign = 'center'; g.fillText(fmtM(q.len), tx, tz + 4 * dpr);
    }
    if (sel) {                                            // duvarlara mesafe
      const b = geo.box; g.strokeStyle = '#f3a000'; g.lineWidth = 1.2 * dpr; g.setLineDash([4 * dpr, 3 * dpr]);
      const zm = (b.z0 + b.z1) / 2, xm = (b.x0 + b.x1) / 2;
      g.beginPath(); g.moveTo(...T(0, zm)); g.lineTo(...T(b.x0, zm)); g.moveTo(...T(xm, 0)); g.lineTo(...T(xm, b.z0)); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#9a6500'; font(10);
      g.fillText(fmtM(b.x0), ...T(b.x0 / 2, zm - .08)); g.fillText(fmtM(b.z0), ...T(xm + .3, b.z0 / 2));
    }
  }
  // kılavuz çizgiler: kesik mavi, kenar ölçüleriyle
  for (const gd of S.guides) {
    const sel = isSel('guide', gd.id), col = sel ? '#f3a000' : '#1e9bff';
    g.strokeStyle = col; g.lineWidth = 2 * dpr; g.setLineDash([7 * dpr, 4 * dpr]); g.lineCap = 'round';
    g.beginPath(); gd.pts.forEach((p, i) => (i ? g.lineTo(...T(...p)) : g.moveTo(...T(...p)))); if (gd.closed) g.closePath(); g.stroke(); g.setLineDash([]);
    if (gd.closed) { g.fillStyle = col + '14'; g.fill(); }
    font(10); g.fillStyle = sel ? '#9a6500' : '#0f6fbf'; g.textAlign = 'center';
    for (const [a, b] of guideSegs(gd)) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L * s < 40 * dpr) continue;
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L;
      g.fillText(fmtM(L), ...T(mx - nx * .12, mz - nz * .12));
    }
    for (const p of gd.pts) { const [x, z] = T(...p); g.fillStyle = '#fff'; g.strokeStyle = col; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(x, z, 4.5 * dpr, 0, Math.PI * 2); g.fill(); g.stroke(); }
  }
  const dg = guideById(S.drawing);
  if (dg && S.ghost) { g.strokeStyle = '#1e9bff99'; g.lineWidth = 1.5 * dpr; g.setLineDash([4 * dpr, 4 * dpr]); g.beginPath(); g.moveTo(...T(...dg.pts[dg.pts.length - 1])); g.lineTo(...T(...S.ghost)); g.stroke(); g.setLineDash([]); }
  // ürünler
  for (const fx of S.fixtures) {
    const ps = fxPose(fx); if (!ps) continue;
    const p = fx.p, [x, z] = T(ps.x, ps.z), sel = isSel('fx', fx.id);
    g.save(); g.translate(x, z); g.rotate(ps.rot);
    const round = p.type === 'spot' || p.type === 'sarkit', len = round ? 9 * dpr : Math.max(8 * dpr, p.lengthCm / 100 * s);
    if (p.type === 'downlight') {                        // gömme spot: gerçek ölçüde beyaz çerçeve (en az 7 px)
      const lx = Math.max(7 * dpr, p.lengthCm / 100 * s), wz = Math.max(7 * dpr, (p.widthCm || p.lengthCm) / 100 * s);
      if (sel) { g.fillStyle = '#f3a00066'; g.fillRect(-lx / 2 - 4 * dpr, -wz / 2 - 4 * dpr, lx + 8 * dpr, wz + 8 * dpr); }
      g.fillStyle = '#f4f5f6'; g.strokeStyle = '#202329'; g.lineWidth = 1.2 * dpr; g.beginPath();
      if (p.shape === 'round') g.arc(0, 0, lx / 2, 0, Math.PI * 2); else g.rect(-lx / 2, -wz / 2, lx, wz);
      g.fill(); g.stroke();
      g.fillStyle = p.opal ? '#ffd76a' : '#2a2d31'; g.beginPath();
      if (p.shape === 'round') g.arc(0, 0, lx * .34, 0, Math.PI * 2); else g.rect(-lx * .42, -wz * .28, lx * .84, wz * .56);
      g.fill(); g.restore(); continue;
    }
    if (p.type === 'gomme') {                            // ETNA: gerçek ölçüde beyaz dikdörtgen
      const wd = Math.max(6 * dpr, p.widthCm / 100 * s);
      if (sel) { g.fillStyle = '#f3a00066'; g.fillRect(-len / 2 - 4 * dpr, -wd / 2 - 4 * dpr, len + 8 * dpr, wd + 8 * dpr); }
      g.fillStyle = '#f4f5f6'; g.strokeStyle = '#202329'; g.lineWidth = 1.2 * dpr; g.fillRect(-len / 2, -wd / 2, len, wd); g.strokeRect(-len / 2, -wd / 2, len, wd);
      g.fillStyle = '#9aa1a8'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(-len * .36 + i * len * .18, 0, 1.6 * dpr, 0, Math.PI * 2); g.fill(); }
      g.restore(); continue;
    }
    if (sel) { g.fillStyle = '#f3a00066'; g.fillRect(-len / 2 - 4 * dpr, -9 * dpr, len + 8 * dpr, 18 * dpr); }
    g.fillStyle = TYPE_COL[p.type] || '#888'; g.strokeStyle = '#202329'; g.lineWidth = 1.2 * dpr;
    if (round) { g.beginPath(); g.arc(0, 0, len / 2 + 1 * dpr, 0, Math.PI * 2); g.fill(); g.stroke(); }
    else { g.fillRect(-len / 2, -4 * dpr, len, 8 * dpr); g.strokeRect(-len / 2, -4 * dpr, len, 8 * dpr); }
    g.restore();
  }
  // ölçek çubuğu
  const [bx, bz] = [ox, oz + (c.banko ? c.zone.z1 : c.depth) * s + 22 * dpr];
  g.fillStyle = '#202329'; g.fillRect(bx, bz, s, 3 * dpr); font(10); g.textAlign = 'left'; g.fillText('1 m', bx + s + 6 * dpr, bz + 5 * dpr);
}
function planHit(e) {
  const r = pc.getBoundingClientRect(), d = plan.dpr;
  const x = ((e.clientX - r.left) * d - plan.ox) / plan.s, z = ((e.clientY - r.top) * d - plan.oz) / plan.s;
  return { x, z, inside: inZone(ceilZone(), x, z) };
}

/* ---------------- etkileşim (fotoğraf, serbest 3D ve plan için ortak) ---------------- */
let drag = null, downAt = null;
// Ürünlerin takıldığı tavan: oda tavanı, vitrin tavanı ya da (cam önü montajda) vitrinin önündeki mağaza tavanı
function ceilZone() {
  const c = S.cal;
  if (c.zone) return { y: c.H, ...c.zone };
  return { y: c.H, x0: 0, x1: c.width, z0: 0, z1: c.depth };
}
const inZone = (z, x, y) => x > z.x0 + .05 && x < z.x1 - .05 && y > z.z0 + .05 && y < z.z1 - .05;
function ceilHit(e) {
  const el = R.renderer.domElement, r = el.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, curCam());
  const d = rc.ray.direction, zn = ceilZone();
  const o = S.view === 'model' ? new THREE.Vector3(...m2w(rc.ray.origin.toArray())) : rc.ray.origin;
  if (Math.abs(d.y) < 1e-6) return null;
  const t = (zn.y - o.y) / d.y; if (t <= 0) return null;
  const x = o.x + d.x * t, z = o.z + d.z * t;
  return { x, z, inside: inZone(zn, x, z) };
}
/* ---------------- kılavuz çizgiler (vitrin/tavan kenarları) ---------------- */
const SNAP = .04;                                         // köşeye yapışma mesafesi (m)
const guideById = id => S.guides.find(g => g.id === id);
function guideSegs(g) { const p = g.closed ? [...g.pts, g.pts[0]] : g.pts, out = []; for (let i = 0; i < p.length - 1; i++) out.push([p[i], p[i + 1]]); return out; }
function nearestGuideVertex(h, maxD, skip) {
  let best = null;
  for (const g of S.guides) g.pts.forEach((p, i) => {
    if (skip && skip.g === g && skip.i === i) return;
    const d = Math.hypot(p[0] - h.x, p[1] - h.z); if (d <= maxD && (!best || d < best.d)) best = { g, i, d };
  });
  return best;
}
function nearestGuideSeg(h, maxD) {
  let best = null;
  for (const g of S.guides) for (const [a, b] of guideSegs(g)) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, t = clamp((h.x - a[0]) * ux + (h.z - a[1]) * uz, 0, L);
    const d = Math.hypot(a[0] + ux * t - h.x, a[1] + uz * t - h.z);
    if (d <= maxD && (!best || d < best.d)) best = { g, d, ang: Math.atan2(uz, ux) * 180 / Math.PI };
  }
  return best;
}
// Yeni nokta: mevcut köşeye yapışır; değilse önceki kenara göre 0°/90° yakınsa düzeltilir
function snapPoint(h, skip) {
  const v = nearestGuideVertex(h, SNAP, skip); if (v) return [...v.g.pts[v.i]];
  const g = guideById(S.drawing);
  if (g && g.pts.length >= 2 && !skip) {
    const a = g.pts[g.pts.length - 2], b = g.pts[g.pts.length - 1], d0 = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const vx = h.x - b[0], vz = h.z - b[1], L = Math.hypot(vx, vz), ang = Math.atan2(vz, vx);
    for (const k of [0, 1, 2, 3]) {
      const t = d0 + k * Math.PI / 2, diff = Math.atan2(Math.sin(ang - t), Math.cos(ang - t));
      if (Math.abs(diff) < 5 * Math.PI / 180) { const pr = L * Math.cos(diff); return [b[0] + Math.cos(t) * pr, b[1] + Math.sin(t) * pr]; }
    }
  }
  return [h.x, h.z];
}
function setTool(t) {
  if (S.tool === 'guide' && t !== 'guide') finishGuide();
  S.tool = t; $('#guideBtn').classList.toggle('is-active', t === 'guide');
  if (t === 'guide') { S.active = null; S.sel = null; renderProducts(); if (S.compare) $('#cmpBtn').click(); }
  $('#hint').textContent = t === 'guide' ? 'Kılavuz: tavanda köşelere sırayla tıkla. İlk noktaya tıklayınca şekil kapanır. Bitirmek için Esc ya da tekrar ✏.' : HINTS[S.view];
  if (R) buildFixtures();
}
function finishGuide() {
  const g = guideById(S.drawing);
  if (g && g.pts.length < 2) S.guides = S.guides.filter(x => x !== g);
  S.drawing = null; S.ghost = null;
}
function guideClick(h) {
  if (!h) return;
  const p = snapPoint(h);
  let g = guideById(S.drawing);
  if (!g) { g = { id: S.nextId++, pts: [p], closed: false }; S.guides.push(g); S.drawing = g.id; }
  else {
    const f = g.pts[0];
    if (g.pts.length >= 3 && Math.hypot(p[0] - f[0], p[1] - f[1]) <= SNAP * 1.5) {
      g.closed = true; S.drawing = null; S.ghost = null; S.sel = { kind: 'guide', id: g.id };
      toast(`Kılavuz kapandı: ${g.pts.length} çizgi. Plan'da ölçüleriyle görünür.`);
      buildFixtures(); pushHist(); return;
    }
    g.pts.push(p);
  }
  buildFixtures(); pushHist();
}
function guideHover(h) {
  if (S.tool !== 'guide' || !S.drawing || !h) return;
  S.ghost = snapPoint(h); buildGuides(); render(); if (S.view === 'plan') drawPlan();
}
function buildGuides() {
  if (!R) return;
  const g3 = R.guideGroup; disposeGroup(g3);
  const H = S.cal.H, y = H - .0012;
  const strip = (a, b, col, w, op = 1) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-4) return;
    const m = horizPlane(L, w, new THREE.MeshBasicMaterial({ color: col, transparent: op < 1, opacity: op, depthWrite: false }), 0);
    const grp = new THREE.Group(); grp.position.set((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2); grp.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]); grp.add(m); g3.add(grp);
  };
  const dot = (p, col) => { const d = new THREE.Mesh(new THREE.CircleGeometry(.014, 16), new THREE.MeshBasicMaterial({ color: col, depthWrite: false })); d.rotation.x = Math.PI / 2; d.position.set(p[0], y - .0002, p[1]); g3.add(d); };
  for (const g of S.guides) {
    const col = isSel('guide', g.id) ? '#f3a000' : '#1e9bff';
    for (const [a, b] of guideSegs(g)) strip(a, b, col, .01);
    g.pts.forEach(p => dot(p, '#ffffff'));
  }
  const dg = guideById(S.drawing);
  if (dg && S.ghost) strip(dg.pts[dg.pts.length - 1], S.ghost, '#1e9bff', .007, .6);
}
function alignToGuide() {
  const fx = S.sel?.kind === 'fx' && S.fixtures.find(f => f.id === S.sel.id); if (!fx) return;
  const ps = fxPose(fx), ng = nearestGuideSeg({ x: ps.x, z: ps.z }, 50);
  if (!ng) { toast('Önce bir kılavuz çizgi çiz (✏ Kılavuz çiz).'); return; }
  const cur = selAngle(); let best = ng.ang;
  for (const k of [-2, -1, 0, 1, 2]) { const a = norm180(ng.ang + k * 90); if (Math.abs(norm180(a - cur)) < Math.abs(norm180(best - cur))) best = a; }
  setAngle(Math.round(best * 10) / 10);
  toast('En yakın kılavuz çizgiye paralel yapıldı.');
}

function pickAt(h) {
  if (S.tool !== 'guide') {
    const v = nearestGuideVertex(h, .05);
    if (v) return { kind: 'gv', g: v.g, i: v.i };
  }
  let best = null, bd = .12;
  for (const fx of S.fixtures) {
    const ps = fxPose(fx); if (!ps) continue;
    const ax = [Math.cos(ps.rot), Math.sin(ps.rot)], dx = h.x - ps.x, dz = h.z - ps.z;
    const half = fx.p.type === 'gomme' ? fx.p.lengthCm / 200 : fxLen(fx.p) / 2, halfW = fx.p.type === 'gomme' ? fx.p.widthCm / 200 : 0;
    const t = clamp(dx * ax[0] + dz * ax[1], -half, half), u = clamp(-dx * ax[1] + dz * ax[0], -halfW, halfW);
    const d = Math.hypot(dx - ax[0] * t + ax[1] * u, dz - ax[1] * t - ax[0] * u);
    if (d < bd) { bd = d; best = fx; }
  }
  if (best) return { kind: 'fx', fx: best };
  const nr = nearestRail(h, .15);
  if (nr) return { kind: 'rail', ...nr };
  const ng = nearestGuideSeg(h, .03);
  return ng ? { kind: 'guide', g: ng.g } : null;
}
function nearestRail(h, maxD) {
  let best = null;
  for (const r of S.rails) { const p = projectOnRail(railGeom(r), h.x, h.z); if (p.d <= maxD && (!best || p.d < best.d)) best = { rail: r, s: p.s, d: p.d }; }
  return best;
}

function onDown(h, e) {
  downAt = [e.clientX, e.clientY];
  drag = null;
  if (!h) return false;
  if (S.tool === 'guide') { drag = { kind: 'tool', moved: false }; return S.view !== 'free'; }   // serbest 3D'de döndürmeye izin ver
  const pk = pickAt(h);
  if (pk?.kind === 'gv') { S.sel = { kind: 'guide', id: pk.g.id }; drag = { kind: 'gv', g: pk.g, i: pk.i, moved: false }; buildFixtures(); return true; }
  if (pk?.kind === 'guide') { drag = { kind: 'guide', g: pk.g, moved: false }; return true; }
  if (pk?.kind === 'fx') {
    const id = pk.fx.id;
    if (e.shiftKey || e.ctrlKey || e.metaKey) {           // toplu seçime ekle / çıkar
      const cur = multiOn() ? [...S.multi] : S.sel?.kind === 'fx' ? [S.sel.id] : [];
      const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
      S.multi = next; S.sel = next.length ? { kind: 'fx', id: next.includes(id) ? id : next[next.length - 1] } : null;
      drag = { kind: 'pick' }; buildFixtures(); return true;
    }
    const group = multiOn() && S.multi.includes(id);
    if (!group) S.multi = [id];
    S.sel = { kind: 'fx', id };
    const ps = fxPose(pk.fx);
    drag = { kind: 'fx', fx: pk.fx, moved: false, off: [ps.x - h.x, ps.z - h.z],
      group: group ? selFx().filter(f => f.rail == null).map(f => ({ f, off: [f.x - h.x, f.z - h.z] })) : null };
    buildFixtures(); return true;
  }
  if (pk?.kind === 'rail') { drag = { kind: 'rail', rail: pk.rail, s: pk.s, start: h, orig: [pk.rail.x, pk.rail.z], moved: false }; return true; }
  return false;
}
function onMove(h, e) {
  if (!drag || !h) return;
  const far = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6;
  if (drag.kind === 'tool') { if (far) drag.moved = true; return; }
  if (drag.kind === 'guide') return;
  if (drag.kind === 'gv') {                              // kılavuz köşesini taşı (başka köşeye yapışır)
    if (!far && !drag.moved) return;
    drag.g.pts[drag.i] = snapPoint(h, { g: drag.g, i: drag.i }); drag.moved = true; buildFixtures(); return;
  }
  if (drag.kind === 'fx') {
    if (!far && !drag.moved) return;
    if (drag.group) {                                    // toplu: hepsi aynı kadar kayar, grup tavandan taşmaz
      const zn = ceilZone(), lo = [zn.x0 + .1, zn.z0 + .1], hi = [zn.x1 - .1, zn.z1 - .1];
      const want = drag.group.map(({ off }) => [h.x + off[0], h.z + off[1]]);
      const fit = k => { const mn = Math.min(...want.map(w => w[k])), mx = Math.max(...want.map(w => w[k])); return mn < lo[k] ? lo[k] - mn : mx > hi[k] ? hi[k] - mx : 0; };
      const dx = fit(0), dz = fit(1);
      drag.group.forEach(({ f }, i) => { f.x = clamp(want[i][0] + dx, lo[0], hi[0]); f.z = clamp(want[i][1] + dz, lo[1], hi[1]); });
      drag.moved = true; buildFixtures(); return;
    }
    if (drag.fx.rail == null) {                          // gömme: tavanda serbest taşınır
      const zn = ceilZone(); drag.fx.x = clamp(h.x + drag.off[0], zn.x0 + .1, zn.x1 - .1); drag.fx.z = clamp(h.z + drag.off[1], zn.z0 + .1, zn.z1 - .1);
      drag.moved = true; buildFixtures(); return;
    }
    // Kendi rayında kalır (uçta durur); başka bir raya ancak 30 cm yaklaştırılırsa geçer
    const own = railById(drag.fx.rail), po = projectOnRail(railGeom(own), h.x, h.z);
    let target = { rail: own, s: po.s };
    const nr = nearestRail(h, .3);
    if (nr && nr.rail !== own && nr.d < po.d - .05) target = nr;
    const s = placeOnRail(drag.fx, target.rail, target.s);
    if (s != null) { drag.fx.rail = target.rail.id; drag.fx.s = s; drag.moved = true; buildFixtures(); }
  } else if (drag.kind === 'rail' && (far || drag.moved)) {
    const r = drag.rail; r.x = drag.orig[0] + h.x - drag.start.x; r.z = drag.orig[1] + h.z - drag.start.z;
    clampRail(r); S.sel = { kind: 'rail', id: r.id }; drag.moved = true; buildFixtures();
  }
}
function onUp(h, e) {
  const moved = downAt ? Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6 : true;
  const d = drag; drag = null;
  if (d?.kind === 'tool') { if (!d.moved) guideClick(h); return; }
  if (d?.kind === 'pick') return;                        // toplu seçime eklendi / çıkarıldı
  if (d?.moved) { pushHist(); return; }
  if (d?.kind === 'fx' || d?.kind === 'gv') return;      // sadece seçildi
  if (d?.kind === 'guide') { if (!moved) { S.sel = { kind: 'guide', id: d.g.id }; buildFixtures(); } return; }
  if (moved) return;
  const act = S.active && bySku[S.active];
  if (act && act.fam === 'gomme') {                      // gömme ürün: tavanda tıklanan yere
    if (h && h.inside) addFree(S.active, h.x, h.z); else toast('Gömme ürünü tavana tıklayarak ekle.');
    return;
  }
  if (d?.kind === 'rail') {
    if (S.active) addOnRail(S.active, d.rail, d.s);
    else { S.sel = { kind: 'rail', id: d.rail.id }; buildFixtures(); }
    return;
  }
  if (h && h.inside && S.active) {
    const nr = nearestRail(h, .35);
    if (nr) addOnRail(S.active, nr.rail, nr.s);
    else toast(S.rails.length ? 'Ürünü bir rayın üstüne bırak.' : 'Önce bir ray ekle (soldaki "Ray ekle").');
    return;
  }
  if (S.sel) { S.sel = null; S.multi = []; buildFixtures(); }
}

function bindGL() {
  const el = R.renderer.domElement;
  el.addEventListener('pointerdown', e => {
    if (onDown(ceilHit(e), e)) { R.controls.enabled = false; if (R.mControls) R.mControls.enabled = false; try { el.setPointerCapture(e.pointerId); } catch { } }
  }, { capture: true });
  el.addEventListener('pointermove', e => { if (drag) onMove(ceilHit(e), e); else guideHover(ceilHit(e)); });
  el.addEventListener('pointerup', e => { onUp(ceilHit(e), e); R.controls.enabled = S.view === 'free'; if (R.mControls) R.mControls.enabled = S.view === 'model' && S.mView === 'persp'; });
}
pc.addEventListener('pointerdown', e => { if (onDown(planHit(e), e)) { try { pc.setPointerCapture(e.pointerId); } catch { } } });
pc.addEventListener('pointermove', e => { if (drag) onMove(planHit(e), e); else guideHover(planHit(e)); });
pc.addEventListener('pointerup', e => onUp(planHit(e), e));

function toast(t) {
  const el = $('#toast'); el.textContent = t; el.hidden = false;
  clearTimeout(toast.tm); toast.tm = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ---- ekle / sil ---- */
function addRail(shape, dims, x, z, rot = 0) {
  const c = S.cal, r = { id: S.nextId++, shape, dims: [...dims], x: x ?? c.width / 2, z: z ?? clamp(c.dist * .5, .5, c.depth - .5), rot };
  clampRail(r); S.rails.push(r); S.sel = { kind: 'rail', id: r.id };
  const b = railGeom(r).box;
  if (b.x1 - b.x0 > c.width || b.z1 - b.z0 > c.depth) toast('Bu ray odadan büyük; ölçüleri küçült.');
  buildFixtures(); pushHist();
  return r;
}
function addOnRail(sku, rail, want) {
  const p = bySku[sku];
  if (p.fam !== sysOf().fam) { toast('Bu ürün seçili ray sistemine takılmaz.'); return null; }
  const fx = { id: S.nextId++, p, rail: rail.id, s: 0, beam: p.beam, tilt: 0, yaw: 0 };
  const s = placeOnRail(fx, rail, want);
  if (s == null) { toast('Bu rayda bu ürüne yer kalmadı.'); return null; }
  fx.s = s; S.fixtures.push(fx); S.sel = { kind: 'fx', id: fx.id };
  buildFixtures(); pushHist();
  return fx;
}
function deleteSel() {
  if (!S.sel) return;
  if (S.sel.kind === 'guide') S.guides = S.guides.filter(g => g.id !== S.sel.id);
  else if (S.sel.kind === 'fx') { const ids = selFx().map(f => f.id); S.fixtures = S.fixtures.filter(f => !ids.includes(f.id)); S.multi = []; }
  else { S.rails = S.rails.filter(r => r.id !== S.sel.id); S.fixtures = S.fixtures.filter(f => f.rail !== S.sel.id); }
  S.sel = null; buildFixtures(); pushHist();
}
// İnce döndürme: gömme ürün kendi ekseninde, ray (ve üstündeki ürünler) birlikte döner
const norm180 = d => ((d % 360) + 540) % 360 - 180;
function selAngle() {
  const fx = S.sel?.kind === 'fx' && S.fixtures.find(f => f.id === S.sel.id);
  if (fx && fx.rail == null) return Math.round(norm180((fx.rot || 0) * 180 / Math.PI) * 10) / 10;
  const r = railById(S.sel?.kind === 'rail' ? S.sel.id : fx?.rail);
  return r ? Math.round(norm180(r.rot * 90 + (r.fine || 0)) * 10) / 10 : 0;
}
function setAngle(deg, push = true) {
  const fx = S.sel?.kind === 'fx' && S.fixtures.find(f => f.id === S.sel.id);
  if (fx && fx.rail == null) { for (const f of selFx()) if (f.rail == null) f.rot = deg * Math.PI / 180; }
  else {
    const r = railById(S.sel?.kind === 'rail' ? S.sel.id : fx?.rail); if (!r) return;
    r.rot = 0; r.fine = deg; clampRail(r);
    const n = revalidate(r.id); if (n) toast(`${n} ürün sığmadığı için kaldırıldı.`);
  }
  buildFixtures(); if (push) pushHist();
}
const fineRotate = d => setAngle(norm180(selAngle() + d));
function rotRow() {
  const a = selAngle();
  return `<div class="rotrow"><button data-rot="-5" title="Sola 5°">⟲ 5°</button><button data-rot="-1" title="Sola 1° (Q)">⟲ 1°</button>
    <input type="range" min="-180" max="180" step="0.5" value="${a}" data-angle><b>${a}°</b>
    <button data-rot="1" title="Sağa 1° (E)">1° ⟳</button><button data-rot="5" title="Sağa 5°">5° ⟳</button></div>`;
}
function rotateSel() {
  if (S.sel?.kind === 'fx') {                            // gömme ürün 90° döner
    const list = selFx().filter(f => f.rail == null);
    if (list.length) { for (const f of list) f.rot = ((f.rot || 0) + Math.PI / 2) % (Math.PI * 2); buildFixtures(); pushHist(); }
    return;
  }
  const r = S.sel?.kind === 'rail' && railById(S.sel.id); if (!r) return;
  r.rot = (r.rot + 1) % 4; clampRail(r);
  const n = revalidate(r.id); if (n) toast(`${n} ürün sığmadığı için kaldırıldı.`);
  buildFixtures(); pushHist();
}
function setRailDim(i, v) {
  const r = S.sel?.kind === 'rail' && railById(S.sel.id); if (!r || !(v >= .3 && v <= 15)) return;
  r.dims[i] = v; clampRail(r);
  const n = revalidate(r.id); if (n) toast(`${n} ürün sığmadığı için kaldırıldı.`);
  buildFixtures(); pushHist();
}
addEventListener('keydown', e => {
  if (S.step !== 3 || e.target.tagName === 'INPUT' || e.ctrlKey || e.metaKey) return;
  if (e.key === 'Delete' || e.key === 'Backspace') deleteSel();
  if (e.key === 'r' || e.key === 'R') rotateSel();
  if (S.sel && (e.key === 'q' || e.key === 'Q')) fineRotate(e.shiftKey ? -5 : -1);
  if (S.sel && (e.key === 'e' || e.key === 'E')) fineRotate(e.shiftKey ? 5 : 1);
  if (e.key === 'Escape') { if (S.tool === 'guide') { if (S.drawing) { finishGuide(); buildFixtures(); pushHist(); } else setTool(null); return; } S.sel = null; S.multi = []; S.active = null; renderProducts(); buildFixtures(); }
  if (e.key === 'Enter' && S.tool === 'guide') { finishGuide(); buildFixtures(); pushHist(); }
});

/* ---------------- panel ---------------- */
function renderSystems() {
  $('#systems').innerHTML = SYSTEMS.map(s => `<button class="sys ${s.id === S.system ? 'is-active' : ''}" data-sys="${s.id}">
    <img src="../dist/assets/${s.img}" alt=""><span><strong>${s.name}</strong><small>${s.note}</small></span></button>`).join('');
  $$('.sys').forEach(b => b.addEventListener('click', () => setSystem(b.dataset.sys)));
}
function setSystem(id) {
  if (id === S.system) return;
  const fam = SYSTEMS.find(s => s.id === id).fam, before = S.fixtures.length;
  S.fixtures = S.fixtures.filter(f => f.p.fam === fam || f.p.fam === 'gomme');
  const n = before - S.fixtures.length;
  S.system = id;
  if (S.active && bySku[S.active].fam !== fam && bySku[S.active].fam !== 'gomme') S.active = null;
  if (S.sel?.kind === 'fx' && !S.fixtures.some(f => f.id === S.sel.id)) S.sel = null;
  if (n) toast(`${n} ürün bu ray sistemine uymadığı için kaldırıldı. Geri al ile dönebilirsin.`);
  renderPanel(); buildFixtures(); pushHist();
}
function renderShapes() {
  $('#shapes').innerHTML = SHAPES.map(x => `<button class="shape ${x.id === S.railShape ? 'is-active' : ''}" data-shape="${x.id}"><span>${x.icon}</span>${x.name}</button>`).join('');
  $$('.shape').forEach(b => b.addEventListener('click', () => { S.railShape = b.dataset.shape; renderShapes(); }));
  const sh = SHAPES.find(x => x.id === S.railShape), d = S.railDims[sh.id];
  $('#dims').innerHTML = sh.labels.map((l, i) => `<label>${l}<span class="unit"><input type="number" min="0.3" max="15" step="0.1" value="${d[i]}" data-dim="${i}"><span>m</span></span></label>`).join('');
  $$('#dims input').forEach(inp => inp.addEventListener('input', () => { const v = +inp.value; if (v >= .3 && v <= 15) d[+inp.dataset.dim] = v; }));
}
$('#addRail').addEventListener('click', () => { if (S.cal) addRail(S.railShape, S.railDims[S.railShape]); });

function renderFilters() {
  const fam = sysOf().fam, types = ['all', ...new Set(PRODUCTS.filter(p => p.fam === fam).map(p => p.type))];
  if (!types.includes(S.filter)) S.filter = 'all';
  $('#filters').innerHTML = types.map(t => `<button class="chip ${t === S.filter ? 'is-active' : ''}" data-f="${t}">${t === 'all' ? 'Tümü' : TYPE_TR[t]}</button>`).join('');
  $$('#filters .chip').forEach(b => b.addEventListener('click', () => { S.filter = b.dataset.f; renderFilters(); renderProducts(); }));
}
function renderProducts() {
  const gomme = S.prodGroup !== 'ray', fam = gomme ? 'gomme' : sysOf().fam;
  $$('#groupSeg button').forEach(b => b.classList.toggle('is-active', b.dataset.group === S.prodGroup));
  $('#filters').hidden = gomme;
  const list = PRODUCTS.filter(p => p.fam === fam && grpOf(p) === S.prodGroup && (gomme || S.filter === 'all' || p.type === S.filter));
  $('#products').innerHTML = list.map(p => `<button class="prod ${p.sku === S.active ? 'is-active' : ''}" data-sku="${p.sku}">
    <img src="${p.src}" alt="" loading="lazy"><strong>${p.name}</strong><small>${p.watts}W · ${lmText(p, true)}</small></button>`).join('');
  $$('.prod').forEach(b => b.addEventListener('click', () => { S.active = S.active === b.dataset.sku ? null : b.dataset.sku; if (S.active && S.tool) setTool(null); renderProducts(); }));
  $('#prodHint').textContent = S.mode === 'vitrin' ? 'Tek tek eklemek için: ürünü seç, tavana tıkla' : gomme ? '3 · Ürün seç, tavanda istediğin yere tıkla (ray gerekmez)' : '3 · Ürün seç, rayın üstüne tıkla';
}
function renderPanel() { renderSystems(); renderShapes(); renderFilters(); renderProducts(); renderRoom(); }
$$('#groupSeg button').forEach(b => b.addEventListener('click', () => {
  S.prodGroup = b.dataset.group;
  if (S.active && grpOf(bySku[S.active]) !== S.prodGroup) S.active = null;
  renderProducts();
}));
$('#guideBtn').addEventListener('click', () => setTool(S.tool === 'guide' ? null : 'guide'));
$('#cmpBtn').addEventListener('click', () => {
  S.compare = !S.compare; $('#cmpBtn').classList.toggle('is-active', S.compare);
  if (S.compare && S.view === 'plan') setView('photo');
  render(); placeSplit();
});
{
  const h = $('#split'); let on = false;
  h.addEventListener('pointerdown', e => { on = true; try { h.setPointerCapture(e.pointerId); } catch { } e.stopPropagation(); });
  h.addEventListener('pointermove', e => {
    if (!on || !R) return;
    const cr = R.renderer.domElement.getBoundingClientRect();
    S.split = clamp((e.clientX - cr.left) / cr.width, .02, .98); render();
  });
  h.addEventListener('pointerup', () => { on = false; });
}

function renderSelTools() {
  const el = $('#selTools'), sel = S.sel;
  if (!sel) { el.hidden = true; return; }
  if (sel.kind === 'guide') {
    const g = guideById(sel.id); if (!g) { el.hidden = true; return; }
    const segs = guideSegs(g).map(([a, b]) => fmtM(Math.hypot(b[0] - a[0], b[1] - a[1])));
    el.innerHTML = `<div class="sel-head"><span>Seçili kılavuz</span><strong>${segs.length} çizgi${g.closed ? ' · kapalı şekil' : ''}</strong>
      <small>Kenarlar: ${segs.join(' · ')}</small><small>Köşe noktalarını sürükleyerek düzeltebilirsin.</small></div>
      <div class="row"><button class="danger" data-act="del">Kılavuzu sil</button></div>`;
    el.hidden = false; return;
  }
  if (sel.kind === 'fx' && multiOn()) {
    const list = selFx(), p = list[0].p, same = list.every(f => f.p.sku === p.sku), W = list.reduce((a, f) => a + f.p.watts, 0), lm = list.reduce((a, f) => a + lumenOf(f.p), 0);
    const fx = S.fixtures.find(f => f.id === sel.id) || list[0];
    const opt = (name, key, vals, cur, unit) => `<label>${name}<select data-fx="${key}">${list.every(f => (f[key] || 0) === cur) ? '' : '<option value="" selected>karışık</option>'}${vals.map(v => `<option value="${v}" ${list.every(f => (f[key] || 0) === cur) && v === cur ? 'selected' : ''}>${v}${unit}</option>`).join('')}</select></label>`;
    let aim = '';
    if (same && p.beamOpts) aim += opt('Işık açısı', 'beam', p.beamOpts, fx.beam || p.beam, '°');
    if (same && p.tiltOpts) aim += opt('Eğim', 'tilt', p.tiltOpts, fx.tilt || 0, '°');
    if (list.every(f => f.p.aim)) aim += `<label>Yön <b>${fx.yaw || 0}°</b><input type="range" min="-180" max="180" step="15" value="${fx.yaw || 0}" data-fx="yaw"></label>`;
    const free = list.every(f => f.rail == null);
    el.innerHTML = `<div class="sel-head"><span>Toplu seçim</span><strong>${list.length} ürün${same ? ' · ' + p.name : ''}</strong>
      <small>${W} W · ${Math.round(lm).toLocaleString('tr-TR')} lm · birlikte taşınır; ayarlar hepsine uygulanır</small><small>Shift / Ctrl + tıkla: seçime ekle ya da çıkar</small></div>
      ${aim ? `<div class="aim">${aim}</div>` : ''}
      ${free ? `<p class="label sm">Döndür (hepsi)</p>${rotRow()}` : ''}
      <div class="row">${free ? '<button class="ghost" data-act="rot">⟳ 90° döndür</button>' : ''}<button class="ghost" data-act="none">Seçimi bırak</button><button class="danger" data-act="del">${list.length} ürünü sil</button></div>`;
    el.hidden = false; return;
  }
  if (sel.kind === 'fx') {
    const fx = S.fixtures.find(f => f.id === sel.id); if (!fx) { el.hidden = true; return; }
    const p = fx.p, opt = (name, vals, cur, unit) => `<label>${name}<select data-fx="${name === 'Işık açısı' ? 'beam' : 'tilt'}">${vals.map(v => `<option value="${v}" ${v === cur ? 'selected' : ''}>${v}${unit}</option>`).join('')}</select></label>`;
    let aim = '';
    if (p.beamOpts) aim += opt('Işık açısı', p.beamOpts, fx.beam || p.beam, '°');
    if (p.tiltOpts) aim += opt('Eğim', p.tiltOpts, fx.tilt || 0, '°');
    else if (p.aim) aim += `<label>Eğim <b>${fx.tilt || 0}°</b><input type="range" min="0" max="60" step="5" value="${fx.tilt || 0}" data-fx="tilt"></label>`;
    if (p.aim) aim += `<label>Yön <b>${fx.yaw || 0}°</b><input type="range" min="-180" max="180" step="15" value="${fx.yaw || 0}" data-fx="yaw"></label>`;
    el.innerHTML = `<div class="sel-head"><span>Seçili ürün</span><strong>${p.sku === p.name ? p.name : p.sku + ' · ' + p.name}</strong>
      <small>${p.watts} W · ${lmText(p)}${p.note ? ' · ' + p.note : ''}</small></div>
      ${aim ? `<div class="aim">${aim}</div>` : ''}
      <p class="label sm">Döndür${fx.rail == null ? '' : ' (rayla birlikte)'}</p>${rotRow()}
      <div class="row">${fx.rail == null ? '<button class="ghost" data-act="rot">⟳ 90° döndür</button>' : ''}${fx.rail == null && S.guides.length ? '<button class="ghost" data-act="align">⇲ Çizgiye hizala</button>' : ''}<button class="danger" data-act="del">Sil</button></div>`;
  } else {
    const r = railById(sel.id); if (!r) { el.hidden = true; return; }
    const sh = SHAPES.find(x => x.id === r.shape), geo = railGeom(r);
    el.innerHTML = `<div class="sel-head"><span>Seçili ray</span><strong>${sh.name} · toplam ${fmtM(geo.len)}</strong></div>
      <div class="dims">${sh.labels.map((l, i) => `<label>${l}<span class="unit"><input type="number" min="0.3" max="15" step="0.1" value="${r.dims[i]}" data-rdim="${i}"><span>m</span></span></label>`).join('')}</div>
      <p class="label sm">Döndür</p>${rotRow()}
      <div class="row"><button class="ghost" data-act="rot">⟳ 90° döndür</button><button class="danger" data-act="del">Rayı sil</button></div>`;
  }
  el.hidden = false;
}
$('#selTools').addEventListener('click', e => {
  const a = e.target.closest('[data-act]')?.dataset.act; if (a === 'del') deleteSel(); if (a === 'rot') rotateSel(); if (a === 'align') alignToGuide();
  if (a === 'none') { S.sel = null; S.multi = []; buildFixtures(); }
  const d = e.target.closest('[data-rot]')?.dataset.rot; if (d) fineRotate(+d);
});
$('#selTools').addEventListener('input', e => {
  if (e.target.dataset.angle == null) return;
  setAngle(+e.target.value, false); const b = e.target.parentElement.querySelector('b'); if (b) b.textContent = e.target.value + '°';
});
$('#selTools').addEventListener('change', e => { if (e.target.dataset.angle != null) pushHist(); });
$('#selTools').addEventListener('change', e => {
  const i = e.target.dataset.rdim; if (i != null) { setRailDim(+i, +e.target.value); return; }
  if (e.target.dataset.fx) pushHist();
});
$('#selTools').addEventListener('input', e => {
  const k = e.target.dataset.fx, list = selFx(); if (!k || !list.length || e.target.value === '') return;
  for (const f of list) if (k !== 'yaw' || f.p.aim) f[k] = +e.target.value;   // toplu seçimde hepsine
  const b = e.target.closest('label')?.querySelector('b'); if (b) b.textContent = e.target.value + '°';
  buildFixtureMeshes(); updateLights(); buildFoot(); buildModel(); render(); if (S.view === 'plan') drawPlan();
});

function renderRoom() {
  if (!S.cal) return;
  $('#roomW').textContent = fmtM(S.cal.width);
  $('#roomD').value = S.cal.depth.toFixed(1);
}
$('#roomD').addEventListener('change', e => {
  const v = +e.target.value; if (!(v >= 1 && v <= 30)) return;
  S.depthOverride = v; S.cal = calibrate(); disposeGL(); startGL(); renderRoom(); pushHist();
});

/* ---------------- kuyumcu vitrini: ölçü, yerleşim önerisi, otomatik yerleşim ---------------- */
const vitProd = () => bySku[S.vit.sku];
const vitErr = () => VIT.validate(S.vit, vitProd());
const fmtCm = v => (Math.round(v * 10) / 10).toString().replace('.', ',') + ' cm';
function pickRecommended() {
  const sug = VIT.suggestions(S.vit, vitProd()), r = sug.find(o => o.label === 'Önerilen') || sug[0];
  if (r) { S.vit.cols = r.cols; S.vit.rows = r.rows; }
}
function renderVit() {
  const v = S.vit, p = vitProd(), err = vitErr(), one = v.place !== 'ic', onu = v.place === 'onu', banko = v.place === 'banko';
  $$('[data-v]').forEach(i => { if (document.activeElement !== i) i.value = v[i.dataset.v]; });
  $$('[data-vsku]').forEach(b => b.classList.toggle('is-active', b.dataset.vsku === v.sku));
  $$('[data-vplace]').forEach(b => b.classList.toggle('is-active', b.dataset.vplace === v.place));
  $$('[data-vrot]').forEach(b => b.classList.toggle('is-active', b.dataset.vrot === v.rot));
  $$('.vit-onu').forEach(e => { e.hidden = !onu; });
  $$('.vit-rows').forEach(e => { e.hidden = one; });
  $$('.vz-dis').forEach(e => { e.hidden = banko; });
  $$('.vz-banko').forEach(e => { e.hidden = !banko; });
  $$('.zone[data-vplace]').forEach(b => b.classList.toggle('is-active', (b.dataset.vplace === 'banko') === banko));
  if (S.mode === 'vitrin') {
    $$('.steps button')[1].textContent = banko ? '2 · Bankoyu işaretle' : '2 · Vitrini işaretle';
    $('#step2 h2').textContent = banko ? 'Bankoyu işaretle' : 'Vitrini işaretle';
    $('#step3 h2').textContent = banko ? 'Bankoyu ışıklandır' : 'Vitrini ışıklandır';
  }
  const sug = VIT.suggestions(v, p);
  $$('.vit-cards').forEach(h => {
    h.innerHTML = sug.map(o => `<button type="button" class="vcard${o.label === 'Önerilen' ? ' rec' : ''}${o.cols === v.cols && (one || o.rows === v.rows) ? ' is-active' : ''}" data-cols="${o.cols}" data-rows="${o.rows}">
      <span>${o.label}</span><b>${one ? `${o.cols} adet` : `${o.cols} × ${o.rows} <em>${o.count} adet</em>`}</b><small>boşluk ${fmtCm(o.gx)}${one ? '' : ' / ' + fmtCm(o.gz)}</small></button>`).join('');
  });
  const n = err ? 0 : v.cols * (one ? 1 : v.rows);
  $$('.vit-sum').forEach(e => { e.innerHTML = err ? '' : `<b>${n} adet ${p.name}</b> · ${n * p.watts} W · ${(n * p.lm).toLocaleString('tr-TR')} lm`; });
  $$('.vit-warn').forEach(e => { e.textContent = err; e.hidden = !err; });
  $$('.vit-dims').forEach(e => { e.textContent = banko ? `Banko ${v.width} × ${v.depth} cm · yerden ${v.table} cm · mağaza tavanı ${v.store} cm · ETNA'lar bankonun ortasından ${v.off || 0} cm`
    : `${v.width} × ${v.depth} cm · tabla ${v.table} cm, vitrin tavanı ${v.height} cm (arası ${v.height - v.table} cm)`; });
  $('#dropZone').classList.toggle('off', S.mode === 'vitrin' && !!err);
}
// Seçili yerleşimi (Ferah / Önerilen / Yoğun ya da elle adet) fotoğraftaki vitrine yerleştirir
function applyVitLayout(push = true) {
  const v = S.vit, p = vitProd();
  if (!S.cal || S.cal.kind !== 'vitrin') return;
  // Vitrin tavanında derinlik, kalibre edilen tavandan (girilen ya da fotoğraftan) alınır
  const pos = VIT.positions({ ...v, depth: v.place === 'onu' ? v.depth : Math.round(S.cal.depth * 1000) / 10 }, p), banko = v.place === 'banko';
  if (!pos.length) return;
  S.fixtures = S.fixtures.filter(f => f.p.fam !== 'gomme');
  const onu = v.place === 'onu', rot = v.rot === '1' ? Math.PI / 2 : 0;
  for (const [x, z] of pos) {
    const fx = { id: S.nextId++, p, x, z, rot, beam: p.beam, tilt: 0, yaw: 0 };
    if (onu) { fx.tilt = 25; fx.yaw = rot ? -90 : 180; }   // cam önünde: ışık 25° eğimle vitrine (arka kenara) döner
    // Banko: ETNA bankonun tam üstünde değilse 25° eğimle bankonun ortasına döner
    if (banko && Math.abs(v.off || 0) >= 10) { const back = (v.off || 0) > 0; fx.tilt = 25; fx.yaw = rot ? (back ? -90 : 90) : (back ? 180 : 0); }
    S.fixtures.push(fx);
  }
  S.sel = null; S.active = v.sku; S.autoLaid = true; renderProducts(); buildFixtures(); if (push) pushHist();
  toast(`${pos.length} adet ${p.name} ${banko ? 'bankonun üstüne, mağaza tavanına' : onu ? 'cam önüne, mağaza tavanına' : 'vitrin tavanına'} yerleştirildi. Sürükleyerek ince ayar yapabilirsin.`);
}
function onVitChange() { if (S.step === 3 && S.cal && !vitErr()) applyVitLayout(); }
document.addEventListener('input', e => {
  const k = e.target.dataset?.v; if (!k) return;
  S.vit[k] = +e.target.value; S.autoLaid = false;
  if (k === 'width' || k === 'depth') pickRecommended();
  renderVit(); if (S.step === 2) recalc();
  if (S.step === 3 && k === 'off' && S.cal && !vitErr()) applyVitLayout();   // bankoda tavandaki kaydırma anında uygulanır
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-vsku],[data-vplace],[data-vrot],.vcard'); if (!b) return;
  if (b.dataset.vsku) S.vit.sku = b.dataset.vsku;
  let want = b.dataset.vplace;
  if (want && b.classList.contains('zone') && want !== 'banko') want = S.vit.place === 'banko' ? (S.vit.disPlace || 'ic') : S.vit.place;   // "Dış vitrin" kartı montajı korur
  const placeChanged = want && want !== S.vit.place;
  if (placeChanged && (want === 'banko') !== (S.vit.place === 'banko')) {   // bölge değişti: ölçü takımı değişir (öteki saklanır)
    const keys = ['width', 'depth', 'table', 'store'], cur = Object.fromEntries(keys.map(k => [k, S.vit[k]]));
    if (want === 'banko') { S.vit.disDims = cur; S.vit.disPlace = S.vit.place; Object.assign(S.vit, S.vit.bankoDims || BANKO_DEF); }
    else { S.vit.bankoDims = { ...cur, off: S.vit.off }; Object.assign(S.vit, S.vit.disDims || {}); }
  }
  if (want) S.vit.place = want;
  if (b.dataset.vrot) S.vit.rot = b.dataset.vrot;
  if (b.classList.contains('vcard')) { S.vit.cols = +b.dataset.cols; S.vit.rows = +b.dataset.rows; } else pickRecommended();
  S.active = S.vit.sku; S.autoLaid = false; renderProducts(); renderVit();
  // Montaj değişince işaretlenen tavan da değişir (vitrin içi tavanı ↔ camın önündeki mağaza tavanı): köşeler yeniden işaretlenir
  if (placeChanged && S.img) {
    S.placeIdx = 0; S.cal = null; S.fixtures = []; S.sel = null; S.multi = []; S.autoLaid = false;
    disposeGL(); goStep(2); recalc(); pushHist();
    toast(S.vit.place === 'banko' ? 'Banko üzeri seçildi: banko üstünün 4 köşesini işaretle.' : S.vit.place === 'ic' ? 'Vitrin tavanı seçildi: camın arkasındaki iç tavanın 4 köşesini işaretle.' : 'Cam önü seçildi: camın önündeki mağaza tavanının 4 köşesini işaretle.');
    return;
  }
  onVitChange();
});
function setMode(m) {
  if (m === S.mode) return;
  S.mode = m; ORDER = m === 'vitrin' ? ORDER_VIT : ORDER_ODA; document.body.dataset.mode = m;
  $$('#modeSeg button').forEach(b => b.classList.toggle('is-active', b.dataset.mode === m));
  const st = $$('.steps button');
  st[0].textContent = m === 'vitrin' ? '1 · Ölçü + fotoğraf' : '1 · Fotoğraf';
  st[1].textContent = m === 'vitrin' ? '2 · Vitrini işaretle' : '2 · Odayı işaretle';
  $('#step2 h2').textContent = m === 'vitrin' ? 'Vitrini işaretle' : 'Odayı işaretle';
  $('#step3 h2').textContent = m === 'vitrin' ? 'Vitrini ışıklandır' : 'Ray ve ürünleri yerleştir';
  if (S.img) { S.img = null; S.cal = null; S.fixtures = []; S.rails = []; S.guides = []; S.sel = null; disposeGL(); $('#credit').hidden = true; }
  S.prodGroup = m === 'vitrin' ? 'gomme' : 'ray'; S.active = m === 'vitrin' ? S.vit.sku : 'GMC6031';
  renderProducts(); renderVit(); goStep(1);
}
$$('#modeSeg button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

// Fotoğraf yoksa: girilen ölçülerden vitrinin sade bir görüntüsü çizilir (kamera biraz sağdan, göz hizasından)
function synthVitrin() {
  S.vit.place = 'ic'; renderVit();                     // çizim vitrin tavanını gösterir
  const W = S.vit.width / 100, D = S.vit.depth / 100, Hb = (S.vit.height - S.vit.table) / 100, t = S.vit.table / 100, IW = 1600, IH = 1100, f = 26 / 36 * IW;
  const eyeY = clamp(1.55 - t, Hb * .35, Hb * .8), dist = Math.max(1.1, W * .85);
  const c = VIT.lookAtCam([W * .58, eyeY, D + dist], [W / 2, Hb * .42, D * .45], f);
  const cv = document.createElement('canvas'); cv.width = IW; cv.height = IH;
  const g = cv.getContext('2d'), P = X => VIT.projectWith(c, X, IW, IH);
  const poly = (pts, fill) => { const q = pts.map(P); if (q.some(v => !v)) return; g.fillStyle = fill; g.beginPath(); q.forEach((v, i) => (i ? g.lineTo(...v) : g.moveTo(...v))); g.closePath(); g.fill(); };
  const gr = g.createLinearGradient(0, 0, 0, IH); gr.addColorStop(0, '#d8d2c7'); gr.addColorStop(.3, '#958d80'); gr.addColorStop(1, '#4a443d');
  g.fillStyle = gr; g.fillRect(0, 0, IW, IH);
  poly([[-.06, -t, D], [W + .06, -t, D], [W + .06, Hb + .1, D], [-.06, Hb + .1, D]], '#2f2b27');      // çerçeve + alt dolap
  poly([[0, 0, 0], [W, 0, 0], [W, Hb, 0], [0, Hb, 0]], '#3e3934');                                  // arka (kadife)
  poly([[0, 0, 0], [0, 0, D], [0, Hb, D], [0, Hb, 0]], '#b7ae9f');                                  // yanlar
  poly([[W, 0, 0], [W, 0, D], [W, Hb, D], [W, Hb, 0]], '#b7ae9f');
  poly([[0, Hb, 0], [W, Hb, 0], [W, Hb, D], [0, Hb, D]], '#d5cfc4');                                // vitrin tavanı
  poly([[0, 0, 0], [W, 0, 0], [W, 0, D], [0, 0, D]], '#e6dfcd');                                    // tabla
  poly([[0, 0, D], [W, 0, D], [W, -.035, D], [0, -.035, D]], '#c7bda7');                            // tabla ön kenarı
  const nB = Math.max(2, Math.round(W / .45));                                                     // sade sergi blokları
  for (let i = 0; i < nB; i++) {
    const x0 = (i + .18) / nB * W, x1 = (i + .82) / nB * W, z0 = D * .22, z1 = D * .58, h = .06;
    poly([[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]], '#6a6257'); poly([[x0, h, z1], [x1, h, z1], [x1, 0, z1], [x0, 0, z1]], '#57504a');
  }
  const pts = Object.fromEntries([['TL', [0, Hb, 0]], ['TR', [W, Hb, 0]], ['BR', [W, Hb, D]], ['BL', [0, Hb, D]]].map(([k, X]) => { const q = P(X); return [k, [q[0] / IW, q[1] / IH]]; }));
  return { src: cv.toDataURL('image/jpeg', .92), pts, lensMm: 26, lensFixed: true, credit: 'Ölçülerinden çizilmiş vitrin (fotoğraf yok)' };
}
$('#synthBtn').addEventListener('click', () => { if (vitErr()) { renderVit(); return; } const s = S.vit.place === 'banko' ? synthBanko() : synthVitrin(); loadPhoto(s.src, s.pts, null, s); });
// Fotoğraf yoksa banko: müşteri tarafından, göz hizasından, biraz yandan bakış (ölçüler girilenden)
function synthBanko() {
  const W = S.vit.width / 100, D = S.vit.depth / 100, t = S.vit.table / 100, st = S.vit.store / 100, IW = 1600, IH = 1100, f = 26 / 36 * IW;
  const c = VIT.lookAtCam([W * .62, 1.62, D + Math.max(1.3, W * .75)], [W / 2, t * .8, D * .4], f);
  const cv = document.createElement('canvas'); cv.width = IW; cv.height = IH;
  const g = cv.getContext('2d'), P = X => VIT.projectWith(c, X, IW, IH);
  const poly = (pts, fill) => { const q = pts.map(P); if (q.some(v => !v)) return; g.fillStyle = fill; g.beginPath(); q.forEach((v, i) => (i ? g.lineTo(...v) : g.moveTo(...v))); g.closePath(); g.fill(); };
  const gr = g.createLinearGradient(0, 0, 0, IH); gr.addColorStop(0, '#e9e4da'); gr.addColorStop(.45, '#cfc6b8'); gr.addColorStop(1, '#8b8174');
  g.fillStyle = gr; g.fillRect(0, 0, IW, IH);
  poly([[-3, 0, -1.5], [W + 3, 0, -1.5], [W + 3, 0, D + 6], [-3, 0, D + 6]], '#b9b0a2');                  // zemin
  poly([[-3, 0, -1.5], [W + 3, 0, -1.5], [W + 3, st, -1.5], [-3, st, -1.5]], '#d8d0c3');                  // arka duvar
  poly([[-3, st, -1.5], [W + 3, st, -1.5], [W + 3, st, D + 6], [-3, st, D + 6]], '#f1ece3');            // tavan
  poly([[0, 0, D], [W, 0, D], [W, t, D], [0, t, D]], '#6d5d4b');                                          // banko ön yüzü
  poly([[W, 0, 0], [W, 0, D], [W, t, D], [W, t, 0]], '#5a4c3d');                                          // yan
  poly([[0, t, 0], [W, t, 0], [W, t, D], [0, t, D]], '#efe7d6');                                          // banko üstü
  const nB = Math.max(2, Math.round(W / .5));                                                            // sade sergi blokları
  for (let i = 0; i < nB; i++) {
    const x0 = (i + .2) / nB * W, x1 = (i + .8) / nB * W, z0 = D * .25, z1 = D * .7, h = .05;
    poly([[x0, t + h, z0], [x1, t + h, z0], [x1, t + h, z1], [x0, t + h, z1]], '#7a6f62'); poly([[x0, t + h, z1], [x1, t + h, z1], [x1, t, z1], [x0, t, z1]], '#625a50');
  }
  const pts = Object.fromEntries([['TL', [0, t, 0]], ['TR', [W, t, 0]], ['BR', [W, t, D]], ['BL', [0, t, D]]].map(([k, X]) => { const q = P(X); return [k, [q[0] / IW, q[1] / IH]]; }));
  return { src: cv.toDataURL('image/jpeg', .92), pts, lensMm: 26, lensFixed: true, credit: 'Ölçülerinden çizilmiş banko (fotoğraf yok)', eye: c.cam };
}

// Sitedeki kuyumcu aracının proje dosyası (GMC-LED-Vitrin-Projesi.json) ile karşılıklı
$('#vitJson').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const o = JSON.parse(await f.text()), st = o.settings || {};
    for (const k of ['width', 'depth', 'height', 'table', 'cols', 'rows']) if (st[k] !== '' && Number.isFinite(+st[k])) S.vit[k] = +st[k];
    if (st.rotation != null) S.vit.rot = String(st.rotation) === '1' ? '1' : '0';
    const m = /ETNA\s*-?\s*(6|12|26)/i.exec(o.studio?.sku || o.product || ''); if (m) S.vit.sku = 'ETNA-' + m[1];
    if (o.studio) for (const k of ['place', 'store', 'front', 'off']) if (o.studio[k] != null) S.vit[k] = o.studio[k];
    S.autoLaid = false; S.active = S.vit.sku; renderVit();
    $('#vitFileMsg').textContent = `✓ ${f.name} açıldı: ${S.vit.width} × ${S.vit.depth} cm, ${S.vit.cols}${S.vit.place === 'onu' ? '' : ' × ' + S.vit.rows} ${vitProd().name}`;
  } catch { $('#vitFileMsg').textContent = 'Bu dosya okunamadı; sitedeki aracın "Proje dosyası" çıktısını seç.'; }
});
function exportVit() {
  const v = S.vit, p = vitProd();
  const o = { version: 1, product: p.name, watts: p.watts, settings: { width: v.width, depth: v.depth, height: v.height, table: v.table, cols: v.cols, rows: v.rows, rotation: v.rot },
    studio: { app: 'GMC Tavan Stüdyo', sku: v.sku, place: v.place, store: v.store, front: v.front, off: v.off,
      fixtures: S.fixtures.map(f => ({ sku: f.p.sku, x: +f.x.toFixed(3), z: +f.z.toFixed(3), rot: +(f.rot || 0).toFixed(4), tilt: f.tilt || 0, yaw: f.yaw || 0, beam: f.beam, y: f.y })) } };
  const url = URL.createObjectURL(new Blob([JSON.stringify(o, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'GMC-LED-Vitrin-Projesi.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
$('#vitExport').addEventListener('click', exportVit);
$('#vitRelayout').addEventListener('click', () => { if (!vitErr()) applyVitLayout(); });
$$('.vit-edit').forEach(b => b.addEventListener('click', () => goStep(1)));

function seg(id, attr, fn) { $$(`#${id} button`).forEach(b => b.addEventListener('click', () => { $$(`#${id} button`).forEach(x => x.classList.toggle('is-active', x === b)); fn(b.dataset[attr]); })); }
seg('cctSeg', 'cct', v => { S.cct = +v; buildFixtures(); });
seg('onSeg', 'on', v => { S.on = v === '1'; buildFixtures(); });
function dnLabel() { $('#dnVal').textContent = S.day < .33 ? 'Akşam' : S.day < .66 ? 'Alacakaranlık' : 'Gündüz'; }
$('#dayNight').addEventListener('input', e => { S.day = +e.target.value; dnLabel(); buildFixtures(); });
$('#gain').addEventListener('input', e => { S.gain = +e.target.value; $('#gainVal').textContent = S.gain.toFixed(2) + 'x'; updateLights(); render(); });
function selectAll() {
  if (!S.fixtures.length) { toast('Seçilecek ürün yok.'); return; }
  S.multi = S.fixtures.map(f => f.id); S.sel = { kind: 'fx', id: S.multi[S.multi.length - 1] };
  if (S.multi.length === 1) S.multi = [];
  buildFixtures(); toast(`${S.fixtures.length} ürün seçildi. Sürükleyince hepsi birlikte kayar.`);
}
$('#selAllBtn').addEventListener('click', selectAll);
$('#clearBtn').addEventListener('click', () => { S.fixtures = []; S.rails = []; S.guides = []; S.drawing = null; S.sel = null; buildFixtures(); pushHist(); });

/* ---------------- ölçülü model: sitedeki kuyumcu aracının görünümü, aynı proje ve gerçek ölçüler ---------------- */
// Model koordinatı (metre): x vitrin genişliği (sol 0), y yerden yukarı, z vitrin arkasından (0) cama (vitD), cam önünde sana doğru.
// Fotoğraf dünyasıyla arasında sadece öteleme var: vitrin tavanında y + tabla, cam önünde z + vitrin derinliği.
function vitGeo() {
  const v = S.vit, c = S.cal, onu = v.place === 'onu', banko = !!c.banko;
  return { onu, banko, W: c.width, vitD: onu ? v.depth / 100 : c.depth, t: v.table / 100, h: v.height / 100, store: v.store / 100, ceilD: onu ? c.depth : 0 };
}
// Banko dünyası zaten yerden ölçülü; model ile aynı
const mOff = g => g.banko ? [0, 0, 0] : g.onu ? [0, 0, g.vitD] : [0, g.t, 0];
const w2m = (p, g = vitGeo()) => { const o = mOff(g); return [p[0] + o[0], p[1] + o[1], p[2] + o[2]]; };
const m2w = (p, g = vitGeo()) => { const o = mOff(g); return [p[0] - o[0], p[1] - o[1], p[2] - o[2]]; };
const lin = h => new THREE.Color().setHex(parseInt(h.slice(1), 16), THREE.LinearSRGBColorSpace);   // renk aynen (çıktı doğrusal)

function initModel() {
  const mScene = new THREE.Scene(); mScene.background = lin('#eeebe4');
  const mPersp = new THREE.PerspectiveCamera(30, S.W / S.H, .02, 200);
  const mOrtho = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 400);
  const mControls = new OrbitControls(mPersp, R.renderer.domElement);
  mControls.enabled = false; mControls.enableDamping = false; mControls.addEventListener('change', () => render());
  const mStatic = new THREE.Group(), mFx = new THREE.Group(), mDyn = new THREE.Group(); mScene.add(mStatic, mFx, mDyn);
  Object.assign(R, { mScene, mPersp, mOrtho, mControls, mStatic, mFx, mDyn });
  fitModel();
}
// Görünüme göre kamera: Perspektif (döndürülebilir) ya da ölçekli Ön / Sağ / Sol / Üst
function fitModel() {
  if (!R?.mScene) return;
  const g = vitGeo(), b = g.banko ? { x0: -.3, x1: g.W + .3, y0: 0, y1: g.store + .05, z0: -.5, z1: g.vitD + .6 }
    : { x0: -.15, x1: g.W + .15, y0: 0, y1: (g.onu ? g.store : g.h) + .05, z0: -.02, z1: g.vitD + g.ceilD + .12 };
  const c = new THREE.Vector3((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2), a = S.W / S.H;
  const sx = b.x1 - b.x0, sy = b.y1 - b.y0, sz = b.z1 - b.z0;
  if (S.mView === 'persp') {
    const p = R.mPersp; p.aspect = a; p.updateProjectionMatrix();
    const dir = new THREE.Vector3(.62, .42, 1).normalize(), rad = Math.hypot(sx, sy, sz) / 2;
    const dist = rad / Math.sin(Math.min(p.fov, p.fov * a) * Math.PI / 360) * 1.05;
    p.position.copy(c).addScaledVector(dir, dist); R.mControls.target.copy(c); p.lookAt(c);
    R.mControls.minDistance = rad * 1.05; R.mControls.maxDistance = dist * 3; R.mControls.update();   // içine girmesin
    return;
  }
  const V = { front: [[0, 0, 1], [0, 1, 0], sx, sy], right: [[1, 0, 0], [0, 1, 0], sz, sy], left: [[-1, 0, 0], [0, 1, 0], sz, sy], top: [[0, 1, 0], [0, 0, -1], sx, sz] }[S.mView];
  const o = R.mOrtho, hw = Math.max(V[2] / 2 * 1.35, V[3] / 2 * 1.35 * a), hh = hw / a;
  Object.assign(o, { left: -hw, right: hw, top: hh, bottom: -hh });
  o.up.set(...V[1]); o.position.copy(c).addScaledVector(new THREE.Vector3(...V[0]), 50); o.lookAt(c); o.updateProjectionMatrix();
}
function buildModel() {
  if (!R?.mScene || !S.cal) return;
  const g = vitGeo(), st = R.mStatic, o = mOff(g); disposeGroup(st); disposeGroup(R.mDyn);
  const mat = (col, op = 1) => new THREE.MeshBasicMaterial({ color: lin(col), transparent: op < 1, opacity: op, depthWrite: op >= 1, side: THREE.DoubleSide });
  const box = (w, h, d, x, y, z, col, op = 1, edge = '#8f8068') => {
    if (!(w > 0 && h > 0 && d > 0)) return;
    const geo = new THREE.BoxGeometry(w, h, d), m = new THREE.Mesh(geo, mat(col, op)); m.position.set(x, y, z); st.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: lin(edge), transparent: op < 1, opacity: op < 1 ? .55 : 1 }));
    e.position.copy(m.position); st.add(e);
  };
  const { W, vitD, t, h } = g, ih = h - t;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(W + 3, vitD + g.ceilD + 3), mat('#dcd7cd')); fl.rotation.x = -Math.PI / 2; fl.position.set(W / 2, -.001, (vitD + g.ceilD) / 2); st.add(fl);
  box(W, t, vitD, W / 2, t / 2, vitD / 2, g.banko ? '#6d5d4b' : '#e8e0cd', 1, g.banko ? '#3d342a' : '#8f8068');   // alt dolap / banko gövdesi
  if (g.banko) {                                          // banko üzeri: banko + mağaza tavanı (ETNA'lar orada)
    box(W + 1.2, .02, vitD + 2.4, W / 2, g.store + .01, vitD / 2, '#e4ddcf', .3);
  } else {
  box(W, ih, .02, W / 2, t + ih / 2, -.01, '#4b443c', 1, '#2d2924');                              // arka pano
  box(.01, ih, vitD, -.005, t + ih / 2, vitD / 2, '#cfe0ea', .16, '#7d8a93');                     // yan camlar
  box(.01, ih, vitD, W + .005, t + ih / 2, vitD / 2, '#cfe0ea', .16, '#7d8a93');
  box(W, ih, .008, W / 2, t + ih / 2, vitD + .004, '#bcd6e4', .14, '#7d8a93');                    // ön cam
  box(W + .04, .03, vitD + .02, W / 2, h + .015, vitD / 2, '#efe9dd', .35);                       // vitrin tavanı: yarı saydam, ışıklar ve tabla görünsün
  for (const [x, z] of [[0, 0], [W, 0], [0, vitD], [W, vitD]]) box(.022, ih + .03, .022, x, t + ih / 2 + .015, z, '#b8964f', 1, '#8c6d2e');   // dikmeler
  if (g.onu) {
    box(W + .6, .02, g.ceilD, W / 2, g.store + .01, vitD + g.ceilD / 2, '#e4ddcf', .3);         // mağaza tavanı (cam önü)
    box(W, g.store - h, .02, W / 2, (h + g.store) / 2, vitD + .01, '#d6cdbd', .55);               // camın üstündeki saçak
  }
  }
  // Tabla: lüks haritası açıksa ısı haritası
  const tb = horizPlane(W, vitD, S.luxMap && R.luxTex ? new THREE.MeshBasicMaterial({ map: R.luxTex, side: THREE.DoubleSide }) : mat('#f6f0e1'), t + .002);
  tb.position.x = W / 2; tb.position.z = vitD / 2; st.add(tb);
  // Ürünler fotoğraf sahnesindekiyle aynı gövdeler; ışık konisi tablaya kadar
  R.mFx.position.set(...o); buildFixtureMeshes(R.mFx);
  R.mDyn.position.set(...o);
  if (S.on) for (const fx of S.fixtures) {
    const em = emittersFor(fx); if (!em.length) continue;
    const ps = fxPose(fx), dir = em[0].dir.clone().normalize(), y = faceY(fx.p, fx), yT = g.onu || g.banko ? t : 0;
    const len = (y - yT) / Math.max(.2, -dir.y), beam = fx.beam || fx.p.beam || 60;
    const geo = new THREE.ConeGeometry(len * Math.tan(beam / 2 * Math.PI / 180), len, 40, 1, true); geo.translate(0, -len / 2, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: lin(EMIT_HEX[S.cct]), transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(ps.x, y, ps.z); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); R.mDyn.add(m);
  }
  if (S.foot) footprints(R.mDyn);
}
$$('#mviewSeg button').forEach(b => b.addEventListener('click', () => {
  S.mView = b.dataset.mv; $$('#mviewSeg button').forEach(x => x.classList.toggle('is-active', x === b));
  if (R?.mControls) R.mControls.enabled = S.view === 'model' && S.mView === 'persp';
  fitModel(); render();
}));

/* ---------------- ölçü çizgileri: fotoğrafın perspektifinde ve ölçülü modelde aynı ölçüler (cm) ---------------- */
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
// Ölçüler model koordinatında. lvl 1: fotoğrafta da görünür; 2: sadece modelde (zemin gibi fotoğrafta çoğu zaman görünmeyen yerler)
function dimList() {
  const g = vitGeo(), out = [], cm = m => fmtCm(m * 100), { W, vitD, t, h } = g;
  const add = (a, b, off, label, lvl = 1) => out.push({ a, b, off, label, lvl });
  if (g.banko) {
    add([0, t, vitD], [W, t, vitD], [0, 0, .1], `Uzunluk ${cm(W)}`);
    add([W, t, 0], [W, t, vitD], [.1, 0, 0], `Derinlik ${cm(vitD)}`);
    add([W, 0, vitD], [W, t, vitD], [.1, 0, .1], `Banko yüksekliği ${cm(t)}`);
    add([-.15, 0, vitD / 2], [-.15, g.store, vitD / 2], [0, 0, 0], `Mağaza tavanı ${cm(g.store)}`, 2);
  } else {
  add([0, t, vitD], [W, t, vitD], [0, 0, .1], `Genişlik ${cm(W)}`);
  add([W, t, 0], [W, t, vitD], [.1, 0, 0], `Derinlik ${cm(vitD)}`);
  add([W, t, vitD], [W, h, vitD], [.1, 0, .1], `Tabla → tavan ${cm(h - t)}`);
  if (t > .01) add([W, 0, vitD], [W, t, vitD], [.1, 0, .1], `Tabla ${cm(t)}`, 2);
  if (g.onu) add([0, 0, vitD], [0, g.store, vitD], [-.12, 0, .05], `Mağaza tavanı ${cm(g.store)}`, 2);
  }
  const o = mOff(g);
  const fx = S.fixtures.filter(f => f.p.fam === 'gomme').map(f => {
    const ps = fxPose(f), co = Math.abs(Math.cos(ps.rot)), si = Math.abs(Math.sin(ps.rot)), L = f.p.lengthCm / 100, Wd = f.p.widthCm / 100;
    return { x: ps.x + o[0], z: ps.z + o[2], y: faceY(f.p, f) + o[1], hx: (co * L + si * Wd) / 2, hz: (si * L + co * Wd) / 2 };
  });
  if (!fx.length) return out;
  const rows = [];
  for (const q of [...fx].sort((a, b) => a.z - b.z)) { const r = rows.find(r => Math.abs(r[0].z - q.z) < .05); if (r) r.push(q); else rows.push([q]); }
  const chain = (ps, mk) => { for (let i = 0; i < ps.length - 1; i++) if (ps[i + 1] - ps[i] > .003) mk(ps[i], ps[i + 1]); };
  // Her sırada soldan sağa: duvar–ürün ve ürün–ürün boşlukları (ürün kenarından)
  rows.forEach((r, ri) => {
    r.sort((a, b) => a.x - b.x);
    const z = Math.max(...r.map(q => q.z + q.hz)) + .035, y = Math.min(...r.map(q => q.y));
    const ps = [0, ...r.flatMap(q => [q.x - q.hx, q.x + q.hx]), W];
    for (let i = 0; i < ps.length - 1; i += 2) if (ps[i + 1] - ps[i] > .003) add([ps[i], y, z], [ps[i + 1], y, z], [0, 0, 0], cm(ps[i + 1] - ps[i]), ri ? 2 : 1);
  });
  const q0 = rows[0][0], y0 = q0.y, xl = Math.min(...rows.map(r => r[0].x - r[0].hx)) - .035;
  if (g.banko) {                                          // banko: ETNA'nın bankoya yüksekliği ve bankonun ortasına göre kaydırması
    add([q0.x, y0, q0.z], [q0.x, t, q0.z], [0, 0, 0], `ETNA → banko ${cm(y0 - t)}`, 2);
    if (Math.abs(q0.z - vitD / 2) > .005) add([xl, y0, vitD / 2], [xl, y0, q0.z], [0, 0, 0], `Banko ortasından ${cm(Math.abs(q0.z - vitD / 2))}`);
  } else if (!g.onu) {                                    // vitrin tavanı: arkadan öne sıra boşlukları
    const ps = [0, ...rows.flatMap(r => [r[0].z - r[0].hz, r[0].z + r[0].hz]), vitD];
    for (let i = 0; i < ps.length - 1; i += 2) if (ps[i + 1] - ps[i] > .003) add([xl, y0, ps[i]], [xl, y0, ps[i + 1]], [0, 0, 0], cm(ps[i + 1] - ps[i]));
  } else {
    add([xl, y0, vitD], [xl, y0, q0.z], [0, 0, 0], `Camdan ${cm(q0.z - vitD)} (ürün ortası)`);
    add([q0.x, y0, q0.z], [q0.x, t, q0.z], [0, 0, 0], `ETNA → tabla ${cm(y0 - t)}`, 2);
  }
  return out;
}
const dimsOn = () => S.dims && S.mode === 'vitrin' && S.step === 3 && S.view !== 'plan' && !!R && S.cal?.kind === 'vitrin';
const footOn = () => S.foot && S.on && S.step === 3 && S.view !== 'plan' && !!R && !!S.cal;
const overlayOn = () => dimsOn() || footOn();
// g: 2D bağlam, w × h piksel, k: yazı ölçeği (piksel oranı), cam: o anki kamera
function paintDims(g, w, h, k, cam) {
  const inModel = S.view === 'model', lv = inModel ? 2 : 1, gv = vitGeo();
  const P = pm => { const v = new THREE.Vector3(...(inModel ? pm : m2w(pm, gv))).project(cam); return v.z > 1 || v.z < -1 ? null : [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h]; };
  const seg = (a, b, col, lw, dash) => { g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash || []); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); g.setLineDash([]); };
  g.save(); g.lineCap = 'round'; g.font = `700 ${12 * k}px Work Sans, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const labels = [];
  for (const d of dimList()) {
    if (d.lvl > lv) continue;
    const a2 = add3(d.a, d.off), b2 = add3(d.b, d.off), A = P(d.a), B = P(d.b), A2 = P(a2), B2 = P(b2);
    if (!A2 || !B2) continue;
    if (d.off.some(v => v)) { if (A) seg(A, A2, '#ffffffb0', 1 * k, [3 * k, 3 * k]); if (B) seg(B, B2, '#ffffffb0', 1 * k, [3 * k, 3 * k]); }
    const L = Math.hypot(B2[0] - A2[0], B2[1] - A2[1]); if (L < 2) continue;
    const ux = (B2[0] - A2[0]) / L, uy = (B2[1] - A2[1]) / L, nx = -uy, ny = ux, tk = 5 * k;
    seg(A2, B2, '#1b1e22', 3.6 * k); seg(A2, B2, '#f3a000', 1.8 * k);
    for (const E of [A2, B2]) { seg([E[0] - nx * tk, E[1] - ny * tk], [E[0] + nx * tk, E[1] + ny * tk], '#1b1e22', 3.6 * k); seg([E[0] - nx * tk, E[1] - ny * tk], [E[0] + nx * tk, E[1] + ny * tk], '#f3a000', 1.8 * k); }
    labels.push({ d, m: [(A2[0] + B2[0]) / 2, (A2[1] + B2[1]) / 2], L, n: [nx, ny] });
  }
  // Etiketler en üstte; kısa çizgide çizginin yanına kayar
  for (const { d, m, L, n } of labels) {
    const tw = g.measureText(d.label).width + 10 * k, th = 18 * k, sh = L < tw + 6 * k ? 14 * k : 0;
    if (m[0] < -tw || m[0] > w + tw || m[1] < -th || m[1] > h + th) continue;           // çizgisi ekran dışında: etiket yok
    const x = clamp(m[0] + n[0] * sh, tw / 2 + 2, w - tw / 2 - 2), y = clamp(m[1] + n[1] * sh, th / 2 + 2, h - th / 2 - 2);
    g.fillStyle = '#1b1e22e6'; g.beginPath(); g.roundRect(x - tw / 2, y - th / 2, tw, th, 5 * k); g.fill();
    g.fillStyle = '#fff'; g.fillText(d.label, x, y + .5 * k);
  }
  g.restore();
}
function drawDims() {
  const dc = $('#dimCanvas');
  if (!overlayOn()) { dc.hidden = true; return; }
  const el = R.renderer.domElement, r = el.getBoundingClientRect(), sr = $('#stage').getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  dc.hidden = false;
  Object.assign(dc.style, { left: r.left - sr.left + 'px', top: r.top - sr.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (dc.width !== W || dc.height !== H) { dc.width = W; dc.height = H; }
  const g = dc.getContext('2d'); g.clearRect(0, 0, W, H);
  if (footOn()) paintFoot(g, W, H, dpr, curCam());
  if (dimsOn()) paintDims(g, W, H, dpr, curCam());
}
/* ---- ışık izi: ışın açısı kenarının (şiddet %50) tablaya / zemine düştüğü yer ---- */
function footPolys() {
  const out = []; if (!S.on || !S.cal) return out;
  const c = S.cal, vit = c.kind === 'vitrin', g = vit ? vitGeo() : null;
  // Işığın çarptığı iç yüzeyler: vitrinde tabla + arka pano + yanlar (iç kutu), odada zemin
  const box = !vit || g.banko ? null : g.onu ? { lo: [0, g.t, -g.vitD], hi: [g.W, g.h, 0] } : { lo: [0, 0, 0], hi: [g.W, c.H, c.depth] };
  const hit = (o, r) => {
    if (vit && g.banko) {                                 // banko üstü; bankonun dışına düşen ışık zemine
      if (r.y > -.02) return null;
      const p = o.clone().addScaledVector(r, (g.t - o.y) / r.y);
      return p.x >= 0 && p.x <= g.W && p.z >= 0 && p.z <= g.vitD ? p.setY(g.t + .004) : null;   // sadece banko üstündeki kısım
    }
    if (!box) { if (r.y > -.02) return null; return o.clone().addScaledVector(r, -o.y / r.y).setY(.004); }
    let tIn = -Infinity, tOut = Infinity, inAx = -1;
    for (let a = 0; a < 3; a++) {
      const oa = o.getComponent(a), ra = r.getComponent(a);
      if (Math.abs(ra) < 1e-9) { if (oa < box.lo[a] - 1e-6 || oa > box.hi[a] + 1e-6) return null; continue; }
      let t0 = (box.lo[a] - oa) / ra, t1 = (box.hi[a] - oa) / ra; if (t0 > t1) [t0, t1] = [t1, t0];
      if (t0 > tIn) { tIn = t0; inAx = a; } tOut = Math.min(tOut, t1);
    }
    if (!(tOut > 1e-4) || tIn > tOut) return null;
    if (g.onu && !(inAx === 2 && tIn > 0)) return null;    // cam önü: ışık camdan (ön yüz) girmeli, çerçeveye çarpan sayılmaz
    const p = o.clone().addScaledVector(r, tOut);
    return p.lerp(o, .003 / Math.max(.003, tOut));          // yüzeyin hemen önü
  };
  for (const fx of S.fixtures) {
    const beam = fx.beam || fx.p.beam; if (!beam) continue;      // geniş ışıklı ürünlerde (lineer, sarkıt) iz yok
    const em = emittersFor(fx); if (!em.length) continue;
    const ps = fxPose(fx), dir = em[0].dir.clone().normalize(), o = new THREE.Vector3(ps.x, faceY(fx.p, fx), ps.z);
    const ref = Math.abs(dir.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(dir, ref).normalize(), v = new THREE.Vector3().crossVectors(dir, u).normalize();
    const th = beam / 2 * Math.PI / 180, pts = [];
    for (let i = 0; i < 96; i++) {
      const a = i / 96 * Math.PI * 2, r = dir.clone().multiplyScalar(Math.cos(th)).addScaledVector(u, Math.sin(th) * Math.cos(a)).addScaledVector(v, Math.sin(th) * Math.sin(a));
      pts.push(hit(o, r));
    }
    if (pts.filter(Boolean).length < 12) continue;
    out.push({ pts, cen: hit(o, dir), sel: isSel('fx', fx.id) });
  }
  return out;
}
function footprints() {}                                 // iz üst katmanda (paintFoot) çizilir
// Üst katman: ışık izinin kenarı ve merkezi (ölçü çizgileriyle aynı katman)
function paintFoot(g, w, h, k, cam) {
  const inModel = S.view === 'model', gv = S.cal.kind === 'vitrin' ? vitGeo() : null;
  const P = v => { const p = new THREE.Vector3(...(inModel ? w2m(v.toArray(), gv) : v.toArray())).project(cam); return p.z > 1 || p.z < -1 ? null : [(p.x + 1) / 2 * w, (1 - p.y) / 2 * h]; };
  g.save(); g.lineJoin = 'round';
  for (const { pts, cen, sel } of footPolys()) {
    // Çerçeveye çarpan (null) noktalarda çizgi kesilir
    const q = pts.map(v => v && P(v)), full = q.every(Boolean);
    g.beginPath(); let pen = false;
    for (let i = 0; i <= q.length; i++) { const v = q[i % q.length]; if (!v) { pen = false; continue; } if (pen) g.lineTo(...v); else { g.moveTo(...v); pen = true; } if (i === q.length && full) g.closePath(); }
    g.strokeStyle = '#1b1e22cc'; g.lineWidth = 4 * k; g.stroke();
    g.strokeStyle = sel ? '#f3a000' : '#ffe08a'; g.lineWidth = 2 * k; g.setLineDash([7 * k, 4 * k]); g.stroke(); g.setLineDash([]);
    const c = cen && P(cen); if (!c) continue;
    g.fillStyle = '#1b1e22'; g.beginPath(); g.arc(...c, 5 * k, 0, Math.PI * 2); g.fill();
    g.fillStyle = sel ? '#f3a000' : '#ffe08a'; g.beginPath(); g.arc(...c, 3 * k, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
function buildFoot() { if (!R) return; disposeGroup(R.footGroup); if (S.foot) footprints(R.footGroup); }
$('#footBtn').addEventListener('click', () => { S.foot = !S.foot; $('#footBtn').classList.toggle('is-active', S.foot); buildFixtures(); });
$('#dimBtn').addEventListener('click', () => { S.dims = !S.dims; $('#dimBtn').classList.toggle('is-active', S.dims); render(); });

/* ---------------- ışık ölçümü: tablaya (odada zemine) düşen aydınlık, lüks ---------------- */
const GLASS = .92;                                        // [Tahmin] berrak vitrin camı geçirgenliği
function computeLux() {
  if (!R || !S.cal) return;
  const c = S.cal, vit = c.kind === 'vitrin', g = vit ? vitGeo() : null;
  const rect = !vit ? { x0: 0, x1: c.width, z0: 0, z1: c.depth, y: 0 } : g.banko ? { x0: 0, x1: g.W, z0: 0, z1: g.vitD, y: g.t }
    : g.onu ? { x0: 0, x1: g.W, z0: -g.vitD, z1: 0, y: g.t } : { x0: 0, x1: g.W, z0: 0, z1: g.vitD, y: 0 };
  const ems = S.on ? S.fixtures.flatMap(emittersFor).map(e => ({ p: [e.pos.x, e.pos.y, e.pos.z], d: [e.dir.x, e.dir.y, e.dir.z], cd: e.cd, c0: e.cone[0], c1: e.cone[1], k: e.k })) : [];
  // Cam önü: ışık cam düzlemini (z = 0) vitrin açıklığından geçmeli (tabla ile vitrin tavanı arası); çerçeveye çarpan sayılmaz
  const pass = vit && g.onu ? (e, P) => {
    if (e.p[2] <= 0 || P[2] >= 0) return 1;
    const s = e.p[2] / (e.p[2] - P[2]), yc = e.p[1] + (P[1] - e.p[1]) * s, xc = e.p[0] + (P[0] - e.p[0]) * s;
    return yc >= g.t && yc <= g.h && xc >= 0 && xc <= g.W ? GLASS : 0;
  } : null;
  const step = Math.max(.01, Math.max(rect.x1 - rect.x0, rect.z1 - rect.z0) / (vit ? 100 : 80));
  S.luxRes = ISIK.luxGrid(ems, rect, step, pass);
  paintLux(); renderLux();
}
function paintLux() {
  const res = S.luxRes, sc = ISIK.SCALE[S.mode === 'vitrin' ? 'vitrin' : 'oda'];
  if (!R.luxCv) { R.luxCv = document.createElement('canvas'); R.luxTex = new THREE.CanvasTexture(R.luxCv); R.luxTex.flipY = false; R.luxTex.colorSpace = THREE.NoColorSpace; }
  const cv = R.luxCv;
  if (cv.width !== res.nx || cv.height !== res.nz) { cv.width = res.nx; cv.height = res.nz; R.luxTex.dispose(); }
  const cx = cv.getContext('2d'), im = cx.createImageData(res.nx, res.nz);
  for (let i = 0; i < res.vals.length; i++) { const col = ISIK.luxColor(res.vals[i], sc); im.data[i * 4] = col[0]; im.data[i * 4 + 1] = col[1]; im.data[i * 4 + 2] = col[2]; im.data[i * 4 + 3] = 255; }
  cx.putImageData(im, 0, 0); R.luxTex.needsUpdate = true;
  disposeGroup(R.luxGroup);
  if (S.luxMap) {                                         // fotoğrafta tabla / zemin üstünde yarı saydam katman
    const r = res.rect, m = horizPlane(r.x1 - r.x0, r.z1 - r.z0, new THREE.MeshBasicMaterial({ map: R.luxTex, transparent: true, opacity: .78, depthTest: false, side: THREE.DoubleSide }), r.y + .003);
    m.position.x = (r.x0 + r.x1) / 2; m.position.z = (r.z0 + r.z1) / 2; m.renderOrder = 5; R.luxGroup.add(m);
  }
}
function renderLux() {
  const r = S.luxRes, vit = S.mode === 'vitrin', sc = ISIK.SCALE[vit ? 'vitrin' : 'oda'], fmt = v => Math.round(v).toLocaleString('tr-TR') + ' lx';
  $('#luxPlane').textContent = vit ? (S.vit.place === 'banko' ? 'banko üstü' : S.vit.place === 'onu' ? 'tabla üstü · camın arkası' : 'tabla üstü') : 'zemin';
  $('#luxAvg').textContent = fmt(r.avg); $('#luxMin').textContent = fmt(r.min); $('#luxMax').textContent = fmt(r.max);
  $('#luxU').textContent = r.avg > 0 ? r.u0.toFixed(2).replace('.', ',') : '-';
  const ticks = [0, 3, 6, 9].map(i => sc[i][0].toLocaleString('tr-TR') + (i === 9 ? '+' : ''));
  $('#luxLegend').innerHTML = `<div class="lux-bar" style="background:linear-gradient(90deg,${sc.map(([, c], i) => `${c} ${(i / (sc.length - 1) * 100).toFixed(1)}%`).join(',')})"></div><div class="lux-ticks">${ticks.map(x => `<span>${x}</span>`).join('')}</div>`;
  $('#luxNote').innerHTML = (vit ? 'Katalogdaki lümen ve ışın açısıyla, gerçek mesafeden hesaplandı [ölçüler ve katalog: Kesin]. Sadece doğrudan ışık, yansıma hariç. Işık dağılımı yaklaşık; ürünün ışık dosyası (IES) yok [Tahmin].'
    + (S.vit.place === 'onu' ? ' Cam geçirgenliği %92 [Tahmin]; vitrin çerçevesine çarpan ışık sayılmadı.' : '')
    : 'Sadece doğrudan ışık, yansıma hariç. Magnet ürünlerin lümeni tahmini (90 lm/W) [Tahmin].') + ' Düzgünlük = en düşük / ortalama.';
}
$('#luxBtn').addEventListener('click', () => { S.luxMap = !S.luxMap; $('#luxBtn').classList.toggle('is-active', S.luxMap); buildFixtures(); });

/* ---- malzeme listesi (Codex'teki hesapla aynı: 3/2/1 m parçalar, trafo 100/200/300 W) ---- */
function stockPieces(length) { const out = []; let rem = Math.ceil(length * 10) / 10; while (rem > .001) { const sz = rem >= 3 ? 3 : rem >= 2 ? 2 : 1; out.push(sz); rem = Math.max(0, rem - sz); } return out; }
function recommendedDriver(w) { const need = w * 1.2; return need ? ([100, 200, 300].find(x => x >= need) || Math.ceil(need / 100) * 100) : 0; }
function materials() {
  const pieces = { 3: 0, 2: 0, 1: 0 }; let total = 0, corners = 0, joins = 0, feeds = 0, caps = 0;
  for (const r of S.rails) {
    const g = railGeom(r); total += g.len; corners += g.corners; feeds += 1; caps += g.closed ? 0 : 2;
    for (const q of g.segs) { const ps = stockPieces(q.len); ps.forEach(x => pieces[x]++); joins += ps.length - 1; }
  }
  const prods = {}; for (const f of S.fixtures) prods[f.p.sku] = (prods[f.p.sku] || 0) + 1;
  // 48V magnet trafosu sadece ray ürünlerini besler; ETNA kendi 220V sürücüsüyle gelir
  const magW = S.fixtures.filter(f => f.p.fam !== 'gomme').reduce((a, f) => a + f.p.watts, 0);
  const gomW = S.fixtures.filter(f => f.p.fam === 'gomme').reduce((a, f) => a + f.p.watts, 0);
  return { pieces, total, corners, joins, feeds, caps, prods, watts: magW + gomW, magW, gomW, driver: recommendedDriver(magW) };
}
function renderMaterials() {
  const m = materials(), sys = sysOf(), rows = [];
  const row = (a, b) => rows.push(`<div class="mrow"><span>${a}</span><strong>${b}</strong></div>`);
  if (S.rails.length) {
    row(`${sys.name}`, `${fmtM(m.total)}`);
    const pc = [3, 2, 1].filter(x => m.pieces[x]).map(x => `${x} m × ${m.pieces[x]}`).join(', ');
    row('&nbsp;&nbsp;Ray parçaları (kesilerek)', pc);
    if (m.corners) row('&nbsp;&nbsp;Köşe (L) bağlantı', `${m.corners} adet`);
    if (m.joins) row('&nbsp;&nbsp;Düz bağlantı', `${m.joins} adet`);
    row('&nbsp;&nbsp;Besleme (enerji girişi)', `${m.feeds} adet`);
    if (m.caps) row('&nbsp;&nbsp;Uç kapak', `${m.caps} adet`);
  }
  for (const [sku, n] of Object.entries(m.prods)) row(`${bySku[sku].name === sku ? sku : sku + ' · ' + bySku[sku].name}`, `${n} adet`);
  row('Toplam güç', `${m.watts} W`);
  if (m.magW) row('Magnet trafo (48V, %20 pay)', `${m.driver} W`);
  if (m.gomW) row('ETNA sürücüleri (220V, ürünle gelir)', `${m.gomW} W`);
  $('#materials').innerHTML = rows.join('') || '<p class="muted">Ray ve ürün ekleyince liste burada oluşur.</p>';
}

$('#pngBtn').addEventListener('click', () => {
  if (!R) return;
  if (S.view === 'plan') { const a = document.createElement('a'); a.href = pc.toDataURL('image/png'); a.download = 'gmc-tavan-plan.png'; a.click(); return; }
  const r = R.renderer, cam = curCam(), old = r.getSize(new THREE.Vector2()), pr = r.getPixelRatio();
  r.setPixelRatio(1);
  if (S.view === 'photo') r.setSize(S.W, S.H, false); else r.setSize(old.x * 2, old.y * 2, false);
  r.render(S.view === 'model' ? R.mScene : R.scene, cam);
  let url = r.domElement.toDataURL('image/png');
  if (overlayOn()) {
    const cv = document.createElement('canvas'); cv.width = r.domElement.width; cv.height = r.domElement.height;
    const g2 = cv.getContext('2d'), k2 = cv.width / Math.max(1, r.domElement.getBoundingClientRect().width); g2.drawImage(r.domElement, 0, 0);
    if (footOn()) paintFoot(g2, cv.width, cv.height, k2, cam);
    if (dimsOn()) paintDims(g2, cv.width, cv.height, k2, cam);
    url = cv.toDataURL('image/png');
  }
  r.setPixelRatio(pr); r.setSize(old.x, old.y); render();
  const a = document.createElement('a'); a.href = url; a.download = 'gmc-tavan-tasarim.png'; a.click();
});

new ResizeObserver(() => { if (S.step === 2) drawCalib(); if (S.step === 3) resizeGL(); }).observe($('#stage'));
renderPanel(); dnLabel();

/* ---- test/demo kancası: ?demo=salon&fx=1&view=plan&step=2 ---- */
const q = new URLSearchParams(location.search);
if (q.get('placetest')) placeTest();
async function placeTest() {
  const s = SAMPLES.salon, out = [], ok = (n, c) => out.push(`${c ? 'GEÇTİ' : 'KALDI'} · ${n}`);
  await loadPhoto(s.src, s.pts, null, s); const ref = S.cal;
  await loadPhoto(s.src, null, null, s);
  ok('yeni fotoğrafta işaretleme modu açık', placing() && !$('#placeBox').hidden && !$('#stageBanner').hidden);
  ok('lens EXIF yokken telefon varsayılanı', Math.abs(S.lensMm - lensFromF35(26)) < .01);
  const r = cc.getBoundingClientRect();
  const scr = k => [r.left + (view.ox + s.pts[k][0] * S.W * view.s) / view.dpr, r.top + (view.oy + s.pts[k][1] * S.H * view.s) / view.dpr];
  const fire = (t, p) => cc.dispatchEvent(new PointerEvent(t, { clientX: p[0], clientY: p[1], pointerId: 1, bubbles: true, pointerType: 'touch' }));
  if (q.get('hold')) {                                   // ekran görüntüsü için: 2 nokta konmuş, 3.'sü basılı
    for (const k of ORDER.slice(0, 2)) { const p = scr(k); fire('pointerdown', p); fire('pointerup', p); }
    const p = scr('BR'); fire('pointerdown', [p[0] + 30, p[1] + 25]); fire('pointermove', p); return;
  }
  for (const k of ORDER) {
    const p = scr(k), off = [p[0] + 30, p[1] + 25];
    fire('pointerdown', off); fire('pointermove', p);    // parmak basılı kayıyor, sonra bırakıyor
    if (k === 'TL') ok('basılı tutarken büyüteç açık', !!loupe);
    fire('pointerup', p);
  }
  ok('6 nokta konunca işaretleme bitti', !placing() && !!S.cal);
  ok('elle işaretleme hazır ayarla aynı odayı verdi', S.cal && Math.abs(S.cal.width - ref.width) < .05 && Math.abs(S.cal.camH - ref.camH) < .05 && Math.abs(S.lensMm - 16.5) < 1);
  undo(); ok('geri al: son nokta geri alındı', placing() && S.placeIdx === 5 && !S.cal);
  redo(); ok('ileri al: oda geri geldi', !placing() && !!S.cal);
  $('#restartMark').click(); ok('baştan işaretle', S.placeIdx === 0);
  for (const k of ORDER.slice(0, 4)) { const p = scr(k); fire('pointerdown', p); fire('pointerup', p); }
  $('#skipSide').click(); ok('yan çizgi atlanınca da oda kuruldu', !placing() && !!S.cal && S.sideOff);
  const pre = document.createElement('pre'); pre.id = 'selftest'; pre.textContent = out.join('\n'); document.body.appendChild(pre);
  document.title = 'PLACETEST ' + out.filter(x => x.startsWith('GEÇTİ')).length + '/' + out.length;
}
// Kuyumcu vitrini testi: ?vitrintest=1 (ölçü formu, site ile aynı öneri, tavandan ölçüyle kalibrasyon, otomatik yerleşim, cam önü, fotoğrafsız, proje dosyası)
async function vitrinTest() {
  const out = [], ok = (n, c) => out.push(`${c ? 'GEÇTİ' : 'KALDI'} · ${n}`);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const et = () => S.fixtures.filter(f => f.p.fam === 'gomme');
  try {
    ok('vitrin modu açık, 4 noktalı işaretleme', S.mode === 'vitrin' && ORDER.length === 4 && document.body.dataset.mode === 'vitrin');
    ok('ray blokları gizli, ölçü formu görünür', getComputedStyle($('#systems').closest('.blk')).display === 'none' && $('#vitForm').offsetHeight > 0);
    ok('form site varsayılanlarıyla dolu (200 × 80, 180 / 45)', $('[data-v="width"]').value === '200' && $('[data-v="depth"]').value === '80' && $('[data-v="height"]').value === '180' && $('[data-v="table"]').value === '45');
    const cards = () => $$('#vitForm .vcard');
    ok('3 öneri kartı: Ferah 3×1, Önerilen 4×2, Yoğun 5×3 (sitedeki araçla aynı)', cards().length === 3 && cards().map(b => b.dataset.cols + 'x' + b.dataset.rows).join() === '3x1,4x2,5x3');
    ok('önerilen kart seçili', cards()[1].classList.contains('is-active') && S.vit.cols === 4 && S.vit.rows === 2);
    ok('özet: 8 adet ETNA 26 · 352 W', /8 adet ETNA 26/.test($('#vitForm .vit-sum').textContent) && /352 W/.test($('#vitForm .vit-sum').textContent));
    const t = $('[data-v="table"]'); t.value = '160'; t.dispatchEvent(new Event('input', { bubbles: true }));
    ok('tabla tavana çok yakın: sitedeki uyarı + fotoğraf yükleme kapalı', /en az 30 cm/.test($('#vitForm .vit-warn').textContent) && !$('#vitForm .vit-warn').hidden && $('#dropZone').classList.contains('off'));
    t.value = '45'; t.dispatchEvent(new Event('input', { bubbles: true }));
    ok('düzelince uyarı kalktı', $('#vitForm .vit-warn').hidden && !$('#dropZone').classList.contains('off'));
    cards()[2].click(); ok('Yoğun kartı: 5 × 3', S.vit.cols === 5 && S.vit.rows === 3);
    $('[data-vrot="1"]').click(); ok('yön dik: öneri yeniden hesaplandı (18 cm genişlik boyunca)', S.vit.rot === '1' && S.vit.cols === VIT.maxByGap(200, 18, 8, 30));
    $('[data-vrot="0"]').click();

    // ---- örnek: cam önündeki saçak tavanı (4 köşe) ----
    const sv = SAMPLES.vitrin;
    await loadPhoto(sv.src, sv.pts, null, sv); const ref = S.cal;
    ok('örnek: saçak tavanı kuruldu, kamera tavanın altında', ref && ref.kind === 'vitrin' && ref.cam[1] < ref.H && S.vit.place === 'onu' && S.step === 2);
    ok(`örnek: derinlik fotoğraftan (${ref ? Math.round(ref.depth * 100) : '-'} cm), noktalar uyumlu (${ref ? ref.err.toFixed(1) : '-'} px)`, ref && !ref.fixD && ref.depth > .3 && ref.depth < 3 && ref.err < Math.max(4, longSide() * .006));
    await loadPhoto(sv.src, null, null, sv);
    const r = cc.getBoundingClientRect();
    const scr = k => [r.left + (view.ox + sv.pts[k][0] * S.W * view.s) / view.dpr, r.top + (view.oy + sv.pts[k][1] * S.H * view.s) / view.dpr];
    const fire = (ty, p) => cc.dispatchEvent(new PointerEvent(ty, { clientX: p[0], clientY: p[1], pointerId: 1, bubbles: true, pointerType: 'touch' }));
    ok('işaretleme 1/4: "Tavanın SOL ARKA köşesi" + cam önü açıklaması', placing() && /Tavanın SOL ARKA/.test($('#placeText').textContent) && /Cam önü/.test($('#placeHelp').textContent) && $('#placeNo').textContent === '1/4');
    for (const k of ORDER) { const p = scr(k); fire('pointerdown', p); fire('pointermove', p); fire('pointerup', p); }
    ok('4 nokta konunca tavan kuruldu', !placing() && S.cal && S.cal.kind === 'vitrin');
    ok('elle işaretleme hazır noktalarla aynı kamerayı verdi (<3 cm)', S.cal && Math.hypot(...S.cal.cam.map((v, i) => v - ref.cam[i])) < .03);
    ok('bilgi kutusu ölçüyü ve derinliği yazıyor', /Tavan kuruldu/.test($('#calibInfo').textContent) && /fotoğraftan/.test($('#calibInfo').textContent));
    goStep(3); await wait(50);
    const zf = et();
    ok(`cam önü: ${S.vit.cols} ETNA tek sıra, camdan 25 cm, tavanda`, zf.length === S.vit.cols && S.vit.rows >= 1 && zf.every(f => Math.abs(f.z - .25) < 1e-9 && f.y == null));
    const d0 = emittersFor(zf[0])[0].dir;
    ok('cam önü: ışık 25° eğimle vitrine dönük', zf.every(f => f.tilt === 25) && d0.z < -.3 && Math.abs(Math.acos(-d0.y) * 180 / Math.PI - 25) < .5);
    const el = R.renderer.domElement, screenOf = (x, y, z) => { const p = new THREE.Vector3(x, y, z).project(curCam()), b = el.getBoundingClientRect(); return [b.left + (p.x + 1) / 2 * b.width, b.top + (1 - p.y) / 2 * b.height]; };
    const gf = (ty, p) => el.dispatchEvent(new PointerEvent(ty, { clientX: p[0], clientY: p[1], pointerId: 1, bubbles: true, button: 0, isPrimary: true }));
    const f0 = zf[0], x0 = f0.x, a = screenOf(f0.x, S.cal.H, f0.z), b2 = screenOf(f0.x + .2, S.cal.H, f0.z + .1);
    S.active = null; gf('pointerdown', a); gf('pointermove', [(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2]); gf('pointermove', b2); gf('pointerup', b2);
    ok('ETNA tavanda sürüklendi', Math.abs(f0.x - x0 - .2) < .05 && Math.abs(f0.z - .35) < .05 && S.sel?.id === f0.id);
    setView('plan'); ok('plan çizildi', !$('#planCanvas').hidden && plan.s > 10); setView('photo');
    ok('ışık kaynakları çizildi, ekran kartı hatasız', R.uniforms.uCount.value === et().length * 10 && R.renderer.getContext().getError() === 0);

    // ---- Aşama 3c: ölçülü model, ölçü çizgileri, lüks (cam önü) ----
    ok('fotoğrafta ölçü çizgileri açık', S.dims && !$('#dimCanvas').hidden && dimList().some(d => d.label === 'Genişlik 200 cm'));
    const dc = $('#dimCanvas'), inked = () => { const d = dc.getContext('2d').getImageData(0, 0, dc.width, dc.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i]) n++; return n; };
    ok('ölçü katmanı çizildi', inked() > 200);
    const gap = dimList().filter(d => /^\d/.test(d.label) && d.lvl === 1).pop();  // ilk sırada sağ duvar–son ETNA (sürüklenmedi)
    ok(`ETNA boşluğu sitedeki öneriyle aynı (${gap?.label})`, gap && gap.label === fmtCm(VIT.suggestions(S.vit, vitProd()).find(o => o.cols === S.vit.cols).gx));
    ok('camdan uzaklık ölçüsü 25 cm', dimList().some(d => /^Camdan 25 cm/.test(d.label)) || dimList().some(d => /^Camdan/.test(d.label)));
    setView('model');
    ok('ölçülü model açıldı (Perspektif)', S.view === 'model' && !$('#mviewSeg').hidden && R.mStatic.children.length > 10 && R.mFx.children.length === et().length);
    $('#mviewSeg [data-mv="top"]').click();
    ok('Üst görünüm: ölçekli kamera', S.mView === 'top' && curCam() === R.mOrtho);
    const mScr = (x, y, z) => { const p = new THREE.Vector3(...w2m([x, y, z])).project(curCam()), b = el.getBoundingClientRect(); return [b.left + (p.x + 1) / 2 * b.width, b.top + (1 - p.y) / 2 * b.height]; };
    const f1 = et()[1], fx0 = f1.x, fz0 = f1.z, ma = mScr(f1.x, S.cal.H, f1.z), mb = mScr(f1.x - .1, S.cal.H, f1.z + .05);
    S.active = null; gf('pointerdown', ma); gf('pointermove', [(ma[0] + mb[0]) / 2, (ma[1] + mb[1]) / 2]); gf('pointermove', mb); gf('pointerup', mb);
    ok('modelde sürüklenen ETNA fotoğraf dünyasında da aynı cm kadar taşındı', Math.abs(f1.x - fx0 + .1) < .01 && Math.abs(f1.z - fz0 - .05) < .01);
    undo(); ok('geri al: model sürüklemesi geri döndü', Math.abs(et()[1].x - fx0) < 1e-6);
    $('#mviewSeg [data-mv="front"]').click(); ok('Ön görünüm', curCam() === R.mOrtho && R.mOrtho.position.z > 10);
    $('#mviewSeg [data-mv="persp"]').click(); ok('Perspektif: döndürme açık', curCam() === R.mPersp && R.mControls.enabled);
    const r0 = S.luxRes;
    ok(`lüks: tabla (camın arkası) ort. ${Math.round(r0.avg)} lx, en yüksek ${Math.round(r0.max)} lx`, r0.avg > 50 && r0.max > r0.avg && r0.rect.z1 === 0 && Math.abs(r0.rect.y - S.vit.table / 100) < 1e-9 && /lx/.test($('#luxAvg').textContent));
    const lmTot = et().reduce((a, f) => a + f.p.lm, 0), area = (r0.rect.x1 - r0.rect.x0) * (r0.rect.z1 - r0.rect.z0);
    ok('enerji korunumu: tablaya düşen akı toplam lümenden az', r0.avg * area < lmTot && r0.avg * area > 0);
    et().forEach(f => { f.tilt = 0; }); buildFixtures();
    const rDown = S.luxRes; et().forEach(f => { f.tilt = 25; }); buildFixtures();
    ok(`cam önü: eğim 0° iken ışık camdan az girer (${Math.round(rDown.avg)} lx < ${Math.round(S.luxRes.avg)} lx)`, rDown.avg * 2 < S.luxRes.avg);
    $('#luxBtn').click();
    ok('lüks haritası: fotoğrafta katman + modelde tabla', S.luxMap && R.luxGroup.children.length === 1 && R.mStatic.children.some(m => m.material?.map === R.luxTex));
    setView('plan'); ok('plan: vitrin içi + lüks haritası çizildi', !$('#planCanvas').hidden); setView('photo');
    $('#luxBtn').click(); ok('lüks haritası kapandı', !S.luxMap && R.luxGroup.children.length === 0);
    $('#dimBtn').click(); ok('ölçüler kapandı (ışık izi katmanı kalır)', !S.dims && !dimsOn() && !$('#dimCanvas').hidden); $('#dimBtn').click();
    ok('ışık izi: her ETNA için vitrin içinde iz hesaplandı', footPolys().length === et().length && footOn() && footPolys().every(f => f.pts.filter(Boolean).every(p => p.z <= 1e-3 && p.y >= S.vit.table / 100 - 1e-3)));
    $('.vit-top [data-vplace="ic"]').click();
    ok('montaj değişince köşeler yeniden işaretleniyor (adım 2, ürünler temizlendi)', S.step === 2 && placing() && S.placeIdx === 0 && !S.cal && !et().length && S.vit.place === 'ic');

    // ---- fotoğrafsız: vitrin içi tavanı (ölçü kesin) ----
    goStep(1); S.vit.width = 240; S.vit.depth = 70; S.vit.height = 180; S.vit.table = 45; pickRecommended(); renderVit();
    $('#synthBtn').click(); await wait(400);
    const W = 2.4, Hb = 1.35, D = .7, eye = [W * .58, clamp(1.55 - .45, Hb * .35, Hb * .8), D + Math.max(1.1, W * .85)];
    ok('fotoğrafsız: vitrin tavanı kuruldu (genişlik ve derinlik girilen)', S.cal && S.cal.kind === 'vitrin' && S.vit.place === 'ic' && Math.abs(S.cal.width - W) < 1e-9 && Math.abs(S.cal.depth - D) < 1e-9 && S.cal.fixD);
    ok('fotoğrafsız: kamera çizim kamerasıyla aynı (<1 cm)', S.cal && Math.hypot(...S.cal.cam.map((v, i) => v - eye[i])) < .01);
    // derinlik yanlış girilirse fotoğraf yakalar
    const dIn = $('[data-v="depth"]'); dIn.value = '90'; dIn.dispatchEvent(new Event('input', { bubbles: true }));
    ok('derinlik 90 girilince fotoğraftan ~70 cm uyarısı', /Fotoğrafa göre derinlik/.test($('#calibInfo').textContent) && S.cal && Math.abs(S.cal.photoD - .7) < .05);
    $('#usePhotoD').click();
    ok('"Fotoğraftakini kullan": derinlik 70 cm oldu, uyarı kalktı', Math.abs(S.vit.depth - 70) <= 1 && !/Fotoğrafa göre derinlik/.test($('#calibInfo').textContent));
    goStep(3); await wait(50);
    const v = S.vit;
    ok(`vitrin tavanı: ${v.cols}×${v.rows} ETNA otomatik yerleşti`, et().length === v.cols * v.rows && S.autoLaid);
    const inBox = f => f.x - .17 >= -1e-6 && f.x + .17 <= S.cal.width + 1e-6 && f.z - .09 >= -1e-6 && f.z + .09 <= S.cal.depth + 1e-6;
    ok('hepsi tavanın içinde, eğim yok', et().every(inBox) && et().every(f => !f.tilt));
    // ışın açısı: dar açı tablada daha yüksek tepe aydınlık verir; ölçüler vitrin tavanı modunda
    const rIc = S.luxRes, ta = S.luxRes.rect;
    ok(`vitrin tavanı: lüks tablada (y=0) ort. ${Math.round(rIc.avg)} lx`, ta.y === 0 && ta.z0 === 0 && Math.abs(ta.z1 - S.cal.depth) < 1e-9 && rIc.avg > 500);
    et().forEach(f => { f.beam = 24; }); buildFixtures(); const m24 = S.luxRes.max;
    et().forEach(f => { f.beam = 48; }); buildFixtures(); const m48 = S.luxRes.max;
    et().forEach(f => { f.beam = 34; }); buildFixtures();
    ok(`24° açı tepe aydınlığı 48°'den yüksek (${Math.round(m24)} > ${Math.round(m48)} lx)`, m24 > m48 * 1.2);
    ok('ölçüler: tabla → tavan 135 cm, derinlik 70 cm', dimList().some(d => d.label === 'Tabla → tavan 135 cm') && dimList().some(d => d.label === 'Derinlik 70 cm'));
    // ---- toplu seçim ----
    const el2 = R.renderer.domElement, scr2 = (x, z) => { const p = new THREE.Vector3(x, S.cal.H, z).project(curCam()), b = el2.getBoundingClientRect(); return [b.left + (p.x + 1) / 2 * b.width, b.top + (1 - p.y) / 2 * b.height]; };
    const fire2 = (ty, pt, o = {}) => el2.dispatchEvent(new PointerEvent(ty, { clientX: pt[0], clientY: pt[1], pointerId: 1, bubbles: true, button: 0, isPrimary: true, ...o }));
    S.active = null; const A = et()[0], B = et()[1], C = et()[2];
    fire2('pointerdown', scr2(A.x, A.z)); fire2('pointerup', scr2(A.x, A.z));
    fire2('pointerdown', scr2(B.x, B.z), { shiftKey: true }); fire2('pointerup', scr2(B.x, B.z), { shiftKey: true });
    fire2('pointerdown', scr2(C.x, C.z), { ctrlKey: true }); fire2('pointerup', scr2(C.x, C.z), { ctrlKey: true });
    ok('Shift / Ctrl + tıkla: 3 ETNA toplu seçildi', multiOn() && selFx().length === 3 && /3 ürün/.test($('#selTools').textContent));
    fire2('pointerdown', scr2(B.x, B.z), { shiftKey: true }); fire2('pointerup', scr2(B.x, B.z), { shiftKey: true });
    ok('Shift + tekrar tıkla: seçimden çıktı (2 kaldı)', selFx().length === 2 && !S.multi.includes(B.id));
    $('#selAllBtn').click();
    ok('Tümünü seç: hepsi seçili', selFx().length === et().length && et().length > 3);
    const before = et().map(f => [f.x, f.z]), a0 = scr2(C.x, C.z), b0 = scr2(C.x - .08, C.z);
    fire2('pointerdown', a0); fire2('pointermove', [(a0[0] + b0[0]) / 2, a0[1]]); fire2('pointermove', b0); fire2('pointerup', b0);
    ok('toplu sürükleme: hepsi aynı kadar kaydı (8 cm), seçim korundu', et().every((f, i) => Math.abs(f.x - before[i][0] + .08) < .01 && Math.abs(f.z - before[i][1]) < .01) && selFx().length === et().length);
    const far0 = scr2(C.x, C.z), far1 = scr2(C.x - 3, C.z);
    fire2('pointerdown', far0); fire2('pointermove', [(far0[0] + far1[0]) / 2, far0[1]]); fire2('pointermove', far1); fire2('pointerup', far1);
    ok('toplu sürükleme: grup tavandan taşmadı, aralıklar korundu', et().every(f => f.x >= .1 - 1e-6) && Math.abs((et()[1].x - et()[0].x) - (before[1][0] - before[0][0])) < 1e-6);
    undo(); undo();
    ok('geri al: toplu sürükleme geri döndü', et().every((f, i) => Math.abs(f.x - before[i][0]) < 1e-6));
    selectAll();
    const tsel2 = $('#selTools select[data-fx="tilt"]'); tsel2.value = '25'; tsel2.dispatchEvent(new Event('input', { bubbles: true }));
    ok('toplu eğim 25°: hepsine uygulandı', et().every(f => f.tilt === 25));
    const n0 = et().length; $('#selTools [data-act="del"]').click();
    ok('toplu sil: hepsi silindi', et().length === 0);
    undo(); ok('geri al: hepsi geri geldi', et().length === n0);
    $('#selTools [data-act="none"]')?.click(); ok('seçimi bırak', !multiOn());
    const xs = [...new Set(et().map(f => f.x.toFixed(4)))].map(Number).sort((a, b) => a - b), gx = (S.vit.width / 100 - xs.length * .34) / (xs.length + 1);
    ok('yan boşluklar sitedeki hesapla aynı (kenarlar dahil eşit)', Math.abs(xs[0] - .17 - gx) < 2e-4 && xs.every((x, i) => !i || Math.abs(x - xs[i - 1] - .34 - gx) < 2e-4));
    const nBefore = et().length;
    $$('.vit-top .vcard')[0].click();
    ok('Ferah kartı yeniden dizdi', et().length === S.vit.cols * S.vit.rows && et().length < nBefore);
    undo(); ok('geri al: önceki yerleşim döndü', et().length === nBefore);
    $('#cmpBtn').click(); ok('önce/sonra çalışıyor', S.compare && !$('#split').hidden); $('#cmpBtn').click();

    // ---- banko üzeri ----
    goStep(1);
    $('.zone[data-vplace="banko"]').click();
    ok('Banko üzeri: bölge seçildi, banko ölçüleri (240 × 60, 95 / 300)', S.vit.place === 'banko' && S.vit.width === 240 && S.vit.depth === 60 && S.vit.table === 95 && S.vit.store === 300 && !$('#vitForm .vz-banko').hidden && $('#vitForm .vz-dis').hidden);
    ok('banko: tek sıra öneri kartları', $$('#vitForm .vcard').length > 0 && $$('#vitForm .vcard').every(b => b.dataset.cols && !/×/.test(b.textContent)));
    const sb = synthBanko(); await loadPhoto(sb.src, sb.pts, null, sb); await wait(200);
    ok('banko: kuruldu (banko üstü yerden 95 cm, ETNA tavanı 300 cm)', S.cal && S.cal.banko && Math.abs(S.cal.tTop - .95) < 1e-9 && Math.abs(S.cal.H - 3) < 1e-9 && /Banko kuruldu/.test($('#calibInfo').textContent) && /Bankoyu işaretle/.test($('#step2 h2').textContent));
    ok('banko: kamera çizim kamerasıyla aynı (<1 cm)', S.cal && Math.hypot(...S.cal.cam.map((v, i) => v - sb.eye[i])) < .01);
    goStep(3); await wait(50);
    const bk = et(), BD = .6;
    ok(`banko: ${S.vit.cols} ETNA bankonun tam üstünde, mağaza tavanında, eğimsiz`, bk.length === S.vit.cols && bk.every(f => Math.abs(f.z - BD / 2) < 1e-9 && !f.tilt) && Math.abs(faceY(bk[0].p, bk[0]) - 3) < .01);
    ok(`banko: lüks banko üstünde (ort. ${Math.round(S.luxRes.avg)} lx)`, Math.abs(S.luxRes.rect.y - .95) < 1e-9 && S.luxRes.avg > 100);
    ok('banko: ölçüler (uzunluk, banko yüksekliği)', dimList().some(d => d.label === 'Uzunluk 240 cm') && dimList().some(d => d.label === 'Banko yüksekliği 95 cm'));
    ok('banko: ışık izi sadece banko üstünde', footPolys().length === bk.length && footPolys().every(f => f.pts.filter(Boolean).every(p => Math.abs(p.y - .954) < 1e-3 && p.z >= -1e-6 && p.z <= BD + 1e-6)));
    const offIn = $('.vit-top [data-v="off"]'); offIn.value = '40'; offIn.dispatchEvent(new Event('input', { bubbles: true }));
    const bk2 = et();
    ok('banko: tavanda 40 cm kaydırınca ETNA 25° eğimle bankoya döndü', bk2.length && bk2.every(f => Math.abs(f.z - (BD / 2 + .4)) < 1e-9 && f.tilt === 25) && emittersFor(bk2[0])[0].dir.z < -.3);
    ok('banko: "Banko ortasından 40 cm" ölçüsü', dimList().some(d => d.label === 'Banko ortasından 40 cm'));
    setView('model'); ok('banko: ölçülü model', R.mStatic.children.length > 4 && R.mFx.children.length === bk2.length); setView('plan'); ok('banko: plan', plan.s > 10); setView('photo');
    $('.zone[data-vplace="ic"]').click();
    ok('dış vitrine dönüş: vitrin ölçüleri geri geldi, köşeler yeniden işaretleniyor', S.vit.place === 'ic' && S.vit.table === 45 && S.step === 2 && placing());
    $('.zone[data-vplace="banko"]').click();
    ok('bankoya tekrar dönüş: banko ölçüleri saklanmış (kaydırma 40)', S.vit.width === 240 && S.vit.off === 40);
    $('.zone[data-vplace="ic"]').click();

    // ---- sitedeki proje dosyası ----
    const js = JSON.stringify({ version: 1, product: 'ETNA 26', watts: 50, settings: { width: 300, depth: 90, height: 190, table: 60, cols: 6, rows: 3, rotation: '0' } });
    const dt = new DataTransfer(); dt.items.add(new File([js], 'GMC-LED-Vitrin-Projesi.json', { type: 'application/json' }));
    const inp = $('#vitJson'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
    for (let i = 0; i < 40 && !/açıldı/.test($('#vitFileMsg').textContent); i++) await wait(50);
    ok('sitedeki proje dosyası açıldı (300 × 90, 6 × 3)', S.vit.width === 300 && S.vit.depth === 90 && S.vit.cols === 6 && S.vit.rows === 3 && /açıldı/.test($('#vitFileMsg').textContent));
    setMode('oda');
    ok('oda moduna dönüş: 6 nokta, ray blokları görünür', ORDER.length === 6 && getComputedStyle($('#systems').closest('.blk')).display !== 'none' && S.step === 1);
    setMode('vitrin');
  } catch (err) { out.push('HATA · ' + err.message + ' ' + (err.stack || '').split('\n')[1]); }
  const wide = [...document.querySelectorAll('body *')].filter(n => n.getBoundingClientRect().right > innerWidth + 1).slice(0, 6).map(n => n.tagName + '.' + n.className + ' ' + Math.round(n.getBoundingClientRect().width));
  ok(`sayfa yatay taşmıyor (${innerWidth}px) ${wide.join(' | ')}`, document.documentElement.scrollWidth <= innerWidth + 1);
  const pre = document.createElement('pre'); pre.id = 'selftest'; pre.textContent = out.join('\n'); document.body.appendChild(pre);
  document.title = 'VITRINTEST ' + out.filter(x => x.startsWith('GEÇTİ')).length + '/' + out.length;
}
// Blender test sahnesi (test_sahne/): ölçüleri ve kamerası bilinen gerçekçi fotoğraflarla doğruluk ölçümü. ?sahnetest=1
async function sahneTest() {
  const out = [], ok = (n, c) => out.push(`${c ? 'GEÇTİ' : 'KALDI'} · ${n}`), wait = ms => new Promise(r => setTimeout(r, ms));
  try {
    const dir = '../test_sahne/' + (q.get('klasor') || 'cikti') + '/', G = await (await fetch(dir + 'gercek.json', { cache: 'no-store' })).json();
    const [IW, IH] = G.cozunurluk, gurultu = [[3, -2], [-2, 3], [2, 2], [-3, -3]];          // elle işaretleme hatası (px)
    const noisy = pts => Object.fromEntries(Object.entries(pts).map(([k, [u, v]], i) => [k, [u + gurultu[i][0] / IW, v + gurultu[i][1] / IH]]));
    setMode('vitrin');
    const olc = async (ad, setup, pts, truthH, truthD) => {
      for (const [tur, P] of [['tam', pts], ['±3 px', noisy(pts)]]) {
        setup(); await loadPhoto(dir + G[ad].foto + '?v=' + Date.now(), P, null, { lensMm: 30 }); await wait(100);
        const c = S.cal; if (!c) { ok(`${ad} (${tur}): kurulamadı`, false); continue; }
        const dH = (c.camH - truthH) * 100, dL = S.lensMm - G[ad].kamera.lens_mm, pd = c.photoD ? (c.photoD * 100 - truthD) : null;
        ok(`${ad} (${tur}): kamera yüksekliği ${(c.camH * 100).toFixed(1)} cm (gerçek ${(truthH * 100).toFixed(1)}, fark ${dH.toFixed(1)} cm) · lens ${S.lensMm.toFixed(1)} mm (gerçek ${G[ad].kamera.lens_mm}) · fotoğraftan derinlik ${pd == null ? '-' : (c.photoD * 100).toFixed(1) + ' cm (gerçek ' + truthD + ')'} · uyum ±${c.err.toFixed(1)} px`,
          Math.abs(dH) < (tur === 'tam' ? 1 : 5) && Math.abs(dL) < (tur === 'tam' ? .5 : 2.5));
      }
    };
    const B = G.banko.olcu_cm, V = G.vitrin.olcu_cm;
    await olc('banko', () => { if (S.vit.place !== 'banko') $('.zone[data-vplace="banko"]').click(); Object.assign(S.vit, { width: B.uzunluk, depth: B.derinlik, table: B.yukseklik, store: B.magaza_tavani, off: 0 }); pickRecommended(); renderVit(); },
      G.banko.pts, G.banko.kamera.yerden_cm / 100, B.derinlik);
    await olc('vitrin', () => { if (S.vit.place === 'banko') $('.zone[data-vplace="ic"]').click(); S.vit.place = 'ic'; Object.assign(S.vit, { width: V.genislik, depth: V.derinlik, height: V.tavan, table: V.tabla }); pickRecommended(); renderVit(); },
      G.vitrin.pts, G.vitrin.kamera.tabladan_cm / 100, V.derinlik);
  } catch (err) { out.push('HATA · ' + err.message + ' ' + (err.stack || '').split('\n')[1]); }
  const pre = document.createElement('pre'); pre.id = 'selftest'; pre.textContent = out.join('\n'); document.body.appendChild(pre);
  document.title = 'SAHNETEST ' + out.filter(x => x.startsWith('GEÇTİ')).length + '/' + out.length;
}
window.__app = { S, addRail, addOnRail, goStep, setView, setMode, applyVitLayout };
function demoLayout() {
  const c = S.cal, w = c.width;
  const r1 = addRail('straight', [Math.round(w * .7 * 10) / 10], w / 2, .45);
  const L1 = railGeom(r1).len;
  [.15, .38, .62, .85].forEach(t => addOnRail('GMC6031', r1, L1 * t));
  const r2 = addRail('rectangle', [2.4, 1.4], w / 2, clamp(c.dist * .55, 1.4, c.depth - 1.2));
  addOnRail('GMC6226', r2, 1.2); addOnRail('GMC6226', r2, 2.4 + 1.4 + 1.2);
  addOnRail('GMC6229', r2, 2.4 + .7); addOnRail('GMC6229', r2, 2.4 * 2 + 1.4 + .7);
  S.sel = null; buildFixtures(); resetHist();
}
// Fotoğraftaki bir noktadan (0-1) yatay bir düzleme ışın: tezgah üstü gibi yerleri bulmak için
function imgToPlane(u, v, y) {
  const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(2 * u - 1, 1 - 2 * v), R.photoCam);
  const o = rc.ray.origin, d = rc.ray.direction, t = (y - o.y) / d.y;
  return t > 0 ? { x: o.x + d.x * t, z: o.z + d.z * t } : null;
}
// Kuyumcu örneği: ETNA 26'lar vitrinin önündeki tavanda 2 sıra; ışık 25° eğimle vitrine (arka duvara) döner
function demoKuyumcu() {
  const w = S.cal.width, n = Math.max(2, Math.round(w / .7));
  for (const z of [.45, .85]) for (let i = 0; i < n; i++) {
    const fx = addFree('ETNA-26', (i + .5) / n * w, z, 0);
    fx.tilt = 25; fx.yaw = 180;
  }
  S.prodGroup = 'gomme'; S.active = 'ETNA-26'; S.sel = null; renderProducts(); buildFixtures(); resetHist();
}
// Siteden gelen bağlantı: ?mod=vitrin&g=200&d=80&y=180&t=45&yon=0&urun=26&adet=4x2&montaj=ic
if (q.get('mod') === 'vitrin' || q.get('demo') === 'vitrin' || q.get('demo') === 'olcu' || q.get('vitrintest')) {
  setMode('vitrin');
  for (const [a, k] of [['g', 'width'], ['d', 'depth'], ['y', 'height'], ['t', 'table'], ['mt', 'store']]) if (q.get(a) && Number.isFinite(+q.get(a))) S.vit[k] = +q.get(a);
  if (q.get('yon')) S.vit.rot = q.get('yon') === '1' ? '1' : '0';
  if (/^(6|12|26)$/.test(q.get('urun') || '')) S.vit.sku = 'ETNA-' + q.get('urun');
  if (q.get('montaj') === 'onu') S.vit.place = 'onu';
  if (q.get('montaj') === 'banko') { Object.assign(S.vit, BANKO_DEF, { place: 'banko' }); for (const [a, k] of [['g', 'width'], ['d', 'depth'], ['t', 'table'], ['mt', 'store'], ['kay', 'off']]) if (q.get(a) && Number.isFinite(+q.get(a))) S.vit[k] = +q.get(a); }
  pickRecommended();
  const ad = /^(\d+)x(\d+)$/.exec(q.get('adet') || ''); if (ad) { S.vit.cols = +ad[1]; S.vit.rows = +ad[2]; }
  S.active = S.vit.sku; renderProducts(); renderVit();
}
if (q.get('vitrintest')) vitrinTest();
if (q.get('sahnetest')) sahneTest();
if (q.get('demo')) {
  if (q.get('demo') === 'banko') { setMode('vitrin'); Object.assign(S.vit, BANKO_DEF, { place: 'banko', off: +(q.get('kay') || 0) }); pickRecommended(); renderVit(); }
  let s = q.get('demo') === 'olcu' ? synthVitrin() : q.get('demo') === 'banko' ? synthBanko() : SAMPLES[q.get('demo')];
  if (q.get('lens')) s = { ...s, lensMm: +q.get('lens') };   // test: lensi elle ver
  if (q.get('isaret') === 'gercek' && s.ptsGercek) { s = { ...s, pts: s.ptsGercek }; setMode('vitrin'); }
  loadPhoto(s.src, s.pts, null, s).then(() => {
    if (q.get('step') === '2') { window.__ready = true; return; }
    goStep(3);
    if (q.get('fx') && S.mode === 'oda') (q.get('demo') === 'kuyumcu' ? demoKuyumcu : demoLayout)();
    if (q.get('spot') && S.mode === 'oda') {             // ekran görüntüsü için: gömme spot ızgarası (?spot=OPUS-6)
      const c = S.cal; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) addFree(q.get('spot'), c.width * (i + 1) / 4, c.depth * (j + 1) / 3);
      S.prodGroup = grpOf(bySku[q.get('spot')]); S.active = q.get('spot'); S.sel = null; renderProducts(); buildFixtures();
    }
    if (q.get('guide') === 'vitrin') {                 // ekran görüntüsü için: vitrin tavanının 4 köşesi
      const pts = [[0, .116], [.979, .040], [.899, .160], [0, .236]].map(([u, v]) => imgToPlane(u, v, S.cal.H)).filter(Boolean).map(p => [p.x, p.z]);
      if (pts.length === 4) { S.guides.push({ id: S.nextId++, pts, closed: true }); buildFixtures(); }
    }
    if (q.get('cct')) $(`#cctSeg button[data-cct="${q.get('cct')}"]`)?.click();
    if (q.get('cmp')) $('#cmpBtn').click();
    if (q.get('sys')) setSystem(q.get('sys'));
    if (q.get('day')) { S.day = +q.get('day'); $('#dayNight').value = S.day; dnLabel(); buildFixtures(); }
    if (q.get('place')) $(`.vit-top [data-vplace="${q.get('place')}"]`)?.click();   // ekran görüntüsü için: montaj değiştir
    if (q.get('lux')) $('#luxBtn').click();
    if (q.get('mv')) $(`#mviewSeg button[data-mv="${q.get('mv')}"]`)?.click();
    if (q.get('view')) setView(q.get('view'));
    if (q.get('zoom')) {                                  // ekran görüntüsü için: kamerayı hedefe doğru yaklaştır (0-1)
      if (S.view === 'free') { R.freeCam.fov = R.photoCam.fov * (1 - +q.get('zoom')); R.freeCam.updateProjectionMatrix(); render(); }
      else { const ct = R.mControls, cam = curCam(); cam.position.lerp(ct.target, +q.get('zoom')); ct.update(); render(); }
    }
    if (q.get('selftest')) selfTest();
    window.__ready = true;
  });
}

// Tarayıcı içi etkileşim testi (Aşama 2): ray ekle, ürünü raya tak, kaydır, rayı taşı/döndür, sistem değiştir, plan
function selfTest() {
  const out = [], ok = (name, cond) => out.push(`${cond ? 'GEÇTİ' : 'KALDI'} · ${name}`);
  const el = R.renderer.domElement;
  const screenOf = (x, z) => {
    const v = new THREE.Vector3(x, S.cal.H, z).project(curCam()), r = el.getBoundingClientRect();
    return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
  };
  const fireOn = (tg, type, [x, y]) => tg.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true, button: 0, isPrimary: true }));
  const fire = (t, p) => fireOn(el, t, p);
  const click = p => { fire('pointerdown', p); fire('pointerup', p); };
  const dragTo = (a, b) => { fire('pointerdown', a); fire('pointermove', [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); fire('pointermove', b); fire('pointerup', b); };
  const onRail = fx => { const ps = fxPose(fx), r = railById(fx.rail); return ps && projectOnRail(railGeom(r), ps.x, ps.z).d < 1e-6; };
  const noOverlap = () => S.rails.every(r => { const l = S.fixtures.filter(f => f.rail === r.id).sort((a, b) => a.s - b.s); return l.every((f, i) => !i || f.s - l[i - 1].s >= (fxLen(f.p) + fxLen(l[i - 1].p)) / 2 + GAP - 1e-6); });
  try {
    const c = S.cal, w = c.width;
    S.active = null;
    $$('.shape').find(b => b.dataset.shape === 'straight').click();
    const inp = $('#dims input'); inp.value = '2'; inp.dispatchEvent(new Event('input'));
    $('#addRail').click();
    const r = S.rails[S.rails.length - 1];
    ok('ray eklendi (düz, 2 m)', r && r.shape === 'straight' && Math.abs(railGeom(r).len - 2) < 1e-6);
    r.x = w / 2; r.z = 1.0; buildFixtures();
    const n0 = S.fixtures.length;
    S.active = 'GMC6226';
    click(screenOf(w / 2 + .2, 1.0));
    const fx = S.fixtures[S.fixtures.length - 1];
    ok('raya tıklayınca ürün rayın üstüne eklendi', S.fixtures.length === n0 + 1 && fx.rail === r.id && onRail(fx));
    click(screenOf(.3, 1.6));
    ok('raydan uzağa tıklayınca ürün eklenmez + uyarı', S.fixtures.length === n0 + 1 && !$('#toast').hidden);
    const s0 = fx.s;
    dragTo(screenOf(fxPose(fx).x, 1.0), screenOf(w / 2 - .5, 1.05));
    ok('ürün ray boyunca kaydı ve rayda kaldı', Math.abs(fx.s - s0) > .3 && onRail(fx));
    dragTo(screenOf(fxPose(fx).x, 1.0), screenOf(w / 2 - 2.5, 1.0));
    ok('ray ucunu geçmedi', fx.s - fxLen(fx.p) / 2 >= -1e-6 && onRail(fx));
    addOnRail('GMC6226', r, fx.s);
    ok('aynı yere ikinci ürün çakışmadan yerleşti', S.fixtures.length === n0 + 2 && noOverlap());
    S.active = null;
    const ps0 = fxPose(fx), grabX = w / 2 + .85;
    dragTo(screenOf(grabX, 1.0), screenOf(grabX, 1.4));
    const ps1 = fxPose(fx);
    ok('ray sürüklenince ürünler de taşındı', Math.abs(r.z - 1.4) < .05 && Math.abs(ps1.z - ps0.z - .4) < .05 && onRail(fx));
    S.sel = { kind: 'rail', id: r.id }; rotateSel();
    ok('ray döndü, ürünler rayla döndü', r.rot === 1 && Math.abs(Math.abs(Math.sin(fxPose(fx).rot)) - 1) < 1e-6 && onRail(fx));
    setRailDim(0, .8);
    ok('ray kısalınca sığmayan ürün kaldırıldı, kalan rayda', S.fixtures.filter(f => f.rail === r.id).length === 1 && S.fixtures.filter(f => f.rail === r.id).every(onRail));
    const L = addRail('l', [2, 1.5], w / 2, 1.2);
    const corner = 1.5;                                  // L'nin köşesi s = dikey kenar boyu
    const fl = addOnRail('GMC6226', L, corner);
    const pl = fxPose(fl), gL = railGeom(L), sg = gL.segs.find(q => fl.s >= q.s0 && fl.s <= q.s0 + q.len);
    ok('ürün köşeye binmedi (tek düz parçada)', sg && fl.s - .3025 >= sg.s0 + END - 1e-6 && fl.s + .3025 <= sg.s0 + sg.len - END + 1e-6);
    const before = S.fixtures.length;
    setSystem('slim');
    ok('slim sisteme geçince standart ürünler kaldırıldı', S.fixtures.length === 0 && before > 0);
    ok('slim seçiliyken sadece slim ürünler listede', $$('.prod').length > 0 && $$('.prod').every(b => bySku[b.dataset.sku].fam === 'slim'));
    undo();
    ok('geri al: sistem ve ürünler geri geldi', S.system === 'standard' && S.fixtures.length === before);
    setView('plan');
    ok('plan görünümü çizildi', !$('#planCanvas').hidden && plan.s > 10);
    const pr = pc.getBoundingClientRect(), tp = (x, z) => [pr.left + (plan.ox + x * plan.s) / plan.dpr, pr.top + (plan.oz + z * plan.s) / plan.dpr];
    const gpx = railGeom(L).segs[1], mx = gpx.a[0] + gpx.dir[0] * 1.5, mz = gpx.a[1] + gpx.dir[1] * 1.5;
    S.active = 'GMC6031';
    const nb = S.fixtures.length;
    fireOn(pc, 'pointerdown', tp(mx, mz)); fireOn(pc, 'pointerup', tp(mx, mz));
    ok('planda raya tıklayınca spot eklendi', S.fixtures.length === nb + 1 && S.fixtures[S.fixtures.length - 1].p.sku === 'GMC6031');
    const m = materials();
    ok('malzeme listesi: köşe ve besleme sayısı doğru', m.corners === S.rails.reduce((a, x) => a + railGeom(x).corners, 0) && m.feeds === S.rails.length);
    setView('photo');
    $('#onSeg button[data-on="0"]').click(); ok('kapalıyken ışık kaynağı yok', R.uniforms.uCount.value === 0);
    $('#onSeg button[data-on="1"]').click(); ok('açıkken ışık kaynakları var', R.uniforms.uCount.value > 0);
    S.sel = { kind: 'rail', id: L.id }; deleteSel();
    ok('ray silinince üstündeki ürünler de gitti', !S.rails.includes(L) && S.fixtures.every(f => f.rail !== L.id));
    ok('hiçbir ürün çakışmıyor', noOverlap());

    // ---- Aşama 4: gömme spot grubu (Opus, Rotun, Dark…; katalogdan) ----
    $('#groupSeg button[data-group="spot"]').click();
    ok('gömme spot grubunda 13 ürün, hepsi raysız', $$('.prod').length === 13 && $$('.prod').every(b => bySku[b.dataset.sku].type === 'downlight'));
    S.active = 'OPUS-6';
    const nd = S.fixtures.length;
    click(screenOf(w / 2 - .8, 1.6));
    const op = S.fixtures[S.fixtures.length - 1];
    ok('Opus 6 tavana tıklanan yere eklendi (raysız)', S.fixtures.length === nd + 1 && op.p.sku === 'OPUS-6' && op.rail == null && Math.abs(op.x - (w / 2 - .8)) < .05);
    const eo = emittersFor(op);
    ok('Opus 6: katalog lümeni 3220, opal = tek geniş kaynak', lumenOf(op.p) === 3220 && eo.length === 1 && eo[0].k === 1);
    const dk = addFree('DARK-5', w / 2 + .8, 1.6);
    ok('Dark 5: 5 göz ayrı koni + geniş pay', emittersFor(dk).length === 6 && dk.p.beamOpts.join() === '20,34,48');
    ok('eski kod (GMC6226) yeni koda (GMC6026) yönlenir', bySku.GMC6226 === bySku.GMC6026 && bySku.GMC6026.lm === 1440);
    const ms = materials();
    ok('gömme spotlar trafo hesabına girmedi', ms.gomW >= 28 && ms.driver === recommendedDriver(ms.magW));
    S.fixtures = S.fixtures.filter(f => f !== op && f !== dk); S.sel = null; buildFixtures();

    // ---- Aşama 3 ----
    $('#groupSeg button[data-group="gomme"]').click();
    ok('kuyumcu grubunda 23 ürün (3 ETNA + Blade, Case Light, Flora…)', $$('.prod').length === 23 && $$('.prod').every(b => bySku[b.dataset.sku].fam === 'gomme') && ['ETNA-26', 'BLADE-24', 'CASE-LIGHT-12'].every(k => $$('.prod').some(b => b.dataset.sku === k)));
    const bh = addFree('BLADE-12-H', w / 2, 1.2);
    ok('Blade 12 H sarkıt: ışık yüzü tavandan 60 cm aşağıda, 8 kaynak halkada', Math.abs(faceY(bh.p, bh) - (S.cal.H - .602)) < 1e-6 && emittersFor(bh).length === 9 && Math.abs(lumenOf(bh.p) - 3717) < 1e-9);
    S.fixtures = S.fixtures.filter(f => f !== bh); S.sel = null; buildFixtures();
    S.active = 'ETNA-26';
    const ne = S.fixtures.length;
    click(screenOf(w / 2 + .3, 2.2));
    const et = S.fixtures[S.fixtures.length - 1];
    ok('ETNA tavana tıklanan yere eklendi (raysız)', S.fixtures.length === ne + 1 && et.p.sku === 'ETNA-26' && et.rail == null && Math.abs(et.x - (w / 2 + .3)) < .05 && Math.abs(et.z - 2.2) < .05);
    ok('ETNA lümeni katalogdan (7788 lm)', lumenOf(et.p) === 7788 && emittersFor(et).length === 10);
    S.active = null;
    dragTo(screenOf(et.x, et.z), screenOf(et.x - .6, et.z + .5));
    ok('ETNA serbestçe sürüklendi', Math.abs(et.x - (w / 2 - .3)) < .08 && Math.abs(et.z - 2.7) < .08);
    S.sel = { kind: 'fx', id: et.id }; rotateSel();
    ok('ETNA 90° döndü', Math.abs(et.rot - Math.PI / 2) < 1e-6);
    renderSelTools();
    const bsel = $('#selTools select[data-fx="beam"]'), tsel = $('#selTools select[data-fx="tilt"]');
    ok('ETNA açı seçenekleri 24/34/48 ve eğim 0/25/38', bsel && [...bsel.options].map(o => +o.value).join() === '24,34,48' && tsel && [...tsel.options].map(o => +o.value).join() === '0,25,38');
    const c34 = emittersFor(et)[0].cone[1];
    bsel.value = '24'; bsel.dispatchEvent(new Event('input', { bubbles: true }));
    ok('ışık açısı 24° seçilince koni daraldı', et.beam === 24 && emittersFor(et)[0].cone[1] > c34);
    tsel.value = '38'; tsel.dispatchEvent(new Event('input', { bubbles: true }));
    const dE = emittersFor(et)[0].dir;
    ok('eğim 38° ışığı yana çevirdi', Math.abs(Math.acos(-dE.y) * 180 / Math.PI - 38) < .5);
    const sp = S.fixtures.find(f => f.p.type === 'spot');
    if (sp) { sp.tilt = 30; sp.yaw = 90; ok('ray spotu eğilip yönlendirildi', Math.abs(Math.acos(-emittersFor(sp)[0].dir.y) * 180 / Math.PI - 30) < .5); sp.tilt = 0; sp.yaw = 0; }
    const m3 = materials();
    ok('ETNA trafo hesabına girmedi (kendi sürücüsü)', m3.gomW === S.fixtures.filter(f => f.p.fam === 'gomme').reduce((a, f) => a + f.p.watts, 0) && m3.driver === recommendedDriver(m3.magW));
    for (let i = 0; i < 24; i++) addFree('ETNA-26', .3 + (i % 6) * .7, 1 + Math.floor(i / 6) * .6);
    buildFixtures();
    const gl = R.renderer.getContext();
    ok(`çok ürün: ${R.uniforms.uCount.value} ışık kaynağı hatasız çizildi`, R.uniforms.uCount.value > 96 && gl.getError() === gl.NO_ERROR);
    undo(); undo();
    S.sel = { kind: 'fx', id: et.id }; renderSelTools();
    const a0 = selAngle(); $('#selTools [data-rot="1"]').click(); $('#selTools [data-rot="1"]').click(); $('#selTools [data-rot="-5"]').click();
    ok('ETNA ince döndürme (+1 +1 −5 = −3°)', Math.abs(selAngle() - norm180(a0 - 3)) < .01);
    const rr = S.rails.find(x => S.fixtures.some(f => f.rail === x.id));
    if (rr) {
      const f1 = S.fixtures.find(f => f.rail === rr.id); S.sel = { kind: 'rail', id: rr.id }; renderSelTools();
      $('#selTools [data-rot="5"]').click();
      const g1 = railGeom(rr), on1 = projectOnRail(g1, fxPose(f1).x, fxPose(f1).z).d < 1e-6;
      ok('ray 5° döndü, ürünler rayda kaldı', Math.abs(Math.atan2(g1.segs[0].dir[1], g1.segs[0].dir[0]) * 180 / Math.PI - selAngle()) < .6 && on1);
    }
    // kılavuz çizgi: 4 köşe + ilk noktaya tıkla = kapalı dikdörtgen
    const gx = [.6, 2.6], gz = [.4, 1.4];
    setTool('guide');
    for (const [x, z] of [[gx[0], gz[0]], [gx[1], gz[0]], [gx[1], gz[1]], [gx[0], gz[1]], [gx[0], gz[0]]]) click(screenOf(x, z));
    const gd = S.guides[S.guides.length - 1];
    ok('kılavuz: 4 tıklama + ilk nokta = kapalı 4 çizgi', gd && gd.closed && gd.pts.length === 4 && S.tool === 'guide');
    const lens4 = guideSegs(gd).map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
    ok('kılavuz kenar ölçüleri doğru (2,00 / 1,00 m)', Math.abs(lens4[0] - 2) < .03 && Math.abs(lens4[1] - 1) < .03);
    setTool(null); setView('plan');
    ok('kılavuz planda çiziliyor', !$('#planCanvas').hidden);
    const pr2 = pc.getBoundingClientRect(), tp2 = (x, z) => [pr2.left + (plan.ox + x * plan.s) / plan.dpr, pr2.top + (plan.oz + z * plan.s) / plan.dpr];
    const v0 = [...gd.pts[2]];
    fireOn(pc, 'pointerdown', tp2(...v0)); fireOn(pc, 'pointermove', tp2(v0[0] + .1, v0[1] + .05)); fireOn(pc, 'pointermove', tp2(v0[0] + .2, v0[1] + .1)); fireOn(pc, 'pointerup', tp2(v0[0] + .2, v0[1] + .1));
    ok('planda kılavuz köşesi sürüklenince taşındı', Math.abs(gd.pts[2][0] - v0[0] - .2) < .03 && Math.abs(gd.pts[2][1] - v0[1] - .1) < .03);
    undo(); ok('geri al: köşe eski yerine döndü', Math.abs(S.guides.find(x => x.id === gd.id).pts[2][0] - v0[0]) < .01);
    setView('photo');
    const g2 = S.guides.find(x => x.id === gd.id); g2.pts = g2.pts.map(([x, z]) => { const c10 = Math.cos(.1745), s10 = Math.sin(.1745), cx0 = 1.6, cz0 = .9; return [cx0 + (x - cx0) * c10 - (z - cz0) * s10, cz0 + (x - cx0) * s10 + (z - cz0) * c10]; });
    const et2 = addFree('ETNA-26', 1.6, .9, 0); alignToGuide();
    ok('ETNA kılavuza paralel hizalandı (10°)', Math.abs(Math.abs(norm180(selAngle() - 10)) % 90) < .2 || Math.abs(Math.abs(norm180(selAngle() - 10)) - 90) < .2 || Math.abs(Math.abs(norm180(selAngle() - 10)) - 180) < .2);
    S.sel = { kind: 'guide', id: gd.id }; deleteSel();
    ok('kılavuz silindi', !S.guides.some(x => x.id === gd.id));
    $('#cmpBtn').click();
    ok('önce/sonra açıldı, ayırıcı görünüyor', S.compare && !$('#split').hidden);
    const cr = el.getBoundingClientRect(), sh = $('#split');
    fireOn(sh, 'pointerdown', [cr.left + cr.width / 2, cr.top + 50]); fireOn(sh, 'pointermove', [cr.left + cr.width * .25, cr.top + 50]); fireOn(sh, 'pointerup', [cr.left + cr.width * .25, cr.top + 50]);
    ok('ayırıcı sürüklenince yeri değişti', Math.abs(S.split - .25) < .02);
    $('#cmpBtn').click();
    ok('önce/sonra kapandı', !S.compare && $('#split').hidden);
    $('#groupSeg button[data-group="ray"]').click();
  } catch (err) { out.push('HATA · ' + err.message + ' ' + (err.stack || '').split('\n')[1]); }
  const wide = [...document.querySelectorAll('body *')].filter(n => n.getBoundingClientRect().right > innerWidth + 1).slice(0, 6).map(n => n.tagName + '.' + n.className + '#' + n.id + ' ' + Math.round(n.getBoundingClientRect().width));
  ok(`sayfa yatay taşmıyor (${innerWidth}px) ${wide.join(' | ')}`, document.documentElement.scrollWidth <= innerWidth + 1);
  const pre = document.createElement('pre'); pre.id = 'selftest'; pre.textContent = out.join('\n'); document.body.appendChild(pre);
  document.title = 'SELFTEST ' + out.filter(s => s.startsWith('GEÇTİ')).length + '/' + out.length;
}
