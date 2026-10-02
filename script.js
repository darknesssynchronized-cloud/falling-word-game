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

const CSV_SOURCE = "data/words.csv";

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
let filteredWordList = [];  // รายการคำศัพท์ที่กรองแล้วตามระดับความยากที่เลือก
let activeWords = [];       
let recentWords = [];       
let score = 0;
let lives = 3;
let level = 1;
let running = false;
let animationFrameId = null;
let spawnTimeoutId = null;
let nextWordId = 1;
let selectedDifficulty = "easy";
let activePreset = DIFFICULTY_PRESETS.easy;

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
    console.warn("Falling back to built-in word list.");
    wordList = FALLBACK_WORDS;
    loadErrorScreen.classList.remove("hidden");
  }
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const word = (parts[0] || "").trim();
    let difficulty = (parts[1] || "").trim().toLowerCase();

    if (!word) continue; 
    if (!["easy", "medium", "hard"].includes(difficulty)) {
      difficulty = "easy"; 
    }
    rows.push({ word, difficulty });
  }
  return rows;
}

// =========================================================
// WORD SELECTION
// =========================================================
function pickRandomWord() {
  // ดึงเฉพาะคำศัพท์จาก filteredWordList เท่านั้น ไม่เอาคำระดับอื่นมาปน
  const pool = filteredWordList.length > 0 ? filteredWordList : wordList;

  const freshPool = pool.filter(w => !recentWords.includes(w.word));
  const finalPool = freshPool.length > 0 ? freshPool : pool;

  const chosen = finalPool[Math.floor(Math.random() * finalPool.length)];

  recentWords.push(chosen.word);
  if (recentWords.length > GAME_CONFIG.noRepeatWindow) {
    recentWords.shift();
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

  const wordWidth = el.offsetWidth;
  const maxX = Math.max(areaWidth - wordWidth - 8, 0);
  const x = Math.floor(Math.random() * maxX);
  el.style.left = x + "px";

  const speed = (GAME_CONFIG.baseSpeed + (level - 1) * GAME_CONFIG.speedIncreasePerLevel)
    * activePreset.speedMultiplier;

  activeWords.push({
    id: nextWordId++,
    text: chosen.word.toLowerCase(),
    displayText: chosen.word,
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
// GAME LOOP
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
// DIFFICULTY SELECTION
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
  // ปรับระดับ preset ของเกม (Easy, Normal, Hard) ให้ตรงกับปุ่ม
  const presetKey = (selectedDifficulty === "easy" || selectedDifficulty === "hard") ? selectedDifficulty : "normal";
  activePreset = DIFFICULTY_PRESETS[presetKey];

  // 🟢 แปลงค่า "normal" บนหน้าจอ UI ให้ตรงกับ "medium" ในฐานข้อมูลคำศัพท์ CSV
  const targetDifficulty = selectedDifficulty === "normal" ? "medium" : selectedDifficulty;

  // กรองคำศัพท์เฉพาะระดับที่เลือกไว้
  filteredWordList = wordList.filter(
    w => w.difficulty.toLowerCase() === targetDifficulty.toLowerCase()
  );

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
