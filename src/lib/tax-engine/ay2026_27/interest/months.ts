/** Count months or part thereof between two calendar dates (UTC). Inclusive of both ends. */
export function monthsOrPartThereof(fromInclusive: Date, toInclusive: Date): number {
  const start = Date.UTC(fromInclusive.getUTCFullYear(), fromInclusive.getUTCMonth(), fromInclusive.getUTCDate());
  const end = Date.UTC(toInclusive.getUTCFullYear(), toInclusive.getUTCMonth(), toInclusive.getUTCDate());
  if (end < start) return 0;
  return (
    (toInclusive.getUTCFullYear() - fromInclusive.getUTCFullYear()) * 12 +
    (toInclusive.getUTCMonth() - fromInclusive.getUTCMonth()) +
    1
  );
}

export function addDays(d: Date, days: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

export function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
