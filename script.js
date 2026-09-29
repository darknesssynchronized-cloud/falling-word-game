// =========================================================
// CONFIGURATION — tweak these values to change game balance
// =========================================================
const GAME_CONFIG = {
  pointsPerWord: 10,
  baseSpeed: 1.0,               // pixels per frame at level 1, before difficulty multiplier
  speedIncreasePerLevel: 0.35,
  spawnIntervalMs: 1600,
  spawnIntervalMinMs: 400,
  fastAnswerBonusMs: 1500,
  fastAnswerBonusPoints: 5,
  difficultyMultiplier: { easy: 1, medium: 1.5, hard: 2.2 },
  noRepeatWindow: 6              // how many recently-used words to avoid repeating
};

// Difficulty presets — chosen by the player on the start screen.
// This is separate from a word's own easy/medium/hard difficulty column;
// this controls the overall game pace (lives, speed, spawn rate, leveling).
const DIFFICULTY_PRESETS = {
  easy: {
    label: "Easy",
    startingLives: 5,
    speedMultiplier: 0.75,
    spawnIntervalMultiplier: 1.3,
    pointsPerLevel: 70
  },
  normal: {
    label: "Normal",
    startingLives: 3,
    speedMultiplier: 1.0,
    spawnIntervalMultiplier: 1.0,
    pointsPerLevel: 50
  },
  hard: {
    label: "Hard",
    startingLives: 2,
    speedMultiplier: 1.35,
    spawnIntervalMultiplier: 0.75,
    pointsPerLevel: 35
  }
};
// =========================================================
// PLAYER SETTINGS
// =========================================================

const DEFAULT_PLAYER_SETTINGS = {
  difficulty: "normal",
  speed: 1,
  wordSize: 1,
  spawnRate: 1,
  lives: 3,
  sound: true,
  theme: "dark"
};

function loadPlayerSettings() {

  const saved = localStorage.getItem("fallingWordSettings");

  if (!saved) {
    return DEFAULT_PLAYER_SETTINGS;
  }

  try {

    return {
      ...DEFAULT_PLAYER_SETTINGS,
      ...JSON.parse(saved)
    };

  } catch (error) {

    console.warn("Could not load player settings.");

    return DEFAULT_PLAYER_SETTINGS;
  }
}

const PLAYER_SETTINGS = loadPlayerSettings();

selectedDifficulty = PLAYER_SETTINGS.difficulty;

// Set this to your local CSV path, or swap in your published
// Google Sheet CSV URL, e.g.:
// "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv"
const CSV_SOURCE = "data/words.csv";

// Used only if the CSV fails to load, so the game is still playable.
const FALLBACK_WORDS = [
  { word: "apple", difficulty: "easy" },
  { word: "computer", difficulty: "easy" },
  { word: "keyboard", difficulty: "easy" },
  { word: "window", difficulty: "easy" },
  { word: "javascript", difficulty: "medium" },
  { word: "programming", difficulty: "medium" },
  { word: "developer", difficulty: "medium" },
  { word: "algorithm", difficulty: "hard" },
  { word: "recursion", difficulty: "hard" },
  { word: "asynchronous", difficulty: "hard" }
];

// =========================================================
// STATE
// =========================================================
let wordList = [];
let activeWords = [];       // [{ id, text, difficulty, x, y, speed, spawnTime, el }]
let recentWords = [];       // last few words used, to avoid picking the same word back-to-back
let score = 0;
let lives = 3;
let level = 1;
let running = false;
let animationFrameId = null;
let spawnTimeoutId = null;
let nextWordId = 1;
let selectedDifficulty = "normal";
let activePreset = DIFFICULTY_PRESETS.normal;

