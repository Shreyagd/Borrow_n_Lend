// Optional: generate a realistic hero image of books with the OpenAI Images API.
//   OPENAI_API_KEY=<your key> node scripts/generate-hero-image.mjs
// Then set VITE_HERO_IMAGE_URL=/images/hero-books.png in .env and restart the dev server.
// The key is read from the environment only; it is never bundled into the website.
import { mkdirSync, writeFileSync } from 'node:fs'

const key = process.env.OPENAI_API_KEY
if (!key) {
  console.error('Set OPENAI_API_KEY in your shell first (do not commit it).')
  process.exit(1)
}

const prompt =
  'Photorealistic 3D render of a small stack of three beautiful hardcover books, the top one slightly open, three-quarter angle, ' +
  'soft studio lighting, realistic soft shadow, cloth-textured covers in indigo violet, cream and coral, gilded page edges, ' +
  'abstract minimal cover artwork with absolutely no text or logos, isolated on a transparent background, product-shot quality'

const res = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
  body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1536x1024', background: 'transparent', output_format: 'png', quality: 'high', n: 1 }),
})
const json = await res.json()
if (!res.ok) {
  console.error('Image generation failed:', res.status, json.error?.message ?? JSON.stringify(json).slice(0, 300))
  process.exit(1)
}
mkdirSync('public/images', { recursive: true })
writeFileSync('public/images/hero-books.png', Buffer.from(json.data[0].b64_json, 'base64'))
console.log('Saved public/images/hero-books.png')
