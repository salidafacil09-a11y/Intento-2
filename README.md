# Ceniza

Juego de supervivencia zombi para navegador, en vista isométrica. El mundo es 2D y los personajes son modelos 3D de pocos polígonos (Three.js). Funciona en PC y en móvil.

> "Ceniza" es un nombre provisional. Es un proyecto inspirado en el género de supervivencia isométrica; todo el arte, el código y los nombres son propios.

## Estado: bloque 1 (base y zombis lentos)

- Pueblo generado con calles, casas con puertas, tabiques y bosque
- Jugador con movimiento isométrico y cámara que lo sigue
- Controles unificados: teclado, joystick táctil y mando (Gamepad API)
- Zombis lentos con visión (cono y línea de vista), oído (el ruido los atrae) y persecución con A*
- Ruido según lo que hagas: quieto, caminar o correr
- Daño provisional al ser alcanzado, para poder probar la persecución

## Controles

| Plataforma | Mover | Correr |
|---|---|---|
| Teclado | WASD o flechas | Shift |
| Móvil | Arrastrar con el pulgar izquierdo | Mantener el botón Correr |
| Mando | Stick izquierdo o cruceta | B, L3, LT o RT |

## Cómo probarlo

Abre `index.html` en el navegador. Necesita conexión para cargar Three.js desde el CDN. Añade `?debug` a la dirección para ver los fotogramas por segundo.

## Publicar en GitHub Pages

1. Sube todos los archivos a la raíz del repositorio.
2. En el repositorio: Settings, Pages, Source "Deploy from a branch", rama `main`, carpeta `/ (root)`.
3. En uno o dos minutos estará en `https://TU_USUARIO.github.io/NOMBRE_DEL_REPO/`.

## Estructura

```
index.html        página y capas de interfaz
style.css         HUD, controles táctiles y pantallas
src/
  util.js         aleatorio con semilla y ayudas de ángulos
  input.js        entrada unificada (teclado, táctil, mando)
  models.js       modelos low-poly y animación
  world.js        mapa, colisiones, línea de vista, pathfinding y render
  player.js       jugador
  zombie.js       zombi lento (IA)
  main.js         bucle principal, cámara y HUD
```

## Ajustes rápidos

- Número de zombis: `ZOMBIE_COUNT` en `src/main.js`
- Velocidad, visión y oído de los zombis: constantes al inicio de `src/zombie.js`
- Velocidad y ruido del jugador: constantes al inicio de `src/player.js`
- Zoom de la cámara: `VIEW` en `src/main.js`

## Plan de bloques

1. Base y zombis lentos (este)
2. Combate: golpes, empujón, pisotón, agarre, mordida e infección
3. Supervivencia: hambre, sed, cansancio, heridas
4. Inventario y saqueo
5. Mundo: interiores con puertas y ventanas, día y noche, clima
6. Pulido: menú, guardado, sonido, PWA y optimización móvil

## Licencia

Añade una licencia al repositorio (por ejemplo MIT) antes de publicarlo. Three.js se carga desde un CDN y tiene su propia licencia (MIT).
