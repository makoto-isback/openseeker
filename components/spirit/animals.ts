import { BrailleCanvas } from './BrailleCanvas';

export type AnimalType = 'dragon' | 'wolf' | 'phoenix' | 'jellyfish' | 'serpent' | 'butterfly' | 'owl' | 'koi';

export const ANIMAL_LIST: AnimalType[] = ['dragon', 'wolf', 'phoenix', 'jellyfish', 'serpent', 'butterfly', 'owl', 'koi'];

export const ANIMAL_COLORS: Record<AnimalType, string> = {
  dragon: '#b388ff',
  wolf: '#80cbc4',
  phoenix: '#ffab91',
  jellyfish: '#81d4fa',
  serpent: '#c5e1a5',
  butterfly: '#f48fb1',
  owl: '#ffe082',
  koi: '#ef9a9a',
};

export const ANIMAL_LABELS: Record<AnimalType, string> = {
  dragon: '\u9F8D Dragon',
  wolf: '\u72FC Wolf',
  phoenix: '\u9CF3 Phoenix',
  jellyfish: '\u6D77\u6708 Jellyfish',
  serpent: '\u86C7 Serpent',
  butterfly: '\u8776 Butterfly',
  owl: '\u68DF Owl',
  koi: '\u9BC9 Koi',
};

export type AnimalRenderer = (canvas: BrailleCanvas, t: number) => void;

// --- DRAGON ---
function renderDragon(c: BrailleCanvas, t: number): void {
  const pw = c.pixelWidth;
  const ph = c.pixelHeight;
  const cx = pw * 0.45;
  const cy = ph * 0.5;
  const wingFlap = Math.sin(t * 2.5) * 0.3;
  const breathe = Math.sin(t * 1.5) * 1.5;
  const tailWave = Math.sin(t * 1.8);

  // Body (torso)
  c.fillEllipse(cx, cy + breathe * 0.5, pw * 0.18, ph * 0.14);
  // Chest
  c.fillEllipse(cx - pw * 0.06, cy - ph * 0.04 + breathe * 0.3, pw * 0.12, ph * 0.11);
  // Neck
  c.fillEllipse(cx - pw * 0.16, cy - ph * 0.14 + breathe * 0.2, pw * 0.07, ph * 0.1);

  // Head
  const hx = cx - pw * 0.22;
  const hy = cy - ph * 0.22 + breathe * 0.3;
  c.fillEllipse(hx, hy, pw * 0.08, ph * 0.07);
  // Snout
  c.fillEllipse(hx - pw * 0.08, hy + ph * 0.01, pw * 0.06, ph * 0.04);
  // Jaw
  c.fillEllipse(hx - pw * 0.06, hy + ph * 0.04, pw * 0.05, ph * 0.03);

  // Horns
  c.fillLine(hx - pw * 0.02, hy - ph * 0.06, hx - pw * 0.08, hy - ph * 0.16, 3);
  c.fillLine(hx + pw * 0.03, hy - ph * 0.05, hx + pw * 0.0, hy - ph * 0.15, 3);

  // Eye
  c.clearCircle(hx + pw * 0.01, hy - ph * 0.01, 2.5);
  c.fillCircle(hx + pw * 0.015, hy - ph * 0.01, 1);

  // Left wing (membrane)
  const wingY = cy - ph * 0.1 + wingFlap * ph * 0.12;
  c.fillPoly([
    [cx - pw * 0.04, cy - ph * 0.08],
    [cx - pw * 0.25, wingY - ph * 0.25],
    [cx - pw * 0.15, wingY - ph * 0.12],
    [cx - pw * 0.28, wingY - ph * 0.18],
    [cx - pw * 0.1, wingY - ph * 0.04],
    [cx + pw * 0.02, cy - ph * 0.02],
  ]);
  // Wing bones
  c.fillLine(cx - pw * 0.04, cy - ph * 0.08, cx - pw * 0.25, wingY - ph * 0.25, 3);
  c.fillLine(cx - pw * 0.04, cy - ph * 0.07, cx - pw * 0.28, wingY - ph * 0.18, 2);
  c.fillLine(cx - pw * 0.03, cy - ph * 0.05, cx - pw * 0.22, wingY - ph * 0.08, 2);

  // Right wing (smaller, perspective)
  const rWingY = cy - ph * 0.08 - wingFlap * ph * 0.08;
  c.fillPoly([
    [cx + pw * 0.06, cy - ph * 0.06],
    [cx + pw * 0.22, rWingY - ph * 0.18],
    [cx + pw * 0.15, rWingY - ph * 0.08],
    [cx + pw * 0.08, cy - ph * 0.0],
  ]);
  c.fillLine(cx + pw * 0.06, cy - ph * 0.06, cx + pw * 0.22, rWingY - ph * 0.18, 2);

  // Spinal ridge
  for (let i = 0; i < 5; i++) {
    const sx = cx - pw * 0.12 + i * pw * 0.06;
    const sy = cy - ph * 0.12 + breathe * 0.3 + Math.sin(i * 0.8) * 2;
    c.fillPoly([
      [sx, sy - 4],
      [sx - 2, sy + 2],
      [sx + 2, sy + 2],
    ]);
  }

  // Tail
  let tx = cx + pw * 0.18;
  let ty = cy + ph * 0.04;
  for (let i = 0; i < 8; i++) {
    const nt = i / 8;
    const nx = tx + pw * 0.04;
    const ny = ty + tailWave * ph * 0.04 * Math.sin(nt * 3 + t * 2);
    c.fillLine(tx, ty, nx, ny, Math.max(4 - i * 0.4, 1.5));
    tx = nx;
    ty = ny;
  }
  // Diamond tail tip
  c.fillPoly([
    [tx, ty - 4],
    [tx - 3, ty],
    [tx, ty + 4],
    [tx + 3, ty],
  ]);

  // Legs
  c.fillLine(cx - pw * 0.02, cy + ph * 0.1, cx - pw * 0.06, cy + ph * 0.22, 4);
  c.fillLine(cx - pw * 0.06, cy + ph * 0.22, cx - pw * 0.1, cy + ph * 0.24, 2);
  c.fillLine(cx + pw * 0.08, cy + ph * 0.1, cx + pw * 0.05, cy + ph * 0.22, 4);
  c.fillLine(cx + pw * 0.05, cy + ph * 0.22, cx + pw * 0.02, cy + ph * 0.24, 2);

  // Fire breath (periodically)
  if (Math.sin(t * 1.2) > 0.3) {
    const fx = hx - pw * 0.14;
    const fy = hy + ph * 0.02;
    for (let i = 0; i < 5; i++) {
      const fi = i * 0.3;
      c.fillCircle(
        fx - pw * 0.02 * i + Math.sin(t * 4 + fi) * 2,
        fy + Math.cos(t * 3 + fi) * 3,
        2 + Math.random() * 1.5,
      );
    }
  }
}

