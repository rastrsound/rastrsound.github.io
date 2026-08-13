import { calculateDevicePose } from "./device-pose.js";

const sourcePriority = Object.freeze({ pointer: 0, relative: 1, absolute: 2, "absolute-event": 3 });

export class DeviceOrientationController {
  constructor(fallback, environment = window) {
    this.fallback = fallback;
    this.environment = environment;
    this.available = false;
    this.source = "pointer";
    this.view = { ...fallback.current(), roll: 0 };
    this.compassOffset = null;
    this.enablePromise = null;
    this.absoluteListener = event => this.update(event, "absolute-event");
    this.relativeListener = event => this.update(event, event.absolute ? "absolute" : "relative");
  }

  enable() {
    if (!this.enablePromise) {
      this.enablePromise = this.start();
    }
    return this.enablePromise;
  }

  async start() {
    if (!("DeviceOrientationEvent" in this.environment)) {
      return false;
    }

    const permissionMethod = this.environment.DeviceOrientationEvent.requestPermission;
    if (typeof permissionMethod === "function") {
      const permission = await permissionMethod.call(this.environment.DeviceOrientationEvent, true);
      if (permission !== "granted") {
        return false;
      }
    }

    const options = { capture: true, passive: true };
    this.environment.addEventListener("deviceorientationabsolute", this.absoluteListener, options);
    this.environment.addEventListener("deviceorientation", this.relativeListener, options);
    return true;
  }

  update(event, source) {
    if (
      !Number.isFinite(event.alpha)
      || !Number.isFinite(event.beta)
      || !Number.isFinite(event.gamma)
      || sourcePriority[source] < sourcePriority[this.source]
    ) {
      return;
    }

    const pose = calculateDevicePose({
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma,
      compassHeading: event.webkitCompassHeading,
      screenAngle: this.environment.screen?.orientation?.angle ?? this.environment.orientation ?? 0
    }, this.compassOffset);
    this.compassOffset = pose.compassOffset;
    this.view = pose.view;
    this.fallback.set(this.view);
    this.available = true;
    this.source = source;
  }

  current() {
    return this.available ? { ...this.view } : { ...this.fallback.current(), roll: 0 };
  }
}
