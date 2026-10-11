(function (G) {
  'use strict';

  // Capa de entrada unificada. El resto del juego solo lee:
  //   Input.move     -> {x, y} con valores de -1 a 1 (y negativo = arriba en pantalla)
  //   Input.running  -> true si el jugador quiere correr
  // Así, añadir acciones nuevas (atacar, interactuar...) no toca nada más.

  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const keys = {};
  const touch = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, run: false };
  const JOY_RADIUS = 52;      // píxeles hasta el tope del joystick
  const TOUCH_DEADZONE = 0.15;
  const PAD_DEADZONE = 0.2;

  const Input = {
    isTouch,
    move: { x: 0, y: 0 },
    running: false,

    init() {
      window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      });
      window.addEventListener('keyup', (e) => { keys[e.code] = false; });
      window.addEventListener('blur', () => {
        for (const k in keys) keys[k] = false;
      });
      if (isTouch) setupTouch();
    },

    // Se llama una vez por fotograma
    update() {
      let x = 0, y = 0;
      if (keys.KeyA || keys.ArrowLeft) x -= 1;
      if (keys.KeyD || keys.ArrowRight) x += 1;
      if (keys.KeyW || keys.ArrowUp) y -= 1;
      if (keys.KeyS || keys.ArrowDown) y += 1;

      // Joystick táctil (con zona muerta)
      const tm = Math.hypot(touch.x, touch.y);
      if (tm > TOUCH_DEADZONE) { x += touch.x; y += touch.y; }

      const pad = readPad();
      x += pad.x;
      y += pad.y;

      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      this.move.x = x;
      this.move.y = y;
      this.running = !!(keys.ShiftLeft || keys.ShiftRight || touch.run || pad.run);
    },

    // Botón de confirmar en el mando (para empezar o reintentar)
    padConfirm() {
      const p = firstPad();
      return !!(p && p.buttons[0] && p.buttons[0].pressed);
    }
  };

  function firstPad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) return pads[i];
    }
    return null;
  }

  function readPad() {
    const p = firstPad();
    if (!p) return { x: 0, y: 0, run: false };
    let x = p.axes[0] || 0;
    let y = p.axes[1] || 0;
    if (Math.hypot(x, y) < PAD_DEADZONE) { x = 0; y = 0; }
    const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
    if (x === 0 && y === 0) {
      if (b(12)) y = -1;
      if (b(13)) y = 1;
      if (b(14)) x = -1;
      if (b(15)) x = 1;
    }
    // B, L3, LT, RT para correr
    const run = b(1) || b(10) || b(6) || b(7);
    return { x, y, run };
  }

  function setupTouch() {
    const ui = document.getElementById('touch-ui');
    const zone = document.getElementById('joy-zone');
    const base = document.getElementById('joy-base');
    const knob = document.getElementById('joy-knob');
    const hint = document.getElementById('joy-hint');
    const runBtn = document.getElementById('btn-run');
    ui.classList.add('visible');

    // Joystick flotante: aparece donde pones el dedo
    zone.addEventListener('pointerdown', (e) => {
      if (touch.active) return;
      touch.active = true;
      touch.id = e.pointerId;
      touch.ox = e.clientX;
      touch.oy = e.clientY;
      touch.x = 0;
      touch.y = 0;
      zone.setPointerCapture(e.pointerId);
      base.style.left = e.clientX + 'px';
      base.style.top = e.clientY + 'px';
      knob.style.transform = 'translate(-50%, -50%)';
      base.classList.add('on');
      hint.classList.add('off');
      e.preventDefault();
    });

    zone.addEventListener('pointermove', (e) => {
      if (!touch.active || e.pointerId !== touch.id) return;
      let dx = e.clientX - touch.ox;
      let dy = e.clientY - touch.oy;
      const len = Math.hypot(dx, dy);
      if (len > JOY_RADIUS) { dx = dx / len * JOY_RADIUS; dy = dy / len * JOY_RADIUS; }
      touch.x = dx / JOY_RADIUS;
      touch.y = dy / JOY_RADIUS;
      knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
    });

    const end = (e) => {
      if (e.pointerId !== touch.id) return;
      touch.active = false;
      touch.id = null;
      touch.x = 0;
      touch.y = 0;
      base.classList.remove('on');
      hint.classList.remove('off');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    // Botón de correr (se mantiene pulsado)
    const runDown = (e) => { touch.run = true; runBtn.classList.add('down'); e.preventDefault(); };
    const runUp = () => { touch.run = false; runBtn.classList.remove('down'); };
    runBtn.addEventListener('pointerdown', runDown);
    runBtn.addEventListener('pointerup', runUp);
    runBtn.addEventListener('pointercancel', runUp);
    runBtn.addEventListener('pointerleave', runUp);

    // Evita el menú contextual al mantener pulsado
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  G.Input = Input;
})(window.Game = window.Game || {});
