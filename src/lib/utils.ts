import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function json<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function maskAccount(n: string) {
  if (!n || n.length < 4) return "••••";
  return `••••${n.slice(-4)}`;
}

export function maskPan(pan: string) {
  if (!pan || pan.length < 4) return "••••";
  return `${pan.slice(0, 2)}••••${pan.slice(-3)}`;
}
