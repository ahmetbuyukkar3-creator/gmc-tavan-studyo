// node isik.test.mjs — ışık hesabının fizik kontrolü
import { beamCone, candela, illuminance, luxGrid, solidAngle } from './isik.js';
const out = [], ok = (n, c) => out.push(`${c ? 'GEÇTİ' : 'KALDI'} · ${n}`);
const cone = beamCone;
// 1) Akı korunumu: 1,5 m yükseklikte aşağı bakan 34° kaynak, 1000 lm. Zemine düşen toplam akı = 1000 lm olmalı.
const [c0, c1] = cone(34), em = { p: [0, 1.5, 0], d: [0, -1, 0], cd: candela(1000, c0, c1, 0), c0, c1, k: 0 };
const g = luxGrid([em], { x0: -2, x1: 2, z0: -2, z1: 2, y: 0 }, .01);
const flux = g.avg * 16;
ok(`34° koni akısı ${flux.toFixed(1)} lm ≈ 1000 lm`, Math.abs(flux - 1000) < 10);
// 2) Ters kare: tam altında E = cd / h²
const E = illuminance([em], [0, 0, 0]);
ok(`merkez ${E.toFixed(0)} lx = cd/h² ${(em.cd / 2.25).toFixed(0)}`, Math.abs(E - em.cd / 2.25) < 1e-6 * E);
// 3) Yarım açı ≈ ışın açısı: 17°'de şiddet merkezin yaklaşık yarısı (yumuşak kenar ortası)
const half = Math.cos(17 * Math.PI / 180), pr = (() => { const t = Math.min(1, Math.max(0, (half - c0) / (c1 - c0))); return t * t * (3 - 2 * t); })();
ok(`ışın açısı kenarında şiddet %${(pr * 100).toFixed(0)} (≈%50)`, Math.abs(pr - .5) < .005);
for (const b of [24, 34, 48]) { const [a0, a1] = beamCone(b), x = Math.cos(b / 2 * Math.PI / 180), t = (x - a0) / (a1 - a0); ok(`${b}° kenarda %50`, Math.abs(t * t * (3 - 2 * t) - .5) < 1e-9); }
// 4) Düz yüzey ışığı (Lambert, k=1): cd = lm/π
ok('Lambert kaynak: cd = lm/π', Math.abs(candela(1000, 0, .02, 1) - 1000 / Math.PI) / (1000 / Math.PI) < .01);
const lam = { p: [0, 1, 0], d: [0, -1, 0], cd: candela(1000, 0, .02, 1), c0: 0, c1: .02, k: 1 };
const gl = luxGrid([lam], { x0: -40, x1: 40, z0: -40, z1: 40, y: 0 }, .05);
ok(`Lambert akısı geniş zeminde ${(gl.avg * 6400).toFixed(0)} lm (>%97)`, gl.avg * 6400 > 970 && gl.avg * 6400 <= 1001);
// 5) ETNA 26 örneği: 7788 lm, 34°, 1,35 m (vitrin tavanı 180, tabla 45) merkez aydınlık
const e26 = { ...em, p: [0, 1.35, 0], cd: candela(7788 * .9, c0, c1, 0) };
ok(`ETNA 26 tek başına 1,35 m altında ~${Math.round(illuminance([e26], [0, 0, 0]) / 100) * 100} lx`, illuminance([e26], [0, 0, 0]) > 5000);
// 6) Engel: geçiş oranı 0 ise ışık yok
ok('engel ışığı keser', illuminance([em], [0, 0, 0], [0, 1, 0], () => 0) === 0);
ok('solidAngle önbellekli ve pozitif', solidAngle(c0, c1, 0) > 0 && solidAngle(c0, c1, 0) === solidAngle(c0, c1, 0));
console.log(out.join('\n')); console.log(`ISIK ${out.filter(s => s.startsWith('GEÇTİ')).length}/${out.length}`);
