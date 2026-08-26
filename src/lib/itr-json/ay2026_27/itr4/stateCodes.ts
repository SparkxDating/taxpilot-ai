const STATES: Record<string, string> = {
  "JAMMU AND KASHMIR": "01",
  "HIMACHAL PRADESH": "02",
  "PUNJAB": "03",
  "CHANDIGARH": "04",
  "UTTARAKHAND": "05",
  "HARYANA": "06",
  "DELHI": "07",
  "RAJASTHAN": "08",
  "UTTAR PRADESH": "09",
  "BIHAR": "10",
  "SIKKIM": "11",
  "ARUNACHAL PRADESH": "12",
  "NAGALAND": "13",
  "MANIPUR": "14",
  "MIZORAM": "15",
  "TRIPURA": "16",
  "MEGHALAYA": "17",
  "ASSAM": "18",
  "WEST BENGAL": "19",
  "JHARKHAND": "20",
  "ODISHA": "21",
  "ORISSA": "21",
  "CHHATTISGARH": "22",
  "MADHYA PRADESH": "23",
  "GUJARAT": "24",
  "DAMAN AND DIU": "25",
  "DADRA AND NAGAR HAVELI": "26",
  "MAHARASHTRA": "27",
  "ANDHRA PRADESH": "28",
  "KARNATAKA": "29",
  "GOA": "30",
  "LAKSHADWEEP": "31",
  "KERALA": "32",
  "TAMIL NADU": "33",
  "PUDUCHERRY": "34",
  "PONDICHERRY": "34",
  "ANDAMAN AND NICOBAR": "35",
  "TELANGANA": "36",
  "LADAKH": "37",
};

export function stateCodeOf(state?: string) {
  if (!state) return "99";
  const key = state.trim().toUpperCase();
  if (/^\d{2}$/.test(key)) return key;
  return STATES[key] || "99";
}

export function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "NA", last: "NA" };
  if (parts.length === 1) return { first: parts[0].slice(0, 25), last: parts[0].slice(0, 75) };
  return { first: parts[0].slice(0, 25), last: parts.slice(1).join(" ").slice(0, 75) };
}

export function mobileInt(phone?: string) {
  const d = (phone || "").replace(/\D/g, "").slice(-10);
  const n = Number(d);
  return Number.isFinite(n) && d.length === 10 ? n : 9999999999;
}

export function pinInt(pin?: string) {
  const n = Number((pin || "").replace(/\D/g, "").slice(0, 6));
  if (n >= 100000 && n <= 999999) return n;
  return 560001;
}
