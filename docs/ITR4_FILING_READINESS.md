# AY 2026–27 ITR-4 Filing Readiness

This report is an engineering assessment of TaxPilot AI’s ITR-4 AY 2026–27 preparation path after Phase 2.2. Schema-valid is not the same as tax-calculation validated, business-rule validated, or filing-ready. TaxPilot AI is not affiliated with the Income Tax Department. JSON generation is not filing.

## Schema

PASS

Production validation uses `src/lib/itr-json/schemas/ay2026_27/itr4/schema.json` (official `ITR-4_2026_Main_V1.1.json`, SchemaVer Ver1.0, last modified 30 Jun 2026). Re-fetched from the Income Tax Department URL on 2026-08-26: byte-for-byte match (252,342 bytes). The development adapter is not used in production.

## Schema Integrity

PASS

SHA-256: `5e9af50083ad92faa684a02ae51693189b43df16b92c1da5a184026fc5cdc2ac`

This checksum was **not** invented to match a local file. It is the digest of the live official file and of the bundled copy. `verifySchemaIntegrity()` / `verifySchemaFile()` fail closed (wrong checksum, modified bytes, missing file). Failure message: “Official AY 2026–27 ITR-4 schema integrity verification failed. JSON generation is disabled.” No JSON is written.

## Mapper

PASS

Supported ITR-4 fields map to official paths. Missing taxpayer values are errors. Official CodeAD/CodeADA required. Mapping audit is in the filing gate.

## Tax Engine

PASS

Deterministic AY 2026–27 engine (no LLM): income heads, presumptive 44AD/44ADA, 112A special rate, Chapter VI-A with regime list from `getApplicableDeductions`, `calculateTaxByRegime` (including senior/super-senior old-regime slabs from DOB), 87A, surcharge, cess, TDS/TCS/advance/SAT, 234A/B/C, 234F, refund/payable, centralized rounding.

## 234A

PASS

1% per month or part thereof on unpaid tax from the day after 31 Aug 2026 to the JSON generation/filing date. Zero when generated on or before the due date.

## 234B

PASS

1% per month from 1 Apr 2026 when advance tax is under 90% of assessed tax and assessed tax ≥ ₹10,000. Assessed tax = tax − TDS − TCS.

## 234C

PASS (with a hard block)

Instalments for FY 2025-26: 15 Jun 15%, 15 Sep 45%, 15 Dec 75%, 15 Mar 100% (31 Mar grace on the last instalment). If advance tax was paid without dates, JSON is blocked (`UNSUPPORTED_INTEREST_CALCULATION`) rather than assuming dates or emitting zero. If no advance tax was paid and liability exists, interest is computed as unpaid instalments.

## 234F

PASS

₹0 on or before due date. After due date: ₹1,000 if taxable income ≤ ₹5 lakh, else ₹5,000.

## Capital Gains

PASS (supported subset)

s.112A listed-equity LTCG at 12.5% after ₹1.25 lakh, not slab income. Acquisition and sale dates are required; holding must be more than 12 months. Other capital-gain types block JSON and are not converted to slab income.

## Presumptive Taxation

PASS (44AD / 44ADA)

6%/8% and 50% floors cannot be undercut. 44AE remains blocked for JSON.

## Deductions

PASS (implemented sections)

Regime eligibility is centralized. New regime only allows 80CCD(2) in Chapter VI-A.

## 80D

PASS

Self/family and parents baskets, senior vs non-senior limits (₹25,000 / ₹50,000), preventive check-up ₹5,000 inside the basket, medical expenditure only for seniors without insurance. No flat ₹1,00,000 cap.

## 80C/80CCC/80CCD(1)

PASS

Sections are modelled separately then reduced to the ₹1,50,000 combined ceiling. 80CCD(1) is also capped at 10% of salary when salary exists. 80CCD(1B) is outside that basket.

## Senior Citizen Logic

PASS

`ageAtFinancialYearEnd()` uses 31 Mar 2026. Categories: NORMAL / SENIOR_CITIZEN (≥60) / SUPER_SENIOR_CITIZEN (≥80). Used for old-regime slabs, 80D self basket, 80TTA vs 80TTB.

## TDS

PASS

Salary TDS and other TDS are separate. TCS is not double-counted.

## TCS

PASS

## Tax Payments

PASS

Advance tax and self-assessment tax are separate credits. Payment dates are required when advance tax is paid so that 234C can be computed.

## Loss Handling

PARTIAL

House-property loss may be set off against other heads up to ₹2,00,000. Any remainder (carry-forward) blocks JSON. Negative GTI blocks JSON. Losses are not converted to zero.

## Official Validation Rules

PARTIAL

ITR4_RULE_001–015 for supported scenarios. The full CBDT validation-rules PDF is not claimed as complete.

## JSON Gate

PASS

Requires: schema integrity, completeness, eligibility, business rules, tax calculation, no unsupported scenario, mapping audit, official schema. Failure returns `json: null` — no invalid file is written.

## Mapping Audit

PASS

`auditITR4Mapping()` reports unmapped internals, duplicates, invalid types/enums, unreachable paths. Critical status must be PASS.

## Security

PASS (repo layout)

Secrets in gitignored `.env`. Demo seed only with `DEMO_MODE=true` and never in production. Audit metadata strips PAN/Aadhaar/account/IFSC/DOB/password/token. Review UI masks PAN and accounts. Test PANs exist only in fixtures.

## Tests

PASS

## Build

PASS (see command log in the Phase 2.2 completion report)

## Known Limitations

1. ITR-3 JSON is disabled.
2. 44AE filing JSON is blocked.
3. Capital gains other than dated s.112A LTCG within ₹1.25 lakh are blocked.
4. Loss carry-forward is blocked.
5. Official CBDT validation PDF is PARTIAL.
6. 234C cannot be computed if advance tax was paid without instalment dates — JSON is blocked.
7. Combined 80G / 80DD / 80DDB / 80E detail is not modelled beyond amount passthrough under the old regime.
8. Interest u/s 234A uses JSON generation date as the intended filing date.
9. No e-filing API. `JSON_GENERATED` is not filed.
10. Form 10-IEA is a Y/NA flag only.

## Filing Status

READY FOR CONTROLLED PILOT

Not “ready to file”. Not department-approved. Suitable for trained operators preparing ITR-4 JSON for supported AY 2026–27 presumptive scenarios, with human review before portal upload.
