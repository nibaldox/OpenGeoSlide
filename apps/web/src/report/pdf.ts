// Informe PDF con jsPDF 4.2.1 (carga diferida) y DejaVu Sans embebida (Identity-H, TrueType).
//
// `jspdf` se importa con `await import('jspdf')` al generar el informe: no entra en el bundle inicial. La fuente
// (`public/fonts/`) se descarga solo entonces. El texto sale codificado con la fuente (glifos Unicode), así que φ, γ,
// ≤, á, ñ, ° y ³ se imprimen bien; con una fuente estándar de jsPDF saldrían bytes que no son WinAnsi (X3 §1.4).
// La sección se dibuja en vectorial: regiones, piezométrica, superficie crítica y dovelas.

import type { jsPDF } from 'jspdf';
import type { Point } from '../engine/types';
import { forceShapes, reinforcementShapes, type PxPoint, type ShapePart } from '../editor/canvas/reinforcements';
import type { Viewport } from '../geometry/viewport';
import { crackShape } from '../render/crack';
import {
  buildReportContent,
  type ReportBlock,
  type ReportContent,
  type ReportSection,
  type Rgb,
  type SectionDrawing,
} from './content';
import { PDF_PALETTE as P } from './palette';
import type { BuildReportPdf, ReportInput } from './types';

export type FontFile = 'DejaVuSans.ttf' | 'DejaVuSans-Bold.ttf';

/** Devuelve los bytes de un TTF de `public/fonts/`. Inyectable para las pruebas (Node no tiene un servidor). */
export type FontLoader = (file: FontFile) => Promise<Uint8Array>;

export interface BuildPdfOptions {
  loadFont?: FontLoader;
  /** Comprime los flujos del PDF (por defecto sí). Las pruebas lo desactivan para leer el texto. */
  compress?: boolean;
}

const FONT = 'DejaVuSans';
const MARGIN = 15;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const BOTTOM = PAGE_H - 18;
/** Píxeles por milímetro con que se calculan los símbolos de los refuerzos (los mismos del lienzo del editor): `px / PX_PER_MM` da mm de página. */
const PX_PER_MM = 3.78;

// Caché de módulo (R7-25): las dos fuentes (~1,4 MB) se piden una sola vez por sesión y su conversión a cadena binaria
// (la que pide jsPDF) también. Se guarda la promesa, así que dos exportaciones simultáneas comparten la misma petición; un
// fallo NO se guarda (la siguiente exportación reintenta). Con un `loadFont` inyectado no hay caché (lo controla quien lo da).
const fontBytesCache = new Map<FontFile, Promise<Uint8Array>>();
const binaryStringCache = new WeakMap<Uint8Array, string>();

/** Vacía las cachés (solo para las pruebas). */
export function clearFontCache(): void {
  fontBytesCache.clear();
}

