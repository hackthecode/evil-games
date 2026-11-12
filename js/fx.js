// Background atmosphere: red hex rain behind the portal pages (never behind a game).
// The effects follow the FX switch of hackthecode.github.io (same origin, key htc.fx).
export function startRain() {
  let off = false;
  try { off = localStorage.getItem('htc.fx') === 'off'; } catch {}
  document.documentElement.classList.toggle('fx-off', off);
  if (off) return;
  const cv = document.createElement('canvas');
  cv.id = 'fx-rain';
  cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);
  const cx = cv.getContext('2d');
  if (!cx) return;

  const glyphs = '0123456789ABCDEF<>/{}#$';
  const size = 18;
  let w = 0, h = 0, drops = [];
  const fit = () => {
    w = cv.width = innerWidth;
    h = cv.height = innerHeight;
    drops = Array.from({ length: Math.ceil(w / size) }, () => Math.random() * -60);
  };
  fit();
  addEventListener('resize', fit);

  let last = 0;
  const draw = (t) => {
    requestAnimationFrame(draw);
    if (document.hidden || document.body.classList.contains('in-game') || t - last < 70) return;
    last = t;
    cx.fillStyle = 'rgba(5,5,6,.14)';
    cx.fillRect(0, 0, w, h);
    cx.font = `${size - 4}px JetBrains Mono, monospace`;
    for (let i = 0; i < drops.length; i++) {
      const y = drops[i] * size;
      cx.fillStyle = Math.random() < 0.04 ? '#ece5dd' : '#ff1f33';
      cx.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * size, y);
      drops[i] = y > h && Math.random() > 0.975 ? 0 : drops[i] + 1;
    }
  };
  requestAnimationFrame(draw);
}
