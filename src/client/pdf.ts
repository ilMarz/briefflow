import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { Report } from "./report";

const PAGE: [number, number] = [595.28, 841.89];
const M = 48;
const W = PAGE[0] - 2 * M;

const color = {
  ink: rgb(0.09, 0.14, 0.17),
  muted: rgb(0.36, 0.42, 0.46),
  line: rgb(0.84, 0.87, 0.89),
  navy: rgb(0.06, 0.12, 0.16),
  accent: rgb(0.12, 0.48, 0.57),
  tint: rgb(0.93, 0.96, 0.97),
  white: rgb(1, 1, 1),
  ok: rgb(0.12, 0.48, 0.33),
  warn: rgb(0.62, 0.4, 0.02),
  neutral: rgb(0.36, 0.42, 0.46),
};

// Standard PDF fonts only encode WinAnsi: anything else is replaced so saving never throws.
const ENCODABLE = /[ -~ -ÿ€–—‘’“”•…]/;
function safe(text: string) {
  return Array.from(text.replace(/→/g, ">").replace(/\s+/g, " "))
    .map((ch) => (ENCODABLE.test(ch) ? ch : "?"))
    .join("");
}

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(
    readonly doc: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
  ) {
    this.addPage();
  }

  addPage() {
    this.page = this.doc.addPage(PAGE);
    this.y = PAGE[1] - M;
  }

  ensure(height: number) {
    if (this.y - height < M + 24) this.addPage();
  }

  wrap(text: string, font: PDFFont, size: number, width: number) {
    const lines: string[] = [];
    let line = "";
    for (const word of safe(text).split(" ")) {
      let rest = word;
      // Break words that are wider than the column.
      while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width)
          cut--;
        if (line) {
          lines.push(line);
          line = "";
        }
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      const next = line ? `${line} ${rest}` : rest;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else {
        if (line) lines.push(line);
        line = rest;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  paragraph(
    text: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      x?: number;
      width?: number;
      lead?: number;
      bar?: boolean;
    } = {},
  ) {
    const size = opts.size ?? 10.5;
    const font = opts.bold ? this.bold : this.regular;
    const x = opts.x ?? M;
    const width = opts.width ?? W;
    const lead = size * (opts.lead ?? 1.4);
    for (const line of this.wrap(text, font, size, width)) {
      this.ensure(lead);
      if (opts.bar)
        this.page.drawRectangle({
          x: x - 10,
          y: this.y - lead + 2,
          width: 2,
          height: lead,
          color: color.line,
        });
      this.page.drawText(line, {
        x,
        y: this.y - size,
        size,
        font,
        color: opts.color ?? color.ink,
      });
      this.y -= lead;
    }
  }

  gap(points: number) {
    this.y -= points;
  }

  heading(text: string, room = 46) {
    this.ensure(room);
    this.y -= 14;
    this.page.drawText(safe(text.toUpperCase()), {
      x: M,
      y: this.y - 9,
      size: 9,
      font: this.bold,
      color: color.accent,
    });
    this.y -= 16;
    this.page.drawLine({
      start: { x: M, y: this.y },
      end: { x: M + W, y: this.y },
      thickness: 0.6,
      color: color.line,
    });
    this.y -= 10;
  }

  rule() {
    this.page.drawLine({
      start: { x: M, y: this.y },
      end: { x: M + W, y: this.y },
      thickness: 0.4,
      color: color.line,
    });
  }

  /** Draws text at a fixed column inside a row that starts at `top`. */
  cell(
    page: PDFPage,
    text: string,
    x: number,
    top: number,
    width: number,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
  ) {
    const size = opts.size ?? 9.5;
    const font = opts.bold ? this.bold : this.regular;
    const lead = size * 1.35;
    const lines = this.wrap(text, font, size, width);
    lines.forEach((line, i) =>
      page.drawText(line, {
        x,
        y: top - size - i * lead,
        size,
        font,
        color: opts.color ?? color.ink,
      }),
    );
    return lines.length * lead;
  }
}

const toneColor = (tone: Report["tone"]) => color[tone];

