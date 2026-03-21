import type { ResponseType, AttachmentItem } from "@/types/chat.type";
import { api } from "@/lib/axios.config";
import { handleApiError } from "@/utils/apiError.util";

interface UploadMediaResponse {
  attachments: AttachmentItem[];
}

interface UploadMediaOptions {
  onProgress?: (percent: number) => void;
}

/**
 * Upload a single image file for chat media.
 *
 * Endpoint: POST /api/media/upload (baseURL already includes /api).
 * Axios auto-sets Content-Type with multipart boundary — do not set manually.
 *
 * @param file - Image file (JPEG, PNG, or WEBP, max 10 MB)
 * @param options.onProgress - Optional upload progress callback (0–100)
 */
async function uploadMediaApi(
  file: File,
  options?: UploadMediaOptions
): Promise<AttachmentItem> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response: ResponseType<UploadMediaResponse> = await api.post(
      "media/upload",
      formData,
      {
        onUploadProgress(event) {
          if (options?.onProgress && event.total) {
            options.onProgress(Math.round((event.loaded * 100) / event.total));
          }
        },
      }
    );

    const attachment = response.data.attachments[0];
    if (!attachment) {
      throw new Error("Upload succeeded but server returned no attachments");
    }
    return attachment;
  } catch (error) {
    throw handleApiError(error);
  }
}

export { uploadMediaApi };