// --- WOLF ---
function renderWolf(c: BrailleCanvas, t: number): void {
  const pw = c.pixelWidth;
  const ph = c.pixelHeight;
  const cx = pw * 0.5;
  const cy = ph * 0.55;
  const howl = Math.max(0, Math.sin(t * 0.8));
  const breathe = Math.sin(t * 1.5) * 1;
  const tailWag = Math.sin(t * 2) * 0.15;

  // Body
  c.fillEllipse(cx, cy + breathe * 0.3, pw * 0.22, ph * 0.13);
  // Chest
  c.fillEllipse(cx - pw * 0.12, cy - ph * 0.02 + breathe * 0.2, pw * 0.13, ph * 0.11);
  // Neck
  c.fillEllipse(cx - pw * 0.2, cy - ph * 0.1 + breathe * 0.2, pw * 0.08, ph * 0.1);

  // Head (tilts up during howl)
  const headTilt = howl * ph * 0.06;
  const hx = cx - pw * 0.26;
  const hy = cy - ph * 0.18 - headTilt + breathe * 0.2;
  c.fillEllipse(hx, hy, pw * 0.08, ph * 0.07);

  // Muzzle
  const mx = hx - pw * 0.07;
  const my = hy + ph * 0.01 - headTilt * 0.3;
  c.fillEllipse(mx, my, pw * 0.05, ph * 0.035);

  // Nose
  c.clearCircle(mx - pw * 0.02, my - 1, 2);
  c.fillCircle(mx - pw * 0.02, my - 1, 0.8);

  // Mouth opens during howl
  if (howl > 0.3) {
    c.fillEllipse(mx, my + ph * 0.03, pw * 0.04, ph * 0.02 * howl);
    c.clearEllipse(mx, my + ph * 0.03, pw * 0.03, ph * 0.015 * howl);
  }

  // Ears (pointed triangles)
  const earTwitch = Math.sin(t * 3) * 1.5;
  c.fillPoly([
    [hx - pw * 0.03, hy - ph * 0.06],
    [hx - pw * 0.07, hy - ph * 0.18 + earTwitch],
    [hx - pw * 0.0, hy - ph * 0.07],
  ]);
  c.fillPoly([
    [hx + pw * 0.03, hy - ph * 0.05],
    [hx + pw * 0.01, hy - ph * 0.17 - earTwitch],
    [hx + pw * 0.06, hy - ph * 0.06],
  ]);

  // Eye
  c.clearCircle(hx + pw * 0.02, hy - ph * 0.01, 2);
  c.fillCircle(hx + pw * 0.025, hy - ph * 0.01, 0.8);

  // 4 legs with paws
  // Front legs
  c.fillLine(cx - pw * 0.1, cy + ph * 0.08, cx - pw * 0.12, cy + ph * 0.24, 4);
  c.fillEllipse(cx - pw * 0.12, cy + ph * 0.25, 3, 2);
  c.fillLine(cx - pw * 0.04, cy + ph * 0.09, cx - pw * 0.05, cy + ph * 0.24, 3.5);
  c.fillEllipse(cx - pw * 0.05, cy + ph * 0.25, 3, 2);
  // Hind legs
  c.fillLine(cx + pw * 0.1, cy + ph * 0.08, cx + pw * 0.12, cy + ph * 0.24, 4);
  c.fillEllipse(cx + pw * 0.12, cy + ph * 0.25, 3, 2);
  c.fillLine(cx + pw * 0.16, cy + ph * 0.06, cx + pw * 0.18, cy + ph * 0.24, 3.5);
  c.fillEllipse(cx + pw * 0.18, cy + ph * 0.25, 3, 2);

  // Bushy tail
  let tx = cx + pw * 0.22;
  let ty = cy - ph * 0.02;
  for (let i = 0; i < 6; i++) {
    const nt = i / 6;
    const nx = tx + pw * 0.03;
    const ny = ty - ph * 0.04 + Math.sin(nt * 2 + t * 2) * ph * tailWag;
    c.fillCircle((tx + nx) / 2, (ty + ny) / 2, 3.5 - i * 0.3);
    tx = nx;
    ty = ny;
  }

  // Fur tufts on back
  for (let i = 0; i < 4; i++) {
    const fx = cx - pw * 0.08 + i * pw * 0.08;
    const fy = cy - ph * 0.11 + breathe * 0.3;
    c.fillPoly([
      [fx, fy - 3],
      [fx - 1.5, fy + 1],
      [fx + 1.5, fy + 1],
    ]);
  }

  // Howl sound waves
  if (howl > 0.5) {
    const waveX = hx - pw * 0.12;
    const waveY = hy - ph * 0.08;
    for (let i = 0; i < 3; i++) {
      const r = 3 + i * 4;
      const angle = -0.3 + i * 0.1;
      c.set(waveX - r * Math.cos(angle), waveY - r * Math.sin(angle));
      c.set(waveX - r * Math.cos(angle + 0.5), waveY - r * Math.sin(angle + 0.5));
      c.set(waveX - r * Math.cos(angle + 1), waveY - r * Math.sin(angle + 1));
    }
  }
}

