// Standard exercises retain their existing ex:<collection>-<file> JSON format.
// SDA v2 deliberately avoids the old, colliding iframe keys.
export const storageKey = (key, sda = false) => `${sda ? 'ex:sda-v2:' : 'ex:'}${key}`;
const fallback = new Map();
const pending = new Map();

export function readStorage(key) {
  if (fallback.has(key)) return fallback.get(key);
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    fallback.delete(key);
  } catch {
    // Keep this tab usable when storage is blocked or full, including deletions.
    fallback.set(key, value);
  }
}

export function cancelSave(key) {
  const save = pending.get(key);
  if (save) clearTimeout(save.timer);
  pending.delete(key);
}

export function saveStorage(key, value, immediate = false) {
  cancelSave(key);
  if (immediate) return writeStorage(key, value);
  pending.set(key, { value, timer: setTimeout(() => {
    pending.delete(key);
    writeStorage(key, value);
  }, 300) });
}

export function flushStorage() {
  for (const [key, { value }] of pending) {
    cancelSave(key);
    writeStorage(key, value);
  }
}

export function readExercise(key, maxBoxes = 12) {
  try {
    const data = JSON.parse(readStorage(key));
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return {
      ...(typeof data.css === 'string' ? { css: data.css } : {}),
      ...(Number.isInteger(data.boxes) && data.boxes >= 1 && data.boxes <= maxBoxes
        ? { boxes: data.boxes } : {}),
    };
  } catch { return {}; }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushStorage);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushStorage();
  });
}
