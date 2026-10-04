// 부팅 순서는 이 파일 한 곳에서만 정해요.
// (지난 게임에서 파일 읽는 순서 때문에 저장 기본값이 빠지는 버그가 있었어요.)
// 순서: 시계 → 저장 불러오기(M2) → 꺼져 있던 시간 계산(M2) → 화면 시작
import { realClock } from "./core/time.js?v=497c29d-1791112943";
import { drawRoom, drawIcon } from "./render/screen.js?v=497c29d-1791112943";
import { SPRITES } from "./render/sprites.js?v=497c29d-1791112943";

const DOT_WIDTH = 128; // 가로 도트 수 목표(실제는 약 110~150). 세로는 화면 비율에 맞춰 늘어나요.

const stage = document.getElementById("stage");
const canvas = document.getElementById("room");
const ctx = canvas.getContext("2d");
const clockEl = document.getElementById("clock");

let view = { w: DOT_WIDTH, h: 200 };

function fitCanvas() {
  const rect = stage.getBoundingClientRect();
  const scale = Math.max(1, Math.round(rect.width / DOT_WIDTH)); // 정수배라야 도트가 안 뭉개져요
  const w = Math.floor(rect.width / scale);
  const h = Math.floor(rect.height / scale);
  canvas.width = w; canvas.height = h;
  canvas.style.width = `${w * scale}px`;
  canvas.style.height = `${h * scale}px`;
  view = { w, h };
  ctx.imageSmoothingEnabled = false;
}

for (const btn of document.querySelectorAll("[data-icon]")) {
  drawIcon(btn.querySelector("canvas"), SPRITES[btn.dataset.icon]);
}

function frame() {
  const now = realClock.now();
  drawRoom(ctx, { ...view, now });
  const t = new Date(now);
  clockEl.textContent = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
  requestAnimationFrame(frame);
}

new ResizeObserver(fitCanvas).observe(stage);
fitCanvas();
requestAnimationFrame(frame);
