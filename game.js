(() => {
  // ── State ─────────────────────────────────────────────────────────────
  const SIZE  = 4;
  const TOTAL = SIZE * SIZE;   // 16 cells; values 1-15, 0 = empty
  let tiles       = [];
  let emptyIndex  = 0;
  let moves       = 0;
  let seconds     = 0;
  let timerInterval  = null;
  let gameActive     = false;

  // Hint state
  let hintTileIndex = -1;   // board position of the tile to move
  let hintTimeout   = null; // auto-clear timer

  // ── DOM refs ──────────────────────────────────────────────────────────
  const board      = document.getElementById('board');
  const movesEl    = document.getElementById('moves');
  const timerEl    = document.getElementById('timer');
  const winOverlay = document.getElementById('win-overlay');
  const winStats   = document.getElementById('win-stats');
  const hintMsg    = document.getElementById('hint-msg');
  const btnNew     = document.getElementById('btn-new');
  const btnHint    = document.getElementById('btn-hint');
  const btnSolve   = document.getElementById('btn-solve');
  const btnWinNew  = document.getElementById('btn-win-new');

  // ── Helpers ───────────────────────────────────────────────────────────
  const row = i => Math.floor(i / SIZE);
  const col = i => i % SIZE;

  function neighbours(i) {
    const r = [];
    if (row(i) > 0)        r.push(i - SIZE);
    if (row(i) < SIZE - 1) r.push(i + SIZE);
    if (col(i) > 0)        r.push(i - 1);
    if (col(i) < SIZE - 1) r.push(i + 1);
    return r;
  }

  function isSolved() {
    for (let i = 0; i < TOTAL - 1; i++) if (tiles[i] !== i + 1) return false;
    return tiles[TOTAL - 1] === 0;
  }

  /** Direction label from the tile's perspective (where it will slide) */
  function slideDirection(from, to) {
    const dr = row(to) - row(from);
    const dc = col(to) - col(from);
    if (dr === -1) return '↑';
    if (dr ===  1) return '↓';
    if (dc === -1) return '←';
    if (dc ===  1) return '→';
    return '';
  }

  // ── Shuffle ───────────────────────────────────────────────────────────
  // Start from solved state and make 200 random valid moves —
  // guarantees the puzzle is always solvable.
  function shuffle() {
    tiles = [...Array(TOTAL - 1).keys()].map(i => i + 1);
    tiles.push(0);
    emptyIndex = TOTAL - 1;
    for (let k = 0; k < 200; k++) {
      const nb   = neighbours(emptyIndex);
      const pick = nb[Math.floor(Math.random() * nb.length)];
      tiles[emptyIndex] = tiles[pick];
      tiles[pick]       = 0;
      emptyIndex        = pick;
    }
  }

  // ── Timer ─────────────────────────────────────────────────────────────
  const fmt = s => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  function startTimer() {
    stopTimer();
    seconds = 0;
    timerEl.textContent = fmt(0);
    timerInterval = setInterval(() => {
      seconds++;
      timerEl.textContent = fmt(seconds);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // ── Render ────────────────────────────────────────────────────────────
  function render(hintPos = -1) {
    board.innerHTML = '';
    tiles.forEach((value, index) => {
      const tile = document.createElement('div');
      tile.classList.add('tile');
      tile.dataset.index = index;

      if (value === 0) {
        tile.classList.add('empty');
        tile.setAttribute('aria-hidden', 'true');
      } else {
        tile.textContent = value;
        tile.setAttribute('role', 'button');
        tile.setAttribute('tabindex', '0');
        tile.setAttribute('aria-label', `Tile ${value}`);

        // Hint highlight
        if (index === hintPos) {
          tile.classList.add('hint-tile');
          const dir = slideDirection(index, emptyIndex);
          tile.dataset.arrow = dir;
          tile.setAttribute('aria-label', `Tile ${value} — suggested move ${dir}`);
        }

        tile.addEventListener('click', () => handleMove(index));
        tile.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleMove(index);
          }
        });
      }

      board.appendChild(tile);
    });
  }

  // ── Move logic ────────────────────────────────────────────────────────
  function handleMove(index) {
    if (!gameActive) return;
    if (!neighbours(emptyIndex).includes(index)) return;

    // Clear any active hint when a move is made
    clearHint();

    const oldEmpty = emptyIndex;
    tiles[emptyIndex] = tiles[index];
    tiles[index]      = 0;
    emptyIndex        = index;

    moves++;
    movesEl.textContent = moves;
    render();

    // Animate the tile that just slid (now sitting at oldEmpty)
    const movedNode = board.children[oldEmpty];
    if (movedNode && !movedNode.classList.contains('empty')) {
      movedNode.classList.remove('slide');
      void movedNode.offsetWidth; // force reflow to restart animation
      movedNode.classList.add('slide');
    }

    if (isSolved()) {
      stopTimer();
      gameActive = false;
      showWin();
    }
  }

  // ── Arrow key navigation ──────────────────────────────────────────────
  // Arrow direction = direction the empty space moves,
  // so the tile on the opposite side slides in.
  document.addEventListener('keydown', e => {
    if (!gameActive) return;
    const r = row(emptyIndex);
    const c = col(emptyIndex);
    let target = -1;
    switch (e.key) {
      case 'ArrowUp':    if (r < SIZE - 1) target = emptyIndex + SIZE; break;
      case 'ArrowDown':  if (r > 0)        target = emptyIndex - SIZE; break;
      case 'ArrowLeft':  if (c < SIZE - 1) target = emptyIndex + 1;    break;
      case 'ArrowRight': if (c > 0)        target = emptyIndex - 1;    break;
      default: return;
    }
    if (target !== -1) { e.preventDefault(); handleMove(target); }
  });

  // ── Win screen ────────────────────────────────────────────────────────
  function showWin() {
    winStats.innerHTML =
      `Solved in <strong>${moves}</strong> move${moves !== 1 ? 's' : ''}<br>` +
      `Time: <strong>${fmt(seconds)}</strong>`;
    winOverlay.classList.add('show');
  }

  function hideWin() {
    winOverlay.classList.remove('show');
  }

  // ── New game ──────────────────────────────────────────────────────────
  function newGame() {
    hideWin();
    stopTimer();
    clearHint();
    moves = 0;
    movesEl.textContent = '0';
    shuffle();
    render();
    gameActive = true;
    startTimer();
  }

  // ── IDA* solver ───────────────────────────────────────────────────────
  // Iterative Deepening A* — finds the optimal (minimum moves) solution.
  function manhattan(state) {
    let d = 0;
    for (let i = 0; i < TOTAL; i++) {
      const v = state[i];
      if (v === 0) continue;
      d += Math.abs(row(i) - Math.floor((v - 1) / SIZE)) +
           Math.abs(col(i) - (v - 1) % SIZE);
    }
    return d;
  }

  function idaStar(initial, initialEmpty) {
    let threshold = manhattan(initial);
    const path = [{ state: initial, empty: initialEmpty }];
    while (true) {
      const res = idasSearch(path, 0, threshold);
      if (res === 'FOUND') return path;
      if (res === Infinity) return null;
      threshold = res;
      if (threshold > 80) return null; // give up on very scrambled boards
    }
  }

  function idasSearch(path, g, threshold) {
    const { state, empty } = path[path.length - 1];
    const f = g + manhattan(state);
    if (f > threshold) return f;

    // Check solved
    let solved = true;
    for (let i = 0; i < TOTAL - 1; i++) if (state[i] !== i + 1) { solved = false; break; }
    if (solved && state[TOTAL - 1] === 0) return 'FOUND';

    let min = Infinity;
    for (const nb of neighbours(empty)) {
      // Don't reverse the previous move
      if (path.length > 1 && path[path.length - 2].empty === nb) continue;
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

  // ── Hint ─────────────────────────────────────────────────────────────
  // Runs IDA* and highlights the single best next tile to move.
  function clearHint() {
    clearTimeout(hintTimeout);
    hintTimeout   = null;
    hintTileIndex = -1;
    hintMsg.textContent = '';
    hintMsg.classList.add('hidden');
    if (tiles.length) render(-1);
  }

  async function showHint() {
    if (!gameActive) return;

    btnHint.disabled = true;
    clearTimeout(hintTimeout);
    hintMsg.textContent = '🔍 Calculating…';
    hintMsg.classList.remove('hidden');

    // Yield to browser so the loading message paints before heavy computation
    await new Promise(r => setTimeout(r, 20));

    const solution = idaStar([...tiles], emptyIndex);

    if (!solution || solution.length < 2) {
      hintMsg.textContent = isSolved() ? '✅ Already solved!' : '🤔 Could not find a hint.';
      btnHint.disabled = false;
      hintTimeout = setTimeout(() => hintMsg.classList.add('hidden'), 3000);
      return;
    }

    // solution[1].empty is where the blank moves next →
    // the tile currently at that position is the one to move.
    hintTileIndex = solution[1].empty;

    const tileValue = tiles[hintTileIndex];
    const dir       = slideDirection(hintTileIndex, emptyIndex);

    hintMsg.textContent = `💡 Move tile ${tileValue} ${dir}`;
    hintMsg.classList.remove('hidden');

    render(hintTileIndex);
    btnHint.disabled = false;

    // Auto-clear after 3 seconds
    hintTimeout = setTimeout(() => {
      hintTileIndex = -1;
      hintMsg.classList.add('hidden');
      if (gameActive) render(-1);
    }, 3000);
  }

  // ── Auto-solve ────────────────────────────────────────────────────────
  // Computes the full optimal solution and animates every step.
  async function autoSolve() {
    if (!gameActive) return;
    gameActive = false;
    stopTimer();
    clearHint();
    btnSolve.disabled = true;
    btnSolve.textContent = 'Solving…';

    await new Promise(r => setTimeout(r, 20));
    const solution = idaStar([...tiles], emptyIndex);

    if (!solution) {
      btnSolve.disabled = false;
      btnSolve.textContent = 'Solve';
      gameActive = true;
      startTimer();
      return;
    }

    for (let step = 1; step < solution.length; step++) {
      await new Promise(r => setTimeout(r, 120));
      tiles      = solution[step].state;
      emptyIndex = solution[step].empty;
      moves++;
      movesEl.textContent = moves;
      render();
    }

    btnSolve.disabled = false;
    btnSolve.textContent = 'Solve';
    stopTimer();
    showWin();
  }

  // ── Event listeners ───────────────────────────────────────────────────
  btnNew.addEventListener('click', newGame);
  btnHint.addEventListener('click', showHint);
  btnSolve.addEventListener('click', autoSolve);
  btnWinNew.addEventListener('click', newGame);

  // ── Boot ──────────────────────────────────────────────────────────────
  newGame();
})();
