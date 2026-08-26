# Test fixtures

Synthetic ITR-4 AY 2026–27 cases. These PANs, bank accounts, and addresses must never populate a real return.

- `itr4/ay2026_27/<case>/input.json` — NormalizedReturn
- `expected.json` — official ITR-4 JSON
- `expectedTax.json` — tax-engine slice
- `expectedValidation.json` — filing-gate layers

Regenerate with `npx tsx scripts/generate-golden.ts`.

Seed users live in `prisma/seed.ts` and run only when `DEMO_MODE=true` (never in production).