async function downloadFont(file: FontFile): Promise<Uint8Array> {
  const res = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`);
  if (!res.ok) throw new Error(`No se pudo cargar la fuente ${file} (HTTP ${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Descarga la fuente desde `public/fonts/` respetando la base de Vite; la segunda llamada no vuelve a pedirla. */
export const fetchFont: FontLoader = (file) => {
  const cached = fontBytesCache.get(file);
  if (cached) return cached;
  const pending = downloadFont(file).catch((error: unknown) => {
    fontBytesCache.delete(file);
    throw error;
  });
  fontBytesCache.set(file, pending);
  return pending;
};

function convertToBinaryString(bytes: Uint8Array): string {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return out;
}

/** Cadena binaria de los bytes de una fuente, convertida una sola vez por objeto (caché débil). */
export function toBinaryString(bytes: Uint8Array): string {
  const cached = binaryStringCache.get(bytes);
  if (cached !== undefined) return cached;
  const out = convertToBinaryString(bytes);
  binaryStringCache.set(bytes, out);
  return out;
}

/** Registra DejaVu Sans (normal y negrita, Identity-H) en el documento. */
export function registerFonts(doc: jsPDF, regular: Uint8Array, bold: Uint8Array): void {
  doc.addFileToVFS('DejaVuSans.ttf', toBinaryString(regular));
  doc.addFont('DejaVuSans.ttf', FONT, 'normal', undefined, 'Identity-H');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', toBinaryString(bold));
  doc.addFont('DejaVuSans-Bold.ttf', FONT, 'bold', undefined, 'Identity-H');
}

// ───────── Anchos de columna (B-07) ─────────

/** Relleno horizontal de una celda (mm): 1 a cada lado más un margen para que la palabra no toque el borde. */
export const CELL_PAD = 2.6;
/** Un fragmento de una celda de datos de hasta esta longitud (un número, un id) tampoco debe partirse. */
const KEEP_WHOLE_MAX_CHARS = 14;

/**
 * Reparte `total` mm entre las columnas: proporcional a `weights`, pero ninguna menor que su mínimo (la palabra más larga
 * que no debe partirse). Si los mínimos no caben, se reducen todos en la misma proporción. La suma es siempre `total`.
 */
export function allocateColumnWidths(weights: number[], mins: number[], total: number): number[] {
  const n = weights.length;
  const minSum = mins.reduce((a, b) => a + b, 0);
  if (minSum >= total) return mins.map((m) => (m / minSum) * total);
  const widths = new Array<number>(n).fill(0);
  const fixed = new Array<boolean>(n).fill(false);
  for (let pass = 0; pass <= n; pass += 1) {
    const freeWeight = weights.reduce((a, w, i) => a + (fixed[i] ? 0 : w), 0);
    const freeTotal = total - widths.reduce((a, w, i) => a + (fixed[i] ? w : 0), 0);
    let changed = false;
    for (let i = 0; i < n; i += 1) {
      if (fixed[i]) continue;
      const w = freeWeight > 0 ? ((weights[i] as number) / freeWeight) * freeTotal : freeTotal / n;
      if (w < (mins[i] as number)) {
        widths[i] = mins[i] as number;
        fixed[i] = true;
        changed = true;
      } else widths[i] = w;
    }
    if (!changed) break;
  }
  return widths;
}

/**
 * Anchos de las columnas de una tabla, medidos con la fuente activa (DejaVu Sans). Cada columna es al menos tan ancha como
 * la palabra más larga de su cabecera (en negrita) y de los textos cortos de sus celdas, para no partir palabras.
 */
export function tableColumnWidths(doc: jsPDF, header: string[], rows: string[][], size: number, total: number = CONTENT_W): number[] {
  const weights = header.map((h, c) => Math.max(h.length * 0.9, ...rows.map((r) => (r[c] ?? '').length), 4));
  doc.setFontSize(size);
  const widest = (texts: string[], style: 'normal' | 'bold', onlyShort: boolean): number => {
    doc.setFont(FONT, style);
    let w = 0;
    for (const t of texts) for (const word of String(t).split(/\s+/)) if (word !== '' && (!onlyShort || word.length <= KEEP_WHOLE_MAX_CHARS)) w = Math.max(w, doc.getTextWidth(word));
    return w;
  };
  const mins = header.map((h, c) => Math.max(widest([h], 'bold', false), widest(rows.map((r) => r[c] ?? ''), 'normal', true)) + CELL_PAD);
  return allocateColumnWidths(weights, mins, total);
}

class Writer {
  y = MARGIN;

  constructor(readonly doc: jsPDF) {}

  font(style: 'normal' | 'bold', size: number): void {
    this.doc.setFont(FONT, style);
    this.doc.setFontSize(size);
  }

  ensure(h: number): void {
    if (this.y + h > BOTTOM) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  /** Ajusta a un ancho en mm; parte las palabras más largas que el ancho. */
  wrap(text: string, width: number): string[] {
    const out: string[] = [];
    for (const paragraph of String(text).split('\n')) {
      const lines = this.doc.splitTextToSize(paragraph === '' ? ' ' : paragraph, width) as string[];
      for (const line of lines) {
        if (this.doc.getTextWidth(line) <= width) {
          out.push(line);
          continue;
        }
        let cur = '';
        for (const ch of line) {
          if (this.doc.getTextWidth(cur + ch) > width && cur !== '') {
            out.push(cur);
            cur = ch;
          } else {
            cur += ch;
          }
        }
        if (cur !== '') out.push(cur);
      }
    }
    return out;
  }

  lineHeight(size: number): number {
    return size * 0.3528 * 1.35;
  }

  /** `keepWith`: alto (mm) que debe caber a continuación para no dejar el título huérfano al pie de página. */
  heading(text: string, keepWith = 25, size = 13): void {
    this.font('bold', size);
    const lines = this.wrap(text, CONTENT_W);
    const h = this.lineHeight(size) * lines.length;
    this.ensure(h + 8 + keepWith);
    this.y += 3;
    for (const line of lines) {
      this.y += this.lineHeight(size);
      this.doc.text(line, MARGIN, this.y - 1);
    }
    this.doc.setDrawColor(...P.headingRule);
    this.doc.setLineWidth(0.2);
    this.doc.line(MARGIN, this.y + 0.5, MARGIN + CONTENT_W, this.y + 0.5);
    this.y += 3;
  }

  paragraph(text: string, size = 10, style: 'normal' | 'bold' = 'normal'): void {
    this.font(style, size);
    const lh = this.lineHeight(size);
    for (const line of this.wrap(text, CONTENT_W)) {
      this.ensure(lh);
      this.y += lh;
      this.doc.text(line, MARGIN, this.y - 1);
    }
    this.y += 2;
  }

  kv(rows: [string, string][]): void {
    const size = 9.5;
    const labelW = 62;
    const lh = this.lineHeight(size);
    for (const [label, value] of rows) {
      this.font('bold', size);
      const l = this.wrap(label, labelW - 2);
      this.font('normal', size);
      const v = this.wrap(value, CONTENT_W - labelW);
      const n = Math.max(l.length, v.length);
      this.ensure(lh * n + 1);
      this.font('bold', size);
      l.forEach((t, i) => this.doc.text(t, MARGIN, this.y + lh * (i + 1) - 1));
      this.font('normal', size);
      v.forEach((t, i) => this.doc.text(t, MARGIN + labelW, this.y + lh * (i + 1) - 1));
      this.y += lh * n + 1;
    }
    this.y += 2;
  }

  table(header: string[], rows: string[][], title?: string): void {
    const size = 8.5;
    const lh = this.lineHeight(size);
    // Ancho de columna proporcional al contenido, pero nunca menor que la palabra más larga de la cabecera (B-07).
    const widths = tableColumnWidths(this.doc, header, rows, size);
    // El título, la cabecera y la primera fila van juntos: una cabecera sola al pie de la página, con sus filas en la siguiente, no se lee.
    const rowHeight = (cells: string[], bold: boolean): number => {
      this.font(bold ? 'bold' : 'normal', size);
      return lh * Math.max(...cells.map((c, i) => this.wrap(c, (widths[i] as number) - 2).length)) + 1.5;
    };
    this.ensure((title ? this.lineHeight(10) + 3 : 0) + rowHeight(header, true) + (rows[0] ? rowHeight(rows[0], false) : 0) + 1);
    if (title) this.paragraph(title, 10, 'bold');

    const drawRow = (cells: string[], bold: boolean, fill: boolean): void => {
      this.font(bold ? 'bold' : 'normal', size);
      const wrapped = cells.map((c, i) => this.wrap(c, (widths[i] as number) - 2));
      const n = Math.max(...wrapped.map((w) => w.length));
      const h = lh * n + 1.5;
      this.ensure(h);
      if (fill) {
        this.doc.setFillColor(...P.tableHeaderBg);
        this.doc.rect(MARGIN, this.y, CONTENT_W, h, 'F');
      }
      let x = MARGIN;
      wrapped.forEach((lines, i) => {
        lines.forEach((t, k) => this.doc.text(t, x + 1, this.y + lh * (k + 1) + 0.2));
        x += widths[i] as number;
      });
      this.doc.setDrawColor(...P.tableRule);
      this.doc.setLineWidth(0.15);
      this.doc.line(MARGIN, this.y + h, MARGIN + CONTENT_W, this.y + h);
      this.y += h;
    };

    this.doc.setDrawColor(...P.tableTopRule);
    this.doc.setLineWidth(0.3);
    this.doc.line(MARGIN, this.y, MARGIN + CONTENT_W, this.y);
    drawRow(header, true, true);
    for (const row of rows) drawRow(row, false, false);
    this.y += 4;
  }

  bullets(title: string, items: string[]): void {
    this.paragraph(title, 10, 'bold');
    const size = 9;
    const lh = this.lineHeight(size);
    for (const item of items) {
      this.font('normal', size);
      const lines = this.wrap(item, CONTENT_W - 4);
      this.ensure(lh * lines.length + 1);
      this.doc.text('•', MARGIN, this.y + lh - 1);
      lines.forEach((t, i) => this.doc.text(t, MARGIN + 4, this.y + lh * (i + 1) - 1));
      this.y += lh * lines.length + 1;
    }
    this.y += 2;
  }

  list(items: { severity: 'nota' | 'aviso'; label: string; text: string }[]): void {
    const size = 9.5;
    const lh = this.lineHeight(size);
    for (const item of items) {
      this.font('normal', size);
      const lines = this.wrap(`${item.severity === 'aviso' ? 'Aviso' : 'Nota'} · ${item.label}: ${item.text}`, CONTENT_W - 4);
      this.ensure(lh * lines.length + 1);
      this.doc.text('•', MARGIN, this.y + lh - 1);
      lines.forEach((t, i) => this.doc.text(t, MARGIN + 4, this.y + lh * (i + 1) - 1));
      this.y += lh * lines.length + 1;
    }
    this.y += 2;
  }

  /** Texto con halo blanco (R9-05a): ninguna cota ni rótulo se pierde sobre el arco crítico, las dovelas ni los materiales. */
  haloText(text: string, x: number, y: number, align: 'left' | 'center' | 'right' = 'left'): void {
    const doc = this.doc;
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.9);
    // Primero el halo (solo trazo) y encima el relleno: con `fillThenStroke` el trazo blanco de 0,9 mm cubre el relleno y el rótulo desaparece
    // (en el PDF de U6-G solo quedaban puntos). El texto va dos veces en el archivo, pero se lee una sola vez como texto seleccionable.
    doc.text(text, x, y, { align, renderingMode: 'stroke' });
    doc.text(text, x, y, { align, renderingMode: 'fill' });
    doc.setLineWidth(0.25);
    doc.setDrawColor(...P.frame);
  }

  /** Flecha de `(x1, y1)` a `(x2, y2)` en mm de página, con punta triangular rellena. */
  arrow(x1: number, y1: number, x2: number, y2: number, color: Rgb, width = 0.35): void {
    const doc = this.doc;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1e-6) return;
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    const head = Math.min(1.8, len * 0.45);
    const bx = x2 - ux * head;
    const by = y2 - uy * head;
    doc.setDrawColor(...color);
    doc.setFillColor(...color);
    doc.setLineWidth(width);
    doc.line(x1, y1, bx, by);
    doc.triangle(x2, y2, bx - uy * head * 0.4, by + ux * head * 0.4, bx + uy * head * 0.4, by - ux * head * 0.4, 'F');
  }

  drawing(d: SectionDrawing): void {
    const { xmin, xmax, ymin, ymax } = d.bounds;
    const doc = this.doc;
    const w = Math.max(xmax - xmin, 1e-9);
    const h = Math.max(ymax - ymin, 1e-9);
    const gutter = 19; // columna izquierda para las cotas de y: fuera del marco, nunca sobre el dibujo
    const maxH = 100;
    const ARROW_UDL = 7;
    const ARROW_LINE = 10;
    const LABEL_ROW = 3.6;

    // Franja libre sobre el terreno para cargas y sismo (R9-05a): arriba el indicador sísmico, debajo las cargas.
    const seismicHead = d.seismic ? 8 : 0;
    const loadHead = d.loads.length > 0 ? ARROW_LINE + 6 + (d.loads.length > 1 ? LABEL_ROW : 0) : 0;
    const head = seismicHead + loadHead;

    const scale = Math.min((CONTENT_W - gutter) / w, (maxH - head) / h);
    const drawW = w * scale;
    const drawH = h * scale + head;
    const legendH = d.legend.length * 5 + 4;
    this.ensure(drawH + legendH + 12);
    const x0 = MARGIN + gutter + (CONTENT_W - gutter - drawW) / 2;
    const y0 = this.y + 2;
    const sx = (x: number): number => x0 + (x - xmin) * scale;
    const sy = (y: number): number => y0 + head + (ymax - y) * scale;

    // Regiones.
    doc.setLineWidth(0.25);
    doc.setDrawColor(...P.regionEdge);
    for (const r of d.regions) {
      const first = r.polygon[0];
      if (!first || r.polygon.length < 3) continue;
      doc.setFillColor(...r.color);
      const rel: number[][] = [];
      for (let i = 1; i < r.polygon.length; i++) {
        const p = r.polygon[i] as [number, number];
        const q = r.polygon[i - 1] as [number, number];
        rel.push([(p[0] - q[0]) * scale, -(p[1] - q[1]) * scale]);
      }
      doc.lines(rel, sx(first[0]), sy(first[1]), [1, 1], 'FD', true);
    }

    // Agua embalsada (F5.3): relleno sobre el terreno y bajo la piezométrica, sin trazo propio (la limitan el terreno y la piezométrica).
    doc.setFillColor(...P.pond);
    for (const poly of d.pond) {
      const first = poly[0];
      if (!first || poly.length < 3) continue;
      const rel: number[][] = [];
      for (let i = 1; i < poly.length; i++) {
        const p = poly[i] as [number, number];
        const q = poly[i - 1] as [number, number];
        rel.push([(p[0] - q[0]) * scale, -(p[1] - q[1]) * scale]);
      }
      doc.lines(rel, sx(first[0]), sy(first[1]), [1, 1], 'F', true);
    }

    const polyline = (pts: [number, number][], color: Rgb, width: number, dash?: number[]): void => {
      const first = pts[0];
      if (!first || pts.length < 2) return;
      doc.setDrawColor(...color);
      doc.setLineWidth(width);
      if (dash) doc.setLineDashPattern(dash, 0);
      const rel: number[][] = [];
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i] as [number, number];
        const q = pts[i - 1] as [number, number];
        rel.push([(p[0] - q[0]) * scale, -(p[1] - q[1]) * scale]);
      }
      doc.lines(rel, sx(first[0]), sy(first[1]), [1, 1], 'S', false);
      if (dash) doc.setLineDashPattern([], 0);
    };

    // Dovelas, piezométrica (con su tramo extrapolado, más tenue) y superficie crítica, en ese orden de apilado.
    if (d.surface) {
      const sliceColor = d.legend.find((l) => l.kind === 'slices')?.color ?? [...P.slices];
      for (const [a, b] of d.surface.sliceLines) polyline([a, b], sliceColor, 0.12);
    }
    const piezoColor = d.legend.find((l) => l.kind === 'piezo')?.color ?? d.legend.find((l) => l.kind === 'piezo_ext')?.color ?? [...P.piezo];
    for (const seg of d.piezoExtension) polyline(seg, piezoColor, 0.5, [0.5, 1.3]);
    if (d.piezo) polyline(d.piezo, piezoColor, 0.5, [2, 1]);
    if (d.surface) polyline(d.surface.points, d.legend.find((l) => l.kind === 'surface')?.color ?? [...P.surface], 0.7);

    // Grieta de tracción (F5.4): línea discontinua en x_c, hueco de agua, flecha de Pw y rótulos, con la forma del lienzo (px → mm de página).
    if (d.crack) {
      const vpPx: Viewport = { scale: scale * PX_PER_MM, tx: -xmin * scale * PX_PER_MM, ty: ymax * scale * PX_PER_MM, width: drawW * PX_PER_MM, height: drawH * PX_PER_MM };
      const mm = (p: PxPoint): PxPoint => [x0 + p[0] / PX_PER_MM, y0 + head + p[1] / PX_PER_MM];
      const cs = crackShape(d.crack, vpPx, d.units);
      if (cs.water) {
        const [wx, wy] = mm([cs.water.x, cs.water.y]);
        doc.setFillColor(...P.pond);
        doc.setDrawColor(...P.piezo);
        doc.setLineWidth(0.2);
        doc.rect(wx, wy, cs.water.width / PX_PER_MM, cs.water.height / PX_PER_MM, 'FD');
      }
      const [tx, ty] = mm(cs.top);
      const [bx, by] = mm(cs.bottom);
      doc.setDrawColor(...P.surface);
      doc.setLineWidth(0.5);
      doc.setLineDashPattern([1.2, 0.9], 0);
      doc.line(tx, ty, bx, by);
      doc.setLineDashPattern([], 0);
      if (cs.arrow) {
        const [ax, ay] = mm(cs.arrow.at);
        const [hx, hy] = mm(cs.arrow.tip);
        this.arrow(ax, ay, hx, hy, [...P.piezo], 0.6);
      }
      this.font('normal', 6.5);
      const align = (a: 'start' | 'end'): 'left' | 'right' => (a === 'start' ? 'left' : 'right');
      const lab = (l: { x: number; y: number; text: string; anchor: 'start' | 'end' }, color: Rgb): void => {
        const [lx, ly] = mm([l.x, l.y]);
        doc.setTextColor(...color);
        this.haloText(l.text, lx, ly + 1, align(l.anchor));
      };
      lab(cs.depthLabel, [...P.surface]);
      if (cs.forceLabel) lab(cs.forceLabel, [...P.piezo]);
      doc.setTextColor(...P.ink);
    }

    // Refuerzos (v0.4): el símbolo de cada tipo y la flecha de cada fuerza, con la geometría del lienzo del editor (px → mm de página).
    if (d.reinforcements.length > 0) {
      const vpPx: Viewport = { scale: scale * PX_PER_MM, tx: -xmin * scale * PX_PER_MM, ty: ymax * scale * PX_PER_MM, width: drawW * PX_PER_MM, height: drawH * PX_PER_MM };
      const mm = (p: PxPoint): PxPoint => [x0 + p[0] / PX_PER_MM, y0 + head + p[1] / PX_PER_MM];
      const partMm = (part: ShapePart, color: Rgb, extra: number): void => {
        doc.setDrawColor(...color);
        doc.setFillColor(...color);
        doc.setLineWidth((part.width + extra) / PX_PER_MM);
        if (part.kind === 'circle') {
          const [cx, cy] = mm([part.cx, part.cy]);
          doc.circle(cx, cy, part.r / PX_PER_MM, part.fill && extra === 0 ? 'FD' : 'S');
          return;
        }
        const first = part.pts[0];
        if (!first || part.pts.length < 2) return;
        const [fx0, fy0] = mm(first);
        const rel: number[][] = [];
        for (let i = 1; i < part.pts.length; i++) {
          const a = mm(part.pts[i] as PxPoint);
          const b = mm(part.pts[i - 1] as PxPoint);
          rel.push([a[0] - b[0], a[1] - b[1]]);
        }
        doc.lines(rel, fx0, fy0, [1, 1], part.fill && part.closed && extra === 0 ? 'FD' : 'S', Boolean(part.closed));
      };
      doc.setLineCap('round');
      doc.setLineJoin('round');
      const refShapes = reinforcementShapes(d.reinforcements, vpPx, d.units);
      for (const rs of refShapes) for (const part of rs.parts) partMm(part, [255, 255, 255], 1.6);
      for (const rs of refShapes) for (const part of rs.parts) partMm(part, [...P.reinforcement], 0);
      doc.setLineCap('butt');
      doc.setLineJoin('miter');
      // Flechas y marcas de las fuerzas; los rótulos (de las fuerzas y de los símbolos) se colocan después, sin solaparse.
      const labels: { text: string; x: number; y: number; color: Rgb }[] = [];
      for (const fs of forceShapes(d.forces, vpPx, d.units)) {
        const [ax, ay] = mm(fs.at);
        const color: Rgb = fs.applied ? [...P.reinforcement] : [...P.inkMuted];
        if (fs.tip) {
          const [tx, ty] = mm(fs.tip);
          this.arrow(ax, ay, tx, ty, color, 0.6);
        } else {
          doc.setDrawColor(...color);
          doc.setLineWidth(0.5);
          doc.line(ax - 1.4, ay - 1.4, ax + 1.4, ay + 1.4);
          doc.line(ax - 1.4, ay + 1.4, ax + 1.4, ay - 1.4);
        }
        const [lx, ly] = mm([fs.label.x, fs.label.y]);
        labels.push({ text: fs.label.text, x: lx, y: ly, color });
      }
      for (const rs of refShapes) {
        const [lx, ly] = mm([rs.label.x, rs.label.y]);
        labels.push({ text: rs.label.text, x: lx, y: ly, color: [...P.reinforcement] });
      }
      this.font('normal', 6.5);
      const boxes: { x1: number; x2: number; y1: number; y2: number }[] = [];
      const top = y0 + head + 2.6;
      const bottom = y0 + drawH - 1;
      for (const l of labels) {
        const half = doc.getTextWidth(l.text) / 2;
        const cx = Math.min(Math.max(l.x, x0 + half + 1), x0 + drawW - half - 1);
        let placed: { x1: number; x2: number; y1: number; y2: number; y: number } | null = null;
        // Prueba el sitio natural y después desplazamientos verticales alternos de 3 mm hasta no pisar otro rótulo.
        for (let k = 0; k < 14 && !placed; k += 1) {
          const dy = (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * 3;
          const y = Math.min(Math.max(l.y + dy, top), bottom);
          const box = { x1: cx - half - 0.5, x2: cx + half + 0.5, y1: y - 2.6, y2: y + 0.8 };
          if (!boxes.some((b) => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1)) placed = { ...box, y };
        }
        const at = placed ?? { x1: cx - half, x2: cx + half, y1: l.y - 2.6, y2: l.y + 0.8, y: l.y };
        boxes.push(at);
        doc.setTextColor(...l.color);
        this.haloText(l.text, cx, at.y, 'center');
      }
      doc.setTextColor(...P.ink);
    }

    // Cargas de superficie: flechas sobre el terreno y rótulo con su unidad. Los rótulos se reparten en dos filas si chocan.
    this.font('normal', 7.5);
    const labelBoxes: { x1: number; x2: number; row: number }[] = [];
    // Los rótulos se dibujan al final: el halo tapa la flecha de otra carga que los cruce (la flecha de `p` cruzaba el rótulo de `q`).
    const pendingLabels: (() => void)[] = [];
    const placeLabel = (text: string, cx: number, tailY: number): void => {
      const half = doc.getTextWidth(text) / 2;
      const cxc = Math.min(Math.max(cx, x0 + half + 1), x0 + drawW - half - 1);
      let row = 0;
      while (labelBoxes.some((b) => b.row === row && cxc - half < b.x2 + 1 && cxc + half > b.x1 - 1)) row += 1;
      labelBoxes.push({ x1: cxc - half, x2: cxc + half, row });
      pendingLabels.push(() => {
        doc.setTextColor(...P.load);
        this.haloText(text, cxc, tailY - 1.5 - row * LABEL_ROW, 'center');
      });
    };
    for (const load of d.loads) {
      if (load.kind === 'udl') {
        const ground = load.ground;
        const groundAt = (x: number): number => {
          for (let i = 1; i < ground.length; i++) {
            const a = ground[i - 1] as Point;
            const b = ground[i] as Point;
            if (x <= b[0] || i === ground.length - 1) return b[0] === a[0] ? b[1] : a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
          }
          return (ground[0] as Point)[1];
        };
        const topY = Math.max(...ground.map((p) => p[1]));
        const tailY = sy(topY) - ARROW_UDL;
        const pxW = (load.x2 - load.x1) * scale;
        const n = Math.min(40, Math.max(2, Math.round(pxW / 6) + 1));
        for (let i = 0; i < n; i++) {
          const x = load.x1 + ((load.x2 - load.x1) * i) / (n - 1);
          this.arrow(sx(x), tailY, sx(x), sy(groundAt(x)), P.load);
        }
        doc.setLineWidth(0.35);
        doc.setDrawColor(...P.load);
        doc.line(sx(load.x1), tailY, sx(load.x2), tailY);
        placeLabel(load.label, (sx(load.x1) + sx(load.x2)) / 2, tailY);
      } else {
        const th = (load.angle * Math.PI) / 180;
        const tipX = sx(load.x);
        const tipY = sy(load.yTop);
        const tailX = tipX - Math.sin(th) * ARROW_LINE;
        const tailY = tipY - Math.cos(th) * ARROW_LINE;
        this.arrow(tailX, tailY, tipX, tipY, P.load, 0.6);
        placeLabel(load.label, tailX, tailY);
      }
    }

    for (const draw of pendingLabels) draw();

    // Indicador sísmico: flechas de kh (en el sentido del deslizamiento) y de kv (kv > 0 hacia abajo) con su texto, arriba a la derecha.
    if (d.seismic) {
      const s = d.seismic;
      doc.setTextColor(...P.seismic);
      this.font('normal', 7.5);
      const right = x0 + drawW - 2;
      const baseY = y0 + 5.2;
      const top = y0 + 1.2;
      const bottom = y0 + 6;
      this.haloText(s.label, right, baseY, 'right');
      const tw = doc.getTextWidth(s.label);
      let ax = right - tw - 3;
      if (s.kv !== 0) {
        if (s.kv > 0) this.arrow(ax - 1, top, ax - 1, bottom, P.seismic, 0.5);
        else this.arrow(ax - 1, bottom, ax - 1, top, P.seismic, 0.5);
        ax -= 4;
      }
      if (s.kh > 0) {
        const x1 = s.dir === 1 ? ax - 9 : ax;
        const x2 = s.dir === 1 ? ax : ax - 9;
        this.arrow(x1, y0 + 3.6, x2, y0 + 3.6, P.seismic, 0.5);
      }
    }

    // Marco y cotas (con unidad) fuera del marco: x abajo, y en la columna izquierda.
    doc.setDrawColor(...P.frame);
    doc.setLineWidth(0.25);
    doc.rect(x0, y0, drawW, drawH, 'S');
    this.font('normal', 7.5);
    doc.setTextColor(...P.inkMuted);
    const num = (n: number): string => n.toFixed(2).replace('.', ',');
    doc.text(`x = ${num(xmin)} ${d.unit}`, x0, y0 + drawH + 3.5);
    doc.text(`x = ${num(xmax)} ${d.unit}`, x0 + drawW, y0 + drawH + 3.5, { align: 'right' });
    doc.text(`y = ${num(ymax)} ${d.unit}`, x0 - 2.5, sy(ymax) + 1, { align: 'right' });
    doc.text(`y = ${num(ymin)} ${d.unit}`, x0 - 2.5, y0 + drawH + 1, { align: 'right' });
    doc.setDrawColor(...P.frame);
    doc.line(x0 - 1.5, sy(ymax), x0, sy(ymax));
    doc.line(x0 - 1.5, y0 + drawH, x0, y0 + drawH);
    doc.setTextColor(...P.ink);
    this.y = y0 + drawH + 7;

    // Leyenda.
    this.font('normal', 8.5);
    for (const item of d.legend) {
      this.ensure(5);
      if (item.kind === 'material') {
        doc.setFillColor(...item.color);
        doc.setDrawColor(...P.regionEdge);
        doc.setLineWidth(0.2);
        doc.rect(MARGIN, this.y, 6, 3.4, 'FD');
      } else if (item.kind === 'reinforcement') {
        doc.setDrawColor(...item.color);
        doc.setFillColor(...item.color);
        doc.setLineWidth(0.5);
        doc.line(MARGIN, this.y + 1.7, MARGIN + 6, this.y + 1.7);
        doc.rect(MARGIN - 0.2, this.y + 0.9, 1.6, 1.6, 'F');
      } else if (item.kind === 'pond') {
        doc.setFillColor(...item.color);
        doc.setDrawColor(...P.piezo);
        doc.setLineWidth(0.2);
        doc.rect(MARGIN, this.y, 6, 3.4, 'FD');
      } else if (item.kind === 'crack') {
        doc.setDrawColor(...item.color);
        doc.setLineWidth(0.5);
        doc.setLineDashPattern([1.2, 0.9], 0);
        doc.line(MARGIN, this.y + 1.7, MARGIN + 6, this.y + 1.7);
        doc.setLineDashPattern([], 0);
      } else if (item.kind === 'force') {
        this.arrow(MARGIN, this.y + 1.7, MARGIN + 6, this.y + 1.7, item.color, 0.6);
      } else if (item.kind === 'force_off') {
        doc.setDrawColor(...item.color);
        doc.setLineWidth(0.5);
        doc.line(MARGIN + 1.5, this.y + 0.2, MARGIN + 4.5, this.y + 3.2);
        doc.line(MARGIN + 1.5, this.y + 3.2, MARGIN + 4.5, this.y + 0.2);
      } else {
        doc.setDrawColor(...item.color);
        doc.setLineWidth(item.kind === 'slices' ? 0.2 : item.kind === 'piezo_ext' ? 0.5 : 0.7);
        if (item.kind === 'piezo') doc.setLineDashPattern([2, 1], 0);
        if (item.kind === 'piezo_ext') doc.setLineDashPattern([0.5, 1.3], 0);
        doc.line(MARGIN, this.y + 1.7, MARGIN + 6, this.y + 1.7);
        doc.setLineDashPattern([], 0);
      }
      doc.text(item.label, MARGIN + 9, this.y + 2.8);
      this.y += 5;
    }
    this.y += 2;
  }

  block(b: ReportBlock): void {
    switch (b.kind) {
      case 'kv':
        this.kv(b.rows);
        break;
      case 'table':
        this.table(b.header, b.rows, b.title);
        break;
      case 'paragraph':
        this.paragraph(b.text);
        break;
      case 'bullets':
        this.bullets(b.title, b.items);
        break;
      case 'list':
        this.list(b.items);
        break;
      case 'drawing':
        this.drawing(b.drawing);
        break;
    }
  }
}

function draw(doc: jsPDF, content: ReportContent): void {
  const w = new Writer(doc);
  let number = 0;
  content.sections.forEach((section: ReportSection) => {
    if (section.id === 'cover') {
      w.font('bold', 18);
      for (const line of w.wrap(content.title, CONTENT_W)) {
        w.y += 8;
        doc.text(line, MARGIN, w.y);
      }
      w.y += 2;
      w.paragraph(section.title, 11);
    } else {
      number += 1;
      w.heading(`${number}. ${section.title}`, section.id === 'section' ? 135 : 25);
    }
    for (const b of section.blocks) w.block(b);
  });

  // Pie de página.
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...P.inkMuted);
    doc.text(`OpenGeoSlide · ${content.title}`, MARGIN, PAGE_H - 9);
    doc.text(`Página ${p} de ${total}`, PAGE_W - MARGIN, PAGE_H - 9, { align: 'right' });
    doc.setTextColor(...P.ink);
  }
}

/** Genera el PDF. `jspdf` y las fuentes se cargan aquí, no al arrancar la aplicación. */
export async function buildReportPdfWith(input: ReportInput, options: BuildPdfOptions = {}): Promise<Blob> {
  const loadFont = options.loadFont ?? fetchFont;
  const [{ jsPDF: JsPdf }, regular, bold] = await Promise.all([
    import('jspdf'),
    loadFont('DejaVuSans.ttf'),
    loadFont('DejaVuSans-Bold.ttf'),
  ]);

  const content = buildReportContent(input);
  const doc = new JsPdf({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: options.compress ?? true });
  registerFonts(doc, regular, bold);
  doc.setProperties({ title: content.title, subject: 'Informe de estabilidad de taludes', creator: 'OpenGeoSlide' });

  draw(doc, content);
  return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
}

/** Firma del contrato `BuildReportPdf`: carga las fuentes con `fetch` desde `public/fonts/`. */
export const buildReportPdf: BuildReportPdf = (input) => buildReportPdfWith(input);