// --- PHOENIX ---
function renderPhoenix(c: BrailleCanvas, t: number): void {
  const pw = c.pixelWidth;
  const ph = c.pixelHeight;
  const cx = pw * 0.5;
  const wingUp = Math.sin(t * 2) * 0.25;
  const rise = Math.sin(t * 1.2) * ph * 0.02;
  const cy = ph * 0.4 + rise;

  // Body
  c.fillEllipse(cx, cy, pw * 0.1, ph * 0.12);

  // Head
  const hx = cx;
  const hy = cy - ph * 0.18;
  c.fillCircle(hx, hy, pw * 0.05);

  // Beak
  c.fillPoly([
    [hx - pw * 0.05, hy],
    [hx - pw * 0.1, hy + 2],
    [hx - pw * 0.05, hy + 3],
  ]);

  // Eye
  c.clearCircle(hx - pw * 0.01, hy - 1, 2);
  c.fillCircle(hx - pw * 0.005, hy - 1, 0.8);

  // Crown feathers (5 feathers waving)
  for (let i = 0; i < 5; i++) {
    const angle = -1.2 + i * 0.4;
    const wave = Math.sin(t * 3 + i * 0.6) * 2;
    const fx = hx + Math.cos(angle) * pw * 0.06;
    const fy = hy + Math.sin(angle) * ph * 0.06 - ph * 0.05;
    const tipX = hx + Math.cos(angle) * pw * 0.1 + wave;
    const tipY = hy + Math.sin(angle) * ph * 0.1 - ph * 0.08;
    c.fillLine(fx, fy, tipX, tipY, 2);
    c.fillCircle(tipX, tipY, 2);
  }

  // Left wing
  const lwY = cy - ph * 0.05 + wingUp * ph * 0.15;
  c.fillPoly([
    [cx - pw * 0.08, cy - ph * 0.05],
    [cx - pw * 0.35, lwY - ph * 0.15],
    [cx - pw * 0.3, lwY - ph * 0.05],
    [cx - pw * 0.38, lwY - ph * 0.08],
    [cx - pw * 0.25, lwY + ph * 0.02],
    [cx - pw * 0.08, cy + ph * 0.04],
  ]);
  // Feather lines
  for (let i = 0; i < 3; i++) {
    const ft = 0.3 + i * 0.2;
    c.fillLine(
      cx - pw * 0.08, cy - ph * 0.02 + i * 3,
      cx - pw * 0.3 - i * 3, lwY - ph * 0.1 + i * ph * 0.04,
      1.5,
    );
  }

  // Right wing
  const rwY = cy - ph * 0.05 - wingUp * ph * 0.15;
  c.fillPoly([
    [cx + pw * 0.08, cy - ph * 0.05],
    [cx + pw * 0.35, rwY - ph * 0.15],
    [cx + pw * 0.3, rwY - ph * 0.05],
    [cx + pw * 0.38, rwY - ph * 0.08],
    [cx + pw * 0.25, rwY + ph * 0.02],
    [cx + pw * 0.08, cy + ph * 0.04],
  ]);
  for (let i = 0; i < 3; i++) {
    c.fillLine(
      cx + pw * 0.08, cy - ph * 0.02 + i * 3,
      cx + pw * 0.3 + i * 3, rwY - ph * 0.1 + i * ph * 0.04,
      1.5,
    );
  }

  // Tail feathers (7 flowing)
  for (let i = 0; i < 7; i++) {
    const spread = (i - 3) * 0.12;
    let tx = cx + spread * pw * 0.15;
    let ty = cy + ph * 0.1;
    for (let j = 0; j < 6; j++) {
      const nt = j / 6;
      const nx = tx + spread * pw * 0.04 + Math.sin(t * 1.5 + i + j * 0.5) * 2;
      const ny = ty + ph * 0.05;
      c.fillLine(tx, ty, nx, ny, Math.max(3 - j * 0.4, 1));
      tx = nx;
      ty = ny;
    }
  }

  // Legs
  c.fillLine(cx - pw * 0.03, cy + ph * 0.1, cx - pw * 0.05, cy + ph * 0.2, 2.5);
  c.fillLine(cx + pw * 0.03, cy + ph * 0.1, cx + pw * 0.05, cy + ph * 0.2, 2.5);
  // Talons
  c.fillLine(cx - pw * 0.05, cy + ph * 0.2, cx - pw * 0.08, cy + ph * 0.22, 1.5);
  c.fillLine(cx - pw * 0.05, cy + ph * 0.2, cx - pw * 0.03, cy + ph * 0.22, 1.5);
  c.fillLine(cx + pw * 0.05, cy + ph * 0.2, cx + pw * 0.08, cy + ph * 0.22, 1.5);
  c.fillLine(cx + pw * 0.05, cy + ph * 0.2, cx + pw * 0.03, cy + ph * 0.22, 1.5);

  // Fire particles
  for (let i = 0; i < 4; i++) {
    const angle = t * 2 + i * 1.5;
    const dist = pw * 0.12 + Math.sin(t * 3 + i) * 3;
    c.set(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist * 0.7);
  }
}

