(function (G) {
  'use strict';

  // Mapa en cuadrícula. 1 casilla = 1 unidad de mundo.
  // El suelo es 2D (una textura) y las paredes y árboles son volúmenes 3D simples.

  const T = { GRASS: 0, ROAD: 1, FLOOR: 2, WALL: 3, TREE: 4 };
  const W = 48;
  const H = 48;
  const WALL_H = 1.1;
  const SPAWN = { x: 23, z: 23 };   // cruce de calles

  const tiles = new Uint8Array(W * H);

  function get(x, z) {
    if (x < 0 || z < 0 || x >= W || z >= H) return T.WALL;
    return tiles[z * W + x];
  }

  function set(x, z, t) {
    if (x >= 0 && z >= 0 && x < W && z < H) tiles[z * W + x] = t;
  }

  function isSolid(x, z) {
    const t = get(x, z);
    return t === T.WALL || t === T.TREE;
  }

  function blocksSight(x, z) {
    return get(x, z) === T.WALL;
  }

  // ¿Un círculo de radio r en (x, z) toca alguna casilla sólida?
  function circleBlocked(x, z, r) {
    const x0 = Math.floor(x - r), x1 = Math.floor(x + r);
    const z0 = Math.floor(z - r), z1 = Math.floor(z + r);
    for (let tz = z0; tz <= z1; tz++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (isSolid(tx, tz)) return true;
      }
    }
    return false;
  }

  // Mueve "pos" deslizando contra paredes (eje por eje)
  function move(pos, dx, dz, r) {
    if (!circleBlocked(pos.x + dx, pos.z, r)) pos.x += dx;
    if (!circleBlocked(pos.x, pos.z + dz, r)) pos.z += dz;
  }

  // Línea de visión: solo las paredes la bloquean
  function hasLOS(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0;
    const n = Math.ceil(Math.hypot(dx, dz) / 0.3);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (blocksSight(Math.floor(x0 + dx * t), Math.floor(z0 + dz * t))) return false;
    }
    return true;
  }

  // Línea despejada para caminar (un cuerpo de ese grosor puede pasar)
  function hasClearLine(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0;
    const n = Math.ceil(Math.hypot(dx, dz) / 0.25);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (circleBlocked(x0 + dx * t, z0 + dz * t, 0.28)) return false;
    }
    return true;
  }

  // ---------- Pathfinding A* (8 direcciones, sin cortar esquinas) ----------
  const gScore = new Float32Array(W * H);
  const cameFrom = new Int32Array(W * H);
  const closed = new Uint8Array(W * H);
  const DIRS = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]
  ];

  function findPath(sx, sz, tx, tz, maxNodes) {
    maxNodes = maxNodes || 700;
    const sX = Math.floor(sx), sZ = Math.floor(sz);
    const tX = Math.floor(tx), tZ = Math.floor(tz);
    if (isSolid(tX, tZ)) return null;
    if (sX === tX && sZ === tZ) return [];

    gScore.fill(Infinity);
    cameFrom.fill(-1);
    closed.fill(0);

    const heap = [];
    function push(f, i) {
      heap.push([f, i]);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (heap[p][0] <= heap[c][0]) break;
        const tmp = heap[p]; heap[p] = heap[c]; heap[c] = tmp;
        c = p;
      }
    }
    function pop() {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          const tmp = heap[m]; heap[m] = heap[i]; heap[i] = tmp;
          i = m;
        }
      }
      return top;
    }
    const h = (x, z) => {
      const dx = Math.abs(x - tX), dz = Math.abs(z - tZ);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };

    const si = sZ * W + sX;
    gScore[si] = 0;
    push(h(sX, sZ), si);
    let expanded = 0;

    while (heap.length) {
      const ci = pop()[1];
      if (closed[ci]) continue;
      closed[ci] = 1;
      const cx = ci % W, cz = (ci / W) | 0;

      if (cx === tX && cz === tZ) {
        const out = [];
        let i = ci;
        while (i !== si) {
          out.push({ x: (i % W) + 0.5, z: ((i / W) | 0) + 0.5 });
          i = cameFrom[i];
        }
        out.reverse();
        return out;
      }
      if (++expanded > maxNodes) return null;

      for (let k = 0; k < DIRS.length; k++) {
        const d = DIRS[k];
        const nx = cx + d[0], nz = cz + d[1];
        if (isSolid(nx, nz)) continue;
        if (d[0] !== 0 && d[1] !== 0 && (isSolid(cx + d[0], cz) || isSolid(cx, cz + d[1]))) continue;
        const ni = nz * W + nx;
        if (closed[ni]) continue;
        const ng = gScore[ci] + d[2];
        if (ng < gScore[ni]) {
          gScore[ni] = ng;
          cameFrom[ni] = ci;
          push(ng + h(nx, nz), ni);
        }
      }
    }
    return null;
  }

  // ---------- Generación del mapa ----------
  function nearType(x, z, r, a, b) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const t = get(x + dx, z + dz);
        if (t === a || t === b) return true;
      }
    }
    return false;
  }

  function buildHouse(x, z, w, d, rng) {
    for (let j = 0; j < d; j++) {
      for (let i = 0; i < w; i++) {
        const edge = i === 0 || j === 0 || i === w - 1 || j === d - 1;
        set(x + i, z + j, edge ? T.WALL : T.FLOOR);
      }
    }
    // Tabique interior con hueco a media altura
    if (rng() < 0.6) {
      const gap = Math.floor(d / 2);
      for (let j = 1; j < d - 1; j++) {
        if (j !== gap) set(x + 2, z + j, T.WALL);
      }
    }
    // Puerta principal y, a veces, puerta trasera
    const door = (side) => {
      if (side === 0) set(x + Math.floor(w / 2), z, T.FLOOR);
      else if (side === 1) set(x + w - 1, z + Math.floor(d / 2), T.FLOOR);
      else if (side === 2) set(x + Math.floor(w / 2), z + d - 1, T.FLOOR);
      else set(x, z + Math.floor(d / 2), T.FLOOR);
    };
    const side = Math.floor(rng() * 4);
    door(side);
    if (rng() < 0.5) door((side + 2) % 4);
  }

  function generate(seed) {
    const rng = G.Util.mulberry32(seed);
    tiles.fill(T.GRASS);

    // Calles en cruz
    for (let z = 0; z < H; z++) {
      for (let x = 0; x < W; x++) {
        if (x === 22 || x === 23 || z === 22 || z === 23) set(x, z, T.ROAD);
      }
    }

    // Casas: 4 manzanas, hasta 4 casas por manzana
    const origins = [2, 26];
    const cells = [0, 9];
    for (const ox of origins) {
      for (const oz of origins) {
        for (const cx of cells) {
          for (const cz of cells) {
            if (rng() < 0.2) continue;
            const w = 6 + Math.floor(rng() * 2);
            const d = 6 + Math.floor(rng() * 2);
            const hx = ox + cx + Math.floor(rng() * 3) - 1;
            const hz = oz + cz + Math.floor(rng() * 3) - 1;
            buildHouse(hx, hz, w, d, rng);
          }
        }
      }
    }

    // Árboles: bosque denso en el borde, sueltos en el resto
    for (let z = 0; z < H; z++) {
      for (let x = 0; x < W; x++) {
        if (get(x, z) !== T.GRASS) continue;
        const border = x < 3 || z < 3 || x >= W - 3 || z >= H - 3;
        const p = border ? 0.7 : 0.07;
        if (rng() >= p) continue;
        if (nearType(x, z, 2, T.WALL, T.FLOOR)) continue;
        if (nearType(x, z, 1, T.ROAD, T.ROAD)) continue;
        set(x, z, T.TREE);
      }
    }
  }

  function randomFree(rng, minDist) {
    for (let k = 0; k < 300; k++) {
      const x = 2 + Math.floor(rng() * (W - 4));
      const z = 2 + Math.floor(rng() * (H - 4));
      if (isSolid(x, z)) continue;
      if (Math.hypot(x + 0.5 - SPAWN.x, z + 0.5 - SPAWN.z) < minDist) continue;
      return { x: x + 0.5, z: z + 0.5 };
    }
    return { x: 23.5, z: 5.5 };
  }

  // ---------- Render ----------
  function paintGround() {
    const S = 24;
    const c = document.createElement('canvas');
    c.width = W * S;
    c.height = H * S;
    const g = c.getContext('2d');
    const rng = G.Util.mulberry32(99);

    for (let z = 0; z < H; z++) {
      for (let x = 0; x < W; x++) {
        const t = get(x, z);
        const px = x * S, pz = z * S;
        if (t === T.ROAD) {
          g.fillStyle = '#4b4c50';
          g.fillRect(px, pz, S, S);
          for (let i = 0; i < 5; i++) {
            g.fillStyle = rng() < 0.5 ? '#55565a' : '#414246';
            g.fillRect(px + rng() * S, pz + rng() * S, 2, 2);
          }
        } else if (t === T.FLOOR) {
          g.fillStyle = '#8c6c48';
          g.fillRect(px, pz, S, S);
          g.fillStyle = '#76593a';
          for (let i = 0; i < S; i += 6) g.fillRect(px, pz + i, S, 1);
        } else if (t === T.WALL) {
          g.fillStyle = '#2f2923';
          g.fillRect(px, pz, S, S);
        } else {
          g.fillStyle = '#4d7338';
          g.fillRect(px, pz, S, S);
          for (let i = 0; i < 7; i++) {
            g.fillStyle = rng() < 0.5 ? '#5a8442' : '#436a31';
            g.fillRect(px + rng() * S, pz + rng() * S, 2, 3);
          }
        }
      }
    }

    // Líneas amarillas discontinuas en el centro de las calles
    g.fillStyle = '#b9a547';
    for (let i = 0; i < H; i++) {
      if (i < 20 || i > 26) {
        if (i % 2 === 0) {
          g.fillRect(23 * S - 1, i * S + 5, 2, S - 10);
          g.fillRect(i * S + 5, 23 * S - 1, S - 10, 2);
        }
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  function build(scene) {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshLambertMaterial({ map: paintGround() })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(W / 2, 0, H / 2);
    scene.add(ground);

    let walls = 0, trees = 0;
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] === T.WALL) walls++;
      else if (tiles[i] === T.TREE) trees++;
    }

    const rng = G.Util.mulberry32(7);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    // Paredes
    const wallMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, WALL_H, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      Math.max(1, walls)
    );
    // Árboles: tronco y copa
    const trunkMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.1, 0.14, 0.8, 6),
      new THREE.MeshLambertMaterial({ color: 0x5b4330 }),
      Math.max(1, trees)
    );
    const leafMesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.55, 1.5, 7),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      Math.max(1, trees)
    );

    let wi = 0, ti = 0;
    for (let z = 0; z < H; z++) {
      for (let x = 0; x < W; x++) {
        const t = get(x, z);
        if (t === T.WALL) {
          dummy.position.set(x + 0.5, WALL_H / 2, z + 0.5);
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          wallMesh.setMatrixAt(wi, dummy.matrix);
          const v = 0.82 + rng() * 0.12;
          color.setRGB(0.78 * v, 0.68 * v, 0.55 * v);
          wallMesh.setColorAt(wi, color);
          wi++;
        } else if (t === T.TREE) {
          const s = 0.85 + rng() * 0.5;
          const ox = (rng() - 0.5) * 0.3, oz = (rng() - 0.5) * 0.3;
          dummy.rotation.set(0, rng() * 6.28, 0);
          dummy.scale.set(s, s, s);
          dummy.position.set(x + 0.5 + ox, 0.4 * s, z + 0.5 + oz);
          dummy.updateMatrix();
          trunkMesh.setMatrixAt(ti, dummy.matrix);
          dummy.position.set(x + 0.5 + ox, 1.35 * s, z + 0.5 + oz);
          dummy.updateMatrix();
          leafMesh.setMatrixAt(ti, dummy.matrix);
          const g = 0.8 + rng() * 0.3;
          color.setRGB(0.16 * g, 0.38 * g, 0.18 * g);
          leafMesh.setColorAt(ti, color);
          ti++;
        }
      }
    }
    wallMesh.instanceMatrix.needsUpdate = true;
    if (wallMesh.instanceColor) wallMesh.instanceColor.needsUpdate = true;
    trunkMesh.instanceMatrix.needsUpdate = true;
    leafMesh.instanceMatrix.needsUpdate = true;
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
    // Las instancias abarcan todo el mapa: se evita el recorte por frustum
    wallMesh.frustumCulled = false;
    trunkMesh.frustumCulled = false;
    leafMesh.frustumCulled = false;
    scene.add(wallMesh, trunkMesh, leafMesh);
  }

  G.World = {
    T, W, H, SPAWN,
    generate, build, randomFree,
    isSolid, circleBlocked, move,
    hasLOS, hasClearLine, findPath
  };
})(window.Game = window.Game || {});
