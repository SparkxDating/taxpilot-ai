# AY 2026–27 ITR-4 Schema Provenance

## Official Source

URL:

https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-07/ITR-4_2026_Main_V1.1.json

Downloads page:

https://www.incometax.gov.in/iec/foportal/downloads/income-tax-returns

ITR-4 JSON Schema link on that page (246 KB, first release 15-May-2026, latest release 30-Jun-2026).

## Schema Name

`ITR-4_2026_Main_V1.1.json` (bundled as `src/lib/itr-json/schemas/ay2026_27/itr4/schema.json`)

## Assessment Year

2026-27 (JSON `AssessmentYear` pattern `2026`)

## Release Date

30 June 2026 (HTTP Last-Modified: Tue, 30 Jun 2026 18:36:09 GMT). First JSON schema release: 15 May 2026.

## Schema Version

Ver1.0 (`SchemaVer` / `FormVer` pattern)

## Official File Size

252342 bytes

## Bundled File Size

252342 bytes

## Official SHA-256

`5e9af50083ad92faa684a02ae51693189b43df16b92c1da5a184026fc5cdc2ac`

## Bundled SHA-256

`5e9af50083ad92faa684a02ae51693189b43df16b92c1da5a184026fc5cdc2ac`

## Byte Identical

YES

## Verification Method

1. Opened the official Downloads page and identified the ITR-4 Schema URL above.
2. HTTP GET of that URL (status 200, `application/json`).
3. Saved the response body to a temporary file outside the production source tree.
4. Read bundled `schema.json` as raw bytes (not UTF-8-normalized).
5. Compared `Buffer.equals`, byte lengths, and SHA-256 of both buffers.
6. Parsed both as JSON and compared `JSON.stringify` of the parsed objects.

Result of that run (2026-08-27):

- `byteIdentical: true`
- `jsonDeepEqual: true`
- Official `$schema`: `http://json-schema.org/draft-04/schema#`
- `FormName` pattern `ITR-4`, `AssessmentYear` pattern `2026`, `SchemaVer`/`FormVer` pattern `Ver1.0`

### Line-ending note (root of the earlier discrepancy)

The official ITD artifact uses **CRLF** (`\r\n`). SHA-256 of the **LF-normalized** copy of the same JSON is:

`e4f640764e3c523bdf391c1f5a07adebcf02e033ec8b209240b6f75fb612cf87`

That digest is **not** the official file. It is the official JSON with `\r\n` replaced by `\n`. Git must not convert this file’s line endings. `.gitattributes` marks `schema.json` as `-text`.

## Verification Date

2026-08-27

## Result

PASS
