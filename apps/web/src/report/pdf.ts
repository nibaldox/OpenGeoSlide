// Informe PDF con jsPDF 4.2.1 (carga diferida) y DejaVu Sans embebida (Identity-H, TrueType).
//
// `jspdf` se importa con `await import('jspdf')` al generar el informe: no entra en el bundle inicial. La fuente
// (`public/fonts/`) se descarga solo entonces. El texto sale codificado con la fuente (glifos Unicode), así que φ, γ,
// ≤, á, ñ, ° y ³ se imprimen bien; con una fuente estándar de jsPDF saldrían bytes que no son WinAnsi (X3 §1.4).
// La sección se dibuja en vectorial: regiones, piezométrica, superficie crítica y dovelas.

import type { jsPDF } from 'jspdf';
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

/** Descarga la fuente desde `public/fonts/` respetando la base de Vite. */
export const fetchFont: FontLoader = async (file) => {
  const res = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`);
  if (!res.ok) throw new Error(`No se pudo cargar la fuente ${file} (HTTP ${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
};

function toBinaryString(bytes: Uint8Array): string {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return out;
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
    if (title) this.paragraph(title, 10, 'bold');
    // Ancho de columna proporcional al contenido (con un mínimo).
    const weights = header.map((h, c) => Math.max(h.length * 0.9, ...rows.map((r) => (r[c] ?? '').length), 4));
    const total = weights.reduce((a, b) => a + b, 0);
    const widths = weights.map((w) => (w / total) * CONTENT_W);

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

  drawing(d: SectionDrawing): void {
    const { xmin, xmax, ymin, ymax } = d.bounds;
    const w = Math.max(xmax - xmin, 1e-9);
    const h = Math.max(ymax - ymin, 1e-9);
    const maxH = 95;
    const scale = Math.min(CONTENT_W / w, maxH / h);
    const drawW = w * scale;
    const drawH = h * scale;
    const legendH = d.legend.length * 5 + 4;
    this.ensure(drawH + legendH + 12);
    const x0 = MARGIN + (CONTENT_W - drawW) / 2;
    const y0 = this.y + 2;
    const sx = (x: number): number => x0 + (x - xmin) * scale;
    const sy = (y: number): number => y0 + (ymax - y) * scale;
    const doc = this.doc;

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

    // Dovelas, piezométrica y superficie crítica (en ese orden de apilado).
    if (d.surface) {
      const sliceColor = d.legend.find((l) => l.kind === 'slices')?.color ?? [...P.slices];
      for (const [a, b] of d.surface.sliceLines) polyline([a, b], sliceColor, 0.12);
    }
    if (d.piezo) polyline(d.piezo, d.legend.find((l) => l.kind === 'piezo')?.color ?? [...P.piezo], 0.5, [2, 1]);
    if (d.surface) polyline(d.surface.points, d.legend.find((l) => l.kind === 'surface')?.color ?? [...P.surface], 0.7);

    // Marco y extremos de los ejes.
    doc.setDrawColor(...P.frame);
    doc.setLineWidth(0.25);
    doc.rect(x0, y0, drawW, drawH, 'S');
    this.font('normal', 7.5);
    doc.setTextColor(...P.inkMuted);
    doc.text(`x = ${xmin.toFixed(2).replace('.', ',')}`, x0, y0 + drawH + 3.5);
    doc.text(`x = ${xmax.toFixed(2).replace('.', ',')}`, x0 + drawW, y0 + drawH + 3.5, { align: 'right' });
    doc.text(`y = ${ymax.toFixed(2).replace('.', ',')}`, x0 + 1, y0 + 3);
    doc.text(`y = ${ymin.toFixed(2).replace('.', ',')}`, x0 + 1, y0 + drawH - 1);
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
      } else {
        doc.setDrawColor(...item.color);
        doc.setLineWidth(item.kind === 'slices' ? 0.2 : 0.7);
        if (item.kind === 'piezo') doc.setLineDashPattern([2, 1], 0);
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
      w.heading(`${number}. ${section.title}`, section.id === 'section' ? 120 : 25);
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
  doc.addFileToVFS('DejaVuSans.ttf', toBinaryString(regular));
  doc.addFont('DejaVuSans.ttf', FONT, 'normal', undefined, 'Identity-H');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', toBinaryString(bold));
  doc.addFont('DejaVuSans-Bold.ttf', FONT, 'bold', undefined, 'Identity-H');
  doc.setProperties({ title: content.title, subject: 'Informe de estabilidad de taludes', creator: 'OpenGeoSlide' });

  draw(doc, content);
  return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
}

/** Firma del contrato `BuildReportPdf`: carga las fuentes con `fetch` desde `public/fonts/`. */
export const buildReportPdf: BuildReportPdf = (input) => buildReportPdfWith(input);
