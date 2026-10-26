import { MAX_IMAGE_BYTES } from './constants'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

/** Validates and downsizes a cover photo in the browser (max 1000px, JPEG) to keep pages fast. */
export async function compressImage(file: File, maxSide = 1000, quality = 0.82): Promise<Blob> {
  if (!ACCEPTED.includes(file.type)) throw new Error('Please choose a JPG, PNG or WebP image.')
  if (file.size > MAX_IMAGE_BYTES * 3) throw new Error('That image is too large. Please choose one under 9 MB.')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process the image in this browser.')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
  if (!blob) throw new Error('Could not process the image.')
  if (blob.size > MAX_IMAGE_BYTES) throw new Error('Image is still over 3 MB after compression. Try a smaller photo.')
  return blob
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Could not read the image.'))
    r.readAsDataURL(blob)
  })
}
