// Rysowanie pixel-artu z map znaków: każdy znak w wierszu to kolor z palety.
window.Fresh = window.Fresh || {};

(() => {
  function drawRows(canvas, { rows, palette }, scale = 1) {
    canvas.width = rows[0].length * scale;
    canvas.height = rows.length * scale;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const color = palette[ch];
        if (!color) return;
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      });
    });
    return canvas;
  }

  Fresh.icons = { drawRows };
})();
