// 날씨 분류: WMO 날씨 코드(Open-Meteo) → 창밖에 그릴 날씨 종류와 세기
// 코드표: https://open-meteo.com/en/docs (WMO Weather interpretation codes)
const TABLE = {
  0: ["clear", 0, "맑음"], 1: ["clear", 0, "대체로 맑음"], 2: ["cloudy", 0, "구름 조금"], 3: ["overcast", 0, "흐림"],
  45: ["fog", 0.6, "안개"], 48: ["fog", 0.8, "짙은 안개"],
  51: ["drizzle", 0.3, "약한 이슬비"], 53: ["drizzle", 0.45, "이슬비"], 55: ["drizzle", 0.6, "짙은 이슬비"],
  56: ["sleet", 0.4, "어는 이슬비"], 57: ["sleet", 0.6, "어는 이슬비"],
  61: ["rain", 0.5, "약한 비"], 63: ["rain", 0.75, "비"], 65: ["rain", 1, "폭우"],
  66: ["sleet", 0.5, "어는 비"], 67: ["sleet", 0.8, "강한 어는 비"],
  71: ["snow", 0.45, "약한 눈"], 73: ["snow", 0.7, "눈"], 75: ["snow", 1, "폭설"], 77: ["snow", 0.35, "싸락눈"],
  80: ["rain", 0.55, "소나기"], 81: ["rain", 0.8, "소나기"], 82: ["rain", 1, "강한 소나기"],
  85: ["snow", 0.6, "눈 소나기"], 86: ["snow", 1, "강한 눈 소나기"],
  95: ["thunder", 0.85, "천둥번개"], 96: ["thunder", 0.9, "천둥번개·우박"], 97: ["thunder", 1, "강한 천둥번개"], 99: ["thunder", 1, "천둥번개·우박"],
};

// raw: { code, cloud(0~100), at(ms) } → { kind, intensity(0~1), cloud(0~1), label }
export function classifyWeather(raw, now = Date.now()) {
  if (!raw || raw.code === undefined || now - (raw.at || 0) > 3 * 3600 * 1000) return { kind: "clear", intensity: 0, cloud: 0.15, label: "", stale: true };
  const [kind, intensity, label] = TABLE[raw.code] || ["clear", 0, ""];
  const cloud = Math.max(0, Math.min(1, (raw.cloud ?? (kind === "clear" ? 10 : 90)) / 100));
  // 비·눈·안개면 구름 낀 하늘로 보이게
  const effCloud = ["rain", "drizzle", "snow", "sleet", "thunder", "fog", "overcast"].includes(kind) ? Math.max(cloud, kind === "drizzle" ? 0.6 : 0.85) : cloud;
  return { kind, intensity, cloud: effCloud, label, temp: raw.temp };
}

export function weatherUrl(lat, lon) {
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,cloud_cover,precipitation,snowfall,temperature_2m&timezone=auto`;
}

export function parseWeather(json, now = Date.now()) {
  const c = json && json.current;
  if (!c || typeof c.weather_code !== "number") return null;
  return { code: c.weather_code, cloud: c.cloud_cover, precip: c.precipitation, snow: c.snowfall, temp: c.temperature_2m, at: now };
}
