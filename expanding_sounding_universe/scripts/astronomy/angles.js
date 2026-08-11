export const degreesToRadians = degrees => degrees * Math.PI / 180;

export const radiansToDegrees = radians => radians * 180 / Math.PI;

export const normalizeDegrees = degrees => ((degrees % 360) + 360) % 360;

export const signedAngleDifference = (target, origin) => ((target - origin + 540) % 360) - 180;

export const unwrapDegrees = (continuousAngle, previousAngle, nextAngle) => (
  continuousAngle + signedAngleDifference(nextAngle, previousAngle)
);

export const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const angularDistance = (firstAzimuth, firstElevation, secondAzimuth, secondElevation) => {
  const firstAzimuthRadians = degreesToRadians(firstAzimuth);
  const firstElevationRadians = degreesToRadians(firstElevation);
  const secondAzimuthRadians = degreesToRadians(secondAzimuth);
  const secondElevationRadians = degreesToRadians(secondElevation);
  const cosine = Math.sin(firstElevationRadians) * Math.sin(secondElevationRadians)
    + Math.cos(firstElevationRadians) * Math.cos(secondElevationRadians)
    * Math.cos(firstAzimuthRadians - secondAzimuthRadians);

  return radiansToDegrees(Math.acos(clamp(cosine, -1, 1)));
};
