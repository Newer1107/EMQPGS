import fs from "node:fs";

const CANDIDATES = [
  "templates/tcet-header.png",
  "templates/tcet-header.webp",
  "templates/tcet-header.jpg",
  "templates/tcet-header.jpeg",
];

export type HeaderInfo = {
  buffer: Buffer;
  docxType: "jpg" | "png" | "gif" | "bmp";
};

export function loadHeader(): HeaderInfo | null {
  for (const rel of CANDIDATES) {
    try {
      const buf = fs.readFileSync(rel);
      const ext = rel.split(".").pop()?.toLowerCase() ?? "";
      if (ext === "png") return { buffer: buf, docxType: "png" };
      if (ext === "jpg" || ext === "jpeg") return { buffer: buf, docxType: "jpg" };
      if (ext === "gif") return { buffer: buf, docxType: "gif" };
      if (ext === "bmp") return { buffer: buf, docxType: "bmp" };
      if (ext === "webp") return { buffer: buf, docxType: "png" };
    } catch { /* try next */ }
  }
  return null;
}
