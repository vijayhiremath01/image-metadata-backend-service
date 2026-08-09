import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.POSTGRES_URL!);

async function main() {
  const result = await sql`SELECT version()`;
  console.log(result);
  await sql.end();
}

main().catch(console.error);