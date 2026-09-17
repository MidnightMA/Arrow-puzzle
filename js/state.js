/**
 * Game State Management
 */

export const State = {
  currentLevel: 1,
  highestLevel: 1,
  totalScore: 0,
  levelScore: 0,
  moves: 0,
  secondsElapsed: 0,
  timerInterval: null,
  status: "idle", // 'idle' | 'playing' | 'animating' | 'won'
  undoStack: [],
  user: null,

  init() {
    this.highestLevel = parseInt(localStorage.getItem("arrow_puzzle_highest_level") || "1", 10);
    this.totalScore = parseInt(localStorage.getItem("arrow_puzzle_total_score") || "0", 10);
    this.currentLevel = this.highestLevel;
  },

  startLevel(levelNumber) {
    this.currentLevel = levelNumber;
    this.moves = 0;
    this.levelScore = 0;
    this.secondsElapsed = 0;
    this.status = "playing";
    this.undoStack = [];
    this.startTimer();
  },

  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (this.status === "playing") {
        this.secondsElapsed++;
        if (typeof this.onTimerTick === "function") {
          this.onTimerTick(this.secondsElapsed);
        }
      }
    }, 1000);
  },

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  incrementMove() {
    this.moves++;
  },

  calculateStars(totalArrows, movesTaken) {
    // 3 stars: perfect or minimal moves (moves == totalArrows)
    // 2 stars: up to 1.3x moves
    // 1 star: otherwise
    if (movesTaken <= totalArrows) return 3;
    if (movesTaken <= Math.ceil(totalArrows * 1.3)) return 2;
    return 1;
  },

  calculateScore(totalArrows, movesTaken, seconds) {
    const baseScore = totalArrows * 100;
    const timeBonus = Math.max(0, 300 - seconds * 3);
    const moveBonus = Math.max(0, (totalArrows * 2 - movesTaken) * 50);
    const levelMultiplier = 1 + (this.currentLevel - 1) * 0.15;
    return Math.round((baseScore + timeBonus + moveBonus) * levelMultiplier);
  },

  saveProgression(level, score) {
    if (level >= this.highestLevel) {
      this.highestLevel = level + 1;
      localStorage.setItem("arrow_puzzle_highest_level", String(this.highestLevel));
    }
    this.totalScore += score;
    localStorage.setItem("arrow_puzzle_total_score", String(this.totalScore));
  },

  pushUndo(boardSnapshot) {
    // Keep last 10 moves
    this.undoStack.push(JSON.parse(JSON.stringify(boardSnapshot)));
    if (this.undoStack.length > 10) {
      this.undoStack.shift();
    }
  },

  popUndo() {
    return this.undoStack.pop() || null;
  },

  canUndo() {
    return this.undoStack.length > 0 && this.status === "playing";
  },
};
