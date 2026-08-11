import { degreesToRadians, normalizeDegrees, radiansToDegrees } from "./angles.js";

const unixEpochJulianDate = 2440587.5;
const millisecondsPerDay = 86400000;
const j2000 = 2451545;

export const julianDate = date => date.getTime() / millisecondsPerDay + unixEpochJulianDate;

export const greenwichSiderealTime = date => {
  const daysSinceJ2000 = julianDate(date) - j2000;
  return normalizeDegrees(280.46061837 + 360.98564736629 * daysSinceJ2000);
};

export const horizontalVector = (azimuth, elevation) => {
  const azimuthRadians = degreesToRadians(azimuth);
  const elevationRadians = degreesToRadians(elevation);
  return {
    east: Math.cos(elevationRadians) * Math.sin(azimuthRadians),
    north: Math.cos(elevationRadians) * Math.cos(azimuthRadians),
    up: Math.sin(elevationRadians)
  };
};

export const equatorialToHorizontal = ({ rightAscension, declination }, date, location) => {
  const latitude = degreesToRadians(location.latitude);
  const declinationRadians = degreesToRadians(declination);
  const localSiderealTime = normalizeDegrees(greenwichSiderealTime(date) + location.longitude);
  const hourAngle = degreesToRadians(normalizeDegrees(localSiderealTime - rightAscension + 180) - 180);
  const elevation = Math.asin(
    Math.sin(latitude) * Math.sin(declinationRadians)
    + Math.cos(latitude) * Math.cos(declinationRadians) * Math.cos(hourAngle)
  );
  const azimuth = Math.atan2(
    -Math.sin(hourAngle) * Math.cos(declinationRadians),
    Math.sin(declinationRadians) * Math.cos(latitude)
      - Math.cos(declinationRadians) * Math.sin(latitude) * Math.cos(hourAngle)
  );

  return {
    azimuth: normalizeDegrees(radiansToDegrees(azimuth)),
    elevation: radiansToDegrees(elevation)
  };
};
