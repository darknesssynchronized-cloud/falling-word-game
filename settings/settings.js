```javascript
const DEFAULT_SETTINGS = {
  difficulty: "normal",
  speed: 1,
  wordSize: 1,
  spawnRate: 1,
  lives: 3,
  sound: true,
  theme: "dark"
};

const difficulty = document.getElementById("difficulty");
const speed = document.getElementById("speed");
const wordSize = document.getElementById("word-size");
const spawnRate = document.getElementById("spawn-rate");
const lives = document.getElementById("lives");
const sound = document.getElementById("sound");
const theme = document.getElementById("theme");

const speedValue = document.getElementById("speed-value");
const wordSizeValue = document.getElementById("word-size-value");
const spawnRateValue = document.getElementById("spawn-rate-value");

const saveBtn = document.getElementById("save-btn");
const resetBtn = document.getElementById("reset-btn");
const saveMessage = document.getElementById("save-message");


// =========================================================
// LOAD SETTINGS
// =========================================================

function loadSettings() {

  const saved = localStorage.getItem("fallingWordSettings");

  if (!saved) {
    applySettingsToUI(DEFAULT_SETTINGS);
    return;
  }

  try {

    const settings = {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(saved)
    };

    applySettingsToUI(settings);

  } catch (error) {

    console.warn("Could not load saved settings.");

    applySettingsToUI(DEFAULT_SETTINGS);
  }
}


// =========================================================
// APPLY SETTINGS TO UI
// =========================================================

function applySettingsToUI(settings) {

  difficulty.value = settings.difficulty;

  speed.value = settings.speed;

  wordSize.value = settings.wordSize;

  spawnRate.value = settings.spawnRate;

  lives.value = settings.lives;

  sound.checked = settings.sound;

  theme.value = settings.theme;

  updateLabels();

  applyTheme();
}


// =========================================================
// GET SETTINGS
// =========================================================

function getSettings() {

  return {

    difficulty: difficulty.value,

    speed: Number(speed.value),

    wordSize: Number(wordSize.value),

    spawnRate: Number(spawnRate.value),

    lives: Number(lives.value),

    sound: sound.checked,

    theme: theme.value

  };
}


// =========================================================
// RANGE LABELS
// =========================================================

function updateLabels() {

  speedValue.textContent =
    Number(speed.value).toFixed(1) + "x";

  wordSizeValue.textContent =
    Number(wordSize.value).toFixed(1) + "x";

  spawnRateValue.textContent =
    Number(spawnRate.value).toFixed(1) + "x";
}


// =========================================================
// THEME
// =========================================================

function applyTheme() {

  if (theme.value === "light") {

    document.body.classList.add("light");

  } else {

    document.body.classList.remove("light");

  }
}


// =========================================================
// SAVE
// =========================================================

saveBtn.addEventListener("click", () => {

  const settings = getSettings();

  localStorage.setItem(
    "fallingWordSettings",
    JSON.stringify(settings)
  );

  applyTheme();

  saveMessage.textContent =
    "✓ Settings saved successfully!";

  setTimeout(() => {
    saveMessage.textContent = "";
  }, 2000);

});


// =========================================================
// RESET
// =========================================================

resetBtn.addEventListener("click", () => {

  applySettingsToUI(DEFAULT_SETTINGS);

  localStorage.setItem(
    "fallingWordSettings",
    JSON.stringify(DEFAULT_SETTINGS)
  );

  saveMessage.textContent =
    "✓ Settings reset to default.";

  setTimeout(() => {
    saveMessage.textContent = "";
  }, 2000);

});


// =========================================================
// LIVE UI
// =========================================================

speed.addEventListener("input", updateLabels);

wordSize.addEventListener("input", updateLabels);

spawnRate.addEventListener("input", updateLabels);

theme.addEventListener("change", applyTheme);


// =========================================================
// INITIALIZE
// =========================================================

loadSettings();
```