export async function reportToPdf(report: Report): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(safe(`BriefFlow - ${report.headline}`));
  doc.setCreator("BriefFlow");
  doc.setProducer("BriefFlow");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, regular, bold);

  // Header band
  w.page.drawRectangle({
    x: 0,
    y: PAGE[1] - 64,
    width: PAGE[0],
    height: 64,
    color: color.navy,
  });
  w.page.drawText("BriefFlow", {
    x: M,
    y: PAGE[1] - 40,
    size: 19,
    font: bold,
    color: color.white,
  });
  const title = "Scheda di qualificazione";
  w.page.drawText(title, {
    x: PAGE[0] - M - regular.widthOfTextAtSize(title, 10),
    y: PAGE[1] - 36,
    size: 10,
    font: regular,
    color: color.white,
  });
  if (report.meta.date) {
    const date = safe(
      new Date(report.meta.date).toLocaleString("it-IT", {
        dateStyle: "long",
        timeStyle: "short",
      }),
    );
    w.page.drawText(date, {
      x: PAGE[0] - M - regular.widthOfTextAtSize(date, 8.5),
      y: PAGE[1] - 50,
      size: 8.5,
      font: regular,
      color: rgb(0.7, 0.78, 0.82),
    });
  }
  w.y = PAGE[1] - 64 - 30;

  // Verdict and headline
  const pillText = safe(report.verdict.toUpperCase());
  const pillWidth = bold.widthOfTextAtSize(pillText, 8.5) + 18;
  w.page.drawRectangle({
    x: M,
    y: w.y - 16,
    width: pillWidth,
    height: 18,
    color: toneColor(report.tone),
  });
  w.page.drawText(pillText, {
    x: M + 9,
    y: w.y - 10.5,
    size: 8.5,
    font: bold,
    color: color.white,
  });
  w.y -= 30;
  w.paragraph(report.headline, { size: 21, bold: true, lead: 1.25 });
  w.gap(6);
  w.paragraph(report.explanation, { size: 11, color: color.muted });
  w.gap(12);

  // Next step box
  const boxLines = w.wrap(report.nextStep, bold, 10.5, W - 32);
  const boxHeight = 22 + boxLines.length * 14.5;
  w.ensure(boxHeight + 6);
  w.page.drawRectangle({
    x: M,
    y: w.y - boxHeight,
    width: W,
    height: boxHeight,
    color: color.tint,
  });
  w.page.drawRectangle({
    x: M,
    y: w.y - boxHeight,
    width: 3,
    height: boxHeight,
    color: color.accent,
  });
  w.page.drawText("PROSSIMO PASSO", {
    x: M + 16,
    y: w.y - 16,
    size: 7.5,
    font: bold,
    color: color.accent,
  });
  boxLines.forEach((line, i) =>
    w.page.drawText(line, {
      x: M + 16,
      y: w.y - 31 - i * 14.5,
      size: 10.5,
      font: bold,
      color: color.ink,
    }),
  );
  w.y -= boxHeight + 10;

  // Key facts, two per row
  w.heading("In sintesi");
  const colWidth = W / 2;
  for (let i = 0; i < report.facts.length; i += 2) {
    const row = report.facts.slice(i, i + 2);
    const lines = Math.max(
      ...row.map((f) => w.wrap(f.value, bold, 11.5, colWidth - 14).length),
    );
    const height = 14 + lines * 15.5 + 8;
    w.ensure(height);
    row.forEach((fact, c) => {
      const x = M + c * colWidth;
      w.page.drawText(safe(fact.label.toUpperCase()), {
        x,
        y: w.y - 8,
        size: 7.5,
        font: regular,
        color: color.muted,
      });
      w.cell(w.page, fact.value, x, w.y - 12, colWidth - 14, {
        size: 11.5,
        bold: true,
      });
    });
    w.y -= height;
  }

  // Original request
  if (report.brief) {
    w.heading("Richiesta del cliente");
    w.paragraph(report.brief, {
      size: 10.5,
      color: color.muted,
      x: M + 12,
      width: W - 12,
      bar: true,
    });
  }

  // Required information
  w.heading("Informazioni richieste");
  const stateColor = {
    answer: color.accent,
    brief: color.muted,
    missing: color.warn,
  };
  for (const field of report.fields) {
    const valueLines = w.wrap(field.value, regular, 10, W - 230).length;
    const height = Math.max(24, 10 + valueLines * 13.5);
    w.ensure(height);
    w.cell(w.page, field.label, M, w.y - 5, 120, { size: 10, bold: true });
    w.cell(w.page, field.statusLabel, M + 125, w.y - 5, 95, {
      size: 9,
      bold: true,
      color: stateColor[field.status],
    });
    w.cell(w.page, field.value, M + 230, w.y - 5, W - 230, { size: 10 });
    w.y -= height;
    w.rule();
  }

  // Attention points
  if (report.attention.length) {
    w.heading("Punti di attenzione");
    for (const group of report.attention) {
      w.paragraph(group.label, { size: 10, bold: true });
      for (const item of group.items)
        w.paragraph(`•  ${item}`, { size: 10, x: M + 10, width: W - 10 });
      w.gap(6);
    }
  }

  // Path
  if (report.steps.length) {
    w.heading("Percorso seguito", 120);
    for (const [index, step] of report.steps.entries()) {
      const label = step.visit > 1 ? `${step.label} (visita ${step.visit})` : step.label;
      const lines = Math.max(
        w.wrap(label, bold, 9.5, 170).length,
        w.wrap(step.decision ?? "", regular, 9, W - 300).length,
      );
      const height = Math.max(22, 9 + lines * 13);
      w.ensure(height);
      w.cell(w.page, String(index + 1), M, w.y - 5, 20, {
        size: 9,
        color: color.accent,
        bold: true,
      });
      w.cell(w.page, label, M + 24, w.y - 5, 170, { size: 9.5, bold: true });
      w.cell(w.page, step.kind, M + 200, w.y - 5, 50, {
        size: 9,
        color: color.muted,
      });
      w.cell(w.page, step.ms !== undefined ? `${step.ms} ms` : "-", M + 252, w.y - 5, 40, {
        size: 9,
        color: color.muted,
      });
      if (step.decision)
        w.cell(w.page, step.decision, M + 300, w.y - 5, W - 300, { size: 9 });
      w.y -= height;
      w.rule();
    }
    if (report.totalMs > 0) {
      w.gap(6);
      w.paragraph(`Tempo totale di elaborazione: ${report.totalMs} ms`, {
        size: 9.5,
        color: color.muted,
      });
    }
  }

  // References
  w.heading("Riferimenti");
  const refs = [
    ["Profilo", `${report.meta.profile} (v${report.meta.profileVersion})`],
    ["Modello Jev", report.meta.model],
    ...(report.meta.runId ? [["Run", report.meta.runId]] : []),
  ];
  for (const [label, value] of refs) {
    w.ensure(18);
    w.cell(w.page, label, M, w.y - 2, 90, { size: 9, color: color.muted });
    w.cell(w.page, value, M + 95, w.y - 2, W - 95, { size: 9 });
    w.y -= 16;
  }
  w.gap(8);
  w.paragraph(
    "Le decisioni sono prodotte da Jev su criteri strutturati; domande e testi di questa scheda provengono da modelli predefiniti.",
    { size: 8.5, color: color.muted },
  );

  // Footer with page numbers
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    page.drawLine({
      start: { x: M, y: M - 6 },
      end: { x: M + W, y: M - 6 },
      thickness: 0.4,
      color: color.line,
    });
    page.drawText(safe(`BriefFlow · ${report.meta.profile}`), {
      x: M,
      y: M - 20,
      size: 8,
      font: regular,
      color: color.muted,
    });
    const label = `Pagina ${i + 1} di ${pages.length}`;
    page.drawText(label, {
      x: PAGE[0] - M - regular.widthOfTextAtSize(label, 8),
      y: M - 20,
      size: 8,
      font: regular,
      color: color.muted,
    });
  });

  return doc.save();
}

export async function downloadReportPdf(report: Report) {
  const bytes = await reportToPdf(report);
  const url = URL.createObjectURL(
    new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `briefflow-scheda${report.meta.runId ? `-${report.meta.runId.slice(0, 8)}` : ""}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