// --- JELLYFISH ---
function renderJellyfish(c: BrailleCanvas, t: number): void {
  const pw = c.pixelWidth;
  const ph = c.pixelHeight;
  const pulse = Math.sin(t * 2) * 0.08;
  const driftX = Math.sin(t * 0.5) * pw * 0.03;
  const driftY = Math.sin(t * 0.7) * ph * 0.02;
  const cx = pw * 0.5 + driftX;
  const cy = ph * 0.35 + driftY;

  // Bell dome
  const bellRx = pw * 0.2 * (1 + pulse);
  const bellRy = ph * 0.18 * (1 - pulse * 0.5);
  c.fillEllipse(cx, cy, bellRx, bellRy);
  // Clear bottom half of bell to make dome shape
  c.fillPoly([
    [cx - bellRx - 2, cy + 2],
    [cx + bellRx + 2, cy + 2],
    [cx + bellRx + 2, cy + bellRy + 2],
    [cx - bellRx - 2, cy + bellRy + 2],
  ]);
  // Re-fill as dome
  c.fillEllipse(cx, cy, bellRx, bellRy);
  // Clear lower portion
  for (let y = Math.round(cy + bellRy * 0.3); y <= Math.round(cy + bellRy + 2); y++) {
    for (let x = 0; x < pw; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if ((dx * dx) / (bellRx * bellRx) + (dy * dy) / (bellRy * bellRy) > 0.85) {
        c.unset(x, y);
      }
    }
  }

  // Thick rim at bottom of bell
  c.strokeEllipse(cx, cy, bellRx * 0.95, bellRy * 0.9, 2);

  // Internal dome rings
  c.strokeEllipse(cx, cy - bellRy * 0.15, bellRx * 0.6, bellRy * 0.5, 1);
  c.strokeEllipse(cx, cy - bellRy * 0.25, bellRx * 0.3, bellRy * 0.3, 1);

  // 4 thick oral arms
  const armBaseY = cy + bellRy * 0.2;
  for (let i = 0; i < 4; i++) {
    const ax = cx + (i - 1.5) * pw * 0.07;
    let ay = armBaseY;
    for (let j = 0; j < 8; j++) {
      const wave = Math.sin(t * 2.5 + i * 0.8 + j * 0.6) * pw * 0.03;
      const ny = ay + ph * 0.03;
      const nx = ax + wave;
      c.fillLine(ax + wave * 0.5, ay, nx, ny, 3 - j * 0.2);
      ay = ny;
    }
  }

  // 10 thin tentacles
  for (let i = 0; i < 10; i++) {
    const tx = cx + (i - 4.5) * pw * 0.04;
    let ty = armBaseY + ph * 0.05;
    for (let j = 0; j < 12; j++) {
      const wave = Math.sin(t * 1.8 + i * 0.5 + j * 0.4) * pw * 0.02;
      const ny = ty + ph * 0.025;
      c.fillLine(tx + wave, ty, tx + wave, ny, 1);
      ty = ny;
    }
  }
}

