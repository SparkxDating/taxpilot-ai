import { NextResponse } from "next/server";
import { authed } from "../../_util";
import { prisma } from "@/lib/db";
import { prismaPaymentStore, verifyProPaymentWith } from "@/lib/payment";

export async function POST(request: Request) {
  const { session, error } = await authed();
  if (!session) return error;
  const body = (await request.json().catch(() => ({}))) as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  const result = await verifyProPaymentWith(
    { store: prismaPaymentStore(prisma) },
    {
      userId: session.userId,
      razorpay_order_id: body.razorpay_order_id,
      razorpay_payment_id: body.razorpay_payment_id,
      razorpay_signature: body.razorpay_signature,
    },
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, plan: "PRO" });
}
