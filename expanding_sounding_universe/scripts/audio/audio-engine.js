import { clamp, degreesToRadians, signedAngleDifference } from "../astronomy/angles.js";

export class AudioEngine {
  constructor(sourceDefinitions, settings) {
    this.sourceDefinitions = sourceDefinitions;
    this.settings = settings;
    this.context = null;
    this.channels = new Map();
    this.errorHandler = () => undefined;
    this.preloadElements = sourceDefinitions.map(source => this.createElement(source));
  }

  onError(handler) {
    this.errorHandler = handler;
  }

  createElement(source) {
    const element = new Audio();
    element.src = source.audio;
    element.preload = "auto";
    element.loop = true;
    element.addEventListener("error", () => this.errorHandler(source));
    element.load();
    return element;
  }

  async start() {
    if (this.context) {
      await this.context.resume();
      return;
    }

    const context = new AudioContext({ latencyHint: "interactive" });
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;
    limiter.connect(context.destination);
    try {
      this.sourceDefinitions.forEach((definition, index) => {
        const element = this.preloadElements[index];
        const input = context.createMediaElementSource(element);
        const gain = context.createGain();
        const pan = context.createStereoPanner();
        gain.gain.value = 0;
        input.connect(gain).connect(pan).connect(limiter);
        this.channels.set(definition.id, { definition, element, gain, pan, lastGain: 0, lastPan: 0 });
      });
      await context.resume();
    } catch (error) {
      this.channels.clear();
      await context.close();
      throw error;
    }
    this.context = context;
    this.channels.forEach(channel => {
      channel.element.play().catch(() => this.errorHandler(channel.definition));
    });
  }

  update(positionedSources, view) {
    if (!this.context || positionedSources.length === 0) {
      return;
    }

    const now = this.context.currentTime;
    let dominantSource = positionedSources[0];
    for (let index = 1; index < positionedSources.length; index += 1) {
      if (positionedSources[index].distance < dominantSource.distance) {
        dominantSource = positionedSources[index];
      }
    }
    const dominanceRange = this.settings.dominanceRadius - this.settings.exclusiveRadius;
    const dominanceProgress = clamp(
      (this.settings.dominanceRadius - dominantSource.distance) / dominanceRange,
      0,
      1
    );
    const dominance = dominanceProgress * dominanceProgress * (3 - 2 * dominanceProgress);

    positionedSources.forEach(source => {
      const channel = this.channels.get(source.id);
      if (!channel) {
        return;
      }
      const proximity = clamp(1 - source.distance / this.settings.audibleRadius, 0, 1);
      const shapedProximity = Math.pow(proximity, 1.35);
      const sourceGain = this.settings.ambientGain
        + shapedProximity * (this.settings.focusedGain - this.settings.ambientGain);
      const gainValue = source.id === dominantSource.id
        ? sourceGain
        : sourceGain * (1 - dominance);
      const horizontalDifference = signedAngleDifference(source.azimuth, view.azimuth);
      const panValue = clamp(Math.sin(degreesToRadians(horizontalDifference)), -0.82, 0.82);
      if (Math.abs(gainValue - channel.lastGain) > 0.001) {
        channel.gain.gain.setTargetAtTime(gainValue, now, this.settings.smoothingSeconds);
        channel.lastGain = gainValue;
      }
      if (Math.abs(panValue - channel.lastPan) > 0.001) {
        channel.pan.pan.setTargetAtTime(panValue, now, this.settings.smoothingSeconds);
        channel.lastPan = panValue;
      }
    });
  }
}
