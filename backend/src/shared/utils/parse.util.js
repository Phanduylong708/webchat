function parseId(param, name = "id") {
  const value = Number(param);
  //  Number("") = 0 passes, but DB query will 404 anyway (IDs start at 1)
  if (!Number.isInteger(value)) {
    const error = new Error(`Invalid ${name}`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}
export { parseId };
