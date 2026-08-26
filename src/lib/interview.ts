import { prisma } from "./db";
import { json } from "./utils";

type Source = string;

export async function seedInterview(returnId: string, sources: Source[]) {
  const existing = await prisma.question.count({ where: { returnId } });
  if (existing) return;
  const qs: Array<{ code: string; prompt: string; helpText: string; options: string[] }> = [
    {
      code: "RESIDENT",
      prompt: "Were you a resident of India for the previous year (FY 2025-26)?",
      helpText: "ITR-4 can be used only by residents. RNOR and NRI filers are routed to ITR-3.",
      options: ["Yes", "No", "Not sure"],
    },
    {
      code: "DIRECTOR",
      prompt: "Were you a director in any company during the year?",
      helpText: "Directors cannot use ITR-4.",
      options: ["Yes", "No", "Not sure"],
    },
  ];
  if (sources.includes("PROFESSION") || sources.includes("FREELANCING")) {
    qs.push({
      code: "PERSONAL_PROFESSION",
      prompt: "You mentioned professional income. Was this income earned personally rather than through a company?",
      helpText: "A company's receipts are not reported on your ITR-4. Only income in your personal name (or a partnership that is not an LLP) belongs here.",
      options: ["Yes", "No", "Not sure"],
    });
    qs.push({
      code: "SPECIFIED_PROFESSION",
      prompt: "Is this a specified profession (legal, medical, engineering, architecture, accountancy, technical consultancy, interior decoration, or other notified profession)?",
      helpText: "Section 44ADA applies only to specified professions. Other businesses use 44AD.",
      options: ["Yes", "No", "Not sure"],
    });
  }
  if (sources.includes("BUSINESS") || sources.includes("FREELANCING")) {
    qs.push({
      code: "PRESUMPTIVE",
      prompt: "Do you want to use the presumptive scheme (6%/8% of turnover) instead of detailed books?",
      helpText: "Presumptive taxation is the ITR-4 path. Detailed P&L and balance sheet belong in ITR-3.",
      options: ["Yes", "No", "Not sure"],
    });
  }
  if (sources.includes("SALARY")) {
    qs.push({
      code: "FORM16",
      prompt: "Do you have Form 16 from your employer?",
      helpText: "Form 16 is used to fill salary and TDS. You can also type the figures from your payslips.",
      options: ["Yes", "No", "Not sure"],
    });
  }
  qs.push({
    code: "AIS",
    prompt: "Do you have your AIS or Form 26AS for this year?",
    helpText: "We use AIS/26AS only as reconciliation data. Those figures are not assumed to be correct.",
    options: ["Yes", "No", "Not sure"],
  });
  await prisma.question.createMany({
    data: qs.map((q, i) => ({
      returnId,
      code: q.code,
      prompt: q.prompt,
      helpText: q.helpText,
      optionsJson: JSON.stringify(q.options),
      sortOrder: i,
    })),
  });
}

export function parseOptions(raw: string) {
  return json<string[]>(raw, ["Yes", "No", "Not sure"]);
}
