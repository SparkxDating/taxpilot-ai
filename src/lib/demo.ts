/** Demo/seed behaviour is never enabled in NODE_ENV=production. */
export function demoModeFrom(env: { NODE_ENV?: string; DEMO_MODE?: string; NEXT_PUBLIC_DEMO_MODE?: string }) {
  if (env.NODE_ENV === "production") return false;
  return env.DEMO_MODE === "true" || env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export function isDemoMode() {
  return demoModeFrom(process.env);
}
