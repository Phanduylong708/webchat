function buildSuccessResponse({
  data = null,
  message = undefined,
  meta = undefined,
} = {}) {
  const payload = { success: true };
  if (message !== undefined) payload.message = message;
  if (data !== null) payload.data = data;
  if (meta !== undefined) payload.meta = meta;
  return payload;
}

function buildErrorResponse({
  message = "Internal Server Error",
  code = undefined,
  errors = undefined,
} = {}) {
  const payload = { success: false, message };
  if (code !== undefined) payload.code = code;
  if (errors !== undefined) payload.errors = errors;
  return payload;
}

function sendSuccess(res, { statusCode = 200, data, message, meta } = {}) {
  res.status(statusCode).json(buildSuccessResponse({ data, message, meta }));
}

function sendErrors(res, { statusCode = 500, message, code, errors } = {}) {
  res.status(statusCode).json(buildErrorResponse({ message, code, errors }));
}

export { buildSuccessResponse, buildErrorResponse, sendSuccess, sendErrors };
