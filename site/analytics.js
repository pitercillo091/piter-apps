(() => {
  "use strict";

  const endpoint = window.PITER_CONFIG?.comments?.endpoint;
  if (!endpoint || location.protocol !== "https:") return;

  let origin;
  try {
    const configured = new URL(endpoint);
    if (configured.protocol !== "https:" || configured.pathname !== "/comments") return;
    origin = configured.origin;
  } catch {
    return;
  }

  const total = document.getElementById("page-views-total");
  if (!total) {
    fetch(origin + "/analytics/view", {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      keepalive: true
    }).catch(() => null);
    return;
  }

  const today = document.getElementById("page-views-today");
  const recent = document.getElementById("page-views-last30");
  const status = document.getElementById("page-views-status");
  fetch(origin + "/analytics/view", {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    keepalive: true,
    signal: AbortSignal.timeout(8000)
  }).then(async (response) => {
    if (!response.ok) throw new Error("Visitas no disponibles");
    const summary = await response.json();
    const format = new Intl.NumberFormat("es-ES");
    total.textContent = format.format(summary.total);
    today.textContent = format.format(summary.today);
    recent.textContent = format.format(summary.last30);
    status.textContent = "Recuento diario agregado. Sin cookies ni direcciones IP almacenadas.";
  }).catch(() => {
    total.textContent = today.textContent = recent.textContent = "Sin datos";
    status.textContent = "El contador de visitas no está disponible en este momento.";
  });
})();
