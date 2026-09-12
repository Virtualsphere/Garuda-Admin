/**
 * Which wizard step each candidate got to, so a half-finished onboarding can be
 * resumed instead of restarted.
 *
 * This is browser-local on purpose. Nothing is written to the server until the
 * final Complete Attachment, so "progress" is a draft that only exists on the
 * desk that started it — persisting it server-side would imply the candidate is
 * partway through a process the backend knows nothing about.
 */

const KEY = 'garuda_agent_onboarding_progress';

const readAll = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    // Corrupt or unavailable storage must not take the tab down with it.
    return {};
  }
};

const writeAll = (map) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* private mode / quota — progress is a convenience, not a requirement */
  }
};

/** The furthest step reached, or 0 when this candidate was never opened. */
export const getProgress = (candidateId) => readAll()[String(candidateId)]?.step || 0;

export const getProgressMap = () => {
  const all = readAll();
  const out = {};
  Object.keys(all).forEach((id) => {
    out[id] = all[id]?.step || 0;
  });
  return out;
};

/** Records the furthest step only — going back a step is not a regression. */
export const setProgress = (candidateId, step) => {
  const all = readAll();
  const id = String(candidateId);
  const best = Math.max(all[id]?.step || 0, Number(step) || 0);
  all[id] = { step: best, at: new Date().toISOString() };
  writeAll(all);
};

export const clearProgress = (candidateId) => {
  const all = readAll();
  delete all[String(candidateId)];
  writeAll(all);
};
