/**
 * Helpers for reading axios errors the way this backend actually fails.
 *
 * The API answers rule violations with JSON `{ message }` (400/404/409), but a
 * route that does not exist at all falls through to Express's default handler,
 * which sends an HTML *string*. That difference is what lets a page tell "the
 * server refused this" from "the server I am pointed at predates this feature".
 */

/** True when the server has no such route — the UI is newer than the deployed API. */
export const isMissingEndpoint = (err) =>
  err?.response?.status === 404 && typeof err.response.data === 'string';

/** The server's own explanation if it gave one, otherwise `fallback`. */
export const errorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.response?.data?.error || fallback;

export const BACKEND_UPDATE_HINT =
  'This needs the latest backend. Deploy Garuda-Backend-2, or point VITE_API_URL at a local copy.';
