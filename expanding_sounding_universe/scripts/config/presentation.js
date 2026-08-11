export const presentation = Object.freeze({
  location: Object.freeze({
    latitude: 61.48366,
    longitude: 23.752,
    timeZone: "Europe/Helsinki"
  }),
  simulation: Object.freeze({
    startTime: "2026-09-05T15:00:00+03:00",
    timeScale: 1
  }),
  view: Object.freeze({
    longEdgeFieldOfView: 92,
    focusRadius: 28,
    selectionRadius: 5.5,
    smoothingSeconds: 0.11
  }),
  audio: Object.freeze({
    ambientGain: 0.035,
    focusedGain: 0.72,
    audibleRadius: 105,
    dominanceRadius: 20,
    exclusiveRadius: 6,
    smoothingSeconds: 0.22
  })
});
