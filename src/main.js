// 부팅 순서는 이 파일 한 곳에서만 정해요.
// (지난 게임에서 파일 읽는 순서 때문에 저장 기본값이 빠지는 버그가 있었어요.)
// 순서: 시계 → 저장 불러오기(M2) → 오프라인 경과 계산(M2) → 화면 시작
import { realClock } from "./core/time.js?v=6197e8f-1791112662";
import { drawBootScreen } from "./render/screen.js?v=6197e8f-1791112662";

const canvas = document.getElementById("screen");
const ctx = canvas.getContext("2d");

function frame() {
  drawBootScreen(ctx, { width: canvas.width, height: canvas.height, now: realClock.now() });
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
