import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const connectionString = process.env.POSTGRES_URL!;
const url = new URL(connectionString);

const client = postgres(connectionString, {
  port: url.port ? parseInt(url.port) : 5432,
});

export const db = drizzle(client, { schema });