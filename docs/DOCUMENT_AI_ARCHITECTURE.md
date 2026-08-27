# Document intelligence architecture

Upload → classify → local extract → TaxFact (unverified) → human verify/edit/reject → apply verified facts → existing tax model → existing tax engine → existing ITR-4 mapper → official schema gate.

AI/OCR is optional input only. `DOCUMENT_AI_PROVIDER` is unused in this phase; extraction is local/deterministic (PDF text, CSV). Images and XLSX require manual entry.

Never: extractor → ITR JSON.
