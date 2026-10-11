// GMC Tavan Stüdyo · ürün listesi (saf veri, DOM yok)
// Ürün adları, kodları ve görseller: gmcled.com (2026-10-11). Teknik değerler: GMCLED_KATALOG.pdf.
// Sitede lümen ve ışık açısı yazmıyor. Magnet ürünler için katalogdaki aynı güç ve gövdeli eşdeğer serinin değeri alındı:
//   mercek lensli lineer = Reflect, opal lineer = Diffucer, hareketli mercekli = Moving Reflect, hareketli opal = Moving Diffucer,
//   ray spot = Rotary, sarkıt = Pendant. Bu eşleştirme [Tahmin]; katalogdaki değer [Kesin]. esd alanı eşdeğeri ve sayfayı yazar.
// Gömme spotlar (Opus, Rotun, Dark, Midy, Tiny, Daisy) katalogda doğrudan var: real = true.
// Katalogda aralık verilmişse (ör. 832–887 lm) ortası alındı.

const A = 'assets/urun/';
const L = (o) => ({ ...o, src: A + o.sku.toLowerCase() + '.jpg' });
const REFLECT = [15, 24, 40], ROTARY = [15, 24, 34, 48, 60], PENDANT = [24, 34, 48];

// fam: hangi raya takılır (standard / slim). type: uygulamadaki ışık ve gövde modeli.
export const MAGNET = [
  // ---- standart magnet (sıva üstü, sıva altı yaylı, trimless raylara) ----
  L({ sku: 'GMC6025', old: 'GMC6225', name: '30 CM Lineer Magnet', fam: 'standard', type: 'lineer', watts: 10, lengthCm: 30.5, lenses: 0, lm: 720, beam: 120, esd: 'Diffucer · 72 lm/W (s.23–24)' }),
  L({ sku: 'GMC6026', old: 'GMC6226', name: '60 CM Lineer Magnet', fam: 'standard', type: 'lineer', watts: 20, lengthCm: 60.5, lenses: 0, lm: 1440, beam: 120, esd: 'Diffucer · 72 lm/W (s.23–24)' }),
  L({ sku: 'GMC6027', name: '90 CM Lineer Magnet', fam: 'standard', type: 'lineer', watts: 30, lengthCm: 90.5, lenses: 0, lm: 2160, beam: 120, esd: 'Diffucer · 72 lm/W; güç sitede yok [Tahmin]' }),
  L({ sku: 'GMC6028', old: 'GMC6228', name: '6W Mercek Lensli Magnet', fam: 'standard', type: 'mercek', watts: 6, lengthCm: 13.4, lenses: 6, lm: 430, beam: 24, beamOpts: REFLECT, esd: 'Reflect 6 (s.19)' }),
  L({ sku: 'GMC6029', old: 'GMC6229', name: '12W Mercek Lensli Magnet', fam: 'standard', type: 'mercek', watts: 12, lengthCm: 22, lenses: 12, lm: 860, beam: 24, beamOpts: REFLECT, esd: 'Reflect 12 (s.20)' }),
  L({ sku: 'GMC6030', old: 'GMC6230', name: '18W Mercek Lensli Magnet', fam: 'standard', type: 'mercek', watts: 18, lengthCm: 32.8, lenses: 16, lm: 1295, beam: 24, beamOpts: REFLECT, esd: 'Reflect 18 (s.20)' }),
  L({ sku: 'GMC6031', name: '10W Ray Spot Magnet', fam: 'standard', type: 'spot', watts: 10, lengthCm: 10, lenses: 0, lm: 1020, beam: 24, beamOpts: ROTARY, esd: 'Rotary 60 · 8,9 W (s.8)' }),
  L({ sku: 'GMC6036', name: '20W Ray Spot Magnet', fam: 'standard', type: 'spot', watts: 20, lengthCm: 12, lenses: 0, lm: 1705, beam: 24, beamOpts: ROTARY, esd: 'Rotary 70 · 20 W (s.8)' }),
  L({ sku: 'GMC6032', old: 'GMC6232', name: '6W Hareketli Mercekli', fam: 'standard', type: 'hareketli', watts: 6, lengthCm: 13.4, lenses: 6, lm: 430, beam: 24, beamOpts: REFLECT, esd: 'Moving Reflect 6 (s.16)' }),
  L({ sku: 'GMC6033', old: 'GMC6233', name: '12W Hareketli Mercekli', fam: 'standard', type: 'hareketli', watts: 12, lengthCm: 22, lenses: 12, lm: 860, beam: 24, beamOpts: REFLECT, esd: 'Moving Reflect 12 (s.16)' }),
  // ---- slim magnet ----
  L({ sku: 'GMC6051', name: '30 CM Slim Lineer (opal)', fam: 'slim', type: 'lineer', watts: 18, lengthCm: 30, lenses: 0, lm: 1295, beam: 120, esd: 'Diffucer 18 (s.24)' }),
  L({ sku: 'GMC6052', name: '60 CM Slim Lineer (opal)', fam: 'slim', type: 'lineer', watts: 24, lengthCm: 60, lenses: 0, lm: 1585, beam: 120, esd: 'Diffucer 24 (s.24)' }),
  L({ sku: 'GMC6053', name: '90 CM Slim Lineer (opal)', fam: 'slim', type: 'lineer', watts: 30, lengthCm: 90, lenses: 0, lm: 1980, beam: 120, esd: 'Diffucer · 66 lm/W [Tahmin]' }),
  L({ sku: 'GMC6054', name: '6W Slim Mercek Lensli', fam: 'slim', type: 'mercek', watts: 6, lengthCm: 12.2, lenses: 6, lm: 430, beam: 24, beamOpts: REFLECT, esd: 'Reflect 6 · 120 mm (s.19)' }),
  L({ sku: 'GMC6055', name: '12W Slim Mercek Lensli', fam: 'slim', type: 'mercek', watts: 12, lengthCm: 23, lenses: 12, lm: 860, beam: 24, beamOpts: REFLECT, esd: 'Reflect 12 · 234 mm (s.20)' }),
  L({ sku: 'GMC6056', name: '18W Slim Mercek Lensli', fam: 'slim', type: 'mercek', watts: 18, lengthCm: 33, lenses: 18, lm: 1295, beam: 24, beamOpts: REFLECT, esd: 'Reflect 18 · 348 mm (s.20)' }),
  L({ sku: 'GMC6057', name: '24W Slim Mercek Lensli', fam: 'slim', type: 'mercek', watts: 24, lengthCm: 44, lenses: 24, lm: 1585, beam: 24, beamOpts: REFLECT, esd: 'Reflect 24 · 462 mm (s.20)' }),
  L({ sku: 'GMC6058', name: '30W Slim Mercek Lensli', fam: 'slim', type: 'mercek', watts: 30, lengthCm: 55, lenses: 30, lm: 1980, beam: 24, beamOpts: REFLECT, esd: 'Reflect · 66 lm/W [Tahmin]' }),
  L({ sku: 'GMC6059', name: '6W Slim Hareketli Opal', fam: 'slim', type: 'hareketli', opal: true, watts: 6, lengthCm: 12, lenses: 0, lm: 430, beam: 120, esd: 'Moving Diffucer 6 (s.18)' }),
  L({ sku: 'GMC6060', name: '12W Slim Hareketli Opal', fam: 'slim', type: 'hareketli', opal: true, watts: 12, lengthCm: 23, lenses: 0, lm: 860, beam: 120, esd: 'Moving Diffucer 12 (s.18)' }),
  L({ sku: 'GMC6061', name: '6W Slim Hareketli Mercekli', fam: 'slim', type: 'hareketli', watts: 6, lengthCm: 12, lenses: 6, lm: 430, beam: 24, beamOpts: REFLECT, esd: 'Moving Reflect 6 (s.16)' }),
  L({ sku: 'GMC6062', name: '12W Slim Hareketli Mercekli', fam: 'slim', type: 'hareketli', watts: 12, lengthCm: 23, lenses: 12, lm: 860, beam: 24, beamOpts: REFLECT, esd: 'Moving Reflect 12 (s.16)' }),
  L({ sku: 'GMC6083', name: '6W Slim Ray Spot', fam: 'slim', type: 'spot', watts: 6, lengthCm: 9, lenses: 0, lm: 750, beam: 24, beamOpts: ROTARY, esd: 'Rotary 40 · 6,1 W (s.7)' }),
  L({ sku: 'GMC6064', name: '10W Slim Ray Spot', fam: 'slim', type: 'spot', watts: 10, lengthCm: 11, lenses: 0, lm: 1020, beam: 24, beamOpts: ROTARY, esd: 'Rotary 60 · 8,9 W (s.8)' }),
  L({ sku: 'GMC6065', name: '20W Slim Ray Spot', fam: 'slim', type: 'spot', watts: 20, lengthCm: 12, lenses: 0, lm: 1705, beam: 24, beamOpts: ROTARY, esd: 'Rotary 70 · 20 W (s.8)' }),
  L({ sku: 'GMC6066', name: '30W Slim Ray Spot', fam: 'slim', type: 'spot', watts: 30, lengthCm: 13, lenses: 0, lm: 2550, beam: 24, beamOpts: ROTARY, esd: 'Rotary · 85 lm/W [Tahmin]' }),
  L({ sku: 'GMC6063', name: '2×10W İkili Ray Spot', fam: 'slim', type: 'spot', heads: 2, watts: 20, lengthCm: 18, lenses: 0, lm: 2040, beam: 24, beamOpts: ROTARY, esd: '2 × Rotary 60 (s.8)' }),
  L({ sku: 'GMC6071', name: '6W Slim Sarkıt', fam: 'slim', type: 'sarkit', watts: 6, lengthCm: 4, lenses: 0, lm: 750, beam: 34, beamOpts: PENDANT, esd: 'Pendant 41 · 6,1 W (s.30)' }),
  L({ sku: 'GMC6072', name: '6W Ay Sarkıt', fam: 'slim', type: 'sarkit', opal: true, watts: 6, lengthCm: 12, lenses: 0, lm: 430, beam: 120, esd: 'opal · Diffucer 6 değeri [Tahmin]' }),
  L({ sku: 'GMC6073', name: '12W Slim Sarkıt', fam: 'slim', type: 'sarkit', watts: 12, lengthCm: 6, lenses: 0, lm: 1300, beam: 34, beamOpts: PENDANT, esd: 'Pendant 60 oranı · 110 lm/W [Tahmin]' }),
];

