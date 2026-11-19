(() => {
  "use strict";

  const button = document.getElementById("tv-signal-toggle");
  const status = document.getElementById("tv-demo-status");
  if (!button || !status) return;

  let context;
  let oscillator;
  let active = false;

  function signalMusic(active) {
    window.dispatchEvent(new Event(active ? "piter-tv-tone-start" : "piter-tv-tone-stop"));
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
    status.textContent = "Tono apagado. Pulsa la televisión para volver a escucharlo.";
    signalMusic(false);
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
      status.textContent = "Tono continuo activo. Pulsa la televisión para apagarlo.";
    } catch {
      if (context && context.state !== "closed") context.close();
      context = null;
      oscillator = null;
      status.textContent = "No se ha podido activar el tono de prueba.";
      signalMusic(false);
    } finally {
      button.disabled = false;
    }
  });
})();
