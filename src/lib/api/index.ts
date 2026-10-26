import { IS_DEMO } from '../env'
import { demoApi } from './demoApi'
import { supabaseApi } from './supabaseApi'
import type { Api } from './types'

export const api: Api = IS_DEMO ? demoApi : supabaseApi
export type { Api, AuthUser, TxKind } from './types'
