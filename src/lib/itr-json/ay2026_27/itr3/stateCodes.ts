/** Official ITR-3 AY 2026-27 StateCode enum (not ITR-4 codes). */
const ITR3_STATES: Record<string, string> = {
  "ANDAMAN AND NICOBAR": "01",
  "ANDAMAN AND NICOBAR ISLANDS": "01",
  "ANDHRA PRADESH": "02",
  "ARUNACHAL PRADESH": "03",
  "ASSAM": "04",
  "BIHAR": "05",
  "CHANDIGARH": "06",
  "DADRA AND NAGAR HAVELI": "07",
  "DADRA NAGAR AND HAVELI": "07",
  "DAMAN AND DIU": "08",
  "DELHI": "09",
  "GOA": "10",
  "GUJARAT": "11",
  "HARYANA": "12",
  "HIMACHAL PRADESH": "13",
  "JAMMU AND KASHMIR": "14",
  "KARNATAKA": "15",
  "KERALA": "16",
  "LAKSHADWEEP": "17",
  "MADHYA PRADESH": "18",
  "MAHARASHTRA": "19",
  "MANIPUR": "20",
  "MEGHALAYA": "21",
  "MIZORAM": "22",
  "NAGALAND": "23",
  "ODISHA": "24",
  "ORISSA": "24",
  "PUDUCHERRY": "25",
  "PONDICHERRY": "25",
  "PUNJAB": "26",
  "RAJASTHAN": "27",
  "SIKKIM": "28",
  "TAMIL NADU": "29",
  "TRIPURA": "30",
  "UTTAR PRADESH": "31",
  "WEST BENGAL": "32",
  "CHHATTISGARH": "33",
  "UTTARAKHAND": "34",
  "JHARKHAND": "35",
  "TELANGANA": "36",
  "LADAKH": "37",
};

export function itr3StateCodeOf(state?: string): string | null {
  if (!state) return null;
  const key = state.trim().toUpperCase();
  if (/^(0[1-9]|[12][0-9]|3[0-7]|99)$/.test(key)) return key;
  return ITR3_STATES[key] || null;
}
