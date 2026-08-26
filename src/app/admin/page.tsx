import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui";

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/dashboard");
  const [users, returns, itr3, itr4, completed, inProgress, valFail, docFail, payments] = await Promise.all([
    prisma.user.count(),
    prisma.taxReturn.count(),
    prisma.taxReturn.count({ where: { itrType: "ITR-3" } }),
    prisma.taxReturn.count({ where: { itrType: "ITR-4" } }),
    prisma.taxReturn.count({ where: { status: { in: ["JSON_READY", "READY"] } } }),
    prisma.taxReturn.count({ where: { status: { in: ["DRAFT", "IN_PROGRESS"] } } }),
    prisma.taxReturn.count({ where: { status: "VALIDATION_FAILED" } }),
    prisma.document.count({ where: { status: "FAILED" } }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
  ]);
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  return (
    <div>
      <SiteHeader authed name={session.name} admin />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-4xl">Admin</h1>
        <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[
            ["Users", users],
            ["Returns", returns],
            ["ITR-3", itr3],
            ["ITR-4", itr4],
            ["Completed", completed],
            ["In progress", inProgress],
            ["Validation failures", valFail],
            ["Document failures", docFail],
            ["Revenue (paise/INR recorded)", payments._sum.amount || 0],
          ].map(([k, v]) => (
            <Card key={String(k)}>
              <p className="sans text-xs text-[#5c6773]">{k}</p>
              <p className="mt-1 text-2xl">{v}</p>
            </Card>
          ))}
        </div>
        <h2 className="mt-10 text-2xl">Audit log</h2>
        <ul className="sans mt-3 space-y-2 text-sm">
          {logs.map((l) => (
            <li key={l.id}>
              {l.createdAt.toISOString()} · {l.action} · {l.entity}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
