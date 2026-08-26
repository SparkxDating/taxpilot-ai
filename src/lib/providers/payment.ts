export type Plan = "FREE" | "ITR4" | "ITR3" | "PROFESSIONAL" | "CA_FIRM";

export interface PaymentProvider {
  name: string;
  configured: boolean;
  createPayment(input: { userId: string; plan: Plan; amount: number }): Promise<{ id: string; status: string }>;
  verifyPayment(id: string): Promise<{ status: string }>;
  refundPayment(id: string): Promise<{ status: string }>;
  getSubscription(userId: string): Promise<{ plan: Plan; status: string } | null>;
}

export class UnconfiguredPaymentProvider implements PaymentProvider {
  name = "unconfigured";
  configured = false;
  async createPayment(input: { userId: string; plan: Plan; amount: number }): Promise<{ id: string; status: string }> {
    void input;
    throw new Error("PAYMENT_NOT_CONFIGURED");
  }
  async verifyPayment(id: string): Promise<{ status: string }> {
    void id;
    throw new Error("PAYMENT_NOT_CONFIGURED");
  }
  async refundPayment(id: string): Promise<{ status: string }> {
    void id;
    throw new Error("PAYMENT_NOT_CONFIGURED");
  }
  async getSubscription() {
    return { plan: "FREE" as const, status: "ACTIVE" };
  }
}

export function getPaymentProvider(): PaymentProvider {
  return new UnconfiguredPaymentProvider();
}
