// Renderer kosmetyków wokselowych: three.js (przez skinview3d) + miniatury izometryczne 2D.
window.Fresh = window.Fresh || {};

(() => {
  // skinview3d nie eksportuje three.js – konstruktory bierzemy z istniejących obiektów sceny.
  let T = null;
  function grabThree(viewer) {
    if (T) return T;
    const head = viewer.playerObject.skin.head;
    const mesh = head.innerLayer;
    const geo = mesh.geometry;
    T = {
      Group: Object.getPrototypeOf(head.constructor),
      Mesh: mesh.constructor,
      Geometry: Object.getPrototypeOf(geo.constructor),
      Attr: geo.getAttribute('position').constructor,
      Material: mesh.material.constructor,
      Color: mesh.material.color.constructor
    };
    return T;
  }

  // 6 ścian sześcianu: normalna, 4 narożniki (CCW patrząc z zewnątrz), jasność "retro".
  const FACES = [
    { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.82 },
    { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.82 },
    { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1 },
    { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.6 },
    { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.92 },
    { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.72 }
  ];

  const hex = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };

  /** Siatka z pominięciem niewidocznych ścian (sąsiad w tej samej części). */
  function meshGeometry(part, voxels) {
    const keys = new Set(part.voxels.map(([x, y, z]) => `${x},${y},${z}`));
    const pos = [];
    const nor = [];
    const col = [];
    const s = part.size;
    for (const [x, y, z, c] of voxels) {
      const rgb = hex(c);
      const bx = part.offset[0] + x * s - part.pivot[0];
      const by = part.offset[1] + y * s - part.pivot[1];
      const bz = part.offset[2] + z * s - part.pivot[2];
      for (const f of FACES) {
        if (keys.has(`${x + f.n[0]},${y + f.n[1]},${z + f.n[2]}`)) continue;
        const v = f.c.map(([a, b, d]) => [bx + a * s, by + b * s, bz + d * s]);
        for (const i of [0, 1, 2, 0, 2, 3]) {
          pos.push(...v[i]);
          nor.push(...f.n);
          col.push(rgb[0] * f.s, rgb[1] * f.s, rgb[2] * f.s);
        }
      }
    }
    const g = new T.Geometry();
    g.setAttribute('position', new T.Attr(pos, 3));
    g.setAttribute('normal', new T.Attr(nor, 3));
    g.setAttribute('color', new T.Attr(col, 3));
    return g;
  }

  function buildPart(part) {
    const group = new T.Group();
    group.position.set(...part.pivot);
    group.userData = { part };
    if (part.glow) {
      // świecące woksele: osobna siatka na kolor, z emisją
      const byColor = new Map();
      for (const v of part.voxels) {
        if (!byColor.has(v[3])) byColor.set(v[3], []);
        byColor.get(v[3]).push(v);
      }
      for (const [c, list] of byColor) {
        const m = new T.Material({ vertexColors: true, emissive: new T.Color(c), emissiveIntensity: 0.85, roughness: 1, metalness: 0, side: 2 /* DoubleSide */ });
        group.add(new T.Mesh(meshGeometry(part, list), m));
      }
    } else {
      const m = new T.Material({ vertexColors: true, roughness: 1, metalness: 0, side: 2 /* DoubleSide */ });
      group.add(new T.Mesh(meshGeometry(part, part.voxels), m));
    }
    return group;
  }

  /** Animacje – identyczne wzory jak w modzie (CosmeticRenderer.java). */
  function animate(group, t) {
    const { part } = group.userData;
    const a = part.anim;
    if (!a) return;
    const deg = Math.PI / 180;
    const phase = a.phase || 0;
    const [px, py, pz] = part.pivot;
    group.position.set(px, py, pz);
    group.rotation.set(0, 0, 0);
    group.scale.set(1, 1, 1);
    if (a.bob) group.position.y = py + Math.sin(t * 2 + phase) * a.bob * 0.5;
    if (a.type === 'spin' || a.type === 'orbit') group.rotation.y = t * a.speed * Math.PI + phase;
    if (a.type === 'flap') group.rotation.y = a.dir * (12 + (0.5 + 0.5 * Math.sin(t * a.speed)) * a.amp) * deg;
    if (a.type === 'sway') group.rotation.y = Math.sin(t * a.speed + phase) * a.amp * deg;
    if (a.type === 'tilt') group.rotation.z = Math.sin(t * a.speed + phase) * a.amp * deg;
    if (a.type === 'pulse') group.scale.setScalar(1 + Math.sin(t * a.speed + phase) * a.amp);
    if (a.type === 'bounce') group.position.y += Math.abs(Math.sin(t * a.speed + phase)) * a.amp;
  }

  /** Zarządza kosmetykami założonymi na jeden SkinViewer. */
  function attach(viewer) {
    grabThree(viewer);
    const skin = viewer.playerObject.skin;
    const bones = { head: new T.Group(), body: new T.Group() };
    bones.body.position.y = 6; // origin "body" = szyja (grupa body ma środek w połowie tułowia)
    skin.head.add(bones.head);
    skin.body.add(bones.body);

    const equipped = new Map(); // slot -> { id, groups }
    let raf = 0;

    function tick() {
      raf = requestAnimationFrame(tick);
      if (viewer.renderPaused) return;
      const t = performance.now() / 1000;
      for (const e of equipped.values()) e.groups.forEach((g) => animate(g, t));
    }

    function clear(slot) {
      const e = equipped.get(slot);
      if (!e) return;
      e.groups.forEach((g) => {
        g.parent.remove(g);
        g.children.forEach((m) => {
          m.geometry.dispose();
          m.material.dispose();
        });
      });
      equipped.delete(slot);
    }

    function set(slot, id) {
      if (equipped.get(slot)?.id === id) return;
      clear(slot);
      const item = id && FreshCosmetics.byId(id);
      if (!item) return;
      const groups = item.parts.map(buildPart);
      groups.forEach((g) => bones[item.bone].add(g));
      equipped.set(slot, { id, groups });
      if (!raf) tick();
    }

    return { set, clear, equipped: () => Object.fromEntries([...equipped].map(([k, v]) => [k, v.id])) };
  }

  // miniatury izometryczne
  /** Rysuje model wokselowy w rzucie izometrycznym na canvas (pixel art). */
  function thumbnail(item, size = 96) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const cubes = [];
    for (const p of item.parts) {
      for (const [x, y, z, col] of p.voxels) {
        cubes.push({ x: p.offset[0] + x * p.size, y: p.offset[1] + y * p.size, z: p.offset[2] + z * p.size, s: p.size, col });
      }
    }
    if (!cubes.length) return c;
    // rzut: ekran x = (x - z), ekran y = -(y) + (x + z) / 2
    const proj = (x, y, z) => [x - z, -y + (x + z) * 0.5];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const q of cubes) {
      for (const [dx, dy, dz] of [[0, 0, 0], [1, 1, 1], [1, 0, 0], [0, 0, 1], [0, 1, 0], [1, 1, 0], [0, 1, 1], [1, 0, 1]]) {
        const [px, py] = proj(q.x + dx * q.s, q.y + dy * q.s, q.z + dz * q.s);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
    }
    const scale = Math.min((size - 12) / (maxX - minX), (size - 12) / (maxY - minY));
    const ox = (size - (maxX - minX) * scale) / 2 - minX * scale;
    const oy = (size - (maxY - minY) * scale) / 2 - minY * scale;
    const P = (x, y, z) => {
      const [px, py] = proj(x, y, z);
      return [Math.round(px * scale + ox), Math.round(py * scale + oy)];
    };
    // malarz: od najdalszych (mała suma x+z, małe y)
    cubes.sort((a, b) => a.x + a.z - (b.x + b.z) || a.y - b.y);
    const shade = (h, k) => {
      const [r, g, b] = hex(h).map((v) => Math.round(v * 255 * k));
      return `rgb(${r},${g},${b})`;
    };
    const poly = (pts, fill) => {
      ctx.beginPath();
      ctx.moveTo(...pts[0]);
      pts.slice(1).forEach((p) => ctx.lineTo(...p));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    for (const q of cubes) {
      const { x, y, z, s, col } = q;
      poly([P(x, y + s, z), P(x + s, y + s, z), P(x + s, y + s, z + s), P(x, y + s, z + s)], shade(col, 1)); // góra
      poly([P(x, y, z + s), P(x + s, y, z + s), P(x + s, y + s, z + s), P(x, y + s, z + s)], shade(col, 0.72)); // przód (+z)
      poly([P(x + s, y, z), P(x + s, y, z + s), P(x + s, y + s, z + s), P(x + s, y + s, z)], shade(col, 0.86)); // bok (+x)
    }
    return c;
  }

  /** Miniatura peleryny: przód (region 1,1,10,16) powiększony. */
  function capeThumb(id, w = 40, h = 64) {
    const px = FreshCosmetics.capePixels(id);
    const src = document.createElement('canvas');
    src.width = px.width;
    src.height = px.height;
    src.getContext('2d').putImageData(new ImageData(px.data, px.width, px.height), 0, 0);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 1, 1, 10, 16, 0, 0, w, h);
    return { thumb: c, texture: src.toDataURL() };
  }

  Fresh.voxels = { attach, thumbnail, capeThumb };
})();
