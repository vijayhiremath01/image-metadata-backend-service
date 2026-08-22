import { imagekit } from "@/config/imagekit.config";

interface BlurHashResponse {
  blurHash: string;
}

interface ColorResponse {
  colors: Array<{ hex: string }>;
}

export async function uploadImage(file: Buffer, fileName: string): Promise<{
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  size: number;
  fileType: string;
  fileId: string;
  blurHash?: string;
  hexColor?: string;
}> {
  const uploadResponse = await imagekit.upload({
    file,
    fileName,
    folder: "/wallpapers",
  });

  const url = uploadResponse.url;
  const fileId = uploadResponse.fileId;

  const thumbnailUrl = `${url}?tr=w-400,h-300,q-80`;
  const blurHashUrl = `${url}?tr=blur-30`;
  const colorUrl = `${url}?tr=colors-1`;

  let blurHash: string | undefined;
  let hexColor: string | undefined;

  try {
    const blurResponse = await fetch(blurHashUrl);
    if (blurResponse.ok) {
      const blurData = await blurResponse.json() as BlurHashResponse;
      blurHash = blurData.blurHash;
    }
  } catch {
    console.warn('Failed to generate blurHash');
  }

  try {
    const colorResponse = await fetch(colorUrl);
    if (colorResponse.ok) {
      const colorData = await colorResponse.json() as ColorResponse;
      hexColor = colorData.colors?.[0]?.hex;
    }
  } catch {
    console.warn('Failed to generate dominant color');
  }

  return {
    url,
    thumbnailUrl,
    width: uploadResponse.width,
    height: uploadResponse.height,
    size: uploadResponse.size,
    fileType: uploadResponse.fileType,
    fileId,
    blurHash,
    hexColor,
  };
}

export async function deleteImage(fileId: string): Promise<any> {
  return await imagekit.deleteFile(fileId);
}