// --- SERPENT ---
function renderSerpent(c: BrailleCanvas, t: number): void {
  const pw = c.pixelWidth;
  const ph = c.pixelHeight;
  const cx = pw * 0.5;
  const cy = ph * 0.5;

  // S-curve body (parametric, 120 segments)
  const segments = 120;
  const bodyPoints: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const s = i / segments;
    const x = cx - pw * 0.35 + s * pw * 0.7;
    const wave = Math.sin(s * Math.PI * 2.5 + t * 2) * ph * 0.18;
    const y = cy + wave;
    bodyPoints.push([x, y]);
  }

  // Draw thick body with varying thickness
  for (let i = 0; i < bodyPoints.length - 1; i++) {
    const s = i / segments;
    // Fat in middle, thin at ends
    const thick = 3 + Math.sin(s * Math.PI) * 5;
    c.fillLine(bodyPoints[i][0], bodyPoints[i][1], bodyPoints[i + 1][0], bodyPoints[i + 1][1], thick);
  }

  // Head (at the start of the body)
  const [headX, headY] = bodyPoints[0];
  c.fillEllipse(headX - pw * 0.02, headY, pw * 0.05, ph * 0.05);
  c.fillEllipse(headX - pw * 0.06, headY + 1, pw * 0.04, ph * 0.035);

  // Eye
  c.clearCircle(headX - pw * 0.01, headY - ph * 0.015, 2);
  c.fillCircle(headX - pw * 0.005, headY - ph * 0.015, 0.8);

  // Forked tongue (conditional flick)
  const tongueFlick = Math.sin(t * 5) > 0.6;
  if (tongueFlick) {
    const tx = headX - pw * 0.1;
    const ty = headY + 1;
    c.fillLine(tx, ty, tx - pw * 0.05, ty, 1.5);
    c.fillLine(tx - pw * 0.05, ty, tx - pw * 0.07, ty - 2, 1);
    c.fillLine(tx - pw * 0.05, ty, tx - pw * 0.07, ty + 2, 1);
  }

  // Diamond scale dots along body
  for (let i = 5; i < segments - 5; i += 6) {
    const [sx, sy] = bodyPoints[i];
    const s = i / segments;
    const offset = Math.sin(s * Math.PI) * 3;
    c.set(sx, sy - offset);
    c.set(sx, sy + offset);
  }
}

