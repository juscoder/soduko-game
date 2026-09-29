const BOARD_SIZE = 9;
const EMPTY_CELL = 0;

let sudokuBoard = []; // Current state of the board (user + fixed)
let solutionBoard = []; // The complete solved board
let initialBoard = []; // The initial board with fixed numbers (0 for empty)

let timerInterval;
let timeElapsed = 0;
let currentDifficulty = 'easy'; // Default difficulty

let selectedNumber = null; // Active palette value (0 = eraser), null = none
let selectedCell = null; // {row, col} of the selected cell, null = none

// DOM Elements
const sudokuGridEl = document.getElementById('sudoku-grid');
const timerEl = document.getElementById('timer');
const gameMessageEl = document.getElementById('game-message');
const newGameBtn = document.getElementById('new-game-btn');
const clearBtn = document.getElementById('clear-btn');
const difficultyBtns = document.querySelectorAll('.difficulty-btn');
const numberPalette = document.getElementById('number-palette');

// --- Sudoku Generation and Solving Logic ---

/**
 * Finds the first empty cell on the board.
 * @param {number[][]} board - The 9x9 board to scan.
 * @returns {[number, number]|null} - [row, col] or null if the board is full.
 */
function findEmpty(board) {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === EMPTY_CELL) {
                return [r, c];
            }
        }
    }
    return null; // No empty cells
}

/**
 * Checks if placing `num` at (row, col) respects Sudoku rules
 * (row, column and 3x3 box uniqueness).
 * @param {number[][]} board - The 9x9 board.
 * @param {number} row - Target row.
 * @param {number} col - Target column.
 * @param {number} num - Number to place.
 * @returns {boolean} - True if the move is valid.
 */
function isValid(board, row, col, num) {
    // Check row
    for (let x = 0; x < BOARD_SIZE; x++) {
        if (board[row][x] === num && x !== col) {
            return false;
        }
    }

    // Check column
    for (let x = 0; x < BOARD_SIZE; x++) {
        if (board[x][col] === num && x !== row) {
            return false;
        }
    }

    // Check 3x3 box
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (board[startRow + i][startCol + j] === num && (startRow + i !== row || startCol + j !== col)) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Generates a full valid Sudoku board using backtracking.
 * @param {number[][]} board - The 9x9 board to fill.
 * @returns {boolean} - True if a solution is found, false otherwise.
 */
function solveSudoku(board) {
    const emptyPos = findEmpty(board);
    if (!emptyPos) {
        return true; // Board is solved
    }

    const [row, col] = emptyPos;
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    // Shuffle numbers for different puzzles each time
    for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    for (const num of numbers) {
        if (isValid(board, row, col, num)) {
            board[row][col] = num;
            if (solveSudoku(board)) {
                return true;
            }
            board[row][col] = EMPTY_CELL; // Backtrack
        }
    }
    return false; // No solution found for this path
}

/**
 * Counts the solutions of a puzzle, stopping as soon as `limit` is reached.
 * Uses row/column/box bitmasks (9 bits each) for O(1) validity checks.
 * Used to guarantee that a puzzle has exactly one solution.
 * @param {number[][]} board - The puzzle to analyse (not mutated).
 * @param {number} limit - Maximum number of solutions to look for.
 * @returns {number} - Solutions found (capped at `limit`).
 */
function countSolutions(board, limit = 2) {
    const ALL_BITS = (1 << BOARD_SIZE) - 1;
    const rowMask = new Array(BOARD_SIZE).fill(0);
    const colMask = new Array(BOARD_SIZE).fill(0);
    const boxMask = new Array(BOARD_SIZE).fill(0);
    const emptyCells = [];

    const popcount = (bits) => {
        let count = 0;
        while (bits) {
            bits &= bits - 1; // Drops the lowest set bit
            count++;
        }
        return count;
    };

    // Build the masks and collect the empty cells in row-major order
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const value = board[r][c];
            if (value === EMPTY_CELL) {
                emptyCells.push([r, c]);
            } else {
                const bit = 1 << (value - 1);
                rowMask[r] |= bit;
                colMask[c] |= bit;
                boxMask[Math.floor(r / 3) * 3 + Math.floor(c / 3)] |= bit;
            }
        }
    }

    const solve = (idx, remaining) => {
        if (idx === emptyCells.length) {
            return 1; // Every empty cell was filled validly
        }

        // MRV heuristic: fill the most constrained cell first (fewest candidates)
        let best = idx;
        let bestAvail = 0;
        let bestCount = BOARD_SIZE + 1;
        for (let i = idx; i < emptyCells.length; i++) {
            const [r, c] = emptyCells[i];
            const avail = ~(rowMask[r] | colMask[c] | boxMask[Math.floor(r / 3) * 3 + Math.floor(c / 3)]) & ALL_BITS;
            const count = popcount(avail);
            if (count === 0) {
                return 0; // A cell has no candidates: this branch is impossible
            }
            if (count < bestCount) {
                bestCount = count;
                best = i;
                bestAvail = avail;
                if (count === 1) break;
            }
        }
        if (best !== idx) {
            [emptyCells[idx], emptyCells[best]] = [emptyCells[best], emptyCells[idx]];
        }

        const [row, col] = emptyCells[idx];
        const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
        let count = 0;

        for (let num = 1; num <= BOARD_SIZE; num++) {
            const bit = 1 << (num - 1);
            if (!(bestAvail & bit)) continue;

            rowMask[row] |= bit;
            colMask[col] |= bit;
            boxMask[box] |= bit;

            count += solve(idx + 1, remaining - count);

            rowMask[row] &= ~bit;
            colMask[col] &= ~bit;
            boxMask[box] &= ~bit;

            if (count >= remaining) break;
        }
        return count;
    };

    return solve(0, limit);
}

