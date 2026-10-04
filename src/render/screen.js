// 화면 그리기 전용. 게임 규칙은 모르고, 받은 상태를 그리기만 해요.

const LCD_BG = "#c8d6a0";
const LCD_FG = "#2b3a1f";

export function drawBootScreen(ctx, { width, height, now }) {
  ctx.fillStyle = LCD_BG;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = LCD_FG;
  ctx.textAlign = "center";
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.fillText("포켓 펫 (가제)", width / 2, height / 2 - 12);
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText("준비 중", width / 2, height / 2 + 12);
  const t = new Date(now);
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  ctx.fillText(`${hh}:${mm}`, width / 2, height / 2 + 36);
}
