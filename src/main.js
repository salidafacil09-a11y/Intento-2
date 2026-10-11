(function (G) {
  'use strict';

  const VIEW = 6.5;             // mitad de la altura visible de la cámara (unidades)
  const ZOMBIE_COUNT = 18;
  const OFFSET = { x: 14, y: 14, z: 14 };   // cámara isométrica
  const DEBUG = location.search.indexOf('debug') !== -1;

  let renderer, scene, camera, player;
  let zombies = [];
  let state = 'menu';           // menu | playing | dead
  let last = 0;
  let fpsAcc = 0, fpsN = 0;
  const camPos = { x: 0, z: 0 };
  const el = (id) => document.getElementById(id);

  function fatal(msg) {
    el('start-msg').textContent = msg;
    el('btn-start').disabled = true;
  }

  function init() {
    if (typeof THREE === 'undefined') {
      fatal('No se pudo cargar Three.js. Revisa tu conexión y recarga la página.');
      return;
    }
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !G.Input.isTouch, powerPreference: 'high-performance' });
    } catch (e) {
      fatal('Tu navegador no admite WebGL, necesario para jugar.');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, G.Input.isTouch ? 1.5 : 2));
    document.getElementById('game').appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x16201a);
    scene.add(new THREE.AmbientLight(0xffffff, 0.58));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.5);
    sun.position.set(-6, 12, 4);
    scene.add(sun);

    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 300);

    G.Input.init();
    G.World.generate(1337);
    G.World.build(scene);

    player = new G.Player(scene);
    spawnZombies();
    camPos.x = player.pos.x;
    camPos.z = player.pos.z;

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    resize();

    el('btn-start').addEventListener('click', start);
    el('btn-retry').addEventListener('click', retry);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        if (state === 'menu') start();
        else if (state === 'dead') retry();
      }
    });

    if (DEBUG) el('debug').classList.remove('hidden');
    requestAnimationFrame(loop);
  }

  function spawnZombies() {
    const rng = G.Util.mulberry32(Date.now() & 0xffff);
    for (let i = 0; i < ZOMBIE_COUNT; i++) {
      const p = G.World.randomFree(rng, 14);
      zombies.push(new G.Zombie(scene, p.x, p.z));
    }
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    const a = w / h;
    let hh = VIEW, hw = VIEW * a;
    if (a < 1) { hw = VIEW * 0.9; hh = hw / a; }   // vertical: más zoom out
    camera.left = -hw;
    camera.right = hw;
    camera.top = hh;
    camera.bottom = -hh;
    camera.updateProjectionMatrix();
  }

  function tryFullscreen() {
    if (!G.Input.isTouch) return;
    const e = document.documentElement;
    const req = e.requestFullscreen || e.webkitRequestFullscreen;
    try {
      if (req) {
        const p = req.call(e);
        if (p && p.catch) p.catch(() => {});
      }
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (err) { /* no pasa nada */ }
  }

  function start() {
    if (state !== 'menu') return;
    tryFullscreen();
    el('start').classList.add('hidden');
    state = 'playing';
  }

  function retry() {
    zombies.forEach((z) => z.dispose());
    zombies = [];
    player.reset();
    spawnZombies();
    camPos.x = player.pos.x;
    camPos.z = player.pos.z;
    el('dead').classList.add('hidden');
    state = 'playing';
  }

  function die() {
    state = 'dead';
    el('dead').classList.remove('hidden');
  }

  function updateCamera(dt) {
    const k = Math.min(1, dt * 6);
    camPos.x += (player.pos.x - camPos.x) * k;
    camPos.z += (player.pos.z - camPos.z) * k;
    camera.position.set(camPos.x + OFFSET.x, OFFSET.y, camPos.z + OFFSET.z);
    camera.lookAt(camPos.x, 0, camPos.z);
  }

  const NOISE_TEXT = ['En silencio', 'Caminando', 'Corriendo: te oyen'];

  function updateHud() {
    el('hp-fill').style.width = player.health + '%';
    el('hp-fill').classList.toggle('low', player.health < 35);
    const n = el('noise');
    n.textContent = NOISE_TEXT[player.noiseLevel];
    n.className = 'n' + player.noiseLevel;
    el('damage').style.opacity = Math.min(1, player.hurt * 2.5);

    let chasing = 0;
    for (let i = 0; i < zombies.length; i++) if (zombies[i].state === 'chase') chasing++;
    el('chasers').textContent = chasing ? (chasing === 1 ? 'Te persigue 1 zombi' : 'Te persiguen ' + chasing + ' zombis') : '';
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;

    if (state === 'playing' && !document.hidden) {
      G.Input.update();
      player.update(dt, G.Input);
      for (let i = 0; i < zombies.length; i++) zombies[i].update(dt, player, zombies);
      if (player.health <= 0) die();
    } else if (state === 'menu' || state === 'dead') {
      if (G.Input.padConfirm()) { if (state === 'menu') start(); else retry(); }
    }

    updateCamera(dt);
    updateHud();
    renderer.render(scene, camera);

    if (DEBUG && dt > 0) {
      fpsAcc += dt; fpsN++;
      if (fpsAcc > 0.5) {
        el('debug').textContent = Math.round(fpsN / fpsAcc) + ' fps';
        fpsAcc = 0; fpsN = 0;
      }
    }
  }

  window.addEventListener('DOMContentLoaded', init);
})(window.Game = window.Game || {});
