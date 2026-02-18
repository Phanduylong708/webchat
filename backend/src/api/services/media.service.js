import { prisma } from "../../shared/prisma.js";
import {
  ensureCloudinaryConfigured,
  CLOUDINARY_MEDIA_FOLDER,
} from "../../shared/config/cloudinary.config.js";
import { createHTTPError } from "../../shared/utils/error.util.js";

/**
 * Upload a media file to Cloudinary and persist a PENDING MessageAttachment.
 *
 * @param {number} userId - Authenticated user ID
 * @param {{ buffer: Buffer, mimetype: string, size: number, originalname: string }} file - Multer file
 * @returns {Promise<{ attachments: object[] }>} Normalized attachment DTO array
 */
async function uploadMedia(userId, file) {
  const cloudinary = ensureCloudinaryConfigured();

  let uploadResult;
  try {
    uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: CLOUDINARY_MEDIA_FOLDER,
          resource_type: "image",
        },
        (error, result) => {
          if (error) return reject(error);
          return resolve(result);
        },
      );
      stream.end(file.buffer);
    });
  } catch (error) {
    console.error("[media-upload] Cloudinary upload failed:", error.message);
    throw createHTTPError(502, "Cloud upload failed");
  }

  if (!uploadResult.secure_url || !uploadResult.public_id) {
    throw createHTTPError(502, "Cloud upload returned incomplete result");
  }

  const attachment = await prisma.messageAttachment.create({
    data: {
      uploadedByUserId: userId,
      status: "PENDING",
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      width: uploadResult.width || null,
      height: uploadResult.height || null,
      originalFileName: file.originalname || null,
    },
  });

  return {
    attachments: [
      {
        id: attachment.id,
        status: attachment.status,
        url: attachment.url,
        publicId: attachment.publicId,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        width: attachment.width,
        height: attachment.height,
        originalFileName: attachment.originalFileName,
        createdAt: attachment.createdAt,
      },
    ],
  };
}

/**
 * Best-effort delete a Cloudinary asset by publicId.
 * Returns false on failure (does not throw).
 *
 * @param {string} publicId
 * @returns {Promise<boolean>} true if deleted, false on error
 */
async function deleteCloudAssetBestEffort(publicId) {
  try {
    const cloudinary = ensureCloudinaryConfigured();
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (error) {
    console.warn(`[media-cleanup] Failed to delete cloud asset ${publicId}:`, error.message);
    return false;
  }
}

/**
 * Find and remove stale PENDING attachments (not yet linked to a message).
 *
 * @param {{ olderThanHours?: number }} options
 * @returns {Promise<{ deletedCount: number, cloudErrors: number }>}
 */
async function cleanupStalePendingAttachments({ olderThanHours = 24 } = {}) {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

  const staleAttachments = await prisma.messageAttachment.findMany({
    where: {
      status: "PENDING",
      messageId: null,
      createdAt: { lt: cutoff },
    },
    select: { id: true, publicId: true },
  });

  if (staleAttachments.length === 0) {
    return { deletedCount: 0, cloudErrors: 0 };
  }

  let cloudErrors = 0;
  for (const attachment of staleAttachments) {
    const ok = await deleteCloudAssetBestEffort(attachment.publicId);
    if (!ok) cloudErrors++;
  }

  await prisma.messageAttachment.deleteMany({
    where: { id: { in: staleAttachments.map((a) => a.id) } },
  });

  return { deletedCount: staleAttachments.length, cloudErrors };
}

export { uploadMedia, cleanupStalePendingAttachments, deleteCloudAssetBestEffort };
