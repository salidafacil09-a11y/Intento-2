(function (G) {
  'use strict';

  const U = G.Util;

  // Zombis lentos únicamente. Ajusta estos valores para cambiar la dificultad.
  const SIGHT_RANGE = 11;      // distancia máxima de visión
  const FOV_HALF = 0.8;        // medio ángulo de visión (rad), ~92° en total: solo de frente
  const CLOSE_SENSE = 0;       // distancia a la que te perciben incluso por la espalda
  const WANDER_SPEED = 0.45;
  const INVESTIGATE_SPEED = 0.6;
  const CHASE_SPEED = 0.95;
  const ATTACK_RANGE = 0.85;
  const ATTACK_DPS = 14;       // daño provisional hasta el bloque de combate
  const RADIUS = 0.28;

  const SKINS = [0x7d9470, 0x8a9a78, 0x6f8466, 0x92a082];
  const SHIRTS = [0x5a4a3a, 0x6b5d4f, 0x4a5560, 0x6e4b4b, 0x55603f, 0x7a7a72];
  const PANTS = [0x2f3340, 0x3b3a33, 0x4a4036, 0x28303a];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  class Zombie {
    constructor(scene, x, z) {
      this.scene = scene;
      this.pos = { x, z };
      this.facing = Math.random() * Math.PI * 2;
      this.model = G.Models.createHumanoid({
        skin: pick(SKINS), shirt: pick(SHIRTS), pants: pick(PANTS),
        scale: 0.95 + Math.random() * 0.12, zombie: true
      });
      scene.add(this.model.root);

      this.state = 'idle';           // idle | wander | investigate | chase
      this.timer = 1 + Math.random() * 3;
      this.target = null;
      this.lastKnown = null;
      this.hearTimer = 0;
      this.path = null;
      this.pathTimer = 0;
      this.clear = true;
      this.clearTimer = 0;
      this.stuck = 0;
      this.phase = Math.random() * 10;
      this.speedNow = 0;
      this.attacking = false;
      this.apply();
    }

    dispose() {
      this.scene.remove(this.model.root);
    }

    enter(state, timer) {
      this.state = state;
      this.timer = timer;
      this.pathTimer = 0;
      this.clearTimer = 0;
    }

    update(dt, player, all) {
      const px = player.pos.x, pz = player.pos.z;
      const dx = px - this.pos.x, dz = pz - this.pos.z;
      const dist = Math.hypot(dx, dz);

      // --- Sentidos ---
      let los = null;
      const seeLOS = () => (los === null ? (los = G.World.hasLOS(this.pos.x, this.pos.z, px, pz)) : los);

      let sees = false;
      if (dist < SIGHT_RANGE) {
        const diff = Math.abs(U.angleDiff(Math.atan2(dx, dz), this.facing));
        if ((diff < FOV_HALF || dist < CLOSE_SENSE) && seeLOS()) sees = true;
      }
      let hears = false;
      if (!sees && dist < player.noise + 1) {
        hears = dist < player.noise * (seeLOS() ? 1 : 0.6);
      }

      // --- Cambios de estado ---
      this.hearTimer -= dt;
      if (sees || hears) {
        // Te vio de frente, o te oyó correr cerca: te persigue
        if (this.state !== 'chase') this.enter('chase', 0);
        this.lastKnown = { x: px, z: pz };
        this.target = this.lastKnown;
      } else if (this.state === 'chase') {
        // Te perdió: va al último lugar donde te notó y luego vuelve a vagar
        this.enter('investigate', 10);
        this.target = this.lastKnown;
      }

      // --- Comportamiento ---
      let speed = 0;
      this.attacking = false;

      if (this.state === 'idle') {
        this.timer -= dt;
        if (this.timer <= 0) {
          const a = Math.random() * Math.PI * 2;
          const d = 3 + Math.random() * 5;
          const tx = this.pos.x + Math.sin(a) * d;
          const tz = this.pos.z + Math.cos(a) * d;
          if (!G.World.isSolid(Math.floor(tx), Math.floor(tz))) {
            this.target = { x: tx, z: tz };
            this.enter('wander', 12);
          } else {
            this.timer = 1;
          }
        }
      } else if (this.state === 'wander' || this.state === 'investigate') {
        this.timer -= dt;
        const g = this.target;
        if (!g || this.timer <= 0 || Math.hypot(g.x - this.pos.x, g.z - this.pos.z) < 0.6) {
          this.enter('idle', 2 + Math.random() * 5);
        } else {
          speed = this.state === 'wander' ? WANDER_SPEED : INVESTIGATE_SPEED;
        }
      } else if (this.state === 'chase') {
        if (dist < ATTACK_RANGE) {
          this.attacking = true;
          this.facing = U.turnToward(this.facing, Math.atan2(dx, dz), 5 * dt);
          player.damage(ATTACK_DPS * dt);
        } else {
          speed = CHASE_SPEED;
        }
      }

      let moved = 0;
      if (speed > 0 && this.target) moved = this.stepToward(this.target, speed, dt);
      this.speedNow = moved;

      // Atascado: forzar nueva ruta
      if (speed > 0 && moved < speed * 0.3) {
        this.stuck += dt;
        if (this.stuck > 1.2) {
          this.clear = false;
          this.clearTimer = 1;
          this.pathTimer = 0;
          this.stuck = 0;
        }
      } else {
        this.stuck = 0;
      }

      // Separación entre zombis para que no se amontonen
      for (let i = 0; i < all.length; i++) {
        const o = all[i];
        if (o === this) continue;
        const ox = this.pos.x - o.pos.x, oz = this.pos.z - o.pos.z;
        const d2 = ox * ox + oz * oz;
        if (d2 < 0.36 && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = (0.6 - d) * 0.5;
          G.World.move(this.pos, ox / d * push, oz / d * push, RADIUS);
        }
      }

      this.phase += dt * (1.5 + this.speedNow * 5);
      this.apply();
    }

    // Avanza hacia la meta; si hay obstáculos en medio, sigue una ruta A*
    stepToward(goal, speed, dt) {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) {
        this.clear = G.World.hasClearLine(this.pos.x, this.pos.z, goal.x, goal.z);
        this.clearTimer = 0.2;
      }

      let gx = goal.x, gz = goal.z;
      if (!this.clear) {
        this.pathTimer -= dt;
        if (this.pathTimer <= 0) {
          this.path = G.World.findPath(this.pos.x, this.pos.z, goal.x, goal.z);
          this.pathTimer = 1 + Math.random() * 0.6;
        }
        if (this.path) {
          while (this.path.length &&
                 Math.hypot(this.path[0].x - this.pos.x, this.path[0].z - this.pos.z) < 0.4) {
            this.path.shift();
          }
          if (this.path.length) { gx = this.path[0].x; gz = this.path[0].z; }
        }
      } else {
        this.path = null;
      }

      const ddx = gx - this.pos.x, ddz = gz - this.pos.z;
      const d = Math.hypot(ddx, ddz);
      if (d < 0.01) return 0;

      this.facing = U.turnToward(this.facing, Math.atan2(ddx, ddz), 3 * dt);
      const step = speed * dt;
      const bx = this.pos.x, bz = this.pos.z;
      G.World.move(this.pos, ddx / d * step, ddz / d * step, RADIUS);
      return Math.hypot(this.pos.x - bx, this.pos.z - bz) / dt;
    }

    apply() {
      const m = this.model;
      m.root.position.set(this.pos.x, 0, this.pos.z);
      m.root.rotation.y = this.facing;
      const amt = Math.min(1, this.speedNow / 0.9) * 0.55 + (this.attacking ? 0 : 0.05);
      G.Models.animate(m, this.phase, amt);
    }
  }

  G.Zombie = Zombie;
})(window.Game = window.Game || {});
