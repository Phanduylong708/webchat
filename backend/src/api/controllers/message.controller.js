import { getMessages } from "../services/message.service.js";
import {
  parseId,
  parseOptionalId,
  parseLimit,
} from "../../shared/utils/parse.util.js";
import { sendSuccess } from "../../shared/utils/response.util.js";

async function getMessagesController(req, res, next) {
  try {
    const conversationId = parseId(
      req.params.conversationId,
      "conversation ID"
    );
    const before = parseOptionalId(req.query.before, "before cursor");
    const limit = parseLimit(req.query.limit);
    const currentUserId = req.user.id; // user.id from prisma id always integer so no need check
    const result = await getMessages(
      conversationId,
      currentUserId,
      before,
      limit
    );
    return sendSuccess(res, {
      statusCode: 200,
      data: result,
      message: "Messages retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
}

export { getMessagesController };