// =========================================================
// DOM REFERENCES
// =========================================================
const gameArea = document.getElementById("game-area");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const livesEl = document.getElementById("lives");
const typingInput = document.getElementById("typing-input");
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const finalScoreEl = document.getElementById("final-score");
const loadErrorScreen = document.getElementById("load-error");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const dismissErrorBtn = document.getElementById("dismiss-error-btn");
const difficultyButtons = document.querySelectorAll(".difficulty-btn");

// =========================================================
// CSV LOADING AND PARSING
// =========================================================
async function loadWordList() {
  try {
    const response = await fetch(CSV_SOURCE);
    if (!response.ok) {
      throw new Error("Network response was not OK (status " + response.status + ")");
    }
    const text = await response.text();
    const parsed = parseCSV(text);

    if (parsed.length === 0) {
      throw new Error("CSV was empty or contained no valid rows");
    }
    wordList = parsed;
  } catch (err) {
    console.warn("Could not load word list from CSV_SOURCE:", err.message);
    console.warn("Falling back to built-in word list. Check that", CSV_SOURCE, "is reachable and correctly published.");
    wordList = FALLBACK_WORDS;
    loadErrorScreen.classList.remove("hidden");
  }
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  const rows = [];

  // Skip the header row (index 0)
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const word = (parts[0] || "").trim().toLowerCase();
    let difficulty = (parts[1] || "").trim().toLowerCase();

    if (!word) continue; // skip rows with no word
    if (!["easy", "medium", "hard"].includes(difficulty)) {
      difficulty = "easy"; // default for missing/invalid difficulty
    }
    rows.push({ word, difficulty });
  }
  return rows;
}

// =========================================================
// WORD SELECTION
// (weighted more toward harder words at higher levels, and
//  avoids repeating a word that was just used recently)
// =========================================================
function pickRandomWord() {
  const hardChance = Math.min(0.1 + level * 0.06, 0.5);
  const mediumChance = Math.min(0.25 + level * 0.05, 0.4);

  const roll = Math.random();
  let pool;

  if (roll < hardChance) {
    pool = wordList.filter(w => w.difficulty === "hard");
  } else if (roll < hardChance + mediumChance) {
    pool = wordList.filter(w => w.difficulty === "medium");
  } else {
    pool = wordList.filter(w => w.difficulty === "easy");
  }

  if (!pool || pool.length === 0) pool = wordList; // safety fallback

  // Prefer a word that ISN'T in the recent-use list, so the same word
  // doesn't keep reappearing back-to-back. If every word in the chosen
  // pool has been used recently (e.g. a very small word list), fall
  // back to the full pool rather than getting stuck.
  const freshPool = pool.filter(w => !recentWords.includes(w.word));
  const finalPool = freshPool.length > 0 ? freshPool : pool;

  const chosen = finalPool[Math.floor(Math.random() * finalPool.length)];

  recentWords.push(chosen.word);
  if (recentWords.length > GAME_CONFIG.noRepeatWindow) {
    recentWords.shift(); // forget the oldest entry once the window is full
  }

  return chosen;
}

// =========================================================
// SPAWNING
// =========================================================
function spawnWord() {
  if (!running) return;

  const chosen = pickRandomWord();
  const areaWidth = gameArea.clientWidth;

  const el = document.createElement("div");
  el.className = "falling-word " + chosen.difficulty;
  el.textContent = chosen.word;
  gameArea.appendChild(el);

  // Measure after appending so we know its rendered width
  const wordWidth = el.offsetWidth;
  const maxX = Math.max(areaWidth - wordWidth - 8, 0);
  const x = Math.floor(Math.random() * maxX);
  el.style.left = x + "px";

  const speed = (GAME_CONFIG.baseSpeed + (level - 1) * GAME_CONFIG.speedIncreasePerLevel)
    * activePreset.speedMultiplier;

  activeWords.push({
    id: nextWordId++,
    text: chosen.word,
    difficulty: chosen.difficulty,
    x: x,
    y: 0,
    speed: speed,
    spawnTime: performance.now(),
    el: el
  });

  scheduleNextSpawn();
}

