"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createSession, clearSession, getSession, hashPassword, verifyPassword, canAccessReturn } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { seedInterview } from "@/lib/interview";
import { recomputeReturn } from "@/lib/tax/persist";
import { loadNormalized } from "@/lib/tax/load";
import { generateITRJson } from "@/lib/itr-json/mapper";
import { getStorage, newStorageKey } from "@/lib/providers/storage";
import { getOcrProvider, MIN_AUTO_INSERT_CONFIDENCE } from "@/lib/providers/ocr";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { createHash } from "crypto";

function f(data: FormData) {
  const o: Record<string, string> = {};
  data.forEach((v, k) => {
    if (typeof v === "string") o[k] = v;
  });
  return o;
}
function n(v: string | undefined) {
  const x = Number(v);
  return Number.isFinite(x) ? Math.round(x) : 0;
}

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim();
  if (!rateLimit(`signup:${email}`, 8, 600_000).ok) redirect("/signup?error=rate");
  if (!email.includes("@") || password.length < 8 || !name) redirect("/signup?error=invalid");
  if (await prisma.user.findUnique({ where: { email } })) redirect("/signup?error=exists");
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(password),
      profile: { create: {} },
      subscription: { create: { plan: "FREE" } },
    },
  });
  await createSession(user.id);
  await audit({ userId: user.id, action: "signup", entity: "User", entityId: user.id });
  redirect("/dashboard");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");
  if (!rateLimit(`login:${email}`, 10, 600_000).ok) redirect("/login?error=rate");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) redirect("/login?error=invalid");
  await createSession(user.id);
  await audit({ userId: user.id, action: "login", entity: "User", entityId: user.id });
  redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}

export async function createReturnAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const assessmentYear = String(formData.get("assessmentYear") || "2026-27");
  const taxpayerType = String(formData.get("taxpayerType") || "INDIVIDUAL");
  const sources = formData.getAll("sources").map(String);
  const ret = await prisma.taxReturn.create({
    data: {
      userId: session.userId,
      assessmentYear,
      taxpayerType,
      incomeSourcesJson: JSON.stringify(sources),
      incomeSources: { create: sources.map((kind) => ({ kind, selected: true })) },
    },
  });
  await seedInterview(ret.id, sources);
  await audit({ userId: session.userId, returnId: ret.id, action: "return.created", entity: "TaxReturn", entityId: ret.id });
  await recomputeReturn(ret.id);
  redirect(`/returns/${ret.id}/interview`);
}

export async function answerQuestionAction(formData: FormData) {
  const session = await getSession();
  if (!session) return;
  const questionId = String(formData.get("questionId") || "");
  const value = String(formData.get("value") || "");
  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) return;
  const ret = await prisma.taxReturn.findFirst({ where: { id: q.returnId, userId: session.userId } });
  if (!ret) return;
  await prisma.answer.create({ data: { returnId: ret.id, questionId, value } });
  await prisma.question.update({ where: { id: questionId }, data: { status: "ANSWERED" } });
  if (q.code === "DIRECTOR" && value === "Yes") {
    await prisma.taxReturn.update({ where: { id: ret.id }, data: { itrType: "ITR-3" } });
  }
  await recomputeReturn(ret.id);
  revalidatePath(`/returns/${ret.id}/interview`);
}

export async function saveProfileAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("returnId") || "");
  const ret = await prisma.taxReturn.findFirst({ where: { id, userId: session.userId } });
  if (!ret) redirect("/dashboard");
  const pan = String(formData.get("pan") || "").toUpperCase().trim();
  const profileData = {
    pan,
    fatherName: String(formData.get("fatherName") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    addressLine1: String(formData.get("address") || "").trim(),
    addressLine2: String(formData.get("locality") || "").trim(),
    city: String(formData.get("city") || "").trim(),
    state: String(formData.get("state") || "").trim(),
    pincode: String(formData.get("pincode") || "").trim(),
    residentialStatus: String(formData.get("residentialStatus") || "").trim(),
    dateOfBirth: formData.get("dateOfBirth") ? new Date(String(formData.get("dateOfBirth"))) : undefined,
  };
  await prisma.profile.upsert({
    where: { userId: session.userId },
    update: profileData,
    create: { userId: session.userId, ...profileData },
  });
  await prisma.user.update({ where: { id: session.userId }, data: { name: String(formData.get("name") || session.name) } });
  await recomputeReturn(id);
  revalidatePath(`/returns/${id}/profile`);
  redirect(`/returns/${id}/income`);
}

