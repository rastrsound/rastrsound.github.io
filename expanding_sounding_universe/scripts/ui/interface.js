const formatAngle = value => `${value.toFixed(1).padStart(5, "0")}°`;

export class Interface {
  constructor(root, timeZone) {
    this.timeElement = root.querySelector("[data-time]");
    this.directionElement = root.querySelector("[data-direction]");
    this.targetElement = root.querySelector("[data-target]");
    this.targetNameElement = root.querySelector("[data-target-name]");
    this.targetCoordinatesElement = root.querySelector("[data-target-coordinates]");
    this.noticeElement = root.querySelector("[data-notice]");
    this.onboardingElement = root.querySelector("[data-onboarding]");
    this.startButton = root.querySelector("[data-start]");
    this.technicalElement = root.querySelector(".onboarding__technical");
    this.lastTime = "";
    this.lastDirection = "";
    this.lastTargetId = null;
    this.lastTargetCoordinates = "";
    this.targetVisible = false;
    this.noticeTimer = null;
    this.timeFormatter = new Intl.DateTimeFormat("fi-FI", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    this.onboardingElement.showModal();
  }

  onStart(handler) {
    this.startButton.addEventListener("click", async () => {
      this.startButton.disabled = true;
      this.onboardingElement.close();
      try {
        await handler();
      } finally {
        this.startButton.disabled = false;
      }
    });
  }

  fail(message) {
    this.technicalElement.textContent = message;
    this.startButton.disabled = true;
    this.startButton.textContent = "INSTRUMENTTIA EI VOITU KÄYNNISTÄÄ";
  }

  update(date, view, selected, simulated) {
    const time = `${simulated ? "SIM " : ""}${this.timeFormatter.format(date)}`;
    const direction = `AZ ${formatAngle(view.azimuth)} EL ${formatAngle(view.elevation)}`;
    if (time !== this.lastTime) {
      this.timeElement.textContent = time;
      this.lastTime = time;
    }
    if (direction !== this.lastDirection) {
      this.directionElement.textContent = direction;
      this.lastDirection = direction;
    }
    const targetVisible = Boolean(selected);
    if (targetVisible !== this.targetVisible) {
      this.targetElement.hidden = !targetVisible;
      this.targetVisible = targetVisible;
    }
    if (selected && selected.id !== this.lastTargetId) {
      this.targetNameElement.textContent = selected.name;
    }
    if (selected) {
      const coordinates = `AZ ${formatAngle(selected.azimuth)}  EL ${formatAngle(selected.elevation)}`;
      if (coordinates !== this.lastTargetCoordinates) {
        this.targetCoordinatesElement.textContent = coordinates;
        this.lastTargetCoordinates = coordinates;
      }
    }
    this.lastTargetId = selected?.id ?? null;
  }

  notify(message, duration = 5000) {
    this.noticeElement.textContent = message;
    this.noticeElement.hidden = false;
    window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      this.noticeElement.hidden = true;
    }, duration);
  }
}
