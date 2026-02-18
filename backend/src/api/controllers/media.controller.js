import { uploadMedia } from "../services/media.service.js";
import { sendSuccess, sendErrors } from "../../shared/utils/response.util.js";

async function uploadMediaController(req, res, next) {
  try {
    if (!req.file) {
      return sendErrors(res, { statusCode: 400, message: "No file provided" });
    }

    const result = await uploadMedia(req.user.id, req.file);
    return sendSuccess(res, {
      statusCode: 201,
      data: result,
      message: "Media uploaded successfully",
    });
  } catch (error) {
    next(error);
  }
}

export { uploadMediaController };
