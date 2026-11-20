/** Same-origin requests keep the HttpOnly session cookie outside JavaScript. */
export async function api(path, options = {}) {
  const { body, ...rest } = options;
  const headers = new Headers(rest.headers);
  const method = (rest.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method))
    headers.set('X-Forensiq-Request', '1');
  let payload = body;
  if (body != null && !(body instanceof FormData) && typeof body !== 'string') {
    headers.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch('/api' + path, {
      ...rest,
      method,
      headers,
      body: payload,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error(
      'The evidence service could not be reached. Check your connection and try again.',
    );
  }
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    const detail = details.detail;
    const validation = Array.isArray(detail)
      ? detail.map((item) => item.msg).join('. ')
      : null;
    let message =
      validation ||
      (typeof detail === 'string' && detail) ||
      'The request could not be completed.';
    if (
      response.status === 401 &&
      path !== '/auth/login' &&
      path !== '/auth/me'
    ) {
      window.dispatchEvent(new Event('forensiq:session-ended'));
    }
    if (response.status >= 500)
      message =
        'The evidence service is unavailable. Please try again in a moment.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  if (response.headers.get('content-disposition')?.includes('attachment'))
    return response.blob();
  if (response.headers.get('content-type')?.includes('application/json'))
    return response.json();
  return response.blob();
}
