// Pikselowa tekstura kolorowych przycisków (jasne i ciemne bloki 6 px), wystawiona jako --tex.
(() => {
  function texture() {
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 48;
    const x = c.getContext('2d');
    let s = 7;
    const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const r = rand();
        if (r < 0.32) x.fillStyle = `rgba(255,255,255,${0.05 + rand() * 0.1})`;
        else if (r < 0.55) x.fillStyle = `rgba(0,0,0,${0.04 + rand() * 0.08})`;
        else continue;
        x.fillRect(i * 6, j * 6, 6, 6);
      }
    }
    document.documentElement.style.setProperty('--tex', `url(${c.toDataURL()})`);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', texture);
  else texture();
})();
