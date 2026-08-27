export function sniffMime(bytes: Buffer, fileName: string, claimed: string) {
  const name = fileName.toLowerCase();
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (name.endsWith(".csv") || claimed === "text/csv") return "text/csv";
  if (name.endsWith(".xlsx") || claimed.includes("spreadsheet")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (claimed.startsWith("text/")) return claimed;
  return claimed || "application/octet-stream";
}

export function isAllowedUpload(mime: string, size: number) {
  const ok = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "text/csv",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ].includes(mime);
  if (!ok) return { ok: false, code: "INVALID_TYPE" };
  if (size <= 0) return { ok: false, code: "EMPTY" };
  if (size > 12 * 1024 * 1024) return { ok: false, code: "OVERSIZE" };
  return { ok: true, code: "" };
}
