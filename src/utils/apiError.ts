export function extractErrorMessage(body: unknown, fallback = 'Unknown error'): string {
  if (typeof body === 'string' && body.length > 0) return body;
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b.error === 'string' && b.error.length > 0) return b.error;
    if (typeof b.message === 'string' && b.message.length > 0) return b.message;
  }
  return fallback;
}
