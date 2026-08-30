"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";
import { PAYMENT_NOT_COMPLETED, PAYMENT_UNAVAILABLE } from "@/lib/payment-messages";

type CheckoutPayload = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  name: string;
  description?: string;
  prefillName?: string;
  prefillEmail?: string;
};

type RazorpayHandlerResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      order_id: string;
      handler: (response: RazorpayHandlerResponse) => void;
      modal?: { ondismiss?: () => void };
      prefill?: { name?: string; email?: string };
      theme?: { color?: string };
    }) => { open: () => void };
  }
}

function loadCheckout(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("browser"));
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("checkout"));
    document.body.appendChild(script);
  });
}

export function ProCheckoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function startCheckout() {
    setMessage("");
    setBusy(true);
    try {
      const created = await fetch("/api/payment/create-order", { method: "POST" });
      if (created.status === 401) {
        router.push("/login");
        return;
      }
      const payload = (await created.json().catch(() => ({}))) as CheckoutPayload & { error?: string };
      if (!created.ok || !payload.orderId || !payload.keyId) {
        setMessage(typeof payload.error === "string" ? payload.error : PAYMENT_UNAVAILABLE);
        return;
      }
      await loadCheckout();
      if (!window.Razorpay) {
        setMessage(PAYMENT_UNAVAILABLE);
        return;
      }
      const checkout = new window.Razorpay({
        key: payload.keyId,
        amount: payload.amount,
        currency: payload.currency,
        name: "TaxPilot AI",
        description: payload.name || "Pro",
        order_id: payload.orderId,
        prefill: { name: payload.prefillName, email: payload.prefillEmail },
        theme: { color: "#1f4e46" },
        handler: (response) => {
          void (async () => {
            const verify = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            if (!verify.ok) {
              setMessage(PAYMENT_NOT_COMPLETED);
              setBusy(false);
              return;
            }
            router.push("/pricing?paid=1");
            router.refresh();
          })();
        },
        modal: {
          ondismiss: () => {
            setMessage(PAYMENT_NOT_COMPLETED);
            setBusy(false);
          },
        },
      });
      checkout.open();
    } catch {
      setMessage(PAYMENT_UNAVAILABLE);
      setBusy(false);
    }
  }

  return (
    <div>
      <Button
        className="mt-6 min-h-11 w-full sm:w-auto"
        type="button"
        onClick={() => void startCheckout()}
        disabled={busy}
        aria-label="Upgrade to Pro"
      >
        Upgrade to Pro
      </Button>
      {message ? <p className="sans mt-3 text-sm text-red-800">{message}</p> : null}
    </div>
  );
}
