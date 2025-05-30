// 定数定義
const SOUND = {
    START_FREQ: 600,
    START_DURATION: 100,
    END_FREQ: 800,
    END_DURATION: 300,
    ALERT_FREQ: 800,
    ALERT_DURATION: 200
};
const ELEMENT_ID = {
    DISPLAY: "display",
    DURATION: "duration",
    TIMER_SIZE: "timerSize",
    ALERT: "alart",
    ALERT_TIME: "alart_duration",
    SOUND_START_FREQ: "sound_start_frequency",
    SOUND_START_DUR: "sound_start_duration",
    SOUND_END_FREQ: "sound_end_frequency",
    SOUND_END_DUR: "sound_end_duration",
    SOUND_ALERT_FREQ: "sound_alart_frequency",
    SOUND_ALERT_DUR: "sound_alart_duration"
};
const FADE_TIME = 0.006; // フェードイン・アウト時間（秒）
const TIMER_REFRESH_INTERVAL = 1000 / 60; // 60FPS相当

// オーディオ管理クラス
class AudioManager {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.oscillator = null;
        this.gainNode = null;
        this.soundTimer = null;
    }
    async startSound(frequency) {
        await this.audioContext.resume();
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
            }, FADE_TIME * 1000 + 5);
        } else if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
            this.oscillator = null;
        }
    }
    async playSound(frequency, duration) {
        await this.startSound(frequency);
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
        this.alertPlayed = false;
    }
    getInputValue(id, fallback = 0) {
        const val = Number(document.getElementById(id)?.value);
        return isNaN(val) ? fallback : val;
    }
    changeDuration() {
        this.timer = this.getInputValue(ELEMENT_ID.DURATION) * 1000;
        this.alertPlayed = false;
    }
    async start() {
        this.changeDuration();
        this.baseTime = Date.now();
        this.timerRunning = true;
        this.alertPlayed = false;
        const freq = this.getInputValue(ELEMENT_ID.SOUND_START_FREQ, SOUND.START_FREQ);
        const dur = this.getInputValue(ELEMENT_ID.SOUND_START_DUR, SOUND.START_DURATION);
        await audioManager.playSound(freq, dur);
    }
    async end() {
        const freq = this.getInputValue(ELEMENT_ID.SOUND_END_FREQ, SOUND.END_FREQ);
        const dur = this.getInputValue(ELEMENT_ID.SOUND_END_DUR, SOUND.END_DURATION);
        await audioManager.playSound(freq, dur);
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
        this.checkAlert();
        UIManager.updateDisplay(this.displayTime);
    }
    checkAlert() {
        const alertEnabled = document.getElementById(ELEMENT_ID.ALERT)?.checked;
        if (!alertEnabled || this.alertPlayed || !this.timerRunning) return;
        const alertTime = this.getInputValue(ELEMENT_ID.ALERT_TIME) * 1000;
        if (alertTime >= this.timer) return;
        if (this.displayTime <= alertTime) {
            const freq = this.getInputValue(ELEMENT_ID.SOUND_ALERT_FREQ, SOUND.ALERT_FREQ);
            const dur = this.getInputValue(ELEMENT_ID.SOUND_ALERT_DUR, SOUND.ALERT_DURATION);
            audioManager.playSound(freq, dur);
            console.log(`Alert! Time left: ${this.displayTime / 1000} seconds`);
            this.alertPlayed = true;
        }
    }
}

const timerManager = new TimerManager();

// UI管理クラス
class UIManager {
    static init() {
        this.timerDisplay = document.getElementById(ELEMENT_ID.DISPLAY);
        this.timerSizeInput = document.getElementById(ELEMENT_ID.TIMER_SIZE);
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
    if (event.code === 'Space' && !timerManager.isSpace) {
        timerManager.start();
        timerManager.isSpace = true;
    }
}
function handleKeyUp(event) {
    if (event.code === 'Space') {
        timerManager.isSpace = false;
    }
}

UIManager.timerSizeInput.addEventListener("change", UIManager.changeTimerSize.bind(UIManager));
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

const displayElem = document.getElementById(ELEMENT_ID.DISPLAY);
if (displayElem) {
    displayElem.addEventListener("click", () => timerManager.start());
}

setInterval(() => timerManager.refresh(), TIMER_REFRESH_INTERVAL);
timerManager.refresh();
