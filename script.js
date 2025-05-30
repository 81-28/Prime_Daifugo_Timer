// --- 設定・定数まとめ ---
const DEFAULT_VALUES = Object.freeze({
    duration: 60,                // タイマー秒数（初期値）
    timerSize: 8,                // タイマー表示サイズ（em）
    alarm: true,                 // アラーム有効
    alarm_duration: 10,          // アラーム秒数
    sound_start_frequency: 440,  // 開始音周波数
    sound_start_duration: 100,   // 開始音長さ
    sound_end_frequency: 880,    // 終了音周波数
    sound_end_duration: 400,     // 終了音長さ
    sound_alarm_frequency: 660,  // アラーム音周波数
    sound_alarm_duration: 200    // アラーム音長さ
});

const ELEMENT_ID = Object.freeze({
    DISPLAY: "display",
    DURATION: "duration",
    TIMER_SIZE: "timerSize",
    ALARM: "alarm",
    ALARM_TIME: "alarm_duration",
    SOUND_START_FREQ: "sound_start_frequency",
    SOUND_START_DUR: "sound_start_duration",
    SOUND_END_FREQ: "sound_end_frequency",
    SOUND_END_DUR: "sound_end_duration",
    SOUND_ALERT_FREQ: "sound_alarm_frequency",
    SOUND_ALERT_DUR: "sound_alarm_duration"
});
const FADE_TIME = 0.006; // フェードイン・アウト時間（秒）
const TIMER_REFRESH_INTERVAL = 1000 / 60; // 60FPS相当

// オーディオ管理クラス
class AudioManager {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.oscillator = null;
        this.gainNode = null;
        this.soundTimer = null;
        this.continueTimer = null;
    }
    async startSound(frequency) {
        await this.audioContext.resume();
        const now = this.audioContext.currentTime;
        if (this.oscillator && this.gainNode) {
            this.oscillator.frequency.setValueAtTime(frequency, now);
            this._fadeGainTo(1, now);
            return;
        }
        this.oscillator = this.audioContext.createOscillator();
        this.gainNode = this.audioContext.createGain();
        this.oscillator.type = 'sine';
        this.oscillator.frequency.setValueAtTime(frequency, now);
        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
        this.gainNode.gain.setValueAtTime(0, now);
        this._fadeGainTo(1, now);
        this.oscillator.start();
    }
    stopSound() {
        if (this.oscillator && this.gainNode) {
            const now = this.audioContext.currentTime;
            this._fadeGainTo(0, now);
            setTimeout(() => this._cleanupAudio(), FADE_TIME * 1000 + 5);
        } else if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
            this.oscillator = null;
        }
    }
    async playSound(frequency, duration) {
        await this.startSound(frequency);
        this._clearTimers();
        this.soundTimer = setTimeout(() => this.stopSound(), duration);
        this.continueTimer = setTimeout(() => {
            if (!this.oscillator && !this.gainNode) {
                console.log("Continuing sound...");
                this.playSound(1, 1);
            }
        }, 10000);
    }

    _fadeGainTo(value, now) {
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
        this.gainNode.gain.linearRampToValueAtTime(value, now + FADE_TIME);
    }
    _cleanupAudio() {
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
            this.gainNode.disconnect();
            this.oscillator = null;
            this.gainNode = null;
        }
    }
    _clearTimers() {
        clearTimeout(this.soundTimer);
        clearTimeout(this.continueTimer);
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
        this.alarmPlayed = false;
    }
    getInputValue(id, fallback = 0) {
        const val = Number(document.getElementById(id)?.value);
        return isNaN(val) ? fallback : val;
    }
    changeDuration() {
        this.timer = this.getInputValue(ELEMENT_ID.DURATION) * 1000;
        this.alarmPlayed = false;
    }
    async start() {
        this.changeDuration();
        this.baseTime = Date.now();
        this.timerRunning = true;
        this.alarmPlayed = false;
        const freq = this.getInputValue(ELEMENT_ID.SOUND_START_FREQ, DEFAULT_VALUES.sound_start_frequency);
        const dur = this.getInputValue(ELEMENT_ID.SOUND_START_DUR, DEFAULT_VALUES.sound_start_duration);
        await audioManager.playSound(freq, dur);
    }
    async end() {
        const freq = this.getInputValue(ELEMENT_ID.SOUND_END_FREQ, DEFAULT_VALUES.sound_end_frequency);
        const dur = this.getInputValue(ELEMENT_ID.SOUND_END_DUR, DEFAULT_VALUES.sound_end_duration);
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
        this.checkAlarm();
        UIManager.updateDisplay(this.displayTime);
    }
    checkAlarm() {
        const alarmEnabled = document.getElementById(ELEMENT_ID.ALARM)?.checked;
        if (!alarmEnabled || this.alarmPlayed || !this.timerRunning) return;
        const alarmTime = this.getInputValue(ELEMENT_ID.ALARM_TIME) * 1000;
        if (alarmTime >= this.timer) return;
        if (this.displayTime <= alarmTime) {
            const freq = this.getInputValue(ELEMENT_ID.SOUND_ALERT_FREQ, DEFAULT_VALUES.sound_alarm_frequency);
            const dur = this.getInputValue(ELEMENT_ID.SOUND_ALERT_DUR, DEFAULT_VALUES.sound_alarm_duration);
            audioManager.playSound(freq, dur);
            console.log(`Alarm! Time left: ${this.displayTime / 1000} seconds`);
            this.alarmPlayed = true;
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

// 初期値をinputに反映
function applyDefaultValues() {
    Object.entries(DEFAULT_VALUES).forEach(([key, value]) => {
        const elem = document.getElementById(key);
        if (!elem) return;
        if (elem.type === 'checkbox') {
            elem.checked = Boolean(value);
        } else {
            elem.value = value;
        }
    });
    UIManager.changeTimerSize();
}

applyDefaultValues();

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

document.getElementById(ELEMENT_ID.DISPLAY)?.addEventListener("click", () => timerManager.start());

setInterval(() => timerManager.refresh(), TIMER_REFRESH_INTERVAL);
timerManager.refresh();