// --- BUTTERFLY ---
function renderButterfly(c: BrailleCanvas, t: number): void {
  const pw = c.pixelWidth;
  const ph = c.pixelHeight;
  const wingAngle = Math.sin(t * 3) * 0.4;
  const floatY = Math.sin(t * 1.2) * ph * 0.02;
  const swayX = Math.sin(t * 0.8) * pw * 0.02;
  const cx = pw * 0.5 + swayX;
  const cy = ph * 0.5 + floatY;

  // Wing scale factor based on flap angle
  const wingScale = 0.7 + Math.cos(wingAngle) * 0.3;

  // Body (thin vertical ellipse)
  c.fillEllipse(cx, cy, pw * 0.02, ph * 0.14);

  // Head
  c.fillCircle(cx, cy - ph * 0.16, pw * 0.025);

  // Antennae
  c.fillBezier(
    cx - 1, cy - ph * 0.18,
    cx - pw * 0.06, cy - ph * 0.28,
    cx - pw * 0.1, cy - ph * 0.32,
    cx - pw * 0.08, cy - ph * 0.35,
    1.5,
  );
  c.fillCircle(cx - pw * 0.08, cy - ph * 0.35, 2);
  c.fillBezier(
    cx + 1, cy - ph * 0.18,
    cx + pw * 0.06, cy - ph * 0.28,
    cx + pw * 0.1, cy - ph * 0.32,
    cx + pw * 0.08, cy - ph * 0.35,
    1.5,
  );
  c.fillCircle(cx + pw * 0.08, cy - ph * 0.35, 2);

  // Upper wings
  const uwRx = pw * 0.22 * wingScale;
  const uwRy = ph * 0.2;
  // Left upper wing
  c.fillPoly([
    [cx - pw * 0.02, cy - ph * 0.12],
    [cx - uwRx, cy - uwRy * 0.8],
    [cx - uwRx * 0.9, cy - uwRy * 0.3],
    [cx - uwRx * 0.7, cy + ph * 0.0],
    [cx - pw * 0.02, cy + ph * 0.02],
  ]);
  // Right upper wing
  c.fillPoly([
    [cx + pw * 0.02, cy - ph * 0.12],
    [cx + uwRx, cy - uwRy * 0.8],
    [cx + uwRx * 0.9, cy - uwRy * 0.3],
    [cx + uwRx * 0.7, cy + ph * 0.0],
    [cx + pw * 0.02, cy + ph * 0.02],
  ]);

  // Eyespots on upper wings
  const esLx = cx - uwRx * 0.55;
  const esRx = cx + uwRx * 0.55;
  const esY = cy - ph * 0.06;
  c.fillCircle(esLx, esY, 4);
  c.clearCircle(esLx, esY, 2.5);
  c.fillCircle(esLx, esY, 1);
  c.fillCircle(esRx, esY, 4);
  c.clearCircle(esRx, esY, 2.5);
  c.fillCircle(esRx, esY, 1);

  // Lower wings
  const lwRx = pw * 0.16 * wingScale;
  const lwRy = ph * 0.14;
  c.fillPoly([
    [cx - pw * 0.02, cy + ph * 0.02],
    [cx - lwRx, cy + ph * 0.04],
    [cx - lwRx * 0.8, cy + lwRy],
    [cx - pw * 0.02, cy + ph * 0.1],
  ]);
  c.fillPoly([
    [cx + pw * 0.02, cy + ph * 0.02],
    [cx + lwRx, cy + ph * 0.04],
    [cx + lwRx * 0.8, cy + lwRy],
    [cx + pw * 0.02, cy + ph * 0.1],
  ]);

  // Wing veins
  c.fillLine(cx - 2, cy - ph * 0.1, cx - uwRx * 0.7, cy - uwRy * 0.6, 1);
  c.fillLine(cx - 2, cy - ph * 0.05, cx - uwRx * 0.8, cy - uwRy * 0.2, 1);
  c.fillLine(cx + 2, cy - ph * 0.1, cx + uwRx * 0.7, cy - uwRy * 0.6, 1);
  c.fillLine(cx + 2, cy - ph * 0.05, cx + uwRx * 0.8, cy - uwRy * 0.2, 1);
}

