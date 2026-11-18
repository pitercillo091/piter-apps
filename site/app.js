(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const config = window.PITER_CONFIG || {};
  const menu = document.querySelector(".menu");
  const nav = byId("menu-links");
  function toggleMenu(open) {
    menu.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-collapsed", !open);
  }
  menu.hidden = false;
  toggleMenu(false);
  menu.addEventListener("click", () => toggleMenu(menu.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) toggleMenu(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") {
      toggleMenu(false);
      menu.focus();
    }
  });

  const dialog = byId("image-dialog");
  let zoomLink;
  if (typeof dialog.showModal === "function") {
    for (const link of document.querySelectorAll("[data-zoom]")) link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      zoomLink = link;
      const caption = link.closest("figure").querySelector("figcaption");
      byId("zoom-image").src = link.href;
      byId("zoom-image").alt = link.querySelector("img").alt;
      byId("image-title").textContent = caption.querySelector("h3")?.textContent || caption.textContent.trim();
      dialog.showModal();
      byId("close-image").focus();
    });
    byId("close-image").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => zoomLink?.focus());
  }

  const audio = byId("demo-audio");
  const sample = audio.getAttribute("src");
  const file = byId("demo-file");
  const restore = byId("restore-demo");
  const demoStatus = byId("demo-status");
  let objectUrl;
  function replaceAudio(url) {
    audio.pause();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = url;
    audio.src = url || sample;
    audio.load();
    restore.hidden = !url;
  }
  audio.addEventListener("error", () => { demoStatus.textContent = "No se ha podido abrir este audio. Prueba otro archivo."; });
  file.addEventListener("change", () => {
    const selected = file.files[0];
    if (!selected) return;
    replaceAudio(URL.createObjectURL(selected));
    demoStatus.textContent = selected.name;
  });
  restore.addEventListener("click", () => {
    file.value = "";
    replaceAudio();
    demoStatus.textContent = "Muestra · Primer viaje";
  });

  const sound = new Audio("assets/insercion.wav");
  byId("mechanical-demo").addEventListener("click", () => {
    sound.currentTime = 0;
    sound.play().catch(() => { demoStatus.textContent = "No se ha podido reproducir el efecto de inserción."; });
  });

  const onLocal = location.protocol === "file:" || ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  if (!config.release?.assets && onLocal) byId("local-state").hidden = false;
  const downloadAssets = { ...config.release?.assets, ...config.videoRelease?.assets };
  for (const link of document.querySelectorAll("[data-download]")) {
    const asset = downloadAssets[link.dataset.download];
    if (!asset) continue;
    link.href = asset.url;
    link.removeAttribute("download");
  }
  if (config.release?.assets) loadStats(config.release, "stats-status");
  if (config.videoRelease?.assets) loadStats(config.videoRelease, "video-stats-status");

  async function loadStats({ api, assets }, statusId) {
    const status = byId(statusId);
    status.textContent = "Consultando GitHub Releases…";
    try {
      const response = await fetch(api, {
        credentials: "omit",
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error("GitHub");
      const release = await response.json();
      const counts = Object.entries(assets).map(([platform, asset]) => {
        const match = release.assets.find((item) => item.name === asset.name && item.browser_download_url === asset.url);
        if (!Number.isInteger(match?.download_count)) throw new Error("Contador ausente");
        return [platform, match.download_count];
      });
      const formatter = new Intl.NumberFormat("es-ES");
      for (const [platform, count] of counts) byId("count-" + platform).textContent = formatter.format(count);
      const consulted = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date());
      status.textContent = "GitHub Releases · última consulta: " + consulted + " (Madrid).";
    } catch {
      status.textContent = "GitHub no ha facilitado los contadores en esta consulta.";
      for (const platform of Object.keys(assets)) byId("count-" + platform).textContent = "Sin datos";
    }
  }

  const commentConfig = config.comments;
  if (commentConfig?.endpoint && commentConfig?.sitekey && location.protocol === "https:") initComments();

  async function initComments() {
    const form = byId("comments-form");
    const fields = byId("comment-fields");
    const status = byId("comment-status");
    const submit = form.querySelector("button[type=submit]");
    const empty = byId("comments-empty");
    const endpoint = new URL(commentConfig.endpoint);
    if (endpoint.protocol !== "https:") return;
    const request = { credentials: "omit" };
    empty.textContent = "Buscando comentarios publicados…";
    fetch(endpoint, { ...request, signal: AbortSignal.timeout(8000) }).then(async (response) => {
      if (!response.ok) throw new Error("Lectura");
      const { comments } = await response.json();
      empty.hidden = comments.length > 0;
      empty.textContent = "Aún no hay comentarios publicados.";
      const format = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" });
      for (const comment of comments) {
        const li = document.createElement("li");
        const name = document.createElement("strong");
        const time = document.createElement("time");
        const message = document.createElement("p");
        name.textContent = comment.name;
        time.dateTime = comment.created;
        time.textContent = format.format(new Date(comment.created));
        message.textContent = comment.message;
        li.append(name, time, message);
        byId("comments-list").append(li);
      }
    }).catch(() => { empty.textContent = "Los comentarios no están disponibles en este momento."; });

    try {
      status.textContent = "Preparando la verificación de comentarios…";
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
      const widget = window.turnstile.render("#comment-challenge", {
        sitekey: commentConfig.sitekey,
        action: "comment",
        size: "flexible"
      });
      fields.disabled = false;
      status.textContent = "El comentario se revisará antes de publicarse.";
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (submit.disabled) return;
        const token = window.turnstile.getResponse(widget);
        if (!token) {
          status.textContent = "Completa la verificación antes de enviar.";
          return;
        }
        const data = Object.fromEntries(new FormData(form));
        if (data.name.trim().length < 2 || data.message.trim().length < 5) {
          status.textContent = "Escribe un nombre y un comentario más largos.";
          return;
        }
        submit.disabled = true;
        try {
          const response = await fetch(endpoint, {
            ...request, method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data, token }), signal: AbortSignal.timeout(12000)
          });
          if (response.status === 429) {
            status.textContent = "Espera unos minutos antes de enviar otro comentario.";
          } else if (response.ok) {
            form.reset();
            status.textContent = "Tu comentario se ha enviado a moderación.";
          } else {
            status.textContent = "El comentario no se ha podido enviar. Comprueba los campos y vuelve a intentarlo.";
          }
        } catch {
          status.textContent = "No hay conexión con el foro. Inténtalo más tarde.";
        } finally {
          window.turnstile.reset(widget);
          submit.disabled = false;
        }
      });
    } catch {
      status.textContent = "La verificación del foro no está disponible en este momento.";
    }
  }
})();
