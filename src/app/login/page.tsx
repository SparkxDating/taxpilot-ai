import { loginAction } from "@/app/actions";
import { SiteHeader } from "@/components/site-header";
import { Button, Card, Input, Label } from "@/components/ui";
import { SUCCESS_MESSAGE } from "@/lib/password-reset";
import Link from "next/link";
import { isDemoMode } from "@/lib/demo";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  const { error, reset } = await searchParams;
  const demo = isDemoMode();
  return (
    <div>
      <SiteHeader />
      <div className="mx-auto max-w-md px-6 py-16">
        <Card>
          <h1 className="text-2xl">Log in</h1>
          {reset ? <p className="sans mt-2 text-sm text-emerald-800">{SUCCESS_MESSAGE}</p> : null}
          {error ? <p className="sans mt-2 text-sm text-red-800">{error === "rate" ? "Too many attempts." : error === "db" ? "Server database is unavailable. Please try again." : "Invalid email or password."}</p> : null}
          <form action={loginAction} className="mt-6 space-y-3">
            <div>
              <Label>Email</Label>
              <Input name="email" type="email" required defaultValue={demo ? "demo@taxpilot.local" : undefined} />
            </div>
            <div>
              <Label>Password</Label>
              <Input name="password" type="password" required defaultValue={demo ? "password123" : undefined} />
              <p className="sans mt-2 text-right text-sm text-[#5c6773]">
                <Link href="/forgot-password">Forgot password?</Link>
              </p>
            </div>
            <Button className="w-full">Continue</Button>
          </form>
          <p className="sans mt-4 text-center text-sm text-[#5c6773]">
            <Link href="/signup">Create an account</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