export async function saveIncomeAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("returnId") || "");
  const ret = await prisma.taxReturn.findFirst({ where: { id, userId: session.userId } });
  if (!ret) redirect("/dashboard");
  await prisma.salaryIncome.deleteMany({ where: { returnId: id } });
  await prisma.businessIncome.deleteMany({ where: { returnId: id } });
  await prisma.professionalIncome.deleteMany({ where: { returnId: id } });
  await prisma.otherIncome.deleteMany({ where: { returnId: id } });
  await prisma.houseProperty.deleteMany({ where: { returnId: id } });
  if (n(String(formData.get("grossSalary")))) {
    await prisma.salaryIncome.create({
      data: {
        returnId: id,
        employerName: String(formData.get("employerName") || ""),
        employerTan: String(formData.get("employerTan") || "").toUpperCase(),
        grossSalary: n(String(formData.get("grossSalary"))),
        tds: n(String(formData.get("salaryTds"))),
      },
    });
  }
  if (n(String(formData.get("turnover"))) || n(String(formData.get("digitalReceipts")))) {
    const digital = n(String(formData.get("digitalReceipts")));
    const cash = n(String(formData.get("cashReceipts")));
    const turnover = n(String(formData.get("turnover"))) || digital + cash;
    await prisma.businessIncome.create({
      data: {
        returnId: id,
        section: "44AD",
        nature: String(formData.get("nature") || "").trim(),
        natureCode: String(formData.get("natureCode") || "").trim(),
        turnover,
        digitalReceipts: digital,
        cashReceipts: cash,
        declaredIncome: n(String(formData.get("declaredBusiness"))),
      },
    });
  }
  if (n(String(formData.get("grossReceipts")))) {
    await prisma.professionalIncome.create({
      data: {
        returnId: id,
        section: "44ADA",
        profession: String(formData.get("profession") || "").trim(),
        natureCode: String(formData.get("professionCode") || "").trim(),
        grossReceipts: n(String(formData.get("grossReceipts"))),
        cashReceipts: n(String(formData.get("profCash"))),
        declaredIncome: n(String(formData.get("declaredProfession"))),
        personalNotCompany: String(formData.get("personalNotCompany") || "Yes") === "Yes",
      },
    });
  }
  if (n(String(formData.get("interest")))) {
    await prisma.otherIncome.create({
      data: { returnId: id, kind: "Interest", amount: n(String(formData.get("interest"))), source: String(formData.get("interestSource") || "").trim() },
    });
  }
  if (n(String(formData.get("dividend")))) {
    await prisma.otherIncome.create({
      data: { returnId: id, kind: "Dividend", amount: n(String(formData.get("dividend"))), source: String(formData.get("dividendSource") || "").trim() },
    });
  }
  if (String(formData.get("hpOccupancy"))) {
    await prisma.houseProperty.create({
      data: {
        returnId: id,
        occupancy: String(formData.get("hpOccupancy") || "SELF_OCCUPIED"),
        annualLetableValue: n(String(formData.get("hpAlv"))),
        municipalTaxes: n(String(formData.get("hpMunicipal"))),
        interestOnLoan: n(String(formData.get("hpInterest"))),
      },
    });
  }
  const regime = String(formData.get("regime") || "");
  if (regime === "NEW" || regime === "OLD") {
    await prisma.taxReturn.update({ where: { id }, data: { taxRegime: regime } });
  }
  await recomputeReturn(id);
  redirect(`/returns/${id}/deductions`);
}

