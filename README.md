# 15 Puzzle

A classic sliding tile puzzle built with pure HTML, CSS, and JavaScript — no frameworks, no dependencies. Just open `index.html` in a browser and play.

---

## Table of Contents

- [What is the 15 Puzzle?](#what-is-the-15-puzzle)
- [Project Structure](#project-structure)
- [Features](#features)
- [How to Run](#how-to-run)
- [How to Play](#how-to-play)
- [Code Architecture](#code-architecture)
- [Algorithms](#algorithms)
  - [Shuffle (Guaranteed Solvable)](#shuffle-guaranteed-solvable)
  - [Manhattan Distance Heuristic](#manhattan-distance-heuristic)
  - [IDA* (Iterative Deepening A*)](#ida-iterative-deepening-a)
  - [Hint System](#hint-system)
  - [Auto-Solve Animation](#auto-solve-animation)
- [Accessibility](#accessibility)
- [Known Limitations](#known-limitations)

---

## What is the 15 Puzzle?

The 15 Puzzle is a sliding tile game played on a 4×4 grid. It contains 15 numbered tiles (1–15) and one empty space. The goal is to arrange the tiles in ascending order from left to right, top to bottom, with the empty space in the bottom-right corner.

**Goal state:**

```
 1   2   3   4
 5   6   7   8
 9  10  11  12
13  14  15  [ ]
```

A tile can only move if it is directly adjacent (up, down, left, right) to the empty space. The puzzle is solved in the fewest moves possible.

---

## Project Structure

```
puzzle/
├── index.html   # Markup and page structure (pure HTML, no inline CSS or JS)
├── style.css    # All visual styles and animations
├── game.js      # All game logic, algorithms, and interactivity
└── README.md    # This file
```

Each file has a single responsibility:
- `index.html` — structure only
- `style.css` — presentation only
- `game.js` — behaviour and logic only

---

## Features

- **4×4 sliding tile board** with 15 numbered tiles
- **Move counter** — tracks total moves made
- **Timer** — counts elapsed time from the first move
- **New Game** — shuffles and starts a fresh puzzle
- **Hint system** — highlights the single best tile to move next (powered by IDA*)
- **Auto-solve** — computes and animates the full optimal solution step by step
- **Win overlay** — shows a congratulations screen with your move count and time
- **Keyboard support** — navigate and slide tiles using arrow keys
- **Accessible** — ARIA roles, labels, and keyboard focus for screen readers
- **No dependencies** — runs entirely in the browser with no installs

---

## How to Run

No build step or server required. Simply open the file in any modern browser:

```bash
# Option 1: Open directly
xdg-open index.html        # Linux
open index.html            # macOS
start index.html           # Windows

# Option 2: Use a local dev server (e.g., VS Code Live Server extension)
# Right-click index.html → Open with Live Server
```

Tested and works in Chrome, Firefox, Edge, and Safari.

---

## How to Play

1. **Click a tile** adjacent to the empty space to slide it
2. **Arrow keys** also move tiles — the arrow direction moves the empty space, pulling the adjacent tile in
3. **New Game** button shuffles the board and resets the timer
4. **💡 Hint** button highlights the best next tile to move (auto-clears after 3 seconds)
5. **Solve** button automatically plays the optimal solution with animation
6. Arrange all tiles from 1–15 with the empty space at the bottom-right to win

---

## Code Architecture

The entire game logic lives inside an **IIFE (Immediately Invoked Function Expression)** in `game.js` to avoid polluting the global scope:

```js
(() => {
  // all state, logic, and event listeners here
})();
```

### State

| Variable | Description |
|---|---|
| `tiles` | Array of 16 values (1–15 + 0 for empty), represents board left-to-right, top-to-bottom |
| `emptyIndex` | Current index of the empty cell in the `tiles` array |
| `moves` | Move counter |
| `seconds` | Elapsed time in seconds |
| `gameActive` | Boolean flag — prevents input during auto-solve or after win |
| `hintTileIndex` | Board index of the tile highlighted by the hint system |

### Core Functions

| Function | Description |
|---|---|
| `shuffle()` | Generates a new solvable board by making 200 random valid moves from the solved state |
| `render(hintPos)` | Re-draws the entire board from the `tiles` array |
| `handleMove(index)` | Processes a tile click or key press — swaps tile with empty, updates counter, checks win |
| `newGame()` | Resets state, shuffles, renders, starts timer |
| `showHint()` | Runs IDA* and highlights the next best tile |
| `autoSolve()` | Runs IDA* and animates each step of the full solution |
| `showWin()` | Displays the win overlay with stats |

---

## Algorithms

### Shuffle (Guaranteed Solvable)

Rather than randomly placing tiles (which has a 50% chance of being unsolvable), the shuffle starts from the **solved state** and makes **200 random valid moves**:

```js
function shuffle() {
  tiles = [...Array(TOTAL - 1).keys()].map(i => i + 1);
  tiles.push(0);                          // start from solved state
  emptyIndex = TOTAL - 1;
  for (let k = 0; k < 200; k++) {
    const nb   = neighbours(emptyIndex);
    const pick = nb[Math.floor(Math.random() * nb.length)];
    tiles[emptyIndex] = tiles[pick];
    tiles[pick]       = 0;
    emptyIndex        = pick;
  }
}
```

Since every move is a legal slide, the result is always a valid, solvable board. 200 moves provides sufficient randomness so the puzzle doesn't look partially solved.

---

### Manhattan Distance Heuristic

The **Manhattan distance** is the core heuristic used by IDA*. For each tile, it calculates how many steps away it is from its goal position — horizontally plus vertically — and sums them all up.

```js
function manhattan(state) {
  let d = 0;
  for (let i = 0; i < TOTAL; i++) {
    const v = state[i];
    if (v === 0) continue;                          // skip empty tile
    d += Math.abs(row(i) - Math.floor((v - 1) / SIZE)) +
         Math.abs(col(i) - (v - 1) % SIZE);
  }
  return d;
}
```

**Example:** Tile 1 should be at position (row=0, col=0). If it's currently at position (row=2, col=3), its Manhattan distance is |2-0| + |3-0| = 5.

This heuristic is **admissible** — it never overestimates the actual number of moves needed — which guarantees IDA* finds the optimal solution.

---

### IDA* (Iterative Deepening A*)

IDA* is the main solving algorithm. It finds the **optimal (minimum moves) solution** while using very little memory.

**How it works:**

1. Start with a threshold = initial Manhattan distance of the board
2. Do a depth-first search (DFS), but **prune** any path where:
   ```
   moves so far (g) + Manhattan distance (h) > threshold
   ```
3. If no solution is found within the threshold, increase the threshold to the smallest `f` value that was pruned
4. Repeat until the solution is found

```js
function idaStar(initial, initialEmpty) {
  let threshold = manhattan(initial);
  const path = [{ state: initial, empty: initialEmpty }];
  while (true) {
    const res = idasSearch(path, 0, threshold);
    if (res === 'FOUND') return path;
    if (res === Infinity) return null;
    threshold = res;
    if (threshold > 80) return null;   // give up on deeply scrambled boards
  }
}

function idasSearch(path, g, threshold) {
  const { state, empty } = path[path.length - 1];
  const f = g + manhattan(state);
  if (f > threshold) return f;         // prune this branch

  // check if solved
  let solved = true;
  for (let i = 0; i < TOTAL - 1; i++) if (state[i] !== i + 1) { solved = false; break; }
  if (solved && state[TOTAL - 1] === 0) return 'FOUND';

  let min = Infinity;
  for (const nb of neighbours(empty)) {
    if (path.length > 1 && path[path.length - 2].empty === nb) continue; // no reversals
    const ns = [...state];
    ns[empty] = ns[nb];
    ns[nb] = 0;
    path.push({ state: ns, empty: nb });
    const t = idasSearch(path, g + 1, threshold);
    if (t === 'FOUND') return 'FOUND';
    if (t < min) min = t;
    path.pop();
  }
  return min;
}
```

**Why IDA* and not plain A*?**

| | A* | IDA* |
|---|---|---|
| Memory usage | High — stores all explored nodes in a priority queue | Very low — only stores current path (DFS stack) |
| Finds optimal solution | Yes | Yes |
| Speed | Fast for short solutions | Slower but acceptable for puzzles up to ~80 moves |
| Best for | Graphs with many short paths | Deep search spaces with limited memory |

For a 15-puzzle running in a browser tab, IDA* is the right choice — it uses minimal memory and finds the optimal answer.

**Complexity:**
- Time: O(b^d) where b = branching factor (~3) and d = solution depth
- Space: O(d) — only the current path is stored

---

### Hint System

The hint system runs IDA* on the current board state and returns only the **first move** of the optimal solution:

```js
async function showHint() {
  const solution = idaStar([...tiles], emptyIndex);
  // solution[1].empty = where the blank moves next
  // the tile currently at that position is the one the player should move
  hintTileIndex = solution[1].empty;
}
```

The tile is then highlighted with a pulsing orange animation and a directional arrow (↑ ↓ ← →) showing where it will slide. It auto-clears after 3 seconds.

---

### Auto-Solve Animation

The auto-solve feature computes the full optimal path using IDA* and then **animates each step** with a 120ms delay between moves:

```js
async function autoSolve() {
  const solution = idaStar([...tiles], emptyIndex);
  for (let step = 1; step < solution.length; step++) {
    await new Promise(r => setTimeout(r, 120));   // pause between steps
    tiles      = solution[step].state;
    emptyIndex = solution[step].empty;
    moves++;
    render();
  }
  showWin();
}
```

During auto-solve, `gameActive` is set to `false` so player input is ignored until the animation finishes.

---

## Accessibility

- All tiles have `role="button"` and `aria-label="Tile N"` for screen readers
- Hint tiles update their label to include the suggested direction (e.g., `"Tile 5 — suggested move ↑"`)
- The board has `role="grid"` and `aria-label="15 Puzzle board"`
- The win overlay has `role="dialog"` and `aria-modal="true"`
- All interactive elements are keyboard-focusable with `tabindex="0"`
- Arrow keys fully control tile movement

---

## Known Limitations

- **IDA* gives up at depth 80** — extremely scrambled boards (requiring more than 80 moves) will show no solution from the Solve button. This is a performance trade-off to keep the browser responsive.
- **No local storage** — move history and best scores are not saved between sessions.
- **No undo** — there is no move undo feature.
- **Single board size** — only 4×4 is supported; no 3×3 or 5×5 variants.
