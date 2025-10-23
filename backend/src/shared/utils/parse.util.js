function parseId(param, name = "id") {
  // parse Id
  const value = Number(param);
  //  Number("") = 0 passes, but DB query will 404 anyway (IDs start at 1)
  if (!Number.isInteger(value)) {
    const error = new Error(`Invalid ${name}`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}

function parseOptionalId(value, name = "id") {
  // parse Optional Id(before)
  if (value === null || value === "" || value === undefined) return null;
  return parseId(value, name);
}

function parseLimit(value, optional = { defaultValue: 50, min: 1, max: 100 }) {
  // parse limit for pagination
  const { defaultValue, min, max } = optional;
  if (value === null || value === "" || value === undefined)
    return defaultValue;
  const parsed = parseId(value, "limit");
  const clamped = Math.max(min, Math.min(max, parsed));
  return clamped;
}

export { parseId, parseOptionalId, parseLimit };
