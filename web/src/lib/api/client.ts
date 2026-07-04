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

async function doFetch(path: string, body: unknown, token: string): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

/** POST to a same-origin proxy route and return the raw Response (e.g. for future SSE). */
export async function apiPostRaw(path: string, body: unknown): Promise<Response> {
  const token = await getIdToken(false)
  let res = await doFetch(path, body, token)

  if (res.status === 401) {
    const refreshed = await getIdToken(true)
    res = await doFetch(path, body, refreshed)
  }

  return res
}

/** POST to a same-origin proxy route and parse the JSON response body as `T`. */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await apiPostRaw(path, body)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`apiPost ${path} failed: ${res.status} ${text}`)
  }
  return (await res.json()) as T
}
