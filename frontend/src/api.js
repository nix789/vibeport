// Thin wrapper around the local node API
const BASE = 'http://127.0.0.1:7331/api'

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function uploadAvatar(file) {
  const form = new FormData()
  form.append('avatar', file)
  const res = await fetch(`${BASE}/profile/avatar`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
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
  getWebrings:   ()       => req('GET',   '/webrings'),
  joinWebring:   (data)   => req('POST',  '/webrings', data),
}
