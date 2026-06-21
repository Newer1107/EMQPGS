import fs from "node:fs";
import path from "node:path";

const CANDIDATES = ["tcet-header.png", "tcet-header.webp", "tcet-header.jpg", "tcet-header.jpeg"];

export type HeaderInfo = {
  buffer: Buffer;
  docxType: "jpg" | "png" | "gif" | "bmp";
};

export function loadHeader(templatesDir: string): HeaderInfo | null {
  let filePath: string | null = null;
  for (const name of CANDIDATES) {
    const p = path.join(templatesDir, name);
    try {
      if (fs.statSync(p).isFile()) {
        filePath = p;
        break;
      }
    } catch { /* try next */ }
  }
  if (!filePath) return null;

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".png") return { buffer, docxType: "png" };
  if (ext === ".jpg" || ext === ".jpeg") return { buffer, docxType: "jpg" };
  if (ext === ".gif") return { buffer, docxType: "gif" };
  if (ext === ".bmp") return { buffer, docxType: "bmp" };

  if (ext === ".webp") {
    return { buffer, docxType: "png" };
  }

  return null;
}
