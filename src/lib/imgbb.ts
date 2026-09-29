"server-only";

const IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload";

type ImgBbResponse = {
  success: boolean;
  data?: {
    display_url?: string;
    url?: string;
  };
  error?: { message?: string };
};

export async function uploadToImgBb(file: File): Promise<string> {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) throw new Error("IMGBB_API_KEY is not configured.");

  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`${IMGBB_UPLOAD_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    body: formData,
  });
  const result = (await response.json()) as ImgBbResponse;
  const imageUrl = result.data?.display_url ?? result.data?.url;

  if (!response.ok || !result.success || !imageUrl) {
    throw new Error(result.error?.message ?? "ImgBB upload failed.");
  }

  return imageUrl;
}