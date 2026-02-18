import multer from "multer";
import { createHTTPError } from "../utils/error.util.js";

// ── Avatar upload constants ──────────────────────────────────────────────────

const AVATAR_FIELD_NAME = "avatar";
const MAX_AVATAR_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const INVALID_FILE_TYPE_MESSAGE = "Invalid file type. Only JPEG, PNG, and WEBP are allowed.";
const FILE_TOO_LARGE_MESSAGE = "File too large. Max size is 5MB.";

const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// ── Media upload constants ───────────────────────────────────────────────────

const MEDIA_FIELD_NAME = "file";
const MAX_MEDIA_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const INVALID_MEDIA_TYPE_MESSAGE = "Invalid file type. Only JPEG, PNG, and WEBP are allowed.";
const MEDIA_TOO_LARGE_MESSAGE = "File too large. Max size is 10MB.";

const ALLOWED_MEDIA_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// ── Avatar multer instance ───────────────────────────────────────────────────

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

// ── Media multer instance ────────────────────────────────────────────────────

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_MEDIA_FILE_SIZE_BYTES,
  },
  fileFilter: (req, file, callback) => {
    if (ALLOWED_MEDIA_MIME_TYPES.has(file.mimetype)) {
      return callback(null, true);
    }

    return callback(createHTTPError(400, INVALID_MEDIA_TYPE_MESSAGE));
  },
});

// ── Middleware functions ─────────────────────────────────────────────────────

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

function uploadMediaMiddleware(req, res, next) {
  mediaUpload.single(MEDIA_FIELD_NAME)(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return next(createHTTPError(413, MEDIA_TOO_LARGE_MESSAGE));
      }

      return next(createHTTPError(400, error.message || "Invalid upload request"));
    }

    return next(error);
  });
}

export {
  uploadAvatarMiddleware,
  uploadMediaMiddleware,
  AVATAR_FIELD_NAME,
  MAX_AVATAR_FILE_SIZE_BYTES,
  INVALID_FILE_TYPE_MESSAGE,
  FILE_TOO_LARGE_MESSAGE,
  MEDIA_FIELD_NAME,
  MAX_MEDIA_FILE_SIZE_BYTES,
  INVALID_MEDIA_TYPE_MESSAGE,
  MEDIA_TOO_LARGE_MESSAGE,
  ALLOWED_MEDIA_MIME_TYPES,
};