// --- OWL ---
function renderOwl(c: BrailleCanvas, t: number): void {
  const pw = c.pixelWidth;
  const ph = c.pixelHeight;
  const cx = pw * 0.5;
  const breathe = Math.sin(t * 1.5) * 1;
  const headTilt = Math.sin(t * 0.7) * pw * 0.01;
  const blink = Math.sin(t * 1.2) > 0.93;
  const cy = ph * 0.5 + breathe;

  // Branch
  c.fillLine(pw * 0.1, ph * 0.82, pw * 0.9, ph * 0.82, 4);

  // Talons
  c.fillLine(cx - pw * 0.06, ph * 0.78, cx - pw * 0.06, ph * 0.82, 2.5);
  c.fillLine(cx - pw * 0.08, ph * 0.82, cx - pw * 0.04, ph * 0.82, 1.5);
  c.fillLine(cx + pw * 0.06, ph * 0.78, cx + pw * 0.06, ph * 0.82, 2.5);
  c.fillLine(cx + pw * 0.04, ph * 0.82, cx + pw * 0.08, ph * 0.82, 1.5);

  // Body (bell shape via variable-width scanline)
  const bodyTop = cy + ph * 0.02;
  const bodyBot = ph * 0.78;
  for (let y = Math.round(bodyTop); y <= Math.round(bodyBot); y++) {
    const s = (y - bodyTop) / (bodyBot - bodyTop);
    const w = pw * (0.1 + s * 0.12) * (1 + breathe * 0.005);
    for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) {
      if (x >= 0 && x < pw) c.set(x, y);
    }
  }

  // Head
  const hx = cx + headTilt;
  const hy = cy - ph * 0.08;
  c.fillEllipse(hx, hy, pw * 0.14, ph * 0.1);

  // Ear tufts
  c.fillPoly([
    [hx - pw * 0.1, hy - ph * 0.04],
    [hx - pw * 0.14, hy - ph * 0.18],
    [hx - pw * 0.06, hy - ph * 0.06],
  ]);
  c.fillPoly([
    [hx + pw * 0.1, hy - ph * 0.04],
    [hx + pw * 0.14, hy - ph * 0.18],
    [hx + pw * 0.06, hy - ph * 0.06],
  ]);

  // Facial disc
  c.strokeEllipse(hx, hy + ph * 0.01, pw * 0.12, ph * 0.08, 2);

  // Eyes
  const pupilX = Math.sin(t * 0.9) * 1.5;
  const eyeLx = hx - pw * 0.05;
  const eyeRx = hx + pw * 0.05;
  const eyeY = hy;
  if (blink) {
    // Blink — horizontal lines
    c.fillLine(eyeLx - 3, eyeY, eyeLx + 3, eyeY, 1.5);
    c.fillLine(eyeRx - 3, eyeY, eyeRx + 3, eyeY, 1.5);
  } else {
    // Left eye
    c.fillCircle(eyeLx, eyeY, 5);
    c.clearCircle(eyeLx, eyeY, 3.5);
    c.strokeEllipse(eyeLx, eyeY, 3, 3, 1);
    c.fillCircle(eyeLx + pupilX, eyeY, 1.5);
    c.clearCircle(eyeLx + pupilX - 1, eyeY - 1, 0.7);
    // Right eye
    c.fillCircle(eyeRx, eyeY, 5);
    c.clearCircle(eyeRx, eyeY, 3.5);
    c.strokeEllipse(eyeRx, eyeY, 3, 3, 1);
    c.fillCircle(eyeRx + pupilX, eyeY, 1.5);
    c.clearCircle(eyeRx + pupilX - 1, eyeY - 1, 0.7);
  }

  // Beak
  c.fillPoly([
    [hx - 2, hy + ph * 0.04],
    [hx, hy + ph * 0.07],
    [hx + 2, hy + ph * 0.04],
  ]);

  // Chest feather V-pattern
  for (let i = 0; i < 4; i++) {
    const vy = cy + ph * 0.08 + i * ph * 0.06;
    const vw = 2 + i * 1.5;
    c.fillLine(cx - vw, vy, cx, vy + 3, 1);
    c.fillLine(cx, vy + 3, cx + vw, vy, 1);
  }

  // Wings (curved along body sides)
  c.fillBezier(
    cx - pw * 0.1, cy + ph * 0.05,
    cx - pw * 0.2, cy + ph * 0.1,
    cx - pw * 0.22, cy + ph * 0.25,
    cx - pw * 0.12, ph * 0.72,
    3,
  );
  c.fillBezier(
    cx + pw * 0.1, cy + ph * 0.05,
    cx + pw * 0.2, cy + ph * 0.1,
    cx + pw * 0.22, cy + ph * 0.25,
    cx + pw * 0.12, ph * 0.72,
    3,
  );
}

