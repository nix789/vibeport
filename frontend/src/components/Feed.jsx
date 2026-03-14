/**
 * Feed.jsx
 * Bulletin board — text posts with optional image/video attachment.
 * Images: max 10 MB. Videos: max 75 MB (server compresses if needed).
 * Media posts auto-delete from the node 72 hours after creation.
 */

import { useState, useEffect, useRef } from 'react'
import { api } from '../api'

const IMAGE_MAX_BYTES = 10 * 1024 * 1024   // 10 MB
const VIDEO_MAX_BYTES = 75 * 1024 * 1024   // 75 MB (before upload; server compresses)
const BASE = 'http://127.0.0.1:7331'

export function Feed() {
  const [posts, setPosts] = useState([])
  const [content, setContent] = useState('')
  const [mood, setMood] = useState('')
  const [file, setFile] = useState(null)
  const [fileErr, setFileErr] = useState('')
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const fileRef = useRef()

  const load = () => api.getPosts().then(setPosts).catch(console.error)
  useEffect(() => { load() }, [])

  const onFileChange = (e) => {
    setFileErr('')
    const f = e.target.files[0]
    if (!f) { setFile(null); return }

    const isVideo = f.type.startsWith('video/')
    const isImage = f.type.startsWith('image/')

    if (!isImage && !isVideo) {
      setFileErr('Only images and videos are allowed.')
      setFile(null)
      return
    }
    if (isImage && f.size > IMAGE_MAX_BYTES) {
      setFileErr(`Images must be under 10 MB (yours: ${(f.size/1024/1024).toFixed(1)} MB).`)
      setFile(null)
      return
    }
    // Videos over 75 MB are rejected client-side; server will also compress if needed
    if (isVideo && f.size > VIDEO_MAX_BYTES) {
      setFileErr(`Videos must be under 75 MB before upload (yours: ${(f.size/1024/1024).toFixed(1)} MB).`)
      setFile(null)
      return
    }
    setFile(f)
  }

  const submit = async () => {
    if (!content.trim() && !file) return
    setStatus('Posting...')
    setUploading(true)
    try {
      let mediaPath = null

      if (file) {
        const form = new FormData()
        form.append('media', file)
        const res = await fetch(`${BASE}/api/media/upload`, { method: 'POST', body: form })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        mediaPath = data.path
      }

      await api.createPost({ content: content.trim(), mood: mood.trim(), media: mediaPath })
      setContent('')
      setMood('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      setStatus('')
      load()
    } catch (e) {
      setStatus(`Error: ${e.message}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="feed">
      <h2>Bulletin Board</h2>
      <p className="hint">Posts with media auto-delete after 72 hours.</p>

      <div className="post-composer">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="what's on your mind?"
        />
        <div className="composer-row">
          <input
            value={mood}
            onChange={e => setMood(e.target.value)}
            maxLength={32}
            placeholder="mood (optional)"
            className="mood-input"
          />
          <label className="file-label">
            attach
            <input
              type="file"
              accept="image/*,video/*"
              ref={fileRef}
              onChange={onFileChange}
              style={{ display: 'none' }}
            />
          </label>
          {file && <span className="file-name">{file.name} ({(file.size/1024/1024).toFixed(1)} MB)</span>}
          <button onClick={submit} className="btn-primary" disabled={uploading}>
            {uploading ? 'Posting...' : 'Post'}
          </button>
        </div>
        {fileErr && <p className="error">{fileErr}</p>}
        {status  && <p className="status">{status}</p>}
      </div>

      <div className="posts-list">
        {posts.length === 0 && <p className="empty">No posts yet.</p>}
        {posts.map(p => <PostCard key={p.id} post={p} />)}
      </div>
    </section>
  )
}

function PostCard({ post }) {
  const expiresAt = post.media_expires_at
    ? new Date(post.media_expires_at * 1000).toLocaleString()
    : null

  return (
    <article className="post-card">
      <p className="post-content">{post.content}</p>
      {post.mood && <span className="post-mood">feeling: {post.mood}</span>}
      {post.media && <MediaAttachment path={post.media} mimeType={post.media_type} />}
      <div className="post-meta">
        <span>{new Date(post.created_at * 1000).toLocaleString()}</span>
        {expiresAt && <span className="expiry"> · media expires: {expiresAt}</span>}
      </div>
    </article>
  )
}

function MediaAttachment({ path, mimeType }) {
  const url = `http://127.0.0.1:7331${path}`
  if (!mimeType) return null
  if (mimeType.startsWith('image/')) {
    return <img src={url} alt="attachment" className="post-media" />
  }
  if (mimeType.startsWith('video/')) {
    return <video src={url} controls className="post-media" />
  }
  return null
}
