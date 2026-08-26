export type JsonFileStatus = "CURRENT" | "SUPERSEDED";

/** When return data (or generated JSON hash) changes, the previous CURRENT file is SUPERSEDED. */
export function nextJsonFileStatuses(previousHash: string | null | undefined, newHash: string) {
  if (previousHash && previousHash !== newHash) {
    return { previous: "SUPERSEDED" as const, current: "CURRENT" as const, changed: true };
  }
  return { previous: null, current: "CURRENT" as const, changed: false };
}

export function normalizeJsonForCompare(json: unknown) {
  const clone = JSON.parse(JSON.stringify(json)) as { ITR?: { ITR4?: { CreationInfo?: { JSONCreationDate?: string } } } };
  if (clone?.ITR?.ITR4?.CreationInfo) {
    clone.ITR.ITR4.CreationInfo.JSONCreationDate = "";
  }
  return clone;
}
