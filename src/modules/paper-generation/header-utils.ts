import fs from "node:fs";

const ASSETS_DIR = "src/modules/paper-generation/assets";
const PRIMARY = `${ASSETS_DIR}/tcet-header.png`;
const FALLBACKS = [".webp", ".jpg", ".jpeg"];

export type HeaderInfo = {
  buffer: Buffer;
  docxType: "jpg" | "png" | "gif" | "bmp";
};

export function loadHeader(): HeaderInfo | null {
  try {
    if (fs.statSync(PRIMARY).isFile()) {
      return { buffer: fs.readFileSync(PRIMARY), docxType: "png" };
    }
  } catch { /* fall through */ }

  for (const ext of FALLBACKS) {
    const p = `${ASSETS_DIR}/tcet-header${ext}`;
    try {
      if (fs.statSync(p).isFile()) {
        const buf = fs.readFileSync(p);
        if (ext === ".webp") return { buffer: buf, docxType: "png" };
        return { buffer: buf, docxType: ext === ".jpg" || ext === ".jpeg" ? "jpg" : "png" };
      }
    } catch { /* try next */ }
  }

  return null;
}
