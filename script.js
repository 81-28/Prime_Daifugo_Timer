// 時間関連
let baseTime = new Date().getTime();
let nowTime = new Date().getTime();
// 残り時間(ミリ秒)
let timer=0;
// 表示する時間
let displayTime = 0;
// 画面更新
const frameTime = (1 / 60) * 1000;
// ボタン状態
let isSpace = false;
let timerRunning = false;
// オーディオコンテキストの作成
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let oscillator; // オシレーターを格納するための変数
let soundTimer;

// 音を鳴らし始める関数
function startSound(frequency) {
  // オシレーターを作成
  oscillator = audioContext.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  // 出力に接続
  oscillator.connect(audioContext.destination);
  // 音を再生
  oscillator.start();
}
// 音を停止する関数
function stopSound() {
  if (oscillator) {
    // オシレーターを停止
    oscillator.stop();
  }
}
// 音を鳴らす関数
function playSound(frequency,times) {
    if (oscillator) stopSound();
    startSound(frequency);
    clearTimeout(soundTimer);
    soundTimer = setTimeout(() => {
        stopSound();
    }, times);
}

// タイマーの時間を変更する関数
function changeDuration() {
    const durationSecond = document.getElementById("duration").value;
    timer = durationSecond * 1000;
}
function changeTimerSize() {
    const timerSize = document.getElementById("timerSize").value;
    document.documentElement.style.setProperty('--timerSize', `${timerSize}em`);
}

// 描画する関数
function draw(){
    timer_display.innerHTML = displayTime / 1000;
}
// スタートする関数
function timer_start(){
    changeDuration();
    baseTime = new Date().getTime();
    timerRunning = true;
    playSound(600,100);
}

// タイマーが終了した時に実行する関数
function timer_end(){
    playSound(800,300);
    timerRunning = false;
}

// 毎フレーム実行する関数
function frame_refresh(){
    nowTime = new Date().getTime();
    displayTime = timer + baseTime - nowTime;
    if (displayTime < 0) {
        displayTime = 0;
        if (timerRunning) {
            timer_end();
        }
    }
    draw();
}

// キーを押したときのイベント
document.addEventListener('keydown', (event) => {
    // Spaceを押した時のイベント
    if (event.code === 'Space') {
        if (!isSpace) {
            timer_start();
        }
        isSpace = true;
    }
});
// キーを離したときのイベント
document.addEventListener('keyup', (event) => {
    // Spaceを離した瞬間のイベント
    if (event.code === 'Space') {
        isSpace = false;
    }
});

// フォントサイズの変更イベント
document.getElementById("timerSize").addEventListener("change", changeTimerSize);

// 一定時間毎に関数を実行
setInterval(frame_refresh, frameTime);
frame_refresh();
