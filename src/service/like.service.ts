import { db } from "@/db/db-connection";
import { photos } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function likePhoto(photoId: string , ipAdess: string) {
    const [photo] = await db
    .select()
    .from(photos)
    .where(eq(photos.id, photoId));

    if(!photo){
        throw new Error('Photo not found');
    }

    await db
    .update(photos)
    .set({
        likesCount : sql`${photos.likesCount} + 1`,
    })
    .where(eq(photos.id, photoId));
    
    const [updatedPhoto] = await db
  .select()
  .from(photos)
  .where(eq(photos.id, photoId));

return updatedPhoto;

}