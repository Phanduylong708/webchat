import { prisma } from "../../shared/prisma.js";
import { createHTTPError } from "../../shared/utils/error.util.js";
import {
  CLOUDINARY_AVATAR_FOLDER,
  cloudinary,
  ensureCloudinaryConfigured,
} from "../../shared/config/cloudinary.config.js";
import { cacheGet, cacheSet, cacheDel } from "../../shared/utils/cache.util.js";
import { invalidateUserCache } from "../../shared/utils/auth-cache.util.js";

async function searchUserByUsername(username) {
  const cacheKey = `user:search:${username}`;

  const cacheUser = await cacheGet(cacheKey);
  if (cacheUser) {
    return cacheUser;
  }

  const existingUser = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      avatar: true,
      isOnline: true,
      lastSeen: true,
    },
  });
  if (!existingUser) {
    throw createHTTPError(404, "User not found");
  }

  await cacheSet(cacheKey, existingUser, 60);
  return existingUser;
}

function uploadImageBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_AVATAR_FOLDER,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", {
            name: error.name,
            message: error.message,
            http_code: error.http_code,
          });
          return reject(createHTTPError(502, "Cloud upload failed"));
        }
        return resolve(result);
      },
    );

    uploadStream.end(buffer);
  });
}

async function uploadMyAvatar(userId, avatarBuffer) {
  ensureCloudinaryConfigured();

  const uploadResult = await uploadImageBufferToCloudinary(avatarBuffer);
  const avatarUrl = uploadResult?.secure_url;

  if (!avatarUrl) {
    throw createHTTPError(500, "Avatar upload failed");
  }

  let updatedUser;
  try {
    updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true,
        avatar: true,
      },
    });
  } catch (error) {
    if (error?.code === "P2025") {
      throw createHTTPError(404, "User not found");
    }
    throw error;
  }
  await cacheDel(`user:search:${updatedUser.username}`);
  await invalidateUserCache(userId);
  return updatedUser;
}

export { searchUserByUsername, uploadMyAvatar };
