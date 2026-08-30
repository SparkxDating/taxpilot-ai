#!/usr/bin/env node
const { spawnSync } = require("child_process");

if (!process.env.DATABASE_URL_UNPOOLED && process.env.DATABASE_URL) {
  process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL;
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit", env: process.env, shell: process.platform === "win32" });
  if (result.status) process.exit(result.status);
}

run("npx", ["prisma", "generate"]);
if (process.env.DATABASE_URL) {
  run("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"]);
}
run("npx", ["next", "build"]);
