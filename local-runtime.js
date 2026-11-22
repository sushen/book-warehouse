/** Both development addresses run the same local paid-book flow. */
export function isLocalRuntime(location) {
  return ['localhost','127.0.0.1'].includes(location.hostname) && ['5173','5174'].includes(location.port);
}
