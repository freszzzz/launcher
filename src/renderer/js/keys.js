// Skróty klawiszowe moda: KeyboardEvent.code <-> kody GLFW (tak zapisuje je mod w modules.json).
window.Fresh = window.Fresh || {};

(() => {
  const NONE = -1;
  const MOUSE_BASE = -100;
  const map = {};
  const names = {};

  const add = (code, glfw, name) => {
    map[code] = glfw;
    if (name) names[glfw] = name;
  };
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i);
    add(`Key${ch}`, 65 + i, ch);
  }
  for (let i = 0; i < 10; i++) {
    add(`Digit${i}`, 48 + i, String(i));
    add(`Numpad${i}`, 320 + i, `Num ${i}`);
  }
  for (let i = 1; i <= 25; i++) add(`F${i}`, 289 + i, `F${i}`);
  [
    ['Space', 32, 'Spacja'], ['Quote', 39, "'"], ['Comma', 44, ','], ['Minus', 45, '-'], ['Period', 46, '.'],
    ['Slash', 47, '/'], ['Semicolon', 59, ';'], ['Equal', 61, '='], ['BracketLeft', 91, '['], ['Backslash', 92, '\\'],
    ['BracketRight', 93, ']'], ['Backquote', 96, '`'], ['Enter', 257, 'Enter'], ['Tab', 258, 'Tab'],
    ['Insert', 260, 'Insert'], ['ArrowRight', 262, '→'], ['ArrowLeft', 263, '←'], ['ArrowDown', 264, '↓'],
    ['ArrowUp', 265, '↑'], ['PageUp', 266, 'Page Up'], ['PageDown', 267, 'Page Down'], ['Home', 268, 'Home'],
    ['End', 269, 'End'], ['CapsLock', 280, 'Caps Lock'], ['ScrollLock', 281, 'Scroll Lock'], ['NumLock', 282, 'Num Lock'],
    ['PrintScreen', 283, 'Print Screen'], ['Pause', 284, 'Pause'], ['NumpadDecimal', 330, 'Num .'],
    ['NumpadDivide', 331, 'Num /'], ['NumpadMultiply', 332, 'Num *'], ['NumpadSubtract', 333, 'Num -'],
    ['NumpadAdd', 334, 'Num +'], ['NumpadEnter', 335, 'Num Enter'], ['ShiftLeft', 340, 'Lewy Shift'],
    ['ControlLeft', 341, 'Lewy Ctrl'], ['AltLeft', 342, 'Lewy Alt'], ['MetaLeft', 343, 'Lewy Win'],
    ['ShiftRight', 344, 'Prawy Shift'], ['ControlRight', 345, 'Prawy Ctrl'], ['AltRight', 346, 'Prawy Alt'],
    ['MetaRight', 347, 'Prawy Win'], ['ContextMenu', 348, 'Menu']
  ].forEach(([c, g, n]) => add(c, g, n));

  function name(glfw) {
    if (glfw === undefined || glfw === null || glfw === NONE) return 'Brak';
    if (glfw <= MOUSE_BASE) {
      const b = MOUSE_BASE - glfw;
      return b === 2 ? 'Środkowy przycisk' : `Mysz ${b + 1}`;
    }
    return names[glfw] || `#${glfw}`;
  }

  /**
   * Czeka na naciśnięcie klawisza / bocznego przycisku myszy.
   * Esc = anuluj (null), Backspace/Delete = usuń skrót (NONE).
   */
  function capture() {
    return new Promise((resolve) => {
      const done = (v) => {
        window.removeEventListener('keydown', onKey, true);
        window.removeEventListener('mousedown', onMouse, true);
        window.removeEventListener('contextmenu', block, true);
        resolve(v);
      };
      const block = (e) => e.preventDefault();
      const onKey = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.code === 'Escape') return done(null);
        if (e.code === 'Backspace' || e.code === 'Delete') return done(NONE);
        if (map[e.code] !== undefined) done(map[e.code]);
      };
      const onMouse = (e) => {
        if (e.button === 0) return done(null); // klik lewym = anuluj
        if (e.button === 2) return; // prawy zostawiamy
        e.preventDefault();
        // przeglądarka: 1 = środkowy, 3/4 = boczne -> GLFW 2/3/4
        const glfwButton = e.button === 1 ? 2 : e.button;
        done(MOUSE_BASE - glfwButton);
      };
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('mousedown', onMouse, true);
      window.addEventListener('contextmenu', block, true);
    });
  }

  Fresh.keys = { NONE, MOUSE_BASE, name, capture };
})();
