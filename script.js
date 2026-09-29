const BOARD_SIZE = 9;
const EMPTY_CELL = 0;

let sudokuBoard = []; // Current state of the board (user + fixed)
let solutionBoard = []; // The complete solved board
let initialBoard = []; // The initial board with fixed numbers (0 for empty)

let timerInterval;
let timeElapsed = 0;
let currentDifficulty = 'easy'; // Default difficulty

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
 * Generates a full valid Sudoku board using backtracking.
 * @param {number[][]} board - The 9x9 board to fill.
 * @returns {boolean} - True if a solution is found, false otherwise.
 */
function solveSudoku(board) {
    const findEmpty = (b) => {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (b[r][c] === EMPTY_CELL) {
                    return [r, c];
                }
            }
        }
        return null; // No empty cells
    };

    const isValid = (b, row, col, num) => {
        // Check row
        for (let x = 0; x < BOARD_SIZE; x++) {
            if (b[row][x] === num && x !== col) {
                return false;
            }
        }

        // Check column
        for (let x = 0; x < BOARD_SIZE; x++) {
            if (b[x][col] === num && x !== row) {
                return false;
            }
        }

        // Check 3x3 box
        const startRow = Math.floor(row / 3) * 3;
        const startCol = Math.floor(col / 3) * 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (b[startRow + i][startCol + j] === num && (startRow + i !== row || startCol + j !== col)) {
                    return false;
                }
            }
        }
        return true;
    };

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
 * Creates a new empty 9x9 Sudoku board.
 * @returns {number[][]} - A 9x9 array filled with EMPTY_CELL.
 */
function createEmptyBoard() {
    return Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(EMPTY_CELL));
}

/**
 * Generates a new Sudoku puzzle based on difficulty.
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

    // 3. Create the puzzle by removing cells
    const puzzleBoard = fullBoard.map(row => [...row]); // Start with a copy of the full board
    let removedCount = 0;

    while (removedCount < cellsToRemove) {
        const row = Math.floor(Math.random() * BOARD_SIZE);
        const col = Math.floor(Math.random() * BOARD_SIZE);

        if (puzzleBoard[row][col] !== EMPTY_CELL) {
            const temp = puzzleBoard[row][col];
            puzzleBoard[row][col] = EMPTY_CELL;

            // Optional: Check if the puzzle still has a unique solution.
            // This is computationally expensive and often skipped for simpler games.
            // For this example, we'll assume removing cells randomly is sufficient.
            // A full unique solution check would involve solving the puzzle and ensuring only one solution exists.

            removedCount++;
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

            // Add drag and drop event listeners to cells
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('drop', handleDrop);
            cell.addEventListener('dragleave', handleDragLeave); // For removing drag-over class

            sudokuGridEl.appendChild(cell);
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

    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);

    // Get the value from the global `draggedValue`
    const valueToPlace = draggedValue;

    // Update the board and DOM
    sudokuBoard[row][col] = valueToPlace;
    cell.textContent = valueToPlace === EMPTY_CELL ? '' : valueToPlace;

    // Update cell classes
    cell.classList.remove('user-filled', 'error');
    if (valueToPlace !== EMPTY_CELL) {
        cell.classList.add('user-filled');
    }

    // Check if the move is valid according to Sudoku rules (optional, for immediate feedback)
    // For this game, we'll check validity only when the game is completed.
    // However, we can add a visual error if the number is wrong compared to the solution.
    if (valueToPlace !== EMPTY_CELL && solutionBoard[row][col] !== valueToPlace) {
        cell.classList.add('error');
    }

    checkGameStatus();
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
        // Optionally disable further moves
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
    sudokuGridEl.classList.remove('game-over'); // Enable moves

    generateSudoku(difficulty);
    renderBoard();
    startTimer();
}

/**
 * Clears all user-filled cells.
 */
function clearUserMoves() {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (initialBoard[r][c] === EMPTY_CELL) {
                // Only clear cells that were initially empty
                sudokuBoard[r][c] = EMPTY_CELL;
            }
        }
    }
    renderBoard(); // Re-render to reflect cleared cells
    showMessage('Your moves have been cleared.', '');
    // Re-check game status in case clearing makes it unsolved
    checkGameStatus();
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

// Number palette drag start
numberPalette.querySelectorAll('.palette-number').forEach(numEl => {
    numEl.addEventListener('dragstart', handleDragStart);
    // Optional: Add dragend to remove dragging class from palette number
    numEl.addEventListener('dragend', (event) => {
        event.target.classList.remove('dragging');
    });
});

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    newGame(currentDifficulty); // Start an easy game on page load
});