/**
 * Creates a new empty 9x9 Sudoku board.
 * @returns {number[][]} - A 9x9 array filled with EMPTY_CELL.
 */
function createEmptyBoard() {
    return Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(EMPTY_CELL));
}

/**
 * Generates a new Sudoku puzzle based on difficulty.
 * Cells are only removed while the puzzle keeps a UNIQUE solution,
 * so the game is always solvable in exactly one way.
 * @param {string} difficulty - 'easy', 'medium', or 'hard'.
 */
function generateSudoku(difficulty) {
    let cellsToRemove;
    switch (difficulty) {
        case 'easy':
            cellsToRemove = 40; // Fewer cells removed
            break;
        case 'medium':
            cellsToRemove = 50; // Moderate cells removed
            break;
        case 'hard':
            cellsToRemove = 60; // Many cells removed
            break;
        default:
            cellsToRemove = 40;
    }

    // 1. Create a fully solved board
    const fullBoard = createEmptyBoard();
    solveSudoku(fullBoard); // This fills `fullBoard` with a valid solution

    // 2. Store the solution
    solutionBoard = fullBoard.map(row => [...row]); // Deep copy

    // 3. Create the puzzle by removing cells, one by one, keeping it unique.
    //    Cells are visited in random passes (up to 2 passes over the board)
    //    with a time budget, so generation never freezes the UI.
    const puzzleBoard = fullBoard.map(row => [...row]); // Start with a copy of the full board
    let removedCount = 0;
    let attempts = 0; // Only counts real uniqueness checks
    const maxAttempts = BOARD_SIZE * BOARD_SIZE * 2;
    const timeBudgetMs = 400;
    const startTime = Date.now();

    while (removedCount < cellsToRemove && attempts < maxAttempts && Date.now() - startTime < timeBudgetMs) {
        // Random order for this pass
        const positions = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                positions.push([r, c]);
            }
        }
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }

        for (const [row, col] of positions) {
            if (removedCount >= cellsToRemove || attempts >= maxAttempts || Date.now() - startTime >= timeBudgetMs) {
                break;
            }
            if (puzzleBoard[row][col] === EMPTY_CELL) {
                continue;
            }

            attempts++;
            const removedValue = puzzleBoard[row][col];
            puzzleBoard[row][col] = EMPTY_CELL;

            if (countSolutions(puzzleBoard, 2) === 1) {
                // The puzzle still has exactly one solution: keep the removal
                removedCount++;
            } else {
                // Removing this cell would make the puzzle ambiguous: restore it
                puzzleBoard[row][col] = removedValue;
            }
        }
    }

    initialBoard = puzzleBoard.map(row => [...row]); // Store initial state
    sudokuBoard = puzzleBoard.map(row => [...row]); // Current game state
}

// --- Game Board Rendering ---

/**
 * Renders the Sudoku board in the DOM.
 */
function renderBoard() {
    sudokuGridEl.innerHTML = ''; // Clear existing grid
    selectedCell = null;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('sudoku-cell');
            cell.dataset.row = r;
            cell.dataset.col = c;

            const value = sudokuBoard[r][c];
            if (value !== EMPTY_CELL) {
                cell.textContent = value;
                // If the cell was part of the initial puzzle, it's fixed
                if (initialBoard[r][c] !== EMPTY_CELL) {
                    cell.classList.add('fixed');
                } else {
                    cell.classList.add('user-filled');
                }
            }

            // Drag and drop (desktop) and click/tap (all devices)
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('drop', handleDrop);
            cell.addEventListener('dragleave', handleDragLeave); // For removing drag-over class
            cell.addEventListener('click', handleCellClick);

            sudokuGridEl.appendChild(cell);
        }
    }

    updateSelectionStyles();
}

