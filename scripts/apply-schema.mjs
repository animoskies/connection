import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Client } from "pg";

async function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const rl = createInterface({ input, output });
  const password = await rl.question("Supabase database password: ");
  rl.close();

  const encodedPassword = encodeURIComponent(password.trim());
  return `postgresql://postgres:${encodedPassword}@db.dxduraewkxlkobtgkugl.supabase.co:5432/postgres`;
}

const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const client = new Client({
  connectionString: await getDatabaseUrl(),
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  await client.query(schema);
  console.log("Supabase schema applied.");
} finally {
  await client.end();
}
