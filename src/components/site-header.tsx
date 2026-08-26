import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { Button } from "./ui";

export function SiteHeader({ authed, name, admin }: { authed?: boolean; name?: string; admin?: boolean }) {
  return (
    <header className="border-b border-[#e4ddd0] bg-[#fffcf7]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href={authed ? "/dashboard" : "/"} className="text-lg tracking-tight text-[#102033]">
          TaxPilot <span className="text-[#c4a574]">AI</span>
        </Link>
        <nav className="sans flex items-center gap-5 text-sm text-[#5c6773]">
          {!authed ? (
            <>
              <Link href="/how-it-works">How it works</Link>
              <Link href="/pricing">Pricing</Link>
              <Link href="/security">Security</Link>
              <Link href="/faq">FAQ</Link>
              <Link href="/login">Log in</Link>
              <Link href="/signup">
                <Button>Get started</Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/dashboard">Dashboard</Link>
              {admin ? <Link href="/admin">Admin</Link> : null}
              <span className="hidden sm:inline">{name}</span>
              <form action={logoutAction}>
                <Button variant="outline">Sign out</Button>
              </form>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
