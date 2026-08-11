import { clamp, degreesToRadians } from "../astronomy/angles.js";
import { horizontalVector } from "../astronomy/coordinates.js";

const cardinalDirections = Object.freeze([
  Object.freeze({ label: "N", azimuth: 0 }),
  Object.freeze({ label: "E", azimuth: 90 }),
  Object.freeze({ label: "S", azimuth: 180 }),
  Object.freeze({ label: "W", azimuth: 270 })
]);

export class SkyRenderer {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: true });
    this.settings = settings;
    this.width = 0;
    this.height = 0;
    this.projection = null;
    this.elevationCurves = Array.from({ length: 11 }, (_, index) => -75 + index * 15)
      .filter(elevation => elevation !== 0)
      .map(elevation => Array.from({ length: 145 }, (_, index) => horizontalVector(index * 2.5, elevation)));
    this.azimuthCurves = Array.from({ length: 24 }, (_, index) => index * 15)
      .filter(azimuth => azimuth % 90 !== 0)
      .map(azimuth => Array.from({ length: 73 }, (_, index) => horizontalVector(azimuth, -90 + index * 2.5)));
    this.cardinalCurves = cardinalDirections.map(direction => ({
      axis: direction.azimuth % 180 === 0 ? "north-south" : "east-west",
      points: Array.from(
        { length: 73 },
        (_, index) => horizontalVector(direction.azimuth, -90 + index * 2.5)
      )
    }));
    this.horizonCurve = Array.from({ length: 181 }, (_, index) => horizontalVector(index * 2, 0));
    this.cardinalVectors = cardinalDirections.map(direction => ({
      ...direction,
      vector: horizontalVector(direction.azimuth, 0)
    }));
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(bounds.width * pixelRatio);
    const height = Math.round(bounds.height * pixelRatio);
    if (width === this.canvas.width && height === this.canvas.height) {
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    this.width = bounds.width;
    this.height = bounds.height;
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  project({ east, north, up }) {
    const canonicalRight = east * this.projection.cosAzimuth - north * this.projection.sinAzimuth;
    const canonicalUp = -east * this.projection.sinElevation * this.projection.sinAzimuth
      - north * this.projection.sinElevation * this.projection.cosAzimuth
      + up * this.projection.cosElevation;
    const right = canonicalRight * this.projection.cosRoll - canonicalUp * this.projection.sinRoll;
    const cameraUp = canonicalUp * this.projection.cosRoll + canonicalRight * this.projection.sinRoll;
    const forward = east * this.projection.cosElevation * this.projection.sinAzimuth
      + north * this.projection.cosElevation * this.projection.cosAzimuth
      + up * this.projection.sinElevation;
    const x = this.width / 2 + right / Math.max(forward, 0.001) * this.projection.focalLength;
    const y = this.height / 2 - cameraUp / Math.max(forward, 0.001) * this.projection.focalLength;

    return {
      x,
      y,
      visible: forward > 0.02 && x > -this.width * 0.2 && x < this.width * 1.2
        && y > -this.height * 0.2 && y < this.height * 1.2
    };
  }

  render(positionedSources, view) {
    this.resize();
    this.updateProjection(view);
    this.context.clearRect(0, 0, this.width, this.height);
    this.drawGrid();
    this.drawCardinalMeridians();
    this.drawHorizon();
    this.drawCardinals();
    positionedSources.forEach(source => this.drawSource(source));
    this.drawReticle();
  }

  updateProjection(view) {
    const azimuth = degreesToRadians(view.azimuth);
    const elevation = degreesToRadians(view.elevation);
    const roll = degreesToRadians(view.roll ?? 0);
    const longEdge = Math.max(this.width, this.height);
    this.projection = {
      sinAzimuth: Math.sin(azimuth),
      cosAzimuth: Math.cos(azimuth),
      sinElevation: Math.sin(elevation),
      cosElevation: Math.cos(elevation),
      sinRoll: Math.sin(roll),
      cosRoll: Math.cos(roll),
      focalLength: longEdge / (2 * Math.tan(degreesToRadians(this.settings.longEdgeFieldOfView / 2)))
    };
  }

  drawGrid() {
    const context = this.context;
    context.save();
    context.strokeStyle = "rgba(218, 233, 233, 0.075)";
    context.lineWidth = 1;

    this.elevationCurves.forEach(points => this.drawCurve(points));
    this.azimuthCurves.forEach(points => this.drawCurve(points));

    context.restore();
  }

  drawCardinalMeridians() {
    const context = this.context;
    context.save();
    context.lineWidth = 1.25;
    this.cardinalCurves.forEach(curve => {
      context.strokeStyle = curve.axis === "north-south"
        ? "rgba(112, 180, 194, 0.28)"
        : "rgba(196, 157, 108, 0.25)";
      this.drawCurve(curve.points);
    });
    context.restore();
  }

  drawHorizon() {
    const context = this.context;
    context.save();
    context.strokeStyle = "rgba(126, 157, 149, 0.3)";
    context.lineWidth = 1.8;
    this.drawCurve(this.horizonCurve);
    context.restore();
  }

  drawCurve(points) {
    const context = this.context;
    let drawing = false;
    context.beginPath();
    for (const point of points) {
      const position = this.project(point);
      if (!position.visible) {
        drawing = false;
        continue;
      }

      if (drawing) {
        context.lineTo(position.x, position.y);
      } else {
        context.moveTo(position.x, position.y);
        drawing = true;
      }
    }
    context.stroke();
  }

  drawCardinals() {
    const context = this.context;
    context.save();
    context.fillStyle = "rgba(238, 243, 243, 0.48)";
    context.font = "600 15px monospace";
    context.textAlign = "center";
    this.cardinalVectors.forEach(direction => {
      const position = this.project(direction.vector);
      if (position.visible) {
        context.fillText(direction.label, position.x, position.y - 14);
      }
    });
    context.restore();
  }

  drawSource(source) {
    const position = this.project(source.vector);
    if (!position.visible) {
      return;
    }

    const context = this.context;
    const proximity = clamp(1 - source.distance / this.settings.focusRadius, 0, 1);
    const radius = 2.5 + proximity * 4;
    context.save();
    context.strokeStyle = `rgba(238, 243, 243, ${0.45 + proximity * 0.55})`;
    context.fillStyle = `rgba(238, 243, 243, ${0.55 + proximity * 0.45})`;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(position.x, position.y, radius, 0, Math.PI * 2);
    context.fill();
    if (proximity > 0.6) {
      context.beginPath();
      context.arc(position.x, position.y, radius + 8 + proximity * 7, 0, Math.PI * 2);
      context.stroke();
    }
    context.font = "9px monospace";
    context.textAlign = "center";
    context.fillStyle = `rgba(238, 243, 243, ${0.32 + proximity * 0.58})`;
    context.fillText(source.name, position.x, position.y + radius + 16);
    context.restore();
  }

  drawReticle() {
    const context = this.context;
    const x = this.width / 2;
    const y = this.height / 2;
    context.save();
    context.strokeStyle = "rgba(238, 243, 243, 0.82)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(x, y, 14, 0, Math.PI * 2);
    context.moveTo(x - 24, y);
    context.lineTo(x - 8, y);
    context.moveTo(x + 8, y);
    context.lineTo(x + 24, y);
    context.moveTo(x, y - 24);
    context.lineTo(x, y - 8);
    context.moveTo(x, y + 8);
    context.lineTo(x, y + 24);
    context.stroke();
    context.restore();
  }
}
