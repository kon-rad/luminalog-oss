// Unsplash — picks a random themed photo for the shareable card background.
// Uses /photos/random so every generation gets a fresh image for the same query.
// Honors Unsplash API terms: returns attribution and fires the download ping.
// Graceful-null without a key (client falls back to a gradient).
import { config } from '../config'

export interface UnsplashPhoto {
  imageUrl: string
  imageThumbUrl: string
  photographerName: string
  photographerUrl: string
}

const FALLBACK_QUERY = 'calm landscape'

export async function searchPhoto(query: string): Promise<UnsplashPhoto | null> {
  if (!config.UNSPLASH_ACCESS_KEY) return null
  return (await fetchRandomPhoto(query)) ?? (await fetchRandomPhoto(FALLBACK_QUERY))
}

async function fetchRandomPhoto(query: string): Promise<UnsplashPhoto | null> {
  const auth = { Authorization: `Client-ID ${config.UNSPLASH_ACCESS_KEY}` }
  try {
    const url = `https://api.unsplash.com/photos/random?orientation=portrait&content_filter=high&query=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: auth })
    if (!res.ok) return null
    const photo = (await res.json()) as any
    if (!photo?.id) return null

    // Required by Unsplash API guidelines: trigger a download event.
    const dl = photo.links?.download_location
    if (dl) { try { await fetch(dl, { headers: auth }) } catch { /* non-fatal */ } }

    return {
      imageUrl: photo.urls?.regular ?? '',
      imageThumbUrl: photo.urls?.thumb ?? '',
      photographerName: photo.user?.name ?? '',
      photographerUrl: photo.user?.links?.html ?? '',
    }
  } catch { return null }
}
