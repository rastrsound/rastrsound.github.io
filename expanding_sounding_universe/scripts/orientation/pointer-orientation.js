import { clamp, normalizeDegrees } from "../astronomy/angles.js";

export class PointerOrientation {
  constructor(element, initialView = { azimuth: 180, elevation: 25 }) {
    this.element = element;
    this.view = { ...initialView };
    this.drag = null;
    this.bind();
  }

  bind() {
    this.element.addEventListener("pointerdown", event => this.start(event));
    this.element.addEventListener("pointermove", event => this.move(event));
    this.element.addEventListener("pointerup", event => this.end(event));
    this.element.addEventListener("pointercancel", event => this.end(event));
  }

  start(event) {
    this.element.setPointerCapture(event.pointerId);
    this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  move(event) {
    if (!this.drag || this.drag.id !== event.pointerId) {
      return;
    }

    const horizontalScale = 120 / Math.max(this.element.clientWidth, 1);
    const verticalScale = 90 / Math.max(this.element.clientHeight, 1);
    this.view.azimuth = normalizeDegrees(this.view.azimuth - (event.clientX - this.drag.x) * horizontalScale);
    this.view.elevation = clamp(this.view.elevation + (event.clientY - this.drag.y) * verticalScale, -90, 90);
    this.drag.x = event.clientX;
    this.drag.y = event.clientY;
  }

  end(event) {
    if (this.drag?.id === event.pointerId) {
      this.drag = null;
    }
  }

  current() {
    return { ...this.view };
  }

  set(view) {
    this.view.azimuth = normalizeDegrees(view.azimuth);
    this.view.elevation = clamp(view.elevation, -90, 90);
  }
}
