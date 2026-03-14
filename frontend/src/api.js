// Thin wrapper around the local node API.
// The node always runs on 127.0.0.1:7331 — local-first by design.
// When accessed from the public site (HTTPS), the browser blocks HTTP
// localhost calls (mixed content). Users must run the app via:
//   npm run dev  →  http://localhost:5173
// The public site (vibeport.nixdata.net) shows the landing page only.

export const NODE_URL = 'http://127.0.0.1:7331'
const BASE = `${NODE_URL}/api`

async function req(method, path, body) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  } catch (err) {
    if (err.message === 'Failed to fetch') {
      throw new Error('Node offline — run: cd ~/vibeport && npm run dev')
    }
    throw err
  }
}

async function uploadAvatar(file) {
  const form = new FormData()
  form.append('avatar', file)
  try {
    const res = await fetch(`${BASE}/profile/avatar`, { method: 'POST', body: form })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  } catch (err) {
    if (err.message === 'Failed to fetch') {
      throw new Error('Node offline — run: cd ~/vibeport && npm run dev')
    }
    throw err
  }
}

export const api = {
  identity:      ()       => req('GET',   '/identity'),
  getProfile:    ()       => req('GET',   '/profile'),
  updateProfile: (data)   => req('PATCH', '/profile', data),
  uploadAvatar,
  getPosts:      ()       => req('GET',   '/posts'),
  createPost:    (data)   => req('POST',  '/posts', data),
  getFriends:    ()       => req('GET',   '/friends'),
  addFriend:     (key)    => req('POST',  '/friends', { coreKey: key }),
  sendSticker:   (data)   => req('POST',  '/stickers/send', data),
  getStickers:   ()       => req('GET',   '/stickers'),
  getWebrings:      ()       => req('GET',   '/webrings'),
  joinWebring:      (data)   => req('POST',  '/webrings', data),
  getTop100:        ()       => req('GET',   '/discover/top'),
  bumpInteraction:  (addr)   => req('POST',  '/discover/interact', { address: addr }),
}
