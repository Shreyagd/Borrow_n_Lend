// Cover lookup by ISBN through Open Library's free covers service (https://openlibrary.org/dev/docs/api/covers).
// The image is hotlinked from covers.openlibrary.org (not re-hosted). Cover artwork belongs to its publisher.

export const cleanIsbn = (raw: string) => raw.replace(/[\s-]/g, '').toUpperCase()
export const isValidIsbn = (raw: string) => /^(\d{9}[\dX]|\d{13})$/.test(cleanIsbn(raw))

export function openLibraryCoverUrl(isbn: string, size: 'S' | 'M' | 'L' = 'L'): string {
  // default=false makes the service answer 404 (instead of a blank pixel) when it has no cover.
  return `https://covers.openlibrary.org/b/isbn/${cleanIsbn(isbn)}-${size}.jpg?default=false`
}

/** Resolves true when the cover exists and loads as a real image. */
export function coverExists(url: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    const done = (ok: boolean) => { clearTimeout(t); img.onload = img.onerror = null; resolve(ok) }
    const t = setTimeout(() => done(false), timeoutMs)
    img.onload = () => done(img.naturalWidth > 1)
    img.onerror = () => done(false)
    img.src = url
  })
}
