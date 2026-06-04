import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function usage() {
  console.error("Usage: node scripts/render-md-to-pdf.mjs <input.md> <output.pdf>");
  process.exit(2);
}

function mdToPlainText(md) {
  const text = (
    md
      // remove code fences but keep content
      .replace(/```[\s\S]*?```/g, (block) =>
        block.replace(/^```[^\n]*\n/, "").replace(/\n```$/, "")
      )
      // headings
      .replace(/^#{1,6}\s+/gm, "")
      // bold/italics
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      // inline code
      .replace(/`([^`]+)`/g, "$1")
      // links [text](url) -> text (url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
      // tidy bullets
      .replace(/^\s*-\s+/gm, "• ")
      .replace(/\r\n/g, "\n")
  );

  // Standard PDF fonts can't encode many Unicode chars.
  // Normalize a few common ones and strip the rest.
  return text
    .replaceAll("→", "->")
    .replaceAll("•", "*")
    .replaceAll("—", "-")
    .replaceAll("✓", "OK")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function wrapLine(line, maxLen) {
  if (line.length <= maxLen) return [line];
  const out = [];
  let cur = line;
  while (cur.length > maxLen) {
    let cut = cur.lastIndexOf(" ", maxLen);
    if (cut <= 0) cut = maxLen;
    out.push(cur.slice(0, cut).trimEnd());
    cur = cur.slice(cut).trimStart();
  }
  if (cur.length) out.push(cur);
  return out;
}

async function main() {
  const [, , input, output] = process.argv;
  if (!input || !output) usage();

  const md = fs.readFileSync(input, "utf8");
  const text = mdToPlainText(md);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageSize = { width: 612, height: 792 }; // US Letter
  const margin = { left: 48, right: 48, top: 54, bottom: 54 };
  const fontSize = 11;
  const lineHeight = 15;
  const maxWidth = pageSize.width - margin.left - margin.right;

  const approxCharWidth = font.widthOfTextAtSize("abcdefghijklmnopqrstuvwxyz", fontSize) / 26;
  const maxChars = Math.max(40, Math.floor(maxWidth / approxCharWidth));

  let page = pdf.addPage([pageSize.width, pageSize.height]);
  let y = pageSize.height - margin.top;

  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const isSectionBreak = raw.trim() === "";
    const toDraw = isSectionBreak ? [""] : wrapLine(raw, maxChars);

    for (const l of toDraw) {
      if (y < margin.bottom + lineHeight) {
        page = pdf.addPage([pageSize.width, pageSize.height]);
        y = pageSize.height - margin.top;
      }

      // Simple emphasis: lines that look like titles in the original md
      const looksLikeTitle =
        raw.startsWith("Dental Booking Platform") ||
        raw.startsWith("Goal") ||
        raw.startsWith("Tenancy model") ||
        raw.startsWith("System-of-record") ||
        raw.startsWith("V1 product scope") ||
        raw.startsWith("Architecture") ||
        raw.startsWith("Voice/AI layers");

      page.drawText(l, {
        x: margin.left,
        y,
        size: fontSize,
        font: looksLikeTitle && l.trim().length ? fontBold : font,
        color: rgb(0, 0, 0),
      });
      y -= lineHeight;
    }
  }

  const bytes = await pdf.save();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, bytes);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

