// 定数定義
const SOUND_START_FREQ = 600;
const SOUND_START_DURATION = 100;
const SOUND_END_FREQ = 800;
const SOUND_END_DURATION = 300;
const TIMER_DISPLAY_ID = "display";
const DURATION_INPUT_ID = "duration";
const TIMER_SIZE_INPUT_ID = "timerSize";
const FADE_TIME = 0.002; // フェードイン・アウト時間（秒）
const TIMER_REFRESH_INTERVAL = (1 / 60) * 1000; // 60FPS相当

// オーディオ管理クラス
class AudioManager {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.oscillator = null;
        this.gainNode = null;
        this.soundTimer = null;
    }
    startSound(frequency) {
        this.stopSound();
        this.oscillator = this.audioContext.createOscillator();
        this.gainNode = this.audioContext.createGain();
        this.oscillator.type = 'sine';
        this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
        // フェードイン
        const now = this.audioContext.currentTime;
        this.gainNode.gain.setValueAtTime(0, now);
        this.gainNode.gain.linearRampToValueAtTime(1, now + FADE_TIME);
        this.oscillator.start();
    }
    stopSound() {
        if (this.oscillator && this.gainNode) {
            const now = this.audioContext.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
            this.gainNode.gain.linearRampToValueAtTime(0, now + FADE_TIME);
            setTimeout(() => {
                if (this.oscillator) {
                    this.oscillator.stop();
                    this.oscillator.disconnect();
                    this.gainNode.disconnect();
                    this.oscillator = null;
                    this.gainNode = null;
                }
            }, FADE_TIME * 1000 + 5); // 少し余裕を持たせて停止
        } else if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
            this.oscillator = null;
        }
    }
    playSound(frequency, duration) {
        this.startSound(frequency);
        clearTimeout(this.soundTimer);
        this.soundTimer = setTimeout(() => {
            this.stopSound();
        }, duration);
    }
}

const audioManager = new AudioManager();

// タイマー管理クラス
class TimerManager {
    constructor() {
        this.baseTime = Date.now();
        this.nowTime = Date.now();
        this.timer = 0;
        this.displayTime = 0;
        this.isSpace = false;
        this.timerRunning = false;
    }
    changeDuration() {
        const durationSecond = Number(document.getElementById(DURATION_INPUT_ID).value);
        this.timer = isNaN(durationSecond) ? 0 : durationSecond * 1000;
    }
    start() {
        this.changeDuration();
        this.baseTime = Date.now();
        this.timerRunning = true;
        audioManager.playSound(SOUND_START_FREQ, SOUND_START_DURATION);
    }
    end() {
        audioManager.playSound(SOUND_END_FREQ, SOUND_END_DURATION);
        this.timerRunning = false;
    }
    refresh() {
        this.nowTime = Date.now();
        this.displayTime = this.timer + this.baseTime - this.nowTime;
        if (this.displayTime < 0) {
            this.displayTime = 0;
            if (this.timerRunning) {
                this.end();
            }
        }
        UIManager.updateDisplay(this.displayTime);
    }
}

const timerManager = new TimerManager();

// UI管理クラス
class UIManager {
    static init() {
        this.timerDisplay = document.getElementById(TIMER_DISPLAY_ID);
        this.timerSizeInput = document.getElementById(TIMER_SIZE_INPUT_ID);
    }
    static updateDisplay(timeMs) {
        if (this.timerDisplay) {
            this.timerDisplay.innerHTML = (timeMs / 1000).toFixed(2);
        }
    }
    static changeTimerSize() {
        const timerSize = Number(this.timerSizeInput.value);
        if (!isNaN(timerSize)) {
            document.documentElement.style.setProperty('--timerSize', `${timerSize}em`);
        }
    }
}

UIManager.init();

// イベントリスナー
function handleKeyDown(event) {
    if (event.code === 'Space') {
        if (!timerManager.isSpace) {
            timerManager.start();
        }
        timerManager.isSpace = true;
    }
}
function handleKeyUp(event) {
    if (event.code === 'Space') {
        timerManager.isSpace = false;
    }
}

// イベント登録
UIManager.timerSizeInput.addEventListener("change", () => UIManager.changeTimerSize());
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

// クリックでタイマー開始
const displayElem = document.getElementById(TIMER_DISPLAY_ID);
if (displayElem) {
    displayElem.addEventListener("click", () => timerManager.start());
}

// 一定時間毎にタイマー更新
setInterval(() => timerManager.refresh(), TIMER_REFRESH_INTERVAL);
timerManager.refresh();
