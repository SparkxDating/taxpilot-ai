# AY 2026–27 ITR-4 Filing Readiness

Verified 2026-08-27 against the live Income Tax Department schema and a clean `npm ci` + test/typecheck/lint/build run. TaxPilot AI is not affiliated with the Income Tax Department. JSON generation is not filing.

## Official Schema

PASS

Bundled file: `src/lib/itr-json/schemas/ay2026_27/itr4/schema.json`  
Official filename: `ITR-4_2026_Main_V1.1.json`  
SchemaVer / FormVer: Ver1.0  
AssessmentYear pattern: `2026`  
Draft: JSON Schema draft-04  
Top-level keys: `$schema`, `type`, `additionalProperties`, `properties`, `definitions`  
Bytes: 252342

## Official Source Verification

PASS

Source (Income Tax Department):  
https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-07/ITR-4_2026_Main_V1.1.json  

HTTP 200, Content-Type application/json, Last-Modified Tue, 30 Jun 2026 18:36:09 GMT. Listed on the e-filing Downloads page (JSON Schema latest release 30-Jun-2026, 246 KB). Companion schema-change document V1.1 dated 30 June 2026.

Live official file SHA-256 equals bundled SHA-256. The previously reported digest `e4f640764e3c523bdf391c1f5a07adebcf02e033ec8b209240b6f75fb612cf87` does **not** match the official ITD file and is not used.

## SHA-256 Integrity

PASS

Calculated from bundled `schema.json` and from the live ITD file:

`5e9af50083ad92faa684a02ae51693189b43df16b92c1da5a184026fc5cdc2ac`

Tests: correct pair PASS; modified schema FAIL; wrong metadata FAIL; missing schema FAIL; missing metadata FAIL. Integrity failure blocks JSON (`OFFICIAL_SCHEMA_INTEGRITY_FAILURE`) and prevents `READY_FOR_JSON` / `JSON_GENERATED`.

## AJV Validation

PASS

Production uses `ajv-draft-04` against the official schema import. `validateITR4Json` / `generateITRJson` report `schemaMode: OfficialSchema`. `loadDevelopmentAdapterSchema()` is not called from the JSON path and throws in `NODE_ENV=production`.

## Mapper

PASS

Official ITR-4 mapper for supported scenarios. Missing taxpayer data is an error, not a default.

## Mapping Audit

PASS

`auditITR4Mapping()` critical status PASS in the test suite.

## Tax Engine

PASS

Deterministic AY 2026–27 engine. No LLM in the calculation path.

## 234A

PASS

## 234B

PASS

## 234C

PASS

Computed when instalments are unpaid or dated. If advance tax was paid without dates, JSON is blocked rather than emitting zero.

## 234F

PASS

## 80D

PASS

Self/family and parents baskets; senior limits from attributes/DOB.

## 80C/80CCC/80CCD(1)

PASS

Combined ₹1,50,000 ceiling.

## Senior Citizen Logic

PASS

`ageAtFinancialYearEnd()` on 31 Mar 2026.

## Capital Gains

PARTIAL

s.112A with dates and >12-month holding is supported. Other capital-gain types block JSON.

## Presumptive Taxation

PARTIAL

44AD and 44ADA supported. 44AE JSON is blocked.

## Loss Handling

PARTIAL

House-property set-off up to ₹2 lakh. Carry-forward blocks JSON.

## TDS/TCS

PASS

TCS is not double-counted with TDS.

## Refund/Tax Payable

PASS

REFUND / TAX_PAYABLE / ZERO. Never a negative payable.

## Official Validation Rules

PARTIAL

ITR4_RULE_001–015 for supported scenarios. Remaining vs the CBDT ITR-4 Validation Rules PDF (Category A/B, 80G donee PAN, 234-I revised-return fee, Aadhaar–PAN linking, co-owned HP share, Form 10-IEA acknowledgement, etc.) are not implemented as a complete PDF engine.

## JSON Generation Gate

PASS

Requires schema integrity, completeness, eligibility, business rules, tax calculation, no unsupported scenarios, mapping audit, official schema. Failure returns `json: null`.

## Security

PASS

`.env*` gitignored except `.env.example` placeholders. No API keys/private keys committed. Demo seed only when `DEMO_MODE=true` and never in production. Test PANs only in fixtures.

## Tests

PASS

`npm test`: 106 passed, 0 failed, 0 skipped.

## TypeScript

PASS

## Lint

PASS

## Production Build

PASS

`npm run build` completed. Next.js warns that the `middleware` file convention is deprecated in favour of `proxy` (unchanged this phase).

## Schema inventory

| Role | Path |
|---|---|
| Official production schema | `src/lib/itr-json/schemas/ay2026_27/itr4/schema.json` |
| Development adapter (not production) | `src/lib/itr-json/schemas/ay2026_27/development/adapter.schema.json` |
| Test schemas | none (tests use the official file) |
| Duplicates | none besides the labelled development adapter |

## Database

Local Prisma provider is **SQLite**. PostgreSQL is supported via `docker-compose.yml` (port 5433) by changing `prisma/schema.prisma` `provider` to `postgresql` and `DATABASE_URL`. Production must not keep the SQLite provider.

## Known Limitations

1. ITR-3 JSON is disabled.
2. 44AE filing JSON is blocked.
3. Capital gains other than dated s.112A LTCG within ₹1.25 lakh are blocked.
4. Loss carry-forward is blocked.
5. Official CBDT validation PDF is PARTIAL.
6. 234C blocks JSON if advance tax was paid without dates.
7. 234A uses JSON generation date as the intended filing date.
8. Committed Prisma provider is SQLite; production PostgreSQL requires a provider switch.
9. `npm ci` on this environment skips Prisma/esbuild install scripts (`allow-scripts`); `prisma generate` is required (and is part of `npm run build`).
10. No e-filing API. `JSON_GENERATED` is not filed.

## FINAL STATUS

READY FOR CONTROLLED PILOT

Not ready to file. Not department-approved.
