(() => {
  "use strict";

  const catalog = window.PITER_CASSETTES;
  const byId = (id) => document.getElementById(id);
  const deck = byId("cassette-deck");
  const shell = byId("demo-shell");
  const audio = byId("demo-audio");
  const select = byId("cassette-model");
  const rotate = byId("cassette-rotate");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const context = byId("cassette-reels").getContext("2d");
  let current = 0;
  let timer;
  let frame;

  function draw() {
    if (!context) return;
    context.clearRect(0, 0, 600, 380);
    const model = catalog[current];
    const [x, y, width, height] = model.window;
    const progress = Number.isFinite(audio.duration) && audio.duration > 0
      ? Math.min(1, audio.currentTime / audio.duration)
      : 0;
    // The same tape radii and angles as the Windows cassette renderer.
    const core = 0.010;
    const outer = 0.024;
    const difference = outer ** 2 - core ** 2;
    const radii = [Math.sqrt(outer ** 2 - progress * difference), Math.sqrt(core ** 2 + progress * difference)];
    const pitch = progress > 0 ? Math.PI * difference / (0.0476 * audio.duration) : 1;
    const angles = [2 * Math.PI * (outer - radii[0]) / pitch, 2 * Math.PI * (radii[1] - core) / pitch];
    const packs = [];

    context.save();
    context.beginPath();
    context.roundRect(x, y, width, height, 10);
    context.clip();
    for (const [side, [cx, cy]] of model.hubs.entries()) {
      const edge = Math.min(cx - x, x + width - cx, cy - y, y + height - cy);
      const opening = model.diameters ? model.diameters[side] / 2 : Math.min(23, Math.max(10, height * 0.28));
      const hub = Math.min(opening - 0.8, edge - 1);
      if (hub < 3) continue;
      const radius = Math.max(hub, radii[side] / outer * Math.min(edge - 1, Math.max(hub * 1.8, 33)));
      packs[side] = radius;

      context.save();
      context.translate(cx, cy);
      if (model.visibleTape) {
        const tape = context.createRadialGradient(-radius * 0.16, -radius * 0.2, 0, 0, 0, radius * 1.3);
        tape.addColorStop(0, "#66513b");
        tape.addColorStop(0.65, "#37291e");
        tape.addColorStop(1, "#17100c");
        circle(radius, tape, "#897255");
        for (let layer = hub + 1.6; layer < radius; layer += 1.6) circle(layer, null, "#c5986726");
      }
      const plastic = context.createLinearGradient(-hub, -hub, hub, hub);
      plastic.addColorStop(0, "#f0eddb");
      plastic.addColorStop(0.5, "#929589");
      plastic.addColorStop(1, "#c2c3b4");
      circle(hub, plastic, "#414842");
      circle(hub * 0.72, "#111513");
      context.rotate(motion.matches ? 0 : angles[side]);
      context.fillStyle = "#c9cabc";
      for (let tooth = 0; tooth < 6; tooth++) {
        context.beginPath();
        context.roundRect(-hub * 0.14, -hub * 0.77, hub * 0.28, hub * 0.34, hub * 0.06);
        context.fill();
        context.rotate(Math.PI / 3);
      }
      context.restore();
    }
    if (model.visibleTape && packs.length === 2 && packs.every(Boolean)) {
      context.beginPath();
      context.moveTo(model.hubs[0][0], model.hubs[0][1] + packs[0] - 0.8);
      context.lineTo(model.hubs[1][0], model.hubs[1][1] + packs[1] - 0.8);
      context.strokeStyle = "#27170e";
      context.lineWidth = 2.8;
      context.stroke();
    }
    context.restore();
  }

  function circle(radius, fill, stroke) {
    context.beginPath();
    context.arc(0, 0, radius, 0, 2 * Math.PI);
    if (fill) {
      context.fillStyle = fill;
      context.fill();
    }
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = 0.7;
      context.stroke();
    }
  }

  function show(index) {
    current = (index + catalog.length) % catalog.length;
    const { id, name } = catalog[current];
    select.value = id;
    shell.alt = "Carcasa " + name;
    if (shell.dataset.model !== id) {
      shell.dataset.model = id;
      shell.src = "assets/cassettes/" + id + ".png";
    }
    draw();
  }

  function updateRotation() {
    clearInterval(timer);
    rotate.setAttribute("aria-pressed", String(rotate.dataset.on === "true"));
    rotate.textContent = rotate.dataset.on === "true" ? "Pausar carrusel" : "Activar carrusel";
    if (rotate.dataset.on === "true") {
      timer = setInterval(() => {
        if (!document.hidden && !deck.closest(".demo").matches(":focus-within, :hover")) show(current + 1);
      }, 5500);
    }
  }

  function choose(index) {
    rotate.dataset.on = "false";
    updateRotation();
    show(index);
  }

  for (const { id, name } of catalog) select.add(new Option(name, id));
  select.addEventListener("change", () => choose(select.selectedIndex));
  byId("cassette-prev").addEventListener("click", () => choose(current - 1));
  byId("cassette-next").addEventListener("click", () => choose(current + 1));
  rotate.addEventListener("click", () => {
    rotate.dataset.on = String(rotate.dataset.on !== "true");
    updateRotation();
  });
  rotate.dataset.on = String(!motion.matches);
  updateRotation();
  show(0);

  function animate() {
    draw();
    frame = requestAnimationFrame(animate);
  }

  function stopAnimation() {
    cancelAnimationFrame(frame);
    draw();
  }

  audio.addEventListener("playing", () => {
    cancelAnimationFrame(frame);
    if (!motion.matches) animate();
  });
  for (const event of ["pause", "ended", "waiting", "emptied", "seeking", "durationchange", "error"]) {
    audio.addEventListener(event, stopAnimation);
  }
  audio.addEventListener("seeked", () => {
    if (!audio.paused && !motion.matches) {
      cancelAnimationFrame(frame);
      animate();
    } else draw();
  });
  motion.addEventListener("change", () => {
    if (motion.matches) {
      rotate.dataset.on = "false";
      updateRotation();
      stopAnimation();
    } else if (!audio.paused) {
      cancelAnimationFrame(frame);
      animate();
    }
  });
})();
