import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.POSTGRES_URL!);

async function main() {
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  console.log('Tables:', tables.map(t => t.table_name).join(', '));
  await sql.end();
}

main().catch(console.error);