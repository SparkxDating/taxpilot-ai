import type { PdfPage } from "./types";

export function findOnPages(pages: PdfPage[], patterns: RegExp[]) {
  for (const page of pages) {
    const compact = page.text.replace(/\s+/g, " ");
    for (const re of patterns) {
      const m = compact.match(re);
      if (m?.[1]) {
        return {
          value: m[1].trim(),
          sourcePage: page.pageNumber,
          sourceText: m[0].slice(0, 180),
        };
      }
    }
  }
  return { value: null as string | null, sourcePage: null as number | null, sourceText: "" };
}

export function pagesFromText(text: string): PdfPage[] {
  if (!text) return [];
  return [{ pageNumber: 1, text }];
}
