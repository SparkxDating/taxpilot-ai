# AY 2026–27 ITR-4 Filing Readiness

Verification date: 2026-08-27. Values below are from an executed HTTP download of the official schema and an executed `npm ci` → `npm test` → `npm run typecheck` → `npm run lint` → `npm run build` sequence. TaxPilot AI is not affiliated with the Income Tax Department. JSON generation is not filing.

## Official Schema

VERIFIED

## Official Provenance

VERIFIED

See `docs/ITR4_SCHEMA_PROVENANCE.md`. Official URL:

https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-07/ITR-4_2026_Main_V1.1.json

Linked from https://www.incometax.gov.in/iec/foportal/downloads/income-tax-returns (ITR-4 Schema, 246 KB, latest 30-Jun-2026).

## SHA-256 Integrity

VERIFIED

Official and bundled SHA-256 (raw bytes):

`5e9af50083ad92faa684a02ae51693189b43df16b92c1da5a184026fc5cdc2ac`

Byte identical: YES. File size: 252342.

The digest `e4f640764e3c523bdf391c1f5a07adebcf02e033ec8b209240b6f75fb612cf87` is the **LF-normalized** copy of the same JSON. The official ITD artifact uses CRLF. `.gitattributes` marks `schema.json` as `-text` so Git does not convert line endings.

Runtime integrity checks bundled file vs `metadata.sha256` only. It does not re-download ITD at runtime.

## AJV Validation

VERIFIED

Production compiles `src/lib/itr-json/schemas/ay2026_27/itr4/schema.json` with `ajv-draft-04`. Development adapter is not on the JSON path.

## Mapper

VERIFIED (supported ITR-4 scenarios)

## Mapping Audit

VERIFIED (audit status PASS in tests)

## Tax Engine

VERIFIED (deterministic; no LLM)

## 234A

VERIFIED

## 234B

VERIFIED

## 234C

VERIFIED (blocks JSON if advance tax was paid without dates)

## 234F

VERIFIED

## 80D

VERIFIED (self/parents baskets)

## 80C/80CCC/80CCD(1)

VERIFIED (combined ₹1.5 lakh ceiling)

## Senior Citizen Logic

VERIFIED (age on 31 Mar 2026)

## Capital Gains

PARTIAL

s.112A with dates and holding > 12 months supported. Other types blocked.

## Presumptive Taxation

PARTIAL

44AD / 44ADA supported. 44AE JSON blocked.

## Loss Handling

PARTIAL

HP set-off ≤ ₹2 lakh. Carry-forward blocked.

## TDS/TCS

VERIFIED

## Refund/Tax Payable

VERIFIED

## Official Validation Rules

PARTIAL

ITR4_RULE_001–015 for supported scenarios. Remaining vs CBDT ITR-4 Validation Rules PDF: Category A/B defects not fully encoded (80G donee PAN, 234-I revised-return fee, Aadhaar–PAN linking, co-owned HP 100% share, Form 10-IEA acknowledgement matching, exempt-income constraints, etc.).

## JSON Gate

VERIFIED

Integrity + completeness + eligibility + business + tax + unsupported=none + mapping + official schema. Failure → `json: null`.

## Security

VERIFIED (`.env*` gitignored except `.env.example`; test PANs only in fixtures)

## Tests

VERIFIED

`npm test` exit 0. 107 passed, 0 failed, 0 skipped.

## Typecheck

VERIFIED

`npm run typecheck` exit 0.

## Lint

VERIFIED

`npm run lint` exit 0.

## Build

VERIFIED

`npm run build` exit 0. Next.js middleware→proxy deprecation warning only.

## Production Database

SQLite (`prisma/schema.prisma` provider = sqlite). PostgreSQL is available via `docker-compose.yml` on port 5433. **PostgreSQL migration required before production launch.** No database migration was run in this phase.

## Schema inventory

| Classification | Path |
|---|---|
| PRODUCTION | `src/lib/itr-json/schemas/ay2026_27/itr4/schema.json` |
| DEVELOPMENT | `src/lib/itr-json/schemas/ay2026_27/development/adapter.schema.json` |
| TEST / FIXTURE | none (tests use the production file) |

## Known Limitations

1. ITR-3 JSON disabled.
2. 44AE JSON blocked.
3. Non-112A capital gains blocked.
4. Loss carry-forward blocked.
5. Official CBDT validation PDF PARTIAL.
6. 234C blocked if advance tax paid without dates.
7. 234A uses JSON generation date as intended filing date.
8. Committed Prisma provider is SQLite.
9. `npm ci` skips Prisma/esbuild scripts (`allow-scripts`); `prisma generate` is required (included in `npm run build`).
10. No e-filing. `JSON_GENERATED` is not filed.

## FINAL STATUS

READY FOR CONTROLLED PILOT
