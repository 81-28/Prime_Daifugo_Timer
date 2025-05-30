// --- 定数・設定 ---
const DEFAULT_VALUES = Object.freeze({
    duration: 60,
    timerSize: 8,
    alarm: true,
    alarm_duration: 10,
    sound_start_frequency: 440,
    sound_start_duration: 100,
    sound_alarm_frequency: 660,
    sound_alarm_duration: 200,
    sound_end_frequency: 880,
    sound_end_duration: 400
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
const PRE_SOUND_BEFORE_MS = 2000; // アラーム・タイムアップ前音タイミング

// オーディオ管理クラス
class AudioManager {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.oscillator = null;
        this.gainNode = null;
        this.soundTimer = null;
        this.soundPlaying = false;
        this.silentPulseTimer = null;
    }
    async startSound(frequency) {
        await this.audioContext.resume();
        const now = this.audioContext.currentTime;
        if (this.soundPlaying && this.oscillator && this.gainNode) {
            this.oscillator.frequency.setValueAtTime(frequency, now);
            return;
        }
        this._cleanupAudio();
        this.oscillator = this.audioContext.createOscillator();
        this.gainNode = this.audioContext.createGain();
        this.oscillator.type = 'sine';
        this.oscillator.frequency.setValueAtTime(frequency, now);
        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
        this.gainNode.gain.setValueAtTime(0, now);
        this.gainNode.gain.linearRampToValueAtTime(1, now + FADE_TIME);
        this.oscillator.start();
        this.soundPlaying = true;
    }
    stopSound() {
        if (!this.soundPlaying || !this.oscillator || !this.gainNode) return;
        const now = this.audioContext.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
        this.gainNode.gain.linearRampToValueAtTime(0, now + FADE_TIME);
        setTimeout(() => this._cleanupAudio(), FADE_TIME * 1000 + 10);
    }
    async playSound(frequency, duration) {
        await this.startSound(frequency);
        if (this.soundTimer) clearTimeout(this.soundTimer);
        this.soundTimer = setTimeout(() => this.stopSound(), duration);
    }
    playSilent() {
        if (this.silentPulseTimer) return;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1, this.audioContext.currentTime);
        gain.gain.setValueAtTime(0.0001, this.audioContext.currentTime);
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.start();
        this.silentPulseTimer = setTimeout(() => {
            osc.stop();
            osc.disconnect();
            gain.disconnect();
            this.silentPulseTimer = null;
        }, 100);
    }
    _cleanupAudio() {
        if (this.oscillator) {
            try { this.oscillator.stop(); } catch (e) {}
            this.oscillator.disconnect();
            this.oscillator = null;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        this.soundPlaying = false;
        if (this.soundTimer) {
            clearTimeout(this.soundTimer);
            this.soundTimer = null;
        }
    }
}
const audioManager = new AudioManager();

// タイマー管理クラス
class TimerManager {
    constructor() {
        this.reset();
    }
    reset() {
        this.baseTime = Date.now();
        this.nowTime = Date.now();
        this.timer = 0;
        this.displayTime = 0;
        this.isSpace = false;
        this.timerRunning = false;
        this.alarmPlayed = false;
        this.alarmTime = 0;
        this.preAlarmSoundPlayed = false;
        this.preEndSoundPlayed = false;
    }
    getInputValue(id, fallback = 0) {
        const val = Number(document.getElementById(id)?.value);
        return isNaN(val) ? fallback : val;
    }
    changeDuration() {
        this.timer = this.getInputValue(ELEMENT_ID.DURATION) * 1000;
    }
    async start() {
        this.changeDuration();
        this.baseTime = Date.now();
        this.timerRunning = true;
        this.alarmPlayed = false;
        this.preAlarmSoundPlayed = false;
        this.preEndSoundPlayed = false;
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
        this._checkAlarm();
        this._checkPreSounds();
        uiManager.updateDisplay(this.displayTime);
    }
    _checkPreSounds() {
        if (!this.timerRunning) return;
        const alarmEnabled = document.getElementById(ELEMENT_ID.ALARM)?.checked;
        this.alarmTime = this.getInputValue(ELEMENT_ID.ALARM_TIME) * 1000;
        // アラーム前
        if (
            alarmEnabled &&
            this.alarmTime < this.timer &&
            !this.preAlarmSoundPlayed &&
            this.displayTime <= this.alarmTime + PRE_SOUND_BEFORE_MS &&
            this.displayTime > this.alarmTime
        ) {
            this.preAlarmSoundPlayed = true;
            audioManager.playSilent();
        }
        // タイムアップ前
        if (
            !this.preEndSoundPlayed &&
            this.displayTime <= PRE_SOUND_BEFORE_MS &&
            this.displayTime > 0
        ) {
            this.preEndSoundPlayed = true;
            audioManager.playSilent();
        }
    }
    _checkAlarm() {
        const alarmEnabled = document.getElementById(ELEMENT_ID.ALARM)?.checked;
        if (!alarmEnabled || this.alarmPlayed || !this.timerRunning) return;
        this.alarmTime = this.getInputValue(ELEMENT_ID.ALARM_TIME) * 1000;
        if (this.alarmTime >= this.timer) return;
        if (this.displayTime <= this.alarmTime) {
            const freq = this.getInputValue(ELEMENT_ID.SOUND_ALERT_FREQ, DEFAULT_VALUES.sound_alarm_frequency);
            const dur = this.getInputValue(ELEMENT_ID.SOUND_ALERT_DUR, DEFAULT_VALUES.sound_alarm_duration);
            audioManager.playSound(freq, dur);
            this.alarmPlayed = true;
        }
    }
}
const timerManager = new TimerManager();

// UI管理クラス
class UIManager {
    constructor() {
        this.timerDisplay = document.getElementById(ELEMENT_ID.DISPLAY);
        this.timerSizeInput = document.getElementById(ELEMENT_ID.TIMER_SIZE);
    }
    updateDisplay(timeMs) {
        if (this.timerDisplay) {
            this.timerDisplay.innerHTML = (timeMs / 1000).toFixed(2);
        }
    }
    changeTimerSize() {
        const timerSize = Number(this.timerSizeInput.value);
        if (!isNaN(timerSize)) {
            document.documentElement.style.setProperty('--timerSize', `${timerSize}em`);
        }
    }
}
const uiManager = new UIManager();

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
    uiManager.changeTimerSize();
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

uiManager.timerSizeInput.addEventListener("change", uiManager.changeTimerSize.bind(uiManager));
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
document.getElementById(ELEMENT_ID.DISPLAY)?.addEventListener("click", () => timerManager.start());

setInterval(() => timerManager.refresh(), TIMER_REFRESH_INTERVAL);
timerManager.refresh();
