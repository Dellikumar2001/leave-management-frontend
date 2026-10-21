import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "fs";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    process.exit(1);
  }
  const buffer = fs.readFileSync(filePath);
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => (it && it.str) || "").join(" ") + "\n";
  }
  process.stdout.write(text);
}

main().catch((err) => {
  process.stderr.write(err.message || String(err));
  process.exit(1);
});
