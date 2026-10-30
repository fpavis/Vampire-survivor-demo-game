// The game could not even begin: the browser has no WebGL (turned off, blocked, or an old graphics driver), or
// something failed before the first frame. A blank page says nothing, so this says what is wrong in plain words.
// It runs before the interface exists, so it draws its own few elements and carries its own styles.

const webglAvailable = (): boolean => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
};

export function showStartFailure(err: unknown) {
  const noGl = !webglAvailable();
  const detail = String((err && (err as Error).message) || err || '');
  const host = document.getElementById('vs-main') ?? document.body;
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.dataset.startFailure = noGl ? 'webgl' : 'error';
  box.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;overflow:auto;background:#0b0f18;color:#e9eefc;font:16px/1.5 Nunito,"Trebuchet MS",Verdana,sans-serif;text-align:center';
  const h = document.createElement('h2');
  h.textContent = noGl ? 'This browser cannot draw the game' : 'The game could not start';
  h.style.cssText = 'margin:0;font:700 26px/1.2 Cinzel,Georgia,serif;color:#ffd84a';
  const p = document.createElement('p');
  p.style.cssText = 'margin:0;max-width:34em';
  p.textContent = noGl
    ? 'The game is drawn with WebGL, which is turned off or not available here. Try another browser, or turn on hardware acceleration in this browser’s settings, then reload.'
    : 'Something went wrong before the first frame. Reloading often helps; if it does not, try another browser.';
  const b = document.createElement('button');
  b.textContent = 'Reload';
  b.style.cssText = 'font:inherit;font-weight:700;padding:8px 22px;border-radius:10px;border:2px solid #ffd84a;background:#151c33;color:#e9eefc;cursor:pointer';
  b.addEventListener('click', () => location.reload());
  box.append(h, p, b);
  if (detail) {
    const d = document.createElement('code');
    d.textContent = detail.slice(0, 300);
    d.style.cssText = 'max-width:42em;font-size:12px;color:#c9d1e6;word-break:break-word';
    box.append(d);
  }
  host.appendChild(box);
  b.focus();
  console.error('[start] ' + detail);
}
