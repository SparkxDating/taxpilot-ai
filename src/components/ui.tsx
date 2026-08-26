import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "ghost" | "gold" }) {
  return (
    <button
      className={cn(
        "sans inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        variant === "primary" && "bg-[#1f4e46] text-white hover:bg-[#173c36]",
        variant === "outline" && "border border-[#d7cfc0] bg-white hover:bg-[#f7f3eb]",
        variant === "ghost" && "text-[#1f4e46] hover:bg-[#efe8da]",
        variant === "gold" && "bg-[#c4a574] text-[#1b2430] hover:bg-[#b3915f]",
        className,
      )}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "sans w-full rounded-md border border-[#d7cfc0] bg-white px-3 py-2 text-sm outline-none focus:border-[#1f4e46]",
        props.className,
      )}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-[#e4ddd0] bg-[#fffcf7] p-5 shadow-[0_1px_0_rgba(16,32,51,0.04)]", className)} {...props} />;
}

export function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "ok" | "warn" | "err" | "muted" }) {
  const map = {
    ok: "bg-emerald-50 text-emerald-800",
    warn: "bg-amber-50 text-amber-800",
    err: "bg-red-50 text-red-800",
    muted: "bg-[#efe8da] text-[#5c6773]",
  };
  return <span className={cn("sans rounded-full px-2.5 py-0.5 text-xs", map[tone])}>{children}</span>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="sans mb-1 block text-xs font-medium uppercase tracking-wide text-[#5c6773]">{children}</label>;
}

export function Disclaimer() {
  return (
    <p className="sans text-xs leading-relaxed text-[#5c6773]">
      TaxPilot AI is an independent tax preparation software and is not affiliated with or endorsed by the Income Tax Department.
      Tax calculations and return preparation are provided as software assistance and should be reviewed by the taxpayer or a
      qualified tax professional before filing.
    </p>
  );
}