// Gömme spotlar: tavana gömülür, raysız, kendi 220V sürücüsü. Ölçüler cm. shape: round (çap = lengthCm) / rect.
// heads: ışık veren göz sayısı (Dark, Daisy çok gözlü). opal: geniş, yumuşak ışık (Opus).
const S = (o) => L({ fam: 'gomme', grp: 'spot', type: 'downlight', real: true, ...o });
export const SPOTS = [
  S({ sku: 'OPUS-5', name: 'Opus 5', watts: 14, lm: 2170, shape: 'round', lengthCm: 14.2, widthCm: 14.2, cut: 'Ø12 cm', opal: true, beam: 110, kat: 's.72' }),
  S({ sku: 'OPUS-6', name: 'Opus 6', watts: 20, lm: 3220, shape: 'round', lengthCm: 17.7, widthCm: 17.7, cut: 'Ø16 cm', opal: true, beam: 110, kat: 's.72' }),
  S({ sku: 'OPUS-8', name: 'Opus 8', watts: 40, lm: 6440, shape: 'round', lengthCm: 23, widthCm: 23, cut: 'Ø21 cm', opal: true, beam: 110, kat: 's.72' }),
  S({ sku: 'ROTUN-6', name: 'Rotun 6', watts: 10, lm: 1770, shape: 'round', lengthCm: 12, widthCm: 12, cut: 'Ø10 cm', beam: 45, beamOpts: [45, 60], kat: 's.63' }),
  S({ sku: 'ROTUN-12', name: 'Rotun 12', watts: 21, lm: 2124, shape: 'round', lengthCm: 17.7, widthCm: 17.7, cut: 'Ø16 cm', beam: 45, beamOpts: [45, 60], kat: 's.64' }),
  S({ sku: 'ROTUN-18', name: 'Rotun 18', watts: 30, lm: 5310, shape: 'round', lengthCm: 17.7, widthCm: 17.7, cut: 'Ø16 cm', beam: 45, beamOpts: [45, 60], kat: 's.64' }),
  S({ sku: 'MIDY', name: 'Midy', watts: 10, lm: 1600, shape: 'round', lengthCm: 5.9, widthCm: 5.9, cut: 'Ø5,5 cm', beam: 40, kat: 's.68' }),
  S({ sku: 'TINY', name: 'Tiny', watts: 2.2, lm: 390, shape: 'round', lengthCm: 4.7, widthCm: 4.7, cut: 'Ø4 cm', beam: 25, beamOpts: [25, 38], kat: 's.68' }),
  S({ sku: 'DARK-1', name: 'Dark 1', watts: 2.2, lm: 390, shape: 'rect', lengthCm: 5.7, widthCm: 5.7, cut: '5 × 5 cm', heads: 1, beam: 34, beamOpts: [20, 34, 48], kat: 's.65' }),
  S({ sku: 'DARK-3', name: 'Dark 3', watts: 3, lm: 530, shape: 'rect', lengthCm: 10.7, widthCm: 5.5, cut: '10 × 4 cm', heads: 3, beam: 34, beamOpts: [20, 34, 48], kat: 's.65' }),
  S({ sku: 'DARK-5', name: 'Dark 5', watts: 8, lm: 1280, shape: 'rect', lengthCm: 16, widthCm: 5.5, cut: '15 × 4 cm', heads: 5, beam: 34, beamOpts: [20, 34, 48], kat: 's.65' }),
  S({ sku: 'DAISY-4L', name: 'Daisy 4 L', watts: 14, lm: 2240, shape: 'rect', lengthCm: 19.6, widthCm: 6.6, cut: '17,5 × 4,5 cm', heads: 4, beam: 50, beamOpts: [50, 90], kat: 's.66' }),
  S({ sku: 'DAISY-7L', name: 'Daisy 7 L', watts: 20, lm: 3200, shape: 'rect', lengthCm: 30.5, widthCm: 6.6, cut: '29,5 × 4,5 cm', heads: 7, beam: 50, beamOpts: [50, 90], kat: 's.66' }),
];

