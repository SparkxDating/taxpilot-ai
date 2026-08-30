import { NextResponse } from "next/server";
import { authed } from "../../_util";
import { prisma } from "@/lib/db";
import {
  PAYMENT_UNAVAILABLE,
  createProOrderWith,
  liveRazorpay,
  prismaPaymentStore,
  publicCheckoutPayload,
} from "@/lib/payment";

export async function POST(request: Request) {
  const { session, error } = await authed();
  if (!session) return error;
  const clientBody = await request.json().catch(() => ({}));
  try {
    const result = await createProOrderWith(
      { store: prismaPaymentStore(prisma), razorpay: liveRazorpay() },
      session.userId,
      clientBody,
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(
      publicCheckoutPayload({
        ...result.checkout,
        prefillName: session.name,
        prefillEmail: session.email,
      }),
    );
  } catch {
    return NextResponse.json({ error: PAYMENT_UNAVAILABLE }, { status: 503 });
  }
}
