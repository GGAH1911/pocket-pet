// 해·달 위치와 달 모양 계산.
// SunCalc (https://github.com/mourner/suncalc) 의 공식을 옮겨 왔다.
// Copyright (c) 2014, Vladimir Agafonkin. BSD 2-Clause License:
// Redistribution and use in source and binary forms, with or without modification, are permitted provided
// that the following conditions are met: 1. Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer. 2. Redistributions in binary form must reproduce
// the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or
// other materials provided with the distribution. THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND
// CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES ... ARE DISCLAIMED.

const PI = Math.PI, sin = Math.sin, cos = Math.cos, tan = Math.tan, asin = Math.asin, atan = Math.atan2, acos = Math.acos, rad = PI / 180;
const dayMs = 86400000, J1970 = 2440588, J2000 = 2451545;
const toJulian = (ms) => ms / dayMs - 0.5 + J1970;
const fromJulian = (j) => (j + 0.5 - J1970) * dayMs;
const toDays = (ms) => toJulian(ms) - J2000;
const e = rad * 23.4397; // 지구 자전축 기울기

const rightAscension = (l, b) => atan(sin(l) * cos(e) - tan(b) * sin(e), cos(l));
const declination = (l, b) => asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l));
const azimuthOf = (H, phi, dec) => atan(sin(H), cos(H) * sin(phi) - tan(dec) * cos(phi));
const altitudeOf = (H, phi, dec) => asin(sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(H));
const siderealTime = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;
function astroRefraction(h) { if (h < 0) h = 0; return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179)); }
const solarMeanAnomaly = (d) => rad * (357.5291 + 0.98560028 * d);
function eclipticLongitude(M) {
  const C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M));
  return M + C + rad * 102.9372 + PI;
}
function sunCoords(d) { const L = eclipticLongitude(solarMeanAnomaly(d)); return { dec: declination(L, 0), ra: rightAscension(L, 0) }; }

// 방위각을 나침반 각도(북 0°, 동 90°, 남 180°, 서 270°)로
const compass = (az) => ((az / rad) + 180 + 360) % 360;

export function sunPosition(ms, lat, lon) {
  const lw = rad * -lon, phi = rad * lat, d = toDays(ms), c = sunCoords(d), H = siderealTime(d, lw) - c.ra;
  return { altitude: altitudeOf(H, phi, c.dec) / rad, azimuth: compass(azimuthOf(H, phi, c.dec)) };
}

const J0 = 0.0009;
const julianCycle = (d, lw) => Math.round(d - J0 - lw / (2 * PI));
const approxTransit = (Ht, lw, n) => J0 + (Ht + lw) / (2 * PI) + n;
const solarTransitJ = (ds, M, L) => J2000 + ds + 0.0053 * sin(M) - 0.0069 * sin(2 * L);
const hourAngle = (h, phi, d) => acos((sin(h) - sin(phi) * sin(d)) / (cos(phi) * cos(d)));

// 그날의 일출·일몰(ms). 극지방처럼 해가 안 뜨거나 안 지면 null
export function sunTimes(ms, lat, lon) {
  const lw = rad * -lon, phi = rad * lat, d = toDays(ms), n = julianCycle(d, lw), ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds), L = eclipticLongitude(M), dec = declination(L, 0), Jnoon = solarTransitJ(ds, M, L);
  const w = hourAngle(-0.833 * rad, phi, dec);
  if (Number.isNaN(w)) return { sunrise: null, sunset: null, noon: fromJulian(Jnoon) };
  const Jset = solarTransitJ(approxTransit(w, lw, n), M, L);
  return { sunrise: fromJulian(Jnoon - (Jset - Jnoon)), sunset: fromJulian(Jset), noon: fromJulian(Jnoon) };
}

function moonCoords(d) {
  const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.22935 * d);
  const l = L + rad * 6.289 * sin(M), b = rad * 5.128 * sin(F), dt = 385001 - 20905 * cos(M);
  return { ra: rightAscension(l, b), dec: declination(l, b), dist: dt };
}

export function moonPosition(ms, lat, lon) {
  const lw = rad * -lon, phi = rad * lat, d = toDays(ms), c = moonCoords(d), H = siderealTime(d, lw) - c.ra;
  let h = altitudeOf(H, phi, c.dec); h += astroRefraction(h);
  return { altitude: h / rad, azimuth: compass(azimuthOf(H, phi, c.dec)) };
}

// 달 모양: fraction(밝은 부분 비율 0~1), phase(0 삭 → 0.25 상현 → 0.5 보름 → 0.75 하현 → 1 삭)
export function moonIllumination(ms) {
  const d = toDays(ms), s = sunCoords(d), m = moonCoords(d), sdist = 149598000;
  const phi = acos(sin(s.dec) * sin(m.dec) + cos(s.dec) * cos(m.dec) * cos(s.ra - m.ra));
  const inc = atan(sdist * sin(phi), m.dist - sdist * cos(phi));
  const angle = atan(cos(s.dec) * sin(s.ra - m.ra), sin(s.dec) * cos(m.dec) - cos(s.dec) * sin(m.dec) * cos(s.ra - m.ra));
  return { fraction: (1 + cos(inc)) / 2, phase: 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / PI };
}

export function moonPhaseName(phase) {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.03 || p >= 0.97) return "삭(달이 안 보임)";
  if (p < 0.22) return "초승달";
  if (p < 0.28) return "상현달";
  if (p < 0.47) return "차오르는 달";
  if (p < 0.53) return "보름달";
  if (p < 0.72) return "기우는 달";
  if (p < 0.78) return "하현달";
  return "그믐달";
}

// 시간대로 위치 추정(휴대폰 위치 권한 없이). 대표 도시 좌표, 모르면 시간대 오프셋으로 경도만 추정
const TZ_CITY = {
  "Asia/Seoul": [37.57, 126.98, "서울"], "Asia/Tokyo": [35.68, 139.69, "도쿄"], "Asia/Shanghai": [31.23, 121.47, "상하이"],
  "Asia/Hong_Kong": [22.32, 114.17, "홍콩"], "Asia/Taipei": [25.03, 121.57, "타이베이"], "Asia/Singapore": [1.35, 103.82, "싱가포르"],
  "Asia/Bangkok": [13.76, 100.5, "방콕"], "Asia/Ho_Chi_Minh": [10.82, 106.63, "호찌민"], "Australia/Sydney": [-33.87, 151.21, "시드니"],
  "America/Los_Angeles": [34.05, -118.24, "로스앤젤레스"], "America/New_York": [40.71, -74.01, "뉴욕"], "America/Chicago": [41.88, -87.63, "시카고"],
  "America/Vancouver": [49.28, -123.12, "밴쿠버"], "America/Toronto": [43.65, -79.38, "토론토"], "Europe/London": [51.51, -0.13, "런던"],
  "Europe/Paris": [48.86, 2.35, "파리"], "Europe/Berlin": [52.52, 13.4, "베를린"], "Pacific/Auckland": [-36.85, 174.76, "오클랜드"],
};
export function guessLocation(tz, offsetMin) {
  const c = TZ_CITY[tz];
  if (c) return { lat: c[0], lon: c[1], label: `${c[2]}(시간대로 추정)`, source: "tz" };
  return { lat: 37, lon: Math.round((-offsetMin / 4) * 10) / 10, label: "시간대로 추정", source: "tz" };
}
