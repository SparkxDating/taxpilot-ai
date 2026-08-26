# TaxPilot AI

AI-assisted ITR-3 / ITR-4 preparation for **Assessment Year 2026–27**.

TaxPilot AI is an independent tax preparation product. It is **not** affiliated with or endorsed by the Income Tax Department. It does **not** log in to the e-filing portal and never stores portal credentials.

Tax calculations and return preparation are software assistance. Review them before filing.

## What this release does

End-to-end ITR-4 vertical slice:

Signup → dashboard → create return → eligibility (deterministic) → interview → income → deductions → TDS/bank → validation → summary → ITR JSON download.

ITR-3 has data models and screens (P&L / balance sheet tables) but not a complete official mapper.

Document OCR, payments, and live AI providers are **interfaces with development adapters**. They do not fake results.

## Tax rules (AY 2026–27)

Versioned under `src/lib/tax-rules/ay2026_27/`.

- New regime slabs (ITD tax-rates): 0 / 4L / 8L / 12L / 16L / 20L / 24L at 0–5–10–15–20–25–30%
- s.87A rebate up to ₹60,000 if taxable income ≤ ₹12 lakh (resident individual, new regime)
- Standard deduction ₹75,000 (new) / ₹50,000 (old) on salary
- Health and education cess 4%
- 44AD: 6% digital + 8% cash; turnover ₹2 cr / ₹3 cr if cash ≤ 5%
- 44ADA: 50% of receipts; ₹50 lakh / ₹75 lakh if cash ≤ 5%
- ITR-4: resident individual/HUF/firm (not LLP), income ≤ ₹50 lakh, presumptive BP, up to two house properties, 112A LTCG ≤ ₹1.25 lakh

Sources: [ITD tax rates](https://www.incometaxindia.gov.in/w/%E2%80%8Btax-rates-1), [ITR-4 FAQs](https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/file-itr-4-sugam-online).

The bundled JSON schema is an **adapter**. Drop the ITD-published schema into `src/lib/itr-json/schemas/` when you download it from the e-filing portal.

## Run locally

Requires Node 20+. Local development uses SQLite. Production should use PostgreSQL (`docker compose up -d` and switch `DATABASE_URL` + Prisma `provider`).

```bash
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Open http://127.0.0.1:3002

Demo:

- `demo@taxpilot.local` / `password123`
- `admin@taxpilot.local` / `password123`

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL |
| `AUTH_SECRET` | Session JWT |
| `S3_*` | Unused until object storage is wired |
| `AI_PROVIDER` / `OCR_PROVIDER` / `PAYMENT_PROVIDER` | Reserved; current adapters are local/unconfigured |

## Architecture

```
Internal tax model
  → AY 2026-27 rules (eligibility, tax, deductions)
  → ITR mapper
  → adapter / official schema validation
  → JSON file (hashed, stored, not mutated)
```

Providers (`src/lib/providers`): AI, OCR, storage, payments — swap implementations without touching UI.

## Next recommended step

1. Load the official ITR-4 JSON schema from the e-filing downloads page into the validator.
2. Connect an S3-compatible bucket for documents.
3. Add a real extraction provider behind `DocumentExtractionProvider`.
4. Complete ITR-3 Schedule BP / P&L / BS mapping.
