import {
  clamp,
  degreesToRadians,
  normalizeDegrees,
  radiansToDegrees,
  signedAngleDifference
} from "../astronomy/angles.js";

const dot = (first, second) => first.x * second.x + first.y * second.y + first.z * second.z;

const rotateAroundVertical = (vector, sine, cosine) => ({
  x: vector.x * cosine + vector.y * sine,
  y: vector.y * cosine - vector.x * sine,
  z: vector.z
});

const deviceBasis = ({ alpha, beta, gamma }) => {
  const alphaRadians = degreesToRadians(alpha);
  const betaRadians = degreesToRadians(beta);
  const gammaRadians = degreesToRadians(gamma);
  const sinAlpha = Math.sin(alphaRadians);
  const cosAlpha = Math.cos(alphaRadians);
  const sinBeta = Math.sin(betaRadians);
  const cosBeta = Math.cos(betaRadians);
  const sinGamma = Math.sin(gammaRadians);
  const cosGamma = Math.cos(gammaRadians);
  return {
    forward: {
      x: -(cosGamma * sinAlpha * sinBeta + cosAlpha * sinGamma),
      y: cosAlpha * cosGamma * sinBeta - sinAlpha * sinGamma,
      z: -cosBeta * cosGamma
    },
    right: {
      x: cosAlpha * cosGamma - sinAlpha * sinBeta * sinGamma,
      y: sinAlpha * cosGamma + cosAlpha * sinBeta * sinGamma,
      z: -cosBeta * sinGamma
    },
    up: {
      x: -cosBeta * sinAlpha,
      y: cosAlpha * cosBeta,
      z: sinBeta
    }
  };
};

export const calculateDevicePose = (measurement, previousCompassOffset = null) => {
  const basis = deviceBasis(measurement);
  const uncorrectedElevation = radiansToDegrees(Math.asin(clamp(basis.forward.z, -1, 1)));
  let compassOffset = previousCompassOffset;
  if (
    compassOffset === null
    && Number.isFinite(measurement.compassHeading)
    && Math.abs(uncorrectedElevation) < 20
  ) {
    const relativeHeading = normalizeDegrees(radiansToDegrees(Math.atan2(basis.forward.x, basis.forward.y)));
    compassOffset = signedAngleDifference(measurement.compassHeading, relativeHeading);
  }

  const correction = degreesToRadians(compassOffset ?? 0);
  const sine = Math.sin(correction);
  const cosine = Math.cos(correction);
  const forward = rotateAroundVertical(basis.forward, sine, cosine);
  const right = rotateAroundVertical(basis.right, sine, cosine);
  const up = rotateAroundVertical(basis.up, sine, cosine);
  const screenAngle = degreesToRadians(measurement.screenAngle);
  const screenSine = Math.sin(screenAngle);
  const screenCosine = Math.cos(screenAngle);
  const screenUp = {
    x: up.x * screenCosine - right.x * screenSine,
    y: up.y * screenCosine - right.y * screenSine,
    z: up.z * screenCosine - right.z * screenSine
  };
  const azimuth = normalizeDegrees(radiansToDegrees(Math.atan2(forward.x, forward.y)));
  const elevation = radiansToDegrees(Math.asin(clamp(forward.z, -1, 1)));
  const azimuthRadians = degreesToRadians(azimuth);
  const elevationRadians = degreesToRadians(elevation);
  const canonicalRight = {
    x: Math.cos(azimuthRadians),
    y: -Math.sin(azimuthRadians),
    z: 0
  };
  const canonicalUp = {
    x: -Math.sin(elevationRadians) * Math.sin(azimuthRadians),
    y: -Math.sin(elevationRadians) * Math.cos(azimuthRadians),
    z: Math.cos(elevationRadians)
  };
  const roll = radiansToDegrees(Math.atan2(dot(screenUp, canonicalRight), dot(screenUp, canonicalUp)));
  return Object.freeze({
    compassOffset,
    view: Object.freeze({ azimuth, elevation, roll })
  });
};
