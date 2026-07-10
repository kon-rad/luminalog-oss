import { auth } from '../firebase'

// Browser fetch wrapper for the same-origin proxy routes (app/api/**/route.ts).
// Attaches the signed-in user's Firebase ID token as a Bearer header and
// retries once with a force-refreshed token on a 401 (matches the iOS
// ProxyAPIClient behavior). `path` must be a same-origin route like
// '/api/keys/bootstrap' — never a cross-origin API_URL (avoids CORS).
//
// Dates in `body` serialize via JSON.stringify's default Date -> ISO-8601
// toJSON() behavior, so no custom replacer is needed.

async function getIdToken(forceRefresh: boolean): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('apiPost: no signed-in user')
  return user.getIdToken(forceRefresh)
}

type Method = 'GET' | 'POST' | 'DELETE'

function doFetch(method: Method, path: string, token: string, body?: unknown): Promise<Response> {
  const init: RequestInit = {
    method,
    headers: { authorization: `Bearer ${token}` },
  }
  if (body !== undefined) {
    init.headers = { ...init.headers, 'content-type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return fetch(path, init)
}

/** Issue an authed request to a same-origin proxy route, retrying once with a
 * force-refreshed token on a 401 (matches iOS ProxyAPIClient). */
async function requestRaw(method: Method, path: string, body?: unknown): Promise<Response> {
  const token = await getIdToken(false)
  let res = await doFetch(method, path, token, body)
  if (res.status === 401) {
    const refreshed = await getIdToken(true)
    res = await doFetch(method, path, refreshed, body)
  }
  return res
}

async function requestJson<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const res = await requestRaw(method, path, body)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`api ${method} ${path} failed: ${res.status} ${text}`)
  }
  return (await res.json()) as T
}

/** POST to a same-origin proxy route and return the raw Response (e.g. for SSE). */
export async function apiPostRaw(path: string, body: unknown): Promise<Response> {
  return requestRaw('POST', path, body)
}

/** POST to a same-origin proxy route and parse the JSON response body as `T`. */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>('POST', path, body)
}

/** GET a same-origin proxy route and parse the JSON response body as `T`. */
export async function apiGet<T>(path: string): Promise<T> {
  return requestJson<T>('GET', path)
}

/** DELETE a same-origin proxy route and parse the JSON response body as `T`. */
export async function apiDelete<T>(path: string): Promise<T> {
  return requestJson<T>('DELETE', path)
}
