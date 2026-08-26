export type ChatTurn = { role: "user" | "assistant" | "system"; content: string };

export interface AIProvider {
  name: string;
  configured: boolean;
  explain(prompt: string): Promise<string>;
  classifyDocument(fileName: string): Promise<string>;
}

/**
 * Development adapter — templated explanations.
 * Must never: decide eligibility, calculate tax, fabricate values, mark validation resolved,
 * or emit filing-ready data. Deterministic engines own the return.
 */
export class TemplateAIProvider implements AIProvider {
  name = "template-dev";
  configured = true;
  async explain(prompt: string) {
    if (/company/i.test(prompt)) {
      return "Presumptive schemes under 44AD/44ADA apply to income you earn in your personal capacity (or a partnership firm that is not an LLP), not income of a company. If the receipts belong to a private limited company, that company files its own return.";
    }
    if (/44AD/i.test(prompt)) {
      return "Section 44AD lets eligible small businesses declare profit at 6% of digital receipts and 8% of cash receipts without keeping detailed books. You may declare a higher profit. Declaring lower than the prescribed rate generally requires books and ITR-3.";
    }
    if (/44ADA/i.test(prompt)) {
      return "Section 44ADA is for specified professions. Income is taken as 50% of gross receipts (or higher if you declare more). Specified professions include legal, medical, engineering, architecture, accountancy, technical consultancy, interior decoration, and other notified professions.";
    }
    return "I can explain the question in plain language. Final tax, eligibility, and ITR JSON are always computed by the rules engine, not by this assistant.";
  }
  async classifyDocument(fileName: string) {
    const n = fileName.toLowerCase();
    if (n.includes("16")) return "FORM_16";
    if (n.includes("26as")) return "FORM_26AS";
    if (n.includes("ais")) return "AIS";
    if (n.includes("bank")) return "BANK_STATEMENT";
    if (n.includes("pnl") || n.includes("p&l")) return "PNL";
    return "OTHER";
  }
}

export function getAIProvider(): AIProvider {
  return new TemplateAIProvider();
}