export async function saveDeductionsAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("returnId") || "");
  const ret = await prisma.taxReturn.findFirst({ where: { id, userId: session.userId } });
  if (!ret) redirect("/dashboard");
  await prisma.deduction.deleteMany({ where: { returnId: id } });
  const parentsSenior = String(formData.get("parentsSenior") || "") === "Y";
  const rows: Array<{ section: string; amount: number; notes?: string }> = [
    { section: "80C", amount: n(String(formData.get("80C"))) },
    { section: "80CCC", amount: n(String(formData.get("80CCC"))) },
    { section: "80CCD(1)", amount: n(String(formData.get("80CCD(1)"))) },
    { section: "80CCD(1B)", amount: n(String(formData.get("80CCD(1B)"))) },
    { section: "80D_SELF", amount: n(String(formData.get("80D_SELF"))) },
    { section: "80D_SELF_PREVENTIVE", amount: n(String(formData.get("80D_SELF_PREVENTIVE"))) },
    { section: "80D_SELF_MEDICAL", amount: n(String(formData.get("80D_SELF_MEDICAL"))) },
    { section: "80D_PARENTS", amount: n(String(formData.get("80D_PARENTS"))), notes: JSON.stringify({ senior: parentsSenior, beneficiary: "PARENTS", kind: "PREMIUM" }) },
    { section: "80D_PARENTS_PREVENTIVE", amount: n(String(formData.get("80D_PARENTS_PREVENTIVE"))), notes: JSON.stringify({ senior: parentsSenior, beneficiary: "PARENTS", kind: "PREVENTIVE" }) },
    { section: "80D_PARENTS_MEDICAL", amount: n(String(formData.get("80D_PARENTS_MEDICAL"))), notes: JSON.stringify({ senior: parentsSenior, beneficiary: "PARENTS", kind: "MEDICAL" }) },
    { section: "80TTA", amount: n(String(formData.get("80TTA"))) },
    { section: "80TTB", amount: n(String(formData.get("80TTB"))) },
  ];
  for (const row of rows) {
    if (!row.amount) continue;
    await prisma.deduction.create({ data: { returnId: id, section: row.section, amount: row.amount, notes: row.notes || "" } });
  }
  await recomputeReturn(id);
  redirect(`/returns/${id}/tds`);
}

export async function saveTdsBankAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("returnId") || "");
  const ret = await prisma.taxReturn.findFirst({ where: { id, userId: session.userId } });
  if (!ret) redirect("/dashboard");
  await prisma.tDSEntry.deleteMany({ where: { returnId: id } });
  await prisma.taxPayment.deleteMany({ where: { returnId: id } });
  await prisma.bankAccount.deleteMany({ where: { returnId: id } });
  if (n(String(formData.get("tdsAmount")))) {
    await prisma.tDSEntry.create({
      data: {
        returnId: id,
        sectionCode: String(formData.get("tdsSection") || "194A"),
        tan: String(formData.get("tdsTan") || "").toUpperCase(),
        deductorName: String(formData.get("tdsName") || ""),
        amount: n(String(formData.get("tdsAmount"))),
      },
    });
  }
  if (n(String(formData.get("advanceTax")))) {
    const paidOn = String(formData.get("advanceTaxDate") || "");
    await prisma.taxPayment.create({
      data: {
        returnId: id,
        kind: "ADVANCE",
        amount: n(String(formData.get("advanceTax"))),
        paidOn: paidOn ? new Date(paidOn) : undefined,
      },
    });
  }
  if (n(String(formData.get("selfAsst")))) {
    const paidOn = String(formData.get("selfAsstDate") || "");
    await prisma.taxPayment.create({
      data: {
        returnId: id,
        kind: "SELF_ASSESSMENT",
        amount: n(String(formData.get("selfAsst"))),
        paidOn: paidOn ? new Date(paidOn) : undefined,
      },
    });
  }
  const ifsc = String(formData.get("ifsc") || "").toUpperCase().trim();
  const accountNumber = String(formData.get("accountNumber") || "").trim();
  const bankName = String(formData.get("bankName") || "").trim();
  if (ifsc || accountNumber) {
    await prisma.bankAccount.create({
      data: {
        returnId: id,
        ifsc,
        accountNumber,
        bankName,
        accountType: String(formData.get("accountType") || "SB"),
        isPrimary: true,
      },
    });
  }
  await recomputeReturn(id);
  redirect(`/returns/${id}/validate`);
}

