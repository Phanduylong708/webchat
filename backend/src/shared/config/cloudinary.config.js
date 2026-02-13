import { v2 as cloudinary } from "cloudinary";

const requiredCloudinaryEnvKeys = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const CLOUDINARY_AVATAR_FOLDER = "webchat/avatars";

let isCloudinaryConfigured = false;

function getMissingCloudinaryEnvKeys() {
  return requiredCloudinaryEnvKeys.filter((envKey) => !process.env[envKey]);
}

function ensureCloudinaryConfigured() {
  if (isCloudinaryConfigured) {
    return cloudinary;
  }

  const missingEnvKeys = getMissingCloudinaryEnvKeys();
  if (missingEnvKeys.length > 0) {
    throw new Error(
      `Missing Cloudinary environment variables: ${missingEnvKeys.join(", ")}`
    );
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  isCloudinaryConfigured = true;
  return cloudinary;
}

export { cloudinary, ensureCloudinaryConfigured, CLOUDINARY_AVATAR_FOLDER };
