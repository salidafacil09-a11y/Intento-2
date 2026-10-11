(function (G) {
  'use strict';

  const U = G.Util;
  const WALK_SPEED = 2.3;   // casillas por segundo
  const RUN_SPEED = 4.0;
  const RADIUS = 0.28;
  const S = Math.SQRT1_2;

  // Radio de ruido (en casillas): los zombis lo oyen dentro de ese radio
  const NOISE_IDLE = 0;
  const NOISE_WALK = 0;
  const NOISE_RUN = 7;

  class Player {
    constructor(scene) {
      this.model = G.Models.createHumanoid({
        skin: 0xd9a77b, shirt: 0x2f6b78, pants: 0x2b3345, hair: 0x3a2a1c
      });
      scene.add(this.model.root);
      this.reset();
    }

    reset() {
      this.pos = { x: G.World.SPAWN.x, z: G.World.SPAWN.z };
      this.facing = Math.PI;     // mirando hacia la cámara
      this.health = 100;
      this.noise = NOISE_IDLE;
      this.noiseLevel = 0;       // 0 silencio, 1 pasos, 2 carrera
      this.hurt = 0;
      this.phase = 0;
      this.apply(0);
    }

    damage(amount) {
      this.health = Math.max(0, this.health - amount);
      this.hurt = 0.35;
    }

    update(dt, input) {
      const mx = input.move.x, my = input.move.y;
      const mag = Math.min(1, Math.hypot(mx, my));
      const moving = mag > 0.1;
      const running = input.running && moving;

      // Pantalla -> mundo (cámara isométrica): arriba = (-1,-1), derecha = (1,-1)
      const wx = (mx + my) * S;
      const wz = (my - mx) * S;
      const speed = running ? RUN_SPEED : WALK_SPEED;

      if (moving) {
        G.World.move(this.pos, wx * speed * dt, wz * speed * dt, RADIUS);
        const target = Math.atan2(wx, wz);
        this.facing = U.turnToward(this.facing, target, 12 * dt);
      }

      if (!moving) { this.noise = NOISE_IDLE; this.noiseLevel = 0; }
      else if (running) { this.noise = NOISE_RUN; this.noiseLevel = 2; }
      else { this.noise = NOISE_WALK * (0.5 + 0.5 * mag); this.noiseLevel = 1; }

      this.hurt = Math.max(0, this.hurt - dt);
      this.phase += dt * (running ? 11 : 8) * (moving ? 1 : 0);
      this.apply(moving ? Math.max(0.4, mag) : 0);
    }

    apply(amt) {
      this.model.root.position.set(this.pos.x, 0, this.pos.z);
      this.model.root.rotation.y = this.facing;
      G.Models.animate(this.model, this.phase, amt);
    }
  }

  G.Player = Player;
})(window.Game = window.Game || {});