/**
 * Returns the DOM element of a given cell.
 * @param {number} row
 * @param {number} col
 * @returns {HTMLElement|null}
 */
function getCellElement(row, col) {
    return sudokuGridEl.querySelector(`.sudoku-cell[data-row="${row}"][data-col="${col}"]`);
}

/**
 * Syncs the visual selection of palette numbers and the selected cell.
 */
function updateSelectionStyles() {
    numberPalette.querySelectorAll('.palette-number').forEach(el => {
        el.classList.toggle('selected', selectedNumber !== null && parseInt(el.dataset.value) === selectedNumber);
    });

    sudokuGridEl.querySelectorAll('.sudoku-cell.selected').forEach(el => el.classList.remove('selected'));

    if (selectedCell) {
        const cell = getCellElement(selectedCell.row, selectedCell.col);
        if (cell) {
            cell.classList.add('selected');
        }
    }
}

/**
 * Places a value (or clears it with EMPTY_CELL) on an editable cell.
 * Single entry point shared by drag & drop, clicks/taps and the keyboard.
 * @param {number} row - Target row.
 * @param {number} col - Target column.
 * @param {number} value - 1-9 to place, EMPTY_CELL to clear.
 */
function placeValue(row, col, value) {
    if (sudokuGridEl.classList.contains('game-over')) {
        return; // The game is finished: the board is locked
    }
    if (initialBoard[row][col] !== EMPTY_CELL) {
        return; // Fixed cells are read-only
    }

    const cell = getCellElement(row, col);
    if (!cell) {
        return;
    }

    // Update the board and DOM
    sudokuBoard[row][col] = value;
    cell.textContent = value === EMPTY_CELL ? '' : value;

    // Update cell classes
    cell.classList.remove('user-filled', 'error');
    if (value !== EMPTY_CELL) {
        cell.classList.add('user-filled');
        if (solutionBoard[row][col] !== value) {
            cell.classList.add('error');
        }
    }

    checkGameStatus();
}

// --- Selection (click / tap / keyboard) ---

/**
 * Handles a click on an editable cell: selects it, or places the active number.
 * @param {MouseEvent} event
 */
function handleCellClick(event) {
    const cell = event.currentTarget;
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);

    if (cell.classList.contains('fixed') || sudokuGridEl.classList.contains('game-over')) {
        return;
    }

    if (selectedNumber !== null) {
        // A palette number is active: place it into the clicked cell
        selectedCell = { row, col };
        placeValue(row, col, selectedNumber);
    } else {
        // No active number: toggle the cell selection
        if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
            selectedCell = null;
        } else {
            selectedCell = { row, col };
        }
    }

    updateSelectionStyles();
}

/**
 * Handles a click on a palette number: toggles it (or applies it to the selected cell).
 * @param {MouseEvent} event
 */
function handlePaletteClick(event) {
    const value = parseInt(event.currentTarget.dataset.value);

    // Toggle the active number (0 = eraser)
    selectedNumber = (selectedNumber === value) ? null : value;

    // If a cell is selected, apply the number to it right away
    if (selectedNumber !== null && selectedCell) {
        placeValue(selectedCell.row, selectedCell.col, selectedNumber);
    }

    updateSelectionStyles();
}

/**
 * Keyboard input: 1-9 places a number, 0/Backspace/Delete clears the selected cell.
 * @param {KeyboardEvent} event
 */
function handleKeydown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
    }

    if (event.key.length === 1 && event.key >= '1' && event.key <= '9') {
        selectedNumber = parseInt(event.key);
        if (selectedCell) {
            placeValue(selectedCell.row, selectedCell.col, selectedNumber);
        }
        updateSelectionStyles();
    } else if (event.key === '0' || event.key === 'Backspace' || event.key === 'Delete') {
        if (selectedCell) {
            placeValue(selectedCell.row, selectedCell.col, EMPTY_CELL);
            event.preventDefault(); // Avoid the browser going "back" on Backspace
        } else if (selectedNumber !== null) {
            selectedNumber = null;
            updateSelectionStyles();
        }
    }
}

// --- Drag and Drop Handlers ---

let draggedValue = null; // Stores the value of the number being dragged

/**
 * Handles the start of a drag operation from the number palette.
 * @param {DragEvent} event
 */
function handleDragStart(event) {
    draggedValue = parseInt(event.target.dataset.value);
    event.dataTransfer.setData('text/plain', draggedValue); // For compatibility, though we use draggedValue global
    event.target.classList.add('dragging'); // Optional: visual feedback for dragged item
}

/**
 * Handles a drag operation over a Sudoku cell.
 * @param {DragEvent} event
 */
