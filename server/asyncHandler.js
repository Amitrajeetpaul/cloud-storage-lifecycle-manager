// Express 4 does not forward a rejected promise from an async route handler
// to the error-handling middleware — it would otherwise hang silently until
// the client times out. Wrapping every async handler in this routes thrown
// errors (sync or async) to next(err) and the global handler in index.js.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
