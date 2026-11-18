(() => {
  "use strict";

  const player = document.getElementById("background-player");
  const music = document.getElementById("background-audio");
  const toggle = document.getElementById("background-toggle");
  const demo = document.getElementById("demo-audio");
  const preferenceKey = "piter-background-music-muted";
  let enabled = true;
  let blocked = false;
  let unavailable = false;

  try {
    enabled = localStorage.getItem(preferenceKey) !== "true";
  } catch {
    // El control también funciona cuando el navegador restringe el almacenamiento.
  }

  music.volume = 0.18;
  player.hidden = false;

  function demoPlaying() {
    return demo && !demo.paused && !demo.ended;
  }

  function render() {
    toggle.disabled = unavailable;
    toggle.textContent = unavailable ? "Audio no disponible" : music.paused ? "Activar música" : "Silenciar";
    toggle.setAttribute("aria-label", toggle.textContent + " de fondo");
    player.classList.toggle("is-playing", !music.paused);
  }

  async function startMusic() {
    if (!enabled || unavailable || document.hidden || demoPlaying()) {
      music.pause();
      render();
      return;
    }

    try {
      await music.play();
      blocked = false;
      if (!enabled || document.hidden || demoPlaying()) music.pause();
    } catch (error) {
      if (error.name === "NotAllowedError") blocked = true;
      else if (error.name !== "AbortError") unavailable = true;
    }
    render();
  }

  toggle.addEventListener("click", () => {
    if (!music.paused) {
      enabled = false;
      music.pause();
    } else {
      enabled = true;
      if (demoPlaying()) demo.pause();
      else startMusic();
    }
    try {
      localStorage.setItem(preferenceKey, String(!enabled));
    } catch {
      // La elección se mantiene durante esta visita.
    }
    render();
  });

  function onInteraction(event) {
    if (event.target.closest("#background-player, #demo")) return;
    if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
    if (enabled && blocked) startMusic();
  }
  document.addEventListener("click", onInteraction);
  document.addEventListener("keydown", onInteraction);

  music.addEventListener("play", render);
  music.addEventListener("pause", render);
  music.addEventListener("error", () => {
    unavailable = true;
    render();
  });
  demo.addEventListener("play", () => music.pause());
  demo.addEventListener("pause", startMusic);
  demo.addEventListener("ended", startMusic);
  document.addEventListener("visibilitychange", startMusic);

  render();
  startMusic();
})();
