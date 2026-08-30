import { completePasswordResetAction } from "@/app/actions";
import { SiteHeader } from "@/components/site-header";
import { Button, Card, Input, Label } from "@/components/ui";
import { INVALID_TOKEN_MESSAGE, MIN_PASSWORD_LENGTH } from "@/lib/password-reset";
import Link from "next/link";

export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const invalid = !token || error === "invalid";
  const errorText =
    error === "mismatch"
      ? "Passwords do not match."
      : error === "short"
        ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
        : error === "invalid"
          ? INVALID_TOKEN_MESSAGE
          : "";

  return (
    <div>
      <SiteHeader />
      <div className="mx-auto max-w-md px-6 py-16">
        <Card>
          <h1 className="text-2xl">Reset password</h1>
          {invalid ? (
            <p className="sans mt-4 text-sm text-red-800">{INVALID_TOKEN_MESSAGE}</p>
          ) : (
            <form action={completePasswordResetAction} className="mt-6 space-y-3">
              <input type="hidden" name="token" value={token} />
              <div>
                <Label>New password</Label>
                <Input
                  name="newPassword"
                  type="password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label>Confirm new password</Label>
                <Input
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                />
              </div>
              {errorText ? <p className="sans text-sm text-red-800">{errorText}</p> : null}
              <Button className="w-full">Reset password</Button>
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
