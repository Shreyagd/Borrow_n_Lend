// Deno-only helpers shared by the payment Edge Functions. Secrets come from `supabase secrets set ...` and are
// never sent to the browser. See docs/PAYMENTS.md for the full list.
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2'

export const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

export function env(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new HttpError(503, `Payments are not configured on the server (missing ${name}).`)
  return v
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

/** Client acting as the signed-in user (RLS applies). */
export const userClient = (req: Request) =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })

/** Client with the service role: used ONLY to call the apply_* functions after provider verification. */
export const serviceClient = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

/** Calls the Razorpay REST API with the server-side key pair. */
export async function razorpay(path: string, init: RequestInit = {}): Promise<any> {
  const auth = btoa(`${env('RAZORPAY_KEY_ID')}:${env('RAZORPAY_KEY_SECRET')}`)
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}`, ...(init.headers ?? {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new HttpError(502, `Razorpay: ${body?.error?.description ?? res.statusText}`)
  return body
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function handle(fn: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
    try {
      return await fn(req)
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status)
      console.error('payment function error', e)
      return json({ error: 'Unexpected server error.' }, 500)
    }
  })
}
