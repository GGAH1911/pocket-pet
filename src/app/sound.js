// 소리 효과: 파일 없이 Web Audio로 합성한다. 기본은 꺼짐(설정에서 켬).
// 휴대폰은 사용자가 화면을 한 번 눌러야 소리가 나므로, 첫 터치 때 오디오를 깨운다.
let ctx = null;
let enabled = false;

export function setSoundEnabled(on) { enabled = !!on; if (on) unlock(); }
export function soundEnabled() { return enabled; }

function unlock() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch { ctx = null; }
}
// 첫 터치에 오디오 깨우기
for (const ev of ["pointerdown", "touchend", "keydown"]) window.addEventListener(ev, () => { if (enabled) unlock(); }, { passive: true });

// 음 하나: 주파수(Hz), 시작(초 뒤), 길이(초), 파형, 크기, 끝 주파수(미끄러짐)
function tone(freq, at, dur, { type = "square", vol = 0.08, to = null } = {}) {
  const t0 = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(at, dur, vol = 0.05) {
  const t0 = ctx.currentTime + at;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  f.type = "bandpass"; f.frequency.value = 1800;
  src.buffer = buf; g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination); src.start(t0);
}

const C5 = 523, D5 = 587, E5 = 659, G5 = 784, A5 = 880, C6 = 1047, E6 = 1319, G6 = 1568;
const SOUNDS = {
  tap: () => tone(1200, 0, 0.04, { vol: 0.04 }),
  eat: () => { for (let i = 0; i < 3; i++) tone(320 + i * 30, i * 0.16, 0.07, { vol: 0.07 }); tone(E5, 0.55, 0.08); tone(G5, 0.63, 0.12); },
  snack: () => { tone(G5, 0, 0.06); tone(C6, 0.07, 0.1); tone(E6, 0.17, 0.12); },
  happy: () => { [C5, E5, G5, C6].forEach((f, i) => tone(f, i * 0.07, 0.09)); },
  refuse: () => { tone(220, 0, 0.12, { vol: 0.07 }); tone(180, 0.15, 0.16, { vol: 0.07 }); },
  poop: () => tone(300, 0, 0.18, { type: "triangle", vol: 0.1, to: 120 }),
  clean: () => { noise(0, 0.15, 0.06); tone(G6, 0.12, 0.08, { type: "sine", vol: 0.06 }); tone(C6 * 2, 0.2, 0.1, { type: "sine", vol: 0.05 }); },
  wash: () => { for (let i = 0; i < 6; i++) tone(600 + Math.random() * 600, i * 0.09, 0.05, { type: "sine", vol: 0.05 }); },
  light: () => tone(900, 0, 0.03, { vol: 0.05 }),
  medicine: () => { tone(400, 0, 0.1, { type: "triangle", to: 200 }); tone(C6, 0.3, 0.1, { type: "sine" }); },
  bitter: () => { tone(200, 0, 0.2, { type: "sawtooth", vol: 0.05, to: 150 }); },
  hatch: () => { [C5, E5, G5, C6, E6, G6].forEach((f, i) => tone(f, i * 0.06, 0.1, { vol: 0.06 })); },
  evolve: () => { [C5, G5, C6, E6].forEach((f, i) => tone(f, i * 0.12, 0.14)); [C6, E6, G6].forEach((f) => tone(f, 0.55, 0.35, { vol: 0.05 })); },
  right: () => { tone(E6, 0, 0.08); tone(G6, 0.08, 0.14); },
  wrong: () => tone(160, 0, 0.25, { type: "sawtooth", vol: 0.05 }),
  win: () => { [C5, E5, G5, C6, G5, C6].forEach((f, i) => tone(f, i * 0.09, 0.1)); },
  greet: () => { tone(G5, 0, 0.07); tone(C6, 0.09, 0.07); tone(G5, 0.18, 0.07); tone(C6, 0.27, 0.14); },
  farewell: () => { [G5, E5, C5, D5, E5, C5].forEach((f, i) => tone(f, i * 0.28, 0.26, { type: "triangle", vol: 0.07 })); },
  pet: () => { tone(A5, 0, 0.06, { type: "sine", vol: 0.06 }); tone(C6, 0.07, 0.1, { type: "sine", vol: 0.06 }); },
};

export function sfx(name) {
  if (!enabled) return;
  unlock();
  if (!ctx || !SOUNDS[name]) return;
  try { SOUNDS[name](); } catch { /* 소리 실패는 무시 */ }
}
