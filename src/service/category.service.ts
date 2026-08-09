import { db } from "@/db/db-connection";
import { categories } from "@/db/schema";
import { eq, desc, count, and } from "drizzle-orm";

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

export async function getAllCategories(): Promise<typeof categories.$inferSelect[]> {
  return db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(desc(categories.createdAt));
}

export async function getCategoryBySlug(slug: string): Promise<typeof categories.$inferSelect | null> {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.isActive, true)))
    .limit(1);

  return category || null;
}