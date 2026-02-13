import multer from "multer";
import { createHTTPError } from "../utils/error.util.js";

const AVATAR_FIELD_NAME = "avatar";
const MAX_AVATAR_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const INVALID_FILE_TYPE_MESSAGE =
  "Invalid file type. Only JPEG, PNG, and WEBP are allowed.";
const FILE_TOO_LARGE_MESSAGE = "File too large. Max size is 5MB.";

const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AVATAR_FILE_SIZE_BYTES,
  },
  fileFilter: (req, file, callback) => {
    if (ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype)) {
      return callback(null, true);
    }

    return callback(createHTTPError(400, INVALID_FILE_TYPE_MESSAGE));
  },
});

function uploadAvatarMiddleware(req, res, next) {
  avatarUpload.single(AVATAR_FIELD_NAME)(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return next(createHTTPError(413, FILE_TOO_LARGE_MESSAGE));
      }

      return next(createHTTPError(400, error.message || "Invalid upload request"));
    }

    return next(error);
  });
}

export {
  uploadAvatarMiddleware,
  AVATAR_FIELD_NAME,
  MAX_AVATAR_FILE_SIZE_BYTES,
  INVALID_FILE_TYPE_MESSAGE,
  FILE_TOO_LARGE_MESSAGE,
};
