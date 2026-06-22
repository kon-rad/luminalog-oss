// Unsplash Search — picks one themed photo for the shareable card background.
// Honors Unsplash API terms: returns attribution and fires the download ping.
// Graceful-null without a key (client falls back to a gradient).
import { config } from '../config'

export interface UnsplashPhoto {
  imageUrl: string
  imageThumbUrl: string
  photographerName: string
  photographerUrl: string
}

export async function searchPhoto(query: string): Promise<UnsplashPhoto | null> {
  if (!config.UNSPLASH_ACCESS_KEY) return null
  const auth = { Authorization: `Client-ID ${config.UNSPLASH_ACCESS_KEY}` }
  try {
    const url = `https://api.unsplash.com/search/photos?per_page=1&orientation=portrait&content_filter=high&query=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: auth })
    if (!res.ok) return null
    const first = ((await res.json()) as any)?.results?.[0]
    if (!first) return null

    // Required by Unsplash API guidelines: trigger a download event.
    const dl = first.links?.download_location
    if (dl) { try { await fetch(dl, { headers: auth }) } catch { /* non-fatal */ } }

    return {
      imageUrl: first.urls?.regular ?? '',
      imageThumbUrl: first.urls?.thumb ?? '',
      photographerName: first.user?.name ?? '',
      photographerUrl: first.user?.links?.html ?? '',
    }
  } catch { return null }
}
