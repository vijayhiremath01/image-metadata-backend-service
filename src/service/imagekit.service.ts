import { imagekit } from "@/config/imagekit.config";

export async function uploadImage(file: Buffer , fileName : string): Promise<any>{
   return await imagekit.upload({
        file,
        fileName,
        folder: "/wallpapers",
    });
}

export async function deleteImage(fileId: string): Promise<any> {
    return await imagekit.deleteFile(fileId);
}