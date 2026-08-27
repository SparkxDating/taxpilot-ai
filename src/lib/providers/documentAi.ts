import type { DocumentAIExtractInput, DocumentAIResult } from "@/lib/documents/fallback";

export interface DocumentAIProvider {
  name: string;
  model: string;
  configured: boolean;
  extractDocument(input: DocumentAIExtractInput): Promise<DocumentAIResult>;
}

/** Optional extraction AI. Unconfigured unless DOCUMENT_AI_PROVIDER is a real adapter. */
export class UnconfiguredDocumentAIProvider implements DocumentAIProvider {
  name = "unconfigured";
  model = "";
  configured = false;
  async extractDocument(): Promise<DocumentAIResult> {
    return { ok: false, error: "NOT_CONFIGURED" };
  }
}

export function getDocumentAIProvider(): DocumentAIProvider {
  const name = (process.env.DOCUMENT_AI_PROVIDER || "").trim().toLowerCase();
  if (!name || name === "off" || name === "none" || name === "template-dev") {
    return new UnconfiguredDocumentAIProvider();
  }
  return new UnconfiguredDocumentAIProvider();
}