export async function generateJsonAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("returnId") || "");
  const ret = await prisma.taxReturn.findFirst({ where: { id, userId: session.userId } });
  if (!ret || !canAccessReturn(ret.userId, session)) redirect("/dashboard");
  const data = await loadNormalized(id, session.role === "ADMIN" ? undefined : session.userId);
  if (!data) redirect("/dashboard");
  if (data.itrType !== "ITR-4") redirect(`/returns/${id}/summary?error=itr3`);
  const result = generateITRJson(data, { returnId: id, generatedAt: new Date() });
  if (!result.valid || !result.json) {
    await prisma.taxReturn.update({ where: { id }, data: { status: "VALIDATION_FAILED" } });
    redirect(`/returns/${id}/validate?blocked=1`);
  }
  const payload = JSON.stringify(result.json, null, 2);
  const dir = path.join(process.cwd(), "storage", "json", id);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `ITR-4-${Date.now()}.json`);
  await writeFile(file, payload, "utf8");
  await prisma.iTRJsonFile.updateMany({ where: { returnId: id, status: "CURRENT" }, data: { status: "SUPERSEDED" } });
  await prisma.iTRJsonFile.create({
    data: {
      returnId: id,
      assessmentYear: data.assessmentYear,
      itrType: "ITR-4",
      schemaVersion: result.schemaVersion,
      fileHash: result.digest,
      storagePath: file,
      valid: true,
      status: "CURRENT",
      versionId: result.digest.slice(0, 12),
    },
  });
  await prisma.taxReturn.update({ where: { id }, data: { status: "JSON_GENERATED", schemaVersion: result.schemaVersion } });
  await audit({ userId: session.userId, returnId: id, action: "json.generated", entity: "ITRJsonFile", metadata: { hash: result.digest } });
  revalidatePath(`/returns/${id}/json`);
  redirect(`/returns/${id}/json`);
}

export async function uploadDocumentAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("returnId") || "");
  const ret = await prisma.taxReturn.findFirst({ where: { id, userId: session.userId } });
  if (!ret) redirect("/dashboard");
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) redirect(`/returns/${id}/documents?error=file`);
  const allowed = ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"];
  if (!allowed.includes(file.type)) redirect(`/returns/${id}/documents?error=type`);
  if (file.size > 12 * 1024 * 1024) redirect(`/returns/${id}/documents?error=size`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const key = newStorageKey(session.userId, file.name);
  await getStorage().put(key, bytes, file.type);
  const doc = await prisma.document.create({
    data: {
      userId: session.userId,
      returnId: id,
      kind: String(formData.get("kind") || "OTHER"),
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      storageKey: key,
      status: "PROCESSING",
    },
  });
  const ocr = getOcrProvider();
  const candidates = await ocr.extract({ fileName: file.name, mimeType: file.type, bytes });
  if (!ocr.configured) {
    await prisma.document.update({ where: { id: doc.id }, data: { status: "UPLOADED" } });
  } else {
    for (const c of candidates) {
      await prisma.documentExtraction.create({
        data: {
          documentId: doc.id,
          fieldKey: c.fieldKey,
          extractedValue: c.extractedValue,
          numericValue: c.numericValue,
          confidence: c.confidence,
          pageRef: c.pageRef || "",
          status: c.confidence >= MIN_AUTO_INSERT_CONFIDENCE ? "EXTRACTED" : "NEEDS_REVIEW",
        },
      });
    }
    await prisma.document.update({ where: { id: doc.id }, data: { status: candidates.length ? "NEEDS_REVIEW" : "EXTRACTED" } });
  }
  revalidatePath(`/returns/${id}/documents`);
}

export async function reviewExtractionAction(formData: FormData) {
  const session = await getSession();
  if (!session) return;
  const extractionId = String(formData.get("extractionId") || "");
  const decision = String(formData.get("decision") || "");
  const row = await prisma.documentExtraction.findUnique({ where: { id: extractionId }, include: { document: true } });
  if (!row || row.document.userId !== session.userId) return;
  if (row.confidence < MIN_AUTO_INSERT_CONFIDENCE && decision === "confirm" && !String(formData.get("edited"))) {
    /* still allow explicit confirm */
  }
  await prisma.documentExtraction.update({
    where: { id: extractionId },
    data: {
      status: decision === "reject" ? "FAILED" : "CONFIRMED",
      extractedValue: String(formData.get("edited") || row.extractedValue),
    },
  });
  revalidatePath(`/returns/${row.document.returnId}/documents`);
}

void f;
void createHash;
