import "dotenv/config";
import postgres from 'postgres';
import fs from 'fs';

const connectionString = process.env.POSTGRES_URL!;
console.log('Connecting to:', connectionString.substring(0, 50) + '...');

const sql = postgres(connectionString);

async function runMigration() {
  const migrationSQL = fs.readFileSync('./manual_migration.sql', 'utf-8');
  const statements = migrationSQL.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s.length > 0);
  
  for (const statement of statements) {
    try {
      await sql.unsafe(statement);
      console.log('Executed:', statement.substring(0, 80) + '...');
    } catch (error) {
      console.error('Error executing:', statement.substring(0, 80) + '...');
      console.error(error);
    }
  }
  
  await sql.end();
  console.log('Migration complete');
}

runMigration().catch(console.error);
