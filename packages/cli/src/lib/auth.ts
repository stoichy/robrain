// src/lib/auth.ts
// ─────────────────────────────────────────────────────────────
// Handles authentication against Rory Plans API.
// On login: validates token, fetches user info + provisioned
// Perception/Planning API URLs for this account.
// ─────────────────────────────────────────────────────────────

import { RORY_API_BASE, type RoMemoryConfig } from './config.js'

export interface AuthResult {
  ok:            boolean
  email?:        string
  perceptionUrl?: string
  planningUrl?:  string
  error?:        string
}

export interface ProvisionedConfig {
  perceptionUrl: string
  planningUrl:   string
  perceptionKey: string
  planningKey:   string
  embeddingProvider: string
}

/** Validate a Rory Plans token and return account info */
export async function validateToken(token: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${RORY_API_BASE}/robrain/auth/validate`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      return {
        ok:    false,
        error: body.error ?? `Authentication failed (${res.status})`,
      }
    }

    const data = await res.json() as {
      email:          string
      perceptionUrl:  string
      planningUrl:    string
    }

    return {
      ok:            true,
      email:         data.email,
      perceptionUrl: data.perceptionUrl,
      planningUrl:   data.planningUrl,
    }
  } catch (err) {
    return {
      ok:    false,
      error: `Could not reach roryplans.ai — check your internet connection`,
    }
  }
}

/** Fetch provisioned API config for this token */
export async function fetchProvisionedConfig(token: string): Promise<ProvisionedConfig | null> {
  try {
    const res = await fetch(`${RORY_API_BASE}/robrain/provision`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    })

    if (!res.ok) return null

    const data = await res.json() as ProvisionedConfig
    return data
  } catch {
    return null
  }
}

/** Register a new project with Rory Plans */
export async function registerProject(
  token: string,
  projectId: string,
  projectName: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${RORY_API_BASE}/robrain/projects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ project_id: projectId, name: projectName }),
    })
    return res.ok
  } catch {
    return false
  }
}
