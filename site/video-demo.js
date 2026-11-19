(() => {
  "use strict";

  const button = document.getElementById("tv-signal-toggle");
  const status = document.getElementById("tv-demo-status");
  const video = document.getElementById("tv-demo-video");
  const picker = document.getElementById("tv-video-file");
  const reset = document.getElementById("tv-reset-demo");
  const label = document.querySelector(".tv-screen-label");
  const defaultSource = "assets/piter-video/smpte-demo.mp4";
  if (!button || !status || !video || !picker || !reset) return;

  let context;
  let oscillator;
  let active = false;
  let objectUrl;
  let resumeVideoAfterTone = false;

  function signalMusic(isActive) {
    window.dispatchEvent(new Event(isActive ? "piter-tv-tone-start" : "piter-tv-tone-stop"));
  }

  function stopTone() {
    if (!active) return;
    active = false;
    try { oscillator?.stop(); } catch {}
    oscillator?.disconnect();
    oscillator = null;
    if (context && context.state !== "closed") context.close();
    context = null;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "Activar el tono de prueba SMPTE");
    if (!video.dataset.localFile) status.textContent = "Tono apagado. Pulsa la carcasa para volver a escucharlo.";
    signalMusic(false);
    if (resumeVideoAfterTone) {
      resumeVideoAfterTone = false;
      video.play().catch(() => {});
    }
  }

  button.addEventListener("click", async () => {
    if (active) {
      stopTone();
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      status.textContent = "Este navegador no permite reproducir el tono de prueba.";
      return;
    }
    button.disabled = true;
    resumeVideoAfterTone = video.dataset.localFile === "true" && !video.paused;
    if (resumeVideoAfterTone) video.pause();
    signalMusic(true);
    try {
      context = new AudioContextClass();
      await context.resume();
      oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 1000;
      volume.gain.value = 0.06;
      oscillator.connect(volume);
      volume.connect(context.destination);
      oscillator.start();
      active = true;
      button.setAttribute("aria-pressed", "true");
      button.setAttribute("aria-label", "Apagar el tono de prueba SMPTE");
      if (!video.dataset.localFile) status.textContent = "Tono continuo activo. Pulsa la carcasa para apagarlo.";
    } catch {
      if (context && context.state !== "closed") context.close();
      context = null;
      oscillator = null;
      status.textContent = "No se ha podido activar el tono de prueba.";
      signalMusic(false);
      if (resumeVideoAfterTone) video.play().catch(() => {});
      resumeVideoAfterTone = false;
    } finally {
      button.disabled = false;
    }
  });

  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    if (!file) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    video.pause();
    video.src = objectUrl;
    video.loop = false;
    video.autoplay = false;
    video.muted = false;
    video.controls = true;
    video.dataset.localFile = "true";
    video.setAttribute("aria-label", "Vídeo local en la televisión Philips 12T700");
    if (label) label.textContent = "VÍDEO LOCAL";
    reset.hidden = false;
    status.textContent = "Vídeo cargado: " + file.name + ". La música de fondo se pausa al reproducirlo.";
    video.load();
    video.play().catch(() => {
      status.textContent = "Vídeo cargado. Pulsa PLAY en la televisión para iniciar la reproducción.";
    });
  });

  video.addEventListener("error", () => {
    if (video.dataset.localFile === "true") status.textContent = "Este navegador no puede reproducir este formato de vídeo.";
  });

  reset.addEventListener("click", () => {
    video.pause();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    delete video.dataset.localFile;
    video.removeAttribute("controls");
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.src = defaultSource;
    video.setAttribute("aria-label", "Barras SMPTE en la televisión Philips 12T700");
    video.load();
    video.play().catch(() => {});
    picker.value = "";
    reset.hidden = true;
    if (label) label.textContent = "BARRAS SMPTE";
    status.textContent = "Señal de prueba lista. Elige un vídeo o pulsa la carcasa para oír el tono.";
  });

  window.addEventListener("piter-tv-tone-start", () => {
    if (video.dataset.localFile === "true" && !video.paused) {
      resumeVideoAfterTone = true;
      video.pause();
    }
  });

  window.addEventListener("beforeunload", () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (active) stopTone();
  });
})();
