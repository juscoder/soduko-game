# Sudoku Game

Juego de Sudoku desarrollado con **JavaScript puro** (HTML + CSS + JS vanilla). Sin dependencias, sin frameworks y sin paso de build: se abre el navegador y a jugar.

## Características

- 3 niveles de dificultad: **Easy**, **Medium** y **Hard**.
- Temporizador en formato `MM:SS` que arranca al iniciar la partida.
- 3 formas de jugar: **drag & drop** desde la paleta, **clic/tap** (número y celda, en cualquier orden) y **teclado** (`1`–`9` para colocar, `0`/`Backspace`/`Delete` para borrar). Paleta con `X` para borrar una celda.
- Puzzles **con solución única garantizada**: la partida siempre es ganable.
- Celdas fijas (las dadas por el puzzle) no editables.
- Resaltado en rojo de las jugadas incorrectas.
- Detección automática de victoria: mensaje de felicitación y bloqueo del tablero.
- Botón **New Game** para reiniciar con la dificultad seleccionada.
- Botón **Clear My Moves** para limpiar solo tus jugadas y conservar las pistas iniciales (también desbloquea el tablero si ya habías ganado).
- Diseño responsive y estilos con variables CSS.

## Requisitos

Solo necesitas un navegador web moderno (Chrome, Firefox, Edge o Safari).

## Instalación y ejecución

Opción 1 — abrir directamente:

```bash
git clone https://github.com/juscoder/soduko-game.git
cd soduko-game
# Abrir index.html en el navegador
```

Opción 2 — con un servidor local:

```bash
git clone https://github.com/juscoder/soduko-game.git
cd soduko-game
npx serve .        # o: python -m http.server
```

Luego visita `http://localhost:3000` (o el puerto que indique el servidor).

## Estructura del proyecto

| Archivo        | Descripción                                              |
| -------------- | -------------------------------------------------------- |
| `index.html`   | Estructura de la interfaz: controles, grid y paleta.     |
| `style.css`    | Estilos completos, variables CSS y diseño responsive.    |
| `script.js`    | Toda la lógica: generación, render, eventos y temporizador. |

## Cómo funciona

### Generación del puzzle

- `solveSudoku(board)` (script.js:84) llena un tablero 9×9 mediante **backtracking**, barajando los candidatos 1–9 en cada celda para obtener un tablero distinto en cada partida.
- `countSolutions(board, limit)` (script.js:118) cuenta las soluciones de un puzzle con **masks de bits** (fila/columna/caja) y la heurística **MRV** (siempre la celda más restringida), parando al llegar al límite. Así comprueba la unicidad de forma muy rápida.
- `generateSudoku(difficulty)` (script.js:216):
  1. Crea una solución completa válida.
  2. La guarda en `solutionBoard` (usada para validar y detectar victoria).
  3. Elimina celdas al azar según la dificultad: **40** (easy), **50** (medium), **60** (hard), **manteniendo siempre la solución única** (`countSolutions(...) === 1`): si quitar una celda haría el puzzle ambiguo, se restaura. Hay un tope de intentos (2 pasadas por el tablero) y un presupuesto de tiempo (400 ms) para que la interfaz nunca se congele; si no se llega al objetivo, el puzzle sale un poco más fácil pero sigue siendo único.
  4. Guarda el estado inicial (`initialBoard`, las celdas fijas) y el estado actual (`sudokuBoard`).

### Render y jugadas

- `renderBoard()` pinta las 81 celdas y les asigna `data-row` / `data-col`, con listener de clic y de drag & drop en cada una.
- `placeValue(row, col, value)` (script.js:363) es el **único punto de entrada** para modificar una celda: lo usan el drop, el clic/tap y el teclado. Ignora las celdas fijas y el tablero bloqueado, actualiza `sudokuBoard`, marca errores (`.error`) comparando contra `solutionBoard` y llama a `checkGameStatus()`.
- Selección: `handleCellClick()` (script.js:398) y `handlePaletteClick()` (script.js:427) funcionan en cualquier orden (número → celda o celda → número); `handleKeydown()` (script.js:445) permite jugar sin ratón. Las selecciones se reflejan con las clases `.selected`.
- Drag & drop: `dragstart` en la paleta, `dragover`/`drop` en las celdas (escritorio).
- `checkGameStatus()` (script.js:571) compara el tablero con la solución; si coinciden, detiene el temporizador, muestra el mensaje de victoria y añade la clase `game-over` al grid (bloquea el tablero vía CSS `pointer-events` y un guard en `placeValue()`).
- `clearUserMoves()` (script.js:627) limpia solo tus jugadas; si ya habías ganado, desbloquea el tablero y reanuda el temporizador.

### Temporizador

`startTimer()` / `stopTimer()` / `resetTimer()` controlan un `setInterval` de 1 segundo; `formatTime()` convierte los segundos a `MM:SS`.

## Personalización

- **Colores:** edita las variables CSS en el bloque `:root` de `style.css:1` (`--primary-color`, `--error-color`, etc.).
- **Dificultades:** modifica la cantidad de celdas eliminadas en el `switch` de `generateSudoku()` (script.js:219).
- **Idioma de la interfaz:** los textos de los botones están en `index.html`.
