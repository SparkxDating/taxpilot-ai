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
          {error ? (
            <p className="sans mt-2 text-sm text-red-800">
              {error === "google"
                ? "Google sign-in could not be completed. Please try again."
                : error === "rate"
                  ? "Too many attempts."
                  : error === "db"
                    ? "Server database is unavailable. Please try again."
                    : "Invalid email or password."}
            </p>
          ) : null}
          <Link href="/api/auth/google" className="mt-6 block">
            <Button type="button" variant="outline" className="w-full min-h-11">
              Continue with Google
            </Button>
          </Link>
          <p className="sans mt-5 text-center text-xs uppercase tracking-widest text-[#5c6773]">OR</p>
          <form action={loginAction} className="mt-5 space-y-3">
            <div>
              <Label>Email</Label>
              <Input name="email" type="email" required defaultValue={demo ? "demo@taxpilot.local" : undefined} />
            </div>
            <div>
              <Label>Password</Label>
              <Input name="password" type="password" required defaultValue={demo ? "password123" : undefined} />
            </div>
            <Button className="w-full">Sign in</Button>
          </form>
          <p className="sans mt-4 text-center text-sm text-[#5c6773]">
            <Link href="/signup">Create an account</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
