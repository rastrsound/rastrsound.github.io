import { calculateDevicePose } from "./device-pose.js";

export class DeviceOrientationController {
  constructor(fallback) {
    this.fallback = fallback;
    this.available = false;
    this.view = { ...fallback.current(), roll: 0 };
    this.compassOffset = null;
    this.listener = event => this.update(event);
  }

  async enable() {
    if (!("DeviceOrientationEvent" in window)) {
      return false;
    }

    const permissionMethod = window.DeviceOrientationEvent.requestPermission;
    if (typeof permissionMethod === "function") {
      const permission = await permissionMethod.call(window.DeviceOrientationEvent, true);
      if (permission !== "granted") {
        return false;
      }
    }

    const eventName = "ondeviceorientationabsolute" in window
      ? "deviceorientationabsolute"
      : "deviceorientation";
    window.addEventListener(eventName, this.listener, { capture: true, passive: true });
    return true;
  }

  update(event) {
    if (event.alpha === null || event.beta === null || event.gamma === null) {
      return;
    }

    const pose = calculateDevicePose({
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma,
      compassHeading: event.webkitCompassHeading,
      screenAngle: window.screen.orientation?.angle ?? window.orientation ?? 0
    }, this.compassOffset);
    this.compassOffset = pose.compassOffset;
    this.view = pose.view;
    this.fallback.set(this.view);
    this.available = true;
  }

  current() {
    return this.available ? { ...this.view } : { ...this.fallback.current(), roll: 0 };
  }
}
