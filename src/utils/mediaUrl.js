/**
 * Resolve a stored media/document URL to something the browser can load.
 *
 * Uploads are served from the backend's `/public/temp/*` (not under `/api`).
 * New uploads come back as absolute URLs, but older land records hold bare
 * filenames (`abc.jpg`), root-relative paths (`/public/temp/abc.jpg`) or the
 * mistaken `/api/public/...` form. All of those are resolved against the API
 * server's origin, derived from `VITE_API_URL`.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const API_ORIGIN = (() => {
  try {
    return new URL(API_URL, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
})();

const MEDIA_FILE_PATTERN = /\.(jpe?g|png|gif|webp|bmp|svg|mp4|mov|webm|pdf)$/i;

export const IMAGE_NOT_FOUND_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23f3f4f6' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='sans-serif' font-size='16'%3EImage not found%3C/text%3E%3C/svg%3E";

export default function mediaUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;

  if (url.startsWith('/api/public/')) return `${API_ORIGIN}${url.replace('/api/public/', '/public/')}`;
  if (url.startsWith('/public/')) return `${API_ORIGIN}${url}`;
  if (url.startsWith('public/')) return `${API_ORIGIN}/${url}`;
  if (!url.includes('/') && MEDIA_FILE_PATTERN.test(url)) {
    return `${API_ORIGIN}/public/temp/${encodeURIComponent(url)}`;
  }
  return url;
}
