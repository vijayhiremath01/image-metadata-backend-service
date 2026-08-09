import "dotenv/config";
import { db } from './src/db/db-connection';
import fs from 'fs';

async function runMigration() {
  const migrationSQL = fs.readFileSync('./manual_migration.sql', 'utf-8');
  const statements = migrationSQL.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s.length > 0);
  
  for (const statement of statements) {
    try {
      await db.execute(statement);
      console.log('Executed:', statement.substring(0, 80) + '...');
    } catch (error) {
      console.error('Error executing:', statement.substring(0, 80) + '...');
      console.error(error);
    }
  }
  
  console.log('Migration complete');
}

runMigration().catch(console.error);
