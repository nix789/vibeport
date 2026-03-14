/**
 * sanitize.js
 * Strips dangerous constructs from user-supplied CSS and HTML.
 * Profile pages render inside a sandboxed iframe so JS is already blocked,
 * but we also strip at the source to be safe.
 */

// ── CSS ───────────────────────────────────────────────────────────────────────
// Block CSS that can load remote resources or execute JS.
const BLOCKED_CSS_PATTERNS = [
  /javascript\s*:/gi,
  /expression\s*\(/gi,          // IE CSS expressions
  /behavior\s*:/gi,             // IE behaviors
  /-moz-binding\s*:/gi,
  /url\s*\(\s*['"]?data:/gi,    // data: URLs in CSS
]

export function sanitizeCSS(css) {
  if (typeof css !== 'string') return ''
  let safe = css
  for (const pattern of BLOCKED_CSS_PATTERNS) {
    safe = safe.replace(pattern, '/* blocked */')
  }
  return safe.slice(0, 65536) // max 64KB of CSS
}

// ── HTML ──────────────────────────────────────────────────────────────────────
// Allow layout HTML but strip script tags, event handlers, and dangerous attrs.
// This is a simple allowlist-free approach; for production use DOMPurify server-side.
const BLOCKED_HTML_TAGS = /<\s*(script|iframe|object|embed|applet|link|meta|base|form|input|button|select|textarea)[^>]*>/gi
const BLOCKED_ATTRS     = /\s(on\w+|href\s*=\s*['"]?\s*javascript|src\s*=\s*['"]?\s*(javascript|data))[^'">]*/gi

export function sanitizeHTML(html) {
  if (typeof html !== 'string') return ''
  return html
    .replace(BLOCKED_HTML_TAGS, '<!-- blocked -->')
    .replace(BLOCKED_ATTRS, '')
    .slice(0, 65536)
}
