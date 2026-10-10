// 여행을 떠난 친구 다시 데려오기(2026-10-08 사용자 요청: 아들이 키우던 펫이 여행을 떠남 → 도감 기록으로 되살리기).
// 도감 기록(collection)에 남은 이름·테마·모습(key)·태어난 시각·몸무게·실수·속도로 같은 모습의 펫을 다시 만든다.
// 돌아온 친구는 다시 여행을 떠나지 않는다(pet.returned). 방치로 삐져 떠나는 규칙은 그대로.
import { createPet } from "./state.js?v=0b650fa-1791619903";

export const REVIVABLE = new Set(["journey", "runaway"]);
export const canRevive = (rec) => !!rec && REVIVABLE.has(rec.how) && !rec.returnedAt && /^(animal|fantasy)\./.test(rec.key || "");
// 가장 최근에 떠난, 아직 돌아오지 않은 친구
export const lastRevivable = (profile) => [...(profile.collection || [])].reverse().find(canRevive) || null;

export function revivePet(rec, now) {
  const [theme, stage, branch] = rec.key.split(".");
  const pet = createPet({ now, seed: (rec.bornAt || now) >>> 0, theme, speed: rec.speed || "normal", name: rec.name || "" });
  pet.bornAt = rec.bornAt || now; // 겉모습(무늬 색)이 태어난 시각에서 정해짐 → 그대로
  if (rec.look?.chosen && rec.look.spot) pet.eggColor = rec.look.spot;
  pet.stage = stage === "egg" ? "baby" : stage;
  pet.branch = stage === "teen" || stage === "adult" ? branch || null : null;
  pet.ageMin = Math.max(0, Math.round((rec.ageDays || 0) * 1440));
  pet.stageMin = 0;
  pet.weight = Number.isFinite(rec.weight) ? rec.weight : pet.weight;
  pet.mistakes = { total: rec.mistakes || 0, stage: 0 };
  pet.returned = now; // 다시 떠나지 않음
  return pet;
}
