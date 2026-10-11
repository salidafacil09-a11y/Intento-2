(function (G) {
  'use strict';

  // Modelos 3D de pocos polígonos hechos con cajas. Geometrías y materiales
  // se comparten entre todos los personajes para que sea ligero en móviles.
  // El modelo "mira" hacia +Z.

  const mats = {};
  const geos = {};

  function mat(color) {
    return mats[color] || (mats[color] = new THREE.MeshLambertMaterial({ color: color }));
  }

  function geo(w, h, d) {
    const k = w + '|' + h + '|' + d;
    return geos[k] || (geos[k] = new THREE.BoxGeometry(w, h, d));
  }

  function box(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(geo(w, h, d), mat(color));
    m.position.set(x, y, z);
    return m;
  }

  let shadowGeo = null;
  let shadowMat = null;
  function makeShadow() {
    if (!shadowGeo) {
      shadowGeo = new THREE.CircleGeometry(0.38, 12);
      shadowGeo.rotateX(-Math.PI / 2);
      shadowMat = new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false
      });
    }
    const s = new THREE.Mesh(shadowGeo, shadowMat);
    s.position.y = 0.03;
    return s;
  }

  // Extremidad con pivote en su extremo superior (cadera u hombro)
  function limb(x, y, w, h, d, color, handColor) {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    g.add(box(w, h, d, color, 0, -h / 2, 0));
    if (handColor != null) g.add(box(w, 0.14, d, handColor, 0, -h + 0.06, 0));
    return g;
  }

  function createHumanoid(o) {
    const root = new THREE.Group();
    const model = new THREE.Group();
    root.add(model);
    root.add(makeShadow());

    model.add(box(0.5, 0.6, 0.28, o.shirt, 0, 1.0, 0));

    const head = new THREE.Group();
    head.position.set(0, 1.45, 0);
    head.add(box(0.3, 0.3, 0.3, o.skin, 0, 0, 0));
    head.add(box(0.06, 0.06, 0.02, 0x15110f, -0.08, 0.02, 0.151));
    head.add(box(0.06, 0.06, 0.02, 0x15110f, 0.08, 0.02, 0.151));
    if (o.hair != null) head.add(box(0.32, 0.1, 0.32, o.hair, 0, 0.15, -0.01));
    model.add(head);

    const legL = limb(-0.13, 0.7, 0.2, 0.7, 0.22, o.pants);
    const legR = limb(0.13, 0.7, 0.2, 0.7, 0.22, o.pants);
    const armL = limb(-0.34, 1.27, 0.15, 0.55, 0.15, o.shirt, o.skin);
    const armR = limb(0.34, 1.27, 0.15, 0.55, 0.15, o.shirt, o.skin);
    model.add(legL, legR, armL, armR);

    const s = o.scale || 1;
    model.scale.set(s, s, s);

    return { root, model, head, legL, legR, armL, armR, zombie: !!o.zombie };
  }

  // phase: fase del ciclo de paso, amt: 0 (quieto) a 1 (paso completo)
  function animate(m, phase, amt) {
    const swing = Math.sin(phase) * 0.8 * amt;
    m.legL.rotation.x = swing;
    m.legR.rotation.x = -swing;
    if (m.zombie) {
      // Brazos al frente, balanceo lento y cabeza ladeada
      const sway = Math.sin(phase * 0.5);
      m.armL.rotation.x = -1.35 + sway * 0.12;
      m.armR.rotation.x = -1.25 - sway * 0.12;
      m.head.rotation.z = 0.14 + sway * 0.08;
      m.head.rotation.x = 0.18;
      m.model.position.y = 0;
    } else {
      m.armL.rotation.x = -swing * 0.9;
      m.armR.rotation.x = swing * 0.9;
      m.model.position.y = Math.abs(Math.sin(phase)) * 0.04 * amt;
    }
  }

  G.Models = { createHumanoid, animate, mat, geo };
})(window.Game = window.Game || {});
