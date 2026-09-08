/*
 * An opaque per-browser id, sent with every score submission.
 *
 * Scoring needs no account, and everyone in the gym shares one public IP, so
 * without this the score log cannot tell two phones apart. It is not identity
 * and not authenticated — it exists so a director tracing an accidental
 * overwrite can see whether the same device entered the earlier score.
 */

const STORAGE_KEY = 'madhatter.scorerId';

function generate() {
  const bytes = new Uint8Array(8);

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The id for this browser, created on first use. Returns null when storage is
 * unavailable (a private window, or a browser set to block site data) — the
 * score submission just goes without it.
 */
export function getScorerId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);

    if (!id || !/^[a-f0-9]{16}$/.test(id)) {
      id = generate();
      localStorage.setItem(STORAGE_KEY, id);
    }

    return id;
  } catch {
    return null;
  }
}