// --- KOI ---
function renderKoi(c: BrailleCanvas, t: number): void {
  const pw = c.pixelWidth;
  const ph = c.pixelHeight;
  const swimX = Math.sin(t * 0.6) * pw * 0.05;
  const swimY = Math.sin(t * 0.9) * ph * 0.02;
  const tailWag = Math.sin(t * 3) * 0.25;
  const cx = pw * 0.45 + swimX;
  const cy = ph * 0.5 + swimY;

  // Water surface (dots along top)
  for (let x = 0; x < pw; x += 3) {
    const wy = ph * 0.08 + Math.sin(x * 0.15 + t * 2) * 2;
    c.set(x, wy);
    c.set(x + 1, wy);
  }

  // Body (parametric fish profile with wobble)
  const bodyLen = pw * 0.5;
  const bodySegs = 80;
  for (let i = 0; i <= bodySegs; i++) {
    const s = i / bodySegs;
    const x = cx - bodyLen * 0.4 + s * bodyLen;
    // Fish body profile: fat middle, tapered ends
    let halfH;
    if (s < 0.3) {
      halfH = ph * 0.06 * (s / 0.3); // taper in from head
    } else if (s < 0.7) {
      halfH = ph * 0.06; // fat middle
    } else {
      halfH = ph * 0.06 * ((1 - s) / 0.3); // taper to tail
    }
    const wobble = Math.sin(s * Math.PI * 3 + t * 3) * 2 * s;
    const yc = cy + wobble;
    for (let dy = -halfH; dy <= halfH; dy++) {
      c.set(Math.round(x), Math.round(yc + dy));
    }
  }

  // Head
  const hx = cx - bodyLen * 0.4;
  c.fillEllipse(hx, cy, pw * 0.06, ph * 0.06);

  // Mouth
  c.clearEllipse(hx - pw * 0.04, cy + 1, pw * 0.02, ph * 0.015);

  // Eye
  c.clearCircle(hx + pw * 0.01, cy - ph * 0.02, 2);
  c.fillCircle(hx + pw * 0.015, cy - ph * 0.02, 0.8);

  // Whiskers/barbels
  c.fillLine(hx - pw * 0.04, cy - 2, hx - pw * 0.08, cy - ph * 0.04, 1);
  c.fillLine(hx - pw * 0.04, cy + 2, hx - pw * 0.08, cy + ph * 0.04, 1);

  // Dorsal fin
  const dorsalX = cx + pw * 0.02;
  c.fillPoly([
    [dorsalX - pw * 0.06, cy - ph * 0.05],
    [dorsalX - pw * 0.02, cy - ph * 0.14],
    [dorsalX + pw * 0.06, cy - ph * 0.04],
    [dorsalX + pw * 0.04, cy - ph * 0.05],
  ]);

  // Pectoral fin
  c.fillPoly([
    [cx - pw * 0.02, cy + ph * 0.04],
    [cx - pw * 0.1, cy + ph * 0.1],
    [cx - pw * 0.04, cy + ph * 0.08],
    [cx + pw * 0.0, cy + ph * 0.05],
  ]);

  // Tail fin (fan shape with wag)
  const tailX = cx + bodyLen * 0.6;
  const tailSpread = ph * 0.12;
  const wagOffset = tailWag * ph * 0.06;
  c.fillPoly([
    [tailX - pw * 0.04, cy + wagOffset * 0.3],
    [tailX + pw * 0.08, cy - tailSpread + wagOffset],
    [tailX + pw * 0.06, cy + wagOffset * 0.5],
    [tailX + pw * 0.08, cy + tailSpread + wagOffset],
  ]);
  // Tail ray lines
  for (let i = 0; i < 4; i++) {
    const s = (i - 1.5) / 1.5;
    c.fillLine(
      tailX - pw * 0.02, cy + wagOffset * 0.3,
      tailX + pw * 0.07, cy + s * tailSpread * 0.8 + wagOffset,
      1,
    );
  }

  // Koi markings (colored patches — filled ellipses)
  c.fillEllipse(cx - pw * 0.02, cy - ph * 0.01, pw * 0.05, ph * 0.03);
  c.fillEllipse(cx + pw * 0.1, cy + ph * 0.01, pw * 0.04, ph * 0.025);

  // Rising bubbles
  for (let i = 0; i < 3; i++) {
    const bx = hx - pw * 0.06 + i * 4;
    const by = cy - ph * 0.1 - ((t * 8 + i * 10) % (ph * 0.3));
    if (by > ph * 0.1) {
      c.strokeEllipse(bx, by, 2, 2, 1);
    }
  }
}

export const ANIMAL_RENDERERS: Record<AnimalType, AnimalRenderer> = {
  dragon: renderDragon,
  wolf: renderWolf,
  phoenix: renderPhoenix,
  jellyfish: renderJellyfish,
  serpent: renderSerpent,
  butterfly: renderButterfly,
  owl: renderOwl,
  koi: renderKoi,
};
