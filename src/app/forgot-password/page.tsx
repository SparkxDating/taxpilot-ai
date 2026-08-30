import { requestPasswordResetAction } from "@/app/password-reset-actions";
import { SiteHeader } from "@/components/site-header";
import { Button, Card, Input, Label } from "@/components/ui";
import { GENERIC_RESET_MESSAGE } from "@/lib/password-reset";
import Link from "next/link";

export default async function ForgotPassword({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;
  return (
    <div>
      <SiteHeader />
      <div className="mx-auto max-w-md px-6 py-16">
        <Card>
          <h1 className="text-2xl">Forgot password</h1>
          <p className="sans mt-2 text-sm text-[#5c6773]">
            Enter the email associated with your account and we'll send you a password reset link.
          </p>
          {sent ? (
            <p className="sans mt-6 text-sm text-[#102033]">{GENERIC_RESET_MESSAGE}</p>
          ) : (
            <form action={requestPasswordResetAction} className="mt-6 space-y-3">
              <div>
                <Label>Email address</Label>
                <Input name="email" type="email" required autoComplete="email" />
              </div>
              <Button className="w-full">Send reset link</Button>
            </form>
          )}
          <p className="sans mt-4 text-center text-sm text-[#5c6773]">
            <Link href="/login">Back to sign in</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