function scheduleNextSpawn() {
  const interval = Math.max(
    (GAME_CONFIG.spawnIntervalMs - (level - 1) * 120) * activePreset.spawnIntervalMultiplier,
    GAME_CONFIG.spawnIntervalMinMs
  );
  spawnTimeoutId = setTimeout(spawnWord, interval);
}

// =========================================================
// GAME LOOP (movement)
// =========================================================
function gameLoop() {
  if (!running) return;

  const areaHeight = gameArea.clientHeight;

  for (let i = activeWords.length - 1; i >= 0; i--) {
    const w = activeWords[i];
    w.y += w.speed;
    w.el.style.top = w.y + "px";

    if (w.y > areaHeight) {
      removeWord(w.id, false);
      loseLife();
    }
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

// =========================================================
// TYPING / MATCHING
// =========================================================
typingInput.addEventListener("input", () => {
  if (!running) return;

  const typed = typingInput.value.trim().toLowerCase();
  if (!typed) return;

  const match = activeWords.find(w => w.text === typed);
  if (match) {
    handleCorrectWord(match);
    typingInput.value = "";
  }
});

function handleCorrectWord(word) {
  const elapsed = performance.now() - word.spawnTime;
  const base = GAME_CONFIG.pointsPerWord * GAME_CONFIG.difficultyMultiplier[word.difficulty];
  let earned = Math.round(base);

  if (elapsed <= GAME_CONFIG.fastAnswerBonusMs) {
    earned += GAME_CONFIG.fastAnswerBonusPoints;
  }

  score += earned;
  removeWord(word.id, true);
  updateLevel();
  updateHUD();
}

function removeWord(id, wasCorrect) {
  const index = activeWords.findIndex(w => w.id === id);
  if (index === -1) return;

  const word = activeWords[index];
  word.el.remove();
  activeWords.splice(index, 1);
}

function loseLife() {
  lives -= 1;
  updateHUD();
  if (lives <= 0) {
    endGame();
  }
}

function updateLevel() {
  const newLevel = Math.floor(score / activePreset.pointsPerLevel) + 1;
  if (newLevel !== level) {
    level = newLevel;
  }
}

// =========================================================
// HUD
// =========================================================
function updateHUD() {
  scoreEl.textContent = "Score: " + score;
  levelEl.textContent = "Level: " + level + " (" + activePreset.label + ")";
  livesEl.textContent = "Lives: " + "❤️".repeat(Math.max(lives, 0));
}

// =========================================================
// DIFFICULTY SELECTION (start screen)
// =========================================================
difficultyButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    selectedDifficulty = btn.dataset.difficulty;
    difficultyButtons.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
  });
});

// =========================================================
// GAME LIFECYCLE
// =========================================================
function startGame() {
  activePreset = DIFFICULTY_PRESETS[selectedDifficulty] || DIFFICULTY_PRESETS.normal;

  score = 0;
  lives = activePreset.startingLives;
  level = 1;
  recentWords = [];
  activeWords.forEach(w => w.el.remove());
  activeWords = [];
  running = true;

  updateHUD();
  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  typingInput.disabled = false;
  typingInput.value = "";
  typingInput.focus();

  scheduleNextSpawn();
  animationFrameId = requestAnimationFrame(gameLoop);
}

function endGame() {
  running = false;
  clearTimeout(spawnTimeoutId);
  cancelAnimationFrame(animationFrameId);
  typingInput.disabled = true;

  finalScoreEl.textContent = "Final Score: " + score;
  gameOverScreen.classList.remove("hidden");
}

// =========================================================
// EVENT WIRING
// =========================================================
startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);
dismissErrorBtn.addEventListener("click", () => {
  loadErrorScreen.classList.add("hidden");
});

// =========================================================
// INITIALIZATION
// =========================================================
(async function init() {
  await loadWordList();
  updateHUD();
})();
