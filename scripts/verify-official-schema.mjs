import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const localPath = "src/lib/itr-json/schemas/ay2026_27/itr4/schema.json";
const local = readFileSync(localPath);
const localHash = createHash("sha256").update(local).digest("hex");
const parsed = JSON.parse(local.toString("utf8"));
console.log("local bytes", local.length);
console.log("local sha256", localHash);
console.log("local $schema", parsed.$schema);
console.log("local title", parsed.title || parsed.id || parsed.description?.slice?.(0, 80));

const url = "https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-07/ITR-4_2026_Main_V1.1.json";
const res = await fetch(url);
console.log("official status", res.status, res.headers.get("content-type"), res.headers.get("last-modified"));
const remote = Buffer.from(await res.arrayBuffer());
const remoteHash = createHash("sha256").update(remote).digest("hex");
console.log("official bytes", remote.length);
console.log("official sha256", remoteHash);
console.log("match", localHash === remoteHash);
if (localHash !== remoteHash) {
  const tmp = join(tmpdir(), "ITR-4_2026_Main_V1.1.official.json");
  writeFileSync(tmp, remote);
  console.log("wrote official copy", tmp);
  try {
    const rj = JSON.parse(remote.toString("utf8"));
    console.log("official $schema", rj.$schema);
    console.log("official keys", Object.keys(rj).slice(0, 15).join(","));
  } catch (e) {
    console.log("official parse error", String(e));
    console.log("official head", remote.slice(0, 200).toString("utf8"));
  }
}
