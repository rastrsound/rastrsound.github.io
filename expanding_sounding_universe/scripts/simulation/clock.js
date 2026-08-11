const parseScale = value => {
  if (value === null || value.trim() === "") {
    return null;
  }
  const scale = Number(value);
  return Number.isFinite(scale) && scale >= 0 ? scale : null;
};

export class Clock {
  constructor(parameters, defaults) {
    const simulationRequested = parameters.has("simulate");
    const simulatedTime = parameters.get("simulate") || defaults.startTime;
    const parsedTime = simulationRequested ? Date.parse(simulatedTime) : Number.NaN;
    this.simulated = simulationRequested && Number.isFinite(parsedTime);
    this.origin = this.simulated ? parsedTime : Date.now();
    this.startedAt = performance.now();
    this.scale = parseScale(parameters.get("scale")) ?? defaults.timeScale;
  }

  now() {
    if (!this.simulated) {
      return new Date();
    }

    return new Date(this.origin + (performance.now() - this.startedAt) * this.scale);
  }

  get isSimulated() {
    return this.simulated;
  }
}
