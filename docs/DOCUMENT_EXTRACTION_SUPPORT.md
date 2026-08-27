# Document extraction support

| Type | Status |
|---|---|
| Form 16 | Implemented (text/PDF text) |
| AIS | Implemented (text labels) |
| TIS | Implemented (text labels, separate fields) |
| Bank statement | CSV and XLSX implemented; PDF if text-extractable |
| Salary slip, 80C proofs, CG statement, other | Placeholder / manual |

Missing fields stay `null`. Credits are not income until classified. Conflicts between verified sources are `CONFLICT`.
