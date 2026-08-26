# AY 2026–27 ITR-4 Filing Readiness

This report is an engineering assessment of TaxPilot AI’s ITR-4 AY 2026–27 preparation path. Schema-valid is not the same as tax-calculation validated, business-rule validated, or filing-ready. TaxPilot AI is not affiliated with the Income Tax Department. This software does not file returns and does not claim department approval, government verification, or a filing guarantee.

## Official Schema

PASS

Production validation and JSON generation load `src/lib/itr-json/schemas/ay2026_27/itr4/schema.json` (official `ITR-4_2026_Main_V1.1.json`, SchemaVer Ver1.0). The development adapter schema is not used by production validation, JSON generation, or filing-readiness checks.

## Schema Integrity

PASS

SHA-256 of the official schema file matches `metadata.json`:

`5e9af50083ad92faa684a02ae51693189b43df16b92c1da5a184026fc5cdc2ac`

`verifySchemaIntegrity()` recalculates the digest on every generation/validation. A mismatch disables JSON generation with: “Official ITR-4 schema integrity verification failed. JSON generation has been disabled.”

## Mapper

PASS

The official ITR-4 mapper emits only schema paths used by supported scenarios. Missing taxpayer fields are errors; they are not fabricated. Official `CodeAD` / `CodeADA` enums are required when Schedule BP applies. Mapping audit `auditITR4Mapping()` is part of the filing gate.

## Tax Engine

PASS

Deterministic AY 2026–27 engine (no LLM in the calculation path):

- Income heads (salary, house property, 44AD, 44ADA, other sources)
- Gross total income vs GTI including s.112A
- Chapter VI-A deductions with regime restrictions and per-section caps
- Normal-rate slabs vs special-rate s.112A
- Rebate u/s 87A (new/old) including new-regime marginal relief
- Surcharge tables and 4% health and education cess
- TDS / TCS / advance tax / self-assessment, refund vs tax payable vs zero
- Central rounding (`roundIncomeAmount` / `roundTaxAmount` / `roundReturnAmount`)

## Capital Gains

PASS (supported subset)

s.112A LTCG on listed equity / equity-oriented MF is taxed at 12.5% after the ₹1.25 lakh threshold and is not added to slab income. Any other capital-gain type blocks JSON. ITR-4 eligibility still caps s.112A at ₹1.25 lakh.

## Presumptive Taxation

PASS (44AD / 44ADA)

44AD uses 6% digital + 8% cash (turnover limits 2/3 crore by cash mix). 44ADA uses 50% (limits 50/75 lakh). Declared income cannot undercut the statutory minimum. 44AE is calculated only as a library helper; filing JSON is blocked.

## Deductions

PASS (implemented sections)

Each deduction is evaluated as claimed / eligible / disallowed / reason. New-regime incompatible claims (for example 80C) are zeroed. 80C family members are capped individually; a fully combined 80C+80CCC+80CCD(1) netting pass is not implemented.

## TDS

PASS

Salary TDS, other TDS, and TCS are stored and credited separately. TCS is not added twice. Invalid TAN is not invented; the salary TDS schedule is omitted unless the TAN matches the official pattern.

## Tax Payments

PASS

Advance tax and self-assessment tax are separate credits. Settlement is `REFUND` | `TAX_PAYABLE` | `ZERO` via `calculateRefundOrPayable()`. Tax payable is never shown as a negative number.

## Eligibility

PASS

ITR-4 eligibility is explicit (resident individual/HUF/firm-not-LLP, presumptive, income ≤ ₹50 lakh, s.112A ≤ ₹1.25 lakh, no STCG/other LTCG, ≤ two house properties, no F&O/director/foreign assets, etc.). Residential status is not assumed to be Resident when blank.

## Official Validation Rules

PARTIAL

Implemented for supported scenarios (see `src/lib/itr-rules/ay2026_27/officialRules.ts`): ITR4_RULE_001 through ITR4_RULE_011 plus completeness and business-rule IDs (PAN, bank, 44AD/44ADA floors, 112A special rate, schema draft-04). The full CBDT ITR-4 AY 2026–27 validation-rules PDF is not claimed as completely implemented.

## JSON Generation

PASS

`evaluateFilingGate()` requires all of: schema integrity, data completeness, eligibility, business rules, tax calculation, no unsupported scenario, mapping audit, official schema. Failure returns no JSON (`json: null`). Status after success is `JSON_GENERATED`, never filed. Changing return data marks prior JSON `SUPERSEDED`.

## Test Suite

PASS

## TypeScript

PASS

## Lint

PASS

## Production Build

PASS

`npm run build` completed. Next.js 16 warns that the `middleware` file convention is deprecated in favour of `proxy`; this is a framework notice, not a TaxPilot filing defect, and was left unchanged in this phase.

## Security

PASS (for this repo layout)

- Secrets belong in `.env` (gitignored). Only `.env.example` with placeholders is committed.
- Demo credentials are seeded only when `DEMO_MODE=true` and never when `NODE_ENV=production`.
- Audit metadata strips PAN, Aadhaar, account numbers, IFSC, DOB, passwords, tokens.
- UI masks PAN and bank account numbers on review.

## Known Limitations

1. ITR-3 JSON generation is disabled.
2. Section 44AE goods-carriage returns cannot generate filing JSON.
3. Capital gains other than s.112A (within the ITR-4 ₹1.25 lakh cap) are unsupported.
4. Current-year loss carry-forward is unsupported and blocks JSON when GTI is negative.
5. Official CBDT validation-rules PDF coverage is PARTIAL.
6. Rebate u/s 87A uses total income including s.112A as the ₹12 lakh threshold (conservative reading of “total income”). Interaction is flagged when it changes the rebate.
7. Old-regime senior / super-senior slabs are coded but not auto-selected from date of birth.
8. 80D is capped at ₹1,00,000 without a verified self/parents/senior split.
9. Combined 80C + 80CCC + 80CCD(1) ceiling is not fully netted as a single basket beyond per-section caps.
10. Form 10-IEA acknowledgement is a Y/NA flag only; the department acknowledgement is not ingested.
11. Interest u/s 234A/234B/234C and late fee 234F are emitted as zero; they are not computed.
12. AIS / 26AS is not treated as authoritative; reconciliation is a warning path.
13. No Income Tax Department e-filing API. `JSON_GENERATED` is not “filed”.
14. Nature of business/profession requires an official schema enum code; TaxPilot will not guess `09027` or any other code.
15. Salary TDS schedule is omitted when TAN is missing or not in the official TAN pattern.
16. Surcharge does not arise inside the ITR-4 ₹50 lakh ceiling; tables exist for the engine but ITR-4 JSON is blocked above the ceiling.
17. Agricultural income, lottery, foreign assets, unlisted shares, and director cases are eligibility failures / unsupported.
18. Test/demo PANs and bank accounts live in `src/lib/tax/fixtures.ts` and `tests/fixtures/` only. Seed users require `DEMO_MODE=true` and are refused in production.

## Filing Status

READY FOR CONTROLLED PILOT

Not “ready to file”. Not department-approved. Suitable for trained internal operators preparing ITR-4 JSON for supported AY 2026–27 presumptive scenarios, with human review before any upload to the Income Tax e-filing portal.