function handleDragOver(event) {
    event.preventDefault(); // Necessary to allow dropping
    const cell = event.target.closest('.sudoku-cell');
    if (cell && !cell.classList.contains('fixed')) {
        cell.classList.add('drag-over');
    }
}

/**
 * Handles a drag leaving a Sudoku cell.
 * @param {DragEvent} event
 */
function handleDragLeave(event) {
    const cell = event.target.closest('.sudoku-cell');
    if (cell) {
        cell.classList.remove('drag-over');
    }
}

/**
 * Handles a drop operation onto a Sudoku cell.
 * @param {DragEvent} event
 */
function handleDrop(event) {
    event.preventDefault();
    const cell = event.target.closest('.sudoku-cell');

    if (!cell || cell.classList.contains('fixed')) {
        // Cannot drop on fixed cells or outside a cell
        return;
    }

    cell.classList.remove('drag-over'); // Remove drag-over class

    if (draggedValue === null || draggedValue === undefined) {
        return;
    }

    placeValue(parseInt(cell.dataset.row), parseInt(cell.dataset.col), draggedValue);
}

// --- Timer Logic ---

/**
 * Formats time in seconds to MM:SS string.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Starts the game timer.
 */
function startTimer() {
    clearInterval(timerInterval); // Clear any existing timer
    timerInterval = setInterval(() => {
        timeElapsed++;
        timerEl.textContent = formatTime(timeElapsed);
    }, 1000);
}

/**
 * Stops the game timer.
 */
function stopTimer() {
    clearInterval(timerInterval);
}

/**
 * Resets the timer to 00:00.
 */
function resetTimer() {
    stopTimer();
    timeElapsed = 0;
    timerEl.textContent = formatTime(timeElapsed);
}

// --- Game State and Control ---

/**
 * Checks if the current board matches the solution.
 */
function checkGameStatus() {
    let isSolved = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (sudokuBoard[r][c] !== solutionBoard[r][c]) {
                isSolved = false;
                break;
            }
        }
        if (!isSolved) break;
    }

    if (isSolved) {
        stopTimer();
        showMessage('Congratulations! You solved the Sudoku!', 'success');
        // Lock the board: no further moves allowed
        sudokuGridEl.classList.add('game-over');
    } else {
        showMessage('', ''); // Clear message if not solved
    }
}

/**
 * Displays a message to the user.
 * @param {string} message - The message text.
 * @param {string} type - 'success' or 'error' for styling.
 */
function showMessage(message, type) {
    gameMessageEl.textContent = message;
    gameMessageEl.className = 'game-message'; // Reset classes
    if (type) {
        gameMessageEl.classList.add(type);
    }
}

/**
 * Starts a new game with the selected difficulty.
 * @param {string} difficulty
 */
function newGame(difficulty) {
    currentDifficulty = difficulty;
    resetTimer();
    showMessage('', ''); // Clear any previous messages
    selectedNumber = null;
    selectedCell = null;
    sudokuGridEl.classList.remove('game-over'); // Enable moves

    generateSudoku(difficulty);
    renderBoard();
    startTimer();
}

/**
 * Clears all user-filled cells. If the game had already been won,
 * it unlocks the board and resumes the timer.
 */
function clearUserMoves() {
    if (sudokuGridEl.classList.contains('game-over')) {
        sudokuGridEl.classList.remove('game-over');
        startTimer(); // Resume from the stored elapsed time
    }

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (initialBoard[r][c] === EMPTY_CELL) {
                // Only clear cells that were initially empty
                sudokuBoard[r][c] = EMPTY_CELL;
            }
        }
    }
    renderBoard(); // Re-render to reflect cleared cells
    // Re-check game status in case clearing makes it unsolved
    checkGameStatus();
    showMessage('Your moves have been cleared.', '');
}

// --- Event Listeners ---

// Difficulty buttons
difficultyBtns.forEach(button => {
    button.addEventListener('click', () => {
        difficultyBtns.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        newGame(button.dataset.difficulty);
    });
});

// New Game button
newGameBtn.addEventListener('click', () => newGame(currentDifficulty));

// Clear My Moves button
clearBtn.addEventListener('click', clearUserMoves);

// Number palette: drag & drop (desktop) and click/tap (all devices)
numberPalette.querySelectorAll('.palette-number').forEach(numEl => {
    numEl.addEventListener('dragstart', handleDragStart);
    numEl.addEventListener('dragend', (event) => {
        event.target.classList.remove('dragging');
    });
    numEl.addEventListener('click', handlePaletteClick);
});

// Keyboard input
document.addEventListener('keydown', handleKeydown);

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    newGame(currentDifficulty); // Start an easy game on page load
});
