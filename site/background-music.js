(() => {
  "use strict";

  const player = document.getElementById("background-player");
  const music = document.getElementById("background-audio");
  const toggle = document.getElementById("background-toggle");
  const demo = document.getElementById("demo-audio");
  const localVideo = document.getElementById("tv-demo-video");
  const preferenceKey = "piter-background-music-muted";
  let enabled = true;
  let blocked = false;
  let unavailable = false;
  let tvToneActive = false;

  try {
    enabled = localStorage.getItem(preferenceKey) !== "true";
  } catch {
    // El control también funciona cuando el navegador restringe el almacenamiento.
  }

  music.volume = 0.18;
  player.hidden = false;

  function demoPlaying() {
    return (demo && !demo.paused && !demo.ended) || (localVideo?.dataset.localFile === "true" && !localVideo.paused && !localVideo.muted);
  }

  function render() {
    toggle.disabled = unavailable;
    toggle.textContent = unavailable ? "Audio no disponible" : music.paused ? "Activar música" : "Silenciar";
    toggle.setAttribute("aria-label", toggle.textContent + " de fondo");
    player.classList.toggle("is-playing", !music.paused);
  }

  async function startMusic() {
    if (!enabled || unavailable || demoPlaying() || tvToneActive) {
      music.pause();
      render();
      return;
    }

    try {
      await music.play();
      blocked = false;
      if (!enabled || demoPlaying() || tvToneActive) music.pause();
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
    if (event.target.closest("#background-player, #demo, #tv-signal-toggle")) return;
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
  localVideo.addEventListener("play", () => { if (localVideo.dataset.localFile === "true") music.pause(); });
  localVideo.addEventListener("pause", startMusic);
  localVideo.addEventListener("ended", startMusic);
  window.addEventListener("piter-tv-tone-start", () => {
    tvToneActive = true;
    music.pause();
  });
  window.addEventListener("piter-tv-tone-stop", () => {
    tvToneActive = false;
    startMusic();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && music.paused) startMusic();
  });

  render();
  startMusic();
})();
