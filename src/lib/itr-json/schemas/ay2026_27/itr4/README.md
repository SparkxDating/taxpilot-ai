# Official ITR-4 JSON Schema — AY 2026–27

**Source of truth:** Income Tax Department e-filing portal Downloads.

| Item | Value |
|---|---|
| File | `schema.json` (ITR-4_2026_Main_V1.1.json) |
| Latest schema date | 30 June 2026 |
| First schema date | 15 May 2026 |
| SchemaVer / FormVer | Ver1.0 |
| AssessmentYear in JSON | `2026` (4 characters) |
| Draft | JSON Schema draft-04 |
| URL | https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-07/ITR-4_2026_Main_V1.1.json |

Companion documents (linked in `metadata.json`):

- Schema change document V1.1 (PDF)
- Validation rules AY 2026-27 (PDF)

Production validation **must** load this file via `schemaLoader.ts`. The development adapter under `../development/adapter.schema.json` is not an official schema and must not be used as the production authority.
