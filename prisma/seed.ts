import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo taxpayers in production.");
  }
  if (process.env.DEMO_MODE !== "true") {
    console.log("Seed skipped. Set DEMO_MODE=true to load isolated demo users. Demo data never populates a real return.");
    return;
  }
  const passwordHash = await bcrypt.hash("password123", 12);
  const demo = await prisma.user.upsert({
    where: { email: "demo@taxpilot.local" },
    update: { passwordHash },
    create: {
      email: "demo@taxpilot.local",
      name: "Ananya Iyer",
      passwordHash,
      role: "USER",
      profile: { create: { pan: "AAAPA1234A", city: "Bengaluru", state: "Karnataka", pincode: "560001", residentialStatus: "RESIDENT" } },
      subscription: { create: { plan: "FREE" } },
    },
  });
  await prisma.user.upsert({
    where: { email: "admin@taxpilot.local" },
    update: { passwordHash, role: "ADMIN" },
    create: {
      email: "admin@taxpilot.local",
      name: "TaxPilot Admin",
      passwordHash,
      role: "ADMIN",
      profile: { create: {} },
    },
  });
  console.log("Seeded isolated demo users only (DEMO_MODE=true):", demo.email);
}

main().finally(() => prisma.$disconnect());
