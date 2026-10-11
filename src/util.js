(function (G) {
  'use strict';

  const Util = {
    // Generador pseudoaleatorio con semilla (mismo mapa en cada partida)
    mulberry32(seed) {
      let a = seed | 0;
      return function () {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },

    clamp(v, lo, hi) {
      return v < lo ? lo : v > hi ? hi : v;
    },

    // Diferencia de ángulos en el rango [-PI, PI]
    angleDiff(a, b) {
      let d = a - b;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    },

    // Gira el ángulo "a" hacia "b" con un paso máximo
    turnToward(a, b, maxStep) {
      const d = Util.angleDiff(b, a);
      if (Math.abs(d) <= maxStep) return b;
      return a + Math.sign(d) * maxStep;
    }
  };

  G.Util = Util;
})(window.Game = window.Game || {});