// Kuyumcu aydınlatma (gmcled.com/kuyumcu-vitrin-aydinlatma-urunleri; değerler GMCLED_KATALOG.pdf s.43–57) — ETNA ile aynı grupta.
// look: blade = siyah LED halkası + beyaz orta; line = uzun gövde. mount: gomme (tavana gömülü), sivaustu (silindir), sarkit (askılı).
// Uzunluğu "free" (siparişe göre) yazanlara varsayılan uzunluk verildi [Tahmin].
const K = (o) => L({ fam: 'gomme', grp: 'gomme', type: 'downlight', real: true, beam: 34, beamOpts: [20, 34, 48], ...o });
export const KUYUMCU = [
  K({ sku: 'BLADE-6', name: 'Blade 6', watts: 10, lm: 1770, shape: 'round', look: 'blade', lengthCm: 9.5, widthCm: 9.5, heads: 6, cut: 'Ø8 cm', kat: 's.43' }),
  K({ sku: 'BLADE-12', name: 'Blade 12', watts: 21, lm: 3717, shape: 'round', look: 'blade', lengthCm: 14, widthCm: 14, heads: 12, cut: 'Ø13 cm', kat: 's.43' }),
  K({ sku: 'BLADE-24', name: 'Blade 24', watts: 42, lm: 7434, shape: 'round', look: 'blade', lengthCm: 24, widthCm: 24, heads: 24, cut: 'Ø22,5 cm', kat: 's.43' }),
  K({ sku: 'BLADE-2406', name: 'Blade 2406', watts: 53, lm: 9381, shape: 'round', look: 'blade', lengthCm: 24, widthCm: 24, heads: 30, cut: 'Ø22,5 cm', kat: 's.44' }),
  K({ sku: 'BLADE-2412', name: 'Blade 2412', watts: 63, lm: 11150, shape: 'round', look: 'blade', lengthCm: 24, widthCm: 24, heads: 36, cut: 'Ø22,5 cm', kat: 's.44' }),
  K({ sku: 'BLADE-24-L', name: 'Blade 24 L', watts: 56, lm: 9500, shape: 'round', look: 'blade', lengthCm: 24, widthCm: 24, heads: 25, cut: 'Ø22,5 cm', kat: 's.47' }),
  K({ sku: 'BLADE-2415D', name: 'Blade 2415D', watts: 57, lm: 9600, shape: 'round', look: 'blade', lengthCm: 24, widthCm: 24, heads: 24, cut: 'Ø22,5 cm', beamOpts: [20, 34, 48, 120], kat: 's.47 · optik + difüzör' }),
  K({ sku: 'BLADE-24SZ35', name: 'Blade 24SZ35', watts: 47, lm: 8300, shape: 'round', look: 'blade', lengthCm: 24, widthCm: 24, heads: 24, cut: 'Ø22,5 cm', kat: 's.47 · ortası zoom ray spot' }),
  K({ sku: 'BLADE-6-S', name: 'Blade 6 S (sıva üstü)', watts: 10, lm: 1770, shape: 'round', look: 'blade', mount: 'sivaustu', drop: .11, lengthCm: 8.6, widthCm: 8.6, heads: 6, cut: 'kesim yok', kat: 's.46' }),
  K({ sku: 'BLADE-12-S', name: 'Blade 12 S (sıva üstü)', watts: 21, lm: 3717, shape: 'round', look: 'blade', mount: 'sivaustu', drop: .11, lengthCm: 13, widthCm: 13, heads: 12, cut: 'kesim yok', kat: 's.46' }),
  K({ sku: 'BLADE-24-S', name: 'Blade 24 S (sıva üstü)', watts: 42, lm: 7434, shape: 'round', look: 'blade', mount: 'sivaustu', drop: .048, lengthCm: 21.2, widthCm: 21.2, heads: 24, cut: 'kesim yok', kat: 's.46' }),
  K({ sku: 'BLADE-6-H', name: 'Blade 6 H (sarkıt)', watts: 10, lm: 1770, shape: 'round', look: 'blade', mount: 'sarkit', drop: .6, lengthCm: 8.6, widthCm: 8.6, heads: 6, cut: 'askı · boy ayarlı', kat: 's.48' }),
  K({ sku: 'BLADE-12-H', name: 'Blade 12 H (sarkıt)', watts: 21, lm: 3717, shape: 'round', look: 'blade', mount: 'sarkit', drop: .6, lengthCm: 13, widthCm: 13, heads: 12, cut: 'askı · boy ayarlı', kat: 's.48' }),
  K({ sku: 'BLADE-24-H', name: 'Blade 24 H (sarkıt)', watts: 42, lm: 7434, shape: 'round', look: 'blade', mount: 'sarkit', drop: .6, lengthCm: 21.2, widthCm: 21.2, heads: 24, cut: 'askı · boy ayarlı', kat: 's.48' }),
  K({ sku: 'FLORA', name: 'Flora', watts: 40, lm: 7080, shape: 'round', lengthCm: 17.7, widthCm: 17.7, heads: 18, cut: 'Ø16 cm', beam: 25, beamOpts: [25, 38], kat: 's.56 · RGBA' }),
  K({ sku: 'CASE-LIGHT-6', name: 'Case Light 6', watts: 10, lm: 1770, shape: 'rect', look: 'line', lengthCm: 60, widthCm: 11, heads: 12, cut: 'yüzey · boy siparişe göre', beam: 25, beamOpts: [25, 38], kat: 's.54 · boy [Tahmin] 60 cm' }),
  K({ sku: 'CASE-LIGHT-12', name: 'Case Light 12', watts: 21, lm: 3717, shape: 'rect', look: 'line', lengthCm: 60, widthCm: 16, heads: 24, cut: 'yüzey · boy siparişe göre', beam: 25, beamOpts: [25, 38], kat: 's.54 · boy [Tahmin] 60 cm' }),
  K({ sku: 'CASE-LIGHT-26', name: 'Case Light 26', watts: 44, lm: 3717, shape: 'rect', look: 'line', lengthCm: 60, widthCm: 22.5, heads: 52, cut: 'yüzey · boy siparişe göre', beam: 25, beamOpts: [25, 38], kat: 's.54 · lümen katalogda 3717 yazıyor (44 W için düşük, katalog hatası olabilir)' }),
  K({ sku: 'FLAT-LINE', name: 'Flat Line', watts: 32, lm: 5300, shape: 'rect', look: 'line', lengthCm: 100, widthCm: 4.2, heads: 20, cut: 'yüzey · boy siparişe göre', beam: 25, beamOpts: [25, 38], kat: 's.57 · boy [Tahmin] 100 cm' }),
  K({ sku: 'MOVING-LINE', name: 'Moving Line', watts: 42, lm: 6500, shape: 'rect', look: 'line', lengthCm: 100, widthCm: 2.5, heads: 24, cut: 'yüzey · boy siparişe göre', beam: 25, beamOpts: [25, 38], kat: 's.57 · boy [Tahmin] 100 cm' }),
];

// Eski kodlarla kaydedilmiş projeler açılsın (dist/catalog.json'daki GMC62xx kodları sitede GMC60xx)
export const ALIAS = Object.fromEntries(MAGNET.filter(p => p.old).map(p => [p.old, p.sku]));
