import { angularDistance, normalizeDegrees, unwrapDegrees } from "./astronomy/angles.js";
import { equatorialToHorizontal, horizontalVector } from "./astronomy/coordinates.js";
import { AudioEngine } from "./audio/audio-engine.js";
import { presentation } from "./config/presentation.js";
import { loadSources } from "./config/source-loader.js";
import { DeviceOrientationController } from "./orientation/device-orientation.js";
import { PointerOrientation } from "./orientation/pointer-orientation.js";
import { SkyRenderer } from "./rendering/sky-renderer.js";
import { Clock } from "./simulation/clock.js";
import { Interface } from "./ui/interface.js";

const positionUpdateInterval = 1000;
const audioUpdateInterval = 50;
const interfaceUpdateInterval = 100;
const canvas = document.querySelector(".sky");
const instrument = document.querySelector(".instrument");
const clock = new Clock(new URLSearchParams(window.location.search), presentation.simulation);
const pointerOrientation = new PointerOrientation(instrument);
const orientation = new DeviceOrientationController(pointerOrientation);
const renderer = new SkyRenderer(canvas, presentation.view);
const interfaceController = new Interface(document, presentation.location.timeZone);

const startApplication = sources => {
  const audio = new AudioEngine(sources, presentation.audio);
  const positionedSources = sources.map(source => ({
    ...source,
    azimuth: 0,
    elevation: 0,
    distance: 180,
    vector: horizontalVector(0, 0)
  }));
  let lastPositionUpdate = Number.NEGATIVE_INFINITY;
  let lastAudioUpdate = Number.NEGATIVE_INFINITY;
  let lastInterfaceUpdate = Number.NEGATIVE_INFINITY;
  let previousAnimationTime = null;
  let smoothedView = { ...pointerOrientation.current(), roll: 0 };
  let previousAzimuth = smoothedView.azimuth;
  let continuousAzimuth = smoothedView.azimuth;
  let continuousTargetAzimuth = smoothedView.azimuth;
  let previousRoll = smoothedView.roll;
  let continuousRoll = smoothedView.roll;
  let continuousTargetRoll = smoothedView.roll;

  audio.onError(source => {
    const detail = source ? ` (${source.name})` : "";
    interfaceController.notify(`Äänen lataaminen epäonnistui${detail}.`);
  });

  const updatePositions = date => {
    positionedSources.forEach(source => {
      const position = equatorialToHorizontal(source, date, presentation.location);
      source.azimuth = position.azimuth;
      source.elevation = position.elevation;
      source.vector = horizontalVector(position.azimuth, position.elevation);
    });
  };

  const updateView = (view, elapsedSeconds) => {
    const smoothing = 1 - Math.exp(-elapsedSeconds / presentation.view.smoothingSeconds);
    continuousTargetAzimuth = unwrapDegrees(continuousTargetAzimuth, previousAzimuth, view.azimuth);
    continuousAzimuth += (continuousTargetAzimuth - continuousAzimuth) * smoothing;
    previousAzimuth = view.azimuth;
    smoothedView.azimuth = normalizeDegrees(continuousAzimuth);
    smoothedView.elevation += (view.elevation - smoothedView.elevation) * smoothing;
    continuousTargetRoll = unwrapDegrees(continuousTargetRoll, previousRoll, view.roll ?? 0);
    continuousRoll += (continuousTargetRoll - continuousRoll) * smoothing;
    previousRoll = view.roll ?? 0;
    smoothedView.roll = continuousRoll;
  };

  const updateDistances = view => {
    positionedSources.forEach(source => {
      source.distance = angularDistance(source.azimuth, source.elevation, view.azimuth, view.elevation);
    });
  };

  const selectFocusedSource = () => {
    let selected = null;
    positionedSources.forEach(source => {
      if (
        source.distance <= presentation.view.selectionRadius
        && (!selected || source.distance < selected.distance)
      ) {
        selected = source;
      }
    });
    return selected;
  };

  const animate = timestamp => {
    const elapsedSeconds = previousAnimationTime === null
      ? 1 / 60
      : Math.min((timestamp - previousAnimationTime) / 1000, 0.1);
    previousAnimationTime = timestamp;
    if (timestamp - lastPositionUpdate >= positionUpdateInterval) {
      updatePositions(clock.now());
      lastPositionUpdate = timestamp;
    }

    updateView(orientation.current(), elapsedSeconds);
    updateDistances(smoothedView);
    renderer.render(positionedSources, smoothedView);
    if (timestamp - lastAudioUpdate >= audioUpdateInterval) {
      audio.update(positionedSources, smoothedView);
      lastAudioUpdate = timestamp;
    }
    if (timestamp - lastInterfaceUpdate >= interfaceUpdateInterval) {
      interfaceController.update(clock.now(), smoothedView, selectFocusedSource(), clock.isSimulated);
      lastInterfaceUpdate = timestamp;
    }
    window.requestAnimationFrame(animate);
  };

  interfaceController.onStart(async () => {
    const [audioResult, orientationResult] = await Promise.allSettled([
      audio.start(),
      orientation.enable()
    ]);

    if (audioResult.status === "rejected") {
      interfaceController.notify("Ääntä ei voitu käynnistää. Tarkista selaimen ääniasetukset.");
    }
    if (orientationResult.status === "rejected" || orientationResult.value === false) {
      interfaceController.notify("Liikesensori ei ole käytettävissä. Liikuta näkymää vetämällä.");
    }
  });

  window.requestAnimationFrame(animate);
};

try {
  startApplication(await loadSources("./data/sources.csv"));
} catch (error) {
  interfaceController.fail(error instanceof Error ? error.message : "Kohdeluettelon lataaminen epäonnistui.");
}
