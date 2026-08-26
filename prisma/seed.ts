import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
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
  console.log("Seeded demo@taxpilot.local / password123 and admin@taxpilot.local / password123", demo.email);
}

main().finally(() => prisma.$disconnect());
