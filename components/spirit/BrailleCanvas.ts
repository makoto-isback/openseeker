/**
 * BrailleCanvas — Unicode Braille rendering engine
 * Converts pixel buffers to Braille characters (U+2800-U+28FF)
 * Each character cell is 2×4 pixels, giving high-density dot art
 */

// Braille dot mapping per cell (2 cols × 4 rows)
// Col 0: 0x01, 0x02, 0x04, 0x40
// Col 1: 0x08, 0x10, 0x20, 0x80
const DOT_MAP = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
];

const BRAILLE_BASE = 0x2800;

export class BrailleCanvas {
  readonly charWidth: number;
  readonly charHeight: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  private pixels: Uint8Array;

  constructor(charWidth: number, charHeight: number) {
    this.charWidth = charWidth;
    this.charHeight = charHeight;
    this.pixelWidth = charWidth * 2;
    this.pixelHeight = charHeight * 4;
    this.pixels = new Uint8Array(this.pixelWidth * this.pixelHeight);
  }

  clear(): void {
    this.pixels.fill(0);
  }

  set(x: number, y: number): void {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px >= 0 && px < this.pixelWidth && py >= 0 && py < this.pixelHeight) {
      this.pixels[py * this.pixelWidth + px] = 1;
    }
  }

  unset(x: number, y: number): void {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px >= 0 && px < this.pixelWidth && py >= 0 && py < this.pixelHeight) {
      this.pixels[py * this.pixelWidth + px] = 0;
    }
  }

  get(x: number, y: number): boolean {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px >= 0 && px < this.pixelWidth && py >= 0 && py < this.pixelHeight) {
      return this.pixels[py * this.pixelWidth + px] === 1;
    }
    return false;
  }

  fillCircle(cx: number, cy: number, r: number): void {
    this.fillEllipse(cx, cy, r, r);
  }

  clearCircle(cx: number, cy: number, r: number): void {
    this.clearEllipse(cx, cy, r, r);
  }

  fillEllipse(cx: number, cy: number, rx: number, ry: number): void {
    const x0 = Math.max(0, Math.floor(cx - rx));
    const x1 = Math.min(this.pixelWidth - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const y1 = Math.min(this.pixelHeight - 1, Math.ceil(cy + ry));
    const rx2 = rx * rx;
    const ry2 = ry * ry;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if ((dx * dx) / rx2 + (dy * dy) / ry2 <= 1) {
          this.pixels[y * this.pixelWidth + x] = 1;
        }
      }
    }
  }

  clearEllipse(cx: number, cy: number, rx: number, ry: number): void {
    const x0 = Math.max(0, Math.floor(cx - rx));
    const x1 = Math.min(this.pixelWidth - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const y1 = Math.min(this.pixelHeight - 1, Math.ceil(cy + ry));
    const rx2 = rx * rx;
    const ry2 = ry * ry;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if ((dx * dx) / rx2 + (dy * dy) / ry2 <= 1) {
          this.pixels[y * this.pixelWidth + x] = 0;
        }
      }
    }
  }

  strokeEllipse(cx: number, cy: number, rx: number, ry: number, thick: number = 1): void {
    const outerRx = rx + thick / 2;
    const outerRy = ry + thick / 2;
    const innerRx = Math.max(0, rx - thick / 2);
    const innerRy = Math.max(0, ry - thick / 2);
    const x0 = Math.max(0, Math.floor(cx - outerRx));
    const x1 = Math.min(this.pixelWidth - 1, Math.ceil(cx + outerRx));
    const y0 = Math.max(0, Math.floor(cy - outerRy));
    const y1 = Math.min(this.pixelHeight - 1, Math.ceil(cy + outerRy));
    const orx2 = outerRx * outerRx;
    const ory2 = outerRy * outerRy;
    const irx2 = innerRx * innerRx;
    const iry2 = innerRy * innerRy;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const outer = (dx * dx) / orx2 + (dy * dy) / ory2;
        const inner = innerRx > 0 && innerRy > 0 ? (dx * dx) / irx2 + (dy * dy) / iry2 : 0;
        if (outer <= 1 && inner >= 1) {
          this.pixels[y * this.pixelWidth + x] = 1;
        }
      }
    }
  }

  fillLine(x1: number, y1: number, x2: number, y2: number, thick: number = 1): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(Math.ceil(len), 1);
    const r = thick / 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      this.fillCircle(px, py, r);
    }
  }

  fillBezier(
    x1: number, y1: number,
    cx1: number, cy1: number,
    cx2: number, cy2: number,
    x2: number, y2: number,
    thick: number = 1,
  ): void {
    const segments = 30;
    const r = thick / 2;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;
      const t2 = t * t;
      const t3 = t2 * t;
      const px = mt3 * x1 + 3 * mt2 * t * cx1 + 3 * mt * t2 * cx2 + t3 * x2;
      const py = mt3 * y1 + 3 * mt2 * t * cy1 + 3 * mt * t2 * cy2 + t3 * y2;
      this.fillCircle(px, py, r);
    }
  }

  fillPoly(points: number[][]): void {
    if (points.length < 3) return;
    // Find bounding box
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of points) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    minY = Math.max(0, Math.floor(minY));
    maxY = Math.min(this.pixelHeight - 1, Math.ceil(maxY));
    // Scanline fill
    for (let y = minY; y <= maxY; y++) {
      const intersections: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        const [x1, y1] = points[i];
        const [x2, y2] = points[j];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          const t = (y - y1) / (y2 - y1);
          intersections.push(x1 + t * (x2 - x1));
        }
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i < intersections.length - 1; i += 2) {
        const xStart = Math.max(0, Math.floor(intersections[i]));
        const xEnd = Math.min(this.pixelWidth - 1, Math.ceil(intersections[i + 1]));
        for (let x = xStart; x <= xEnd; x++) {
          this.pixels[y * this.pixelWidth + x] = 1;
        }
      }
    }
  }

  render(): string {
    const lines: string[] = [];
    for (let cy = 0; cy < this.charHeight; cy++) {
      let line = '';
      for (let cx = 0; cx < this.charWidth; cx++) {
        let code = 0;
        const baseX = cx * 2;
        const baseY = cy * 4;
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 2; col++) {
            const px = baseX + col;
            const py = baseY + row;
            if (px < this.pixelWidth && py < this.pixelHeight) {
              if (this.pixels[py * this.pixelWidth + px]) {
                code |= DOT_MAP[row][col];
              }
            }
          }
        }
        line += String.fromCharCode(BRAILLE_BASE + code);
      }
      lines.push(line);
    }
    return lines.join('\n');
  }
}
