/** Local text extraction. No external OCR. Images return empty text. */

export function extractPdfText(bytes: Buffer) {
  const s = bytes.toString("latin1");
  if (!s.startsWith("%PDF")) return "";
  const out: string[] = [];
  const re = /\((?:\\.|[^\\)]){1,400}\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const t = m[0]
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");
    if (/[A-Za-z0-9]/.test(t)) out.push(t);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

export function extractText(bytes: Buffer, mime: string, fileName: string) {
  if (mime === "application/pdf") return extractPdfText(bytes);
  if (mime === "text/csv" || mime === "text/plain" || fileName.toLowerCase().endsWith(".csv")) {
    return bytes.toString("utf8");
  }
  return "";
}
