// Scatters twinkling stars (and the odd shooting star) behind the page.
(function () {
  const sky = document.createElement("div");
  sky.className = "sky";
  sky.setAttribute("aria-hidden", "true");
  document.body.prepend(sky);

  const count = window.innerWidth < 600 ? 70 : 130;
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span");
    const size = Math.random() < 0.85 ? 1 + Math.random() : 2 + Math.random();
    s.className = "star";
    s.style.width = s.style.height = size + "px";
    s.style.left = Math.random() * 100 + "%";
    s.style.top = Math.random() * 100 + "%";
    s.style.setProperty("--d", 2 + Math.random() * 5 + "s");
    s.style.setProperty("--delay", -Math.random() * 6 + "s");
    s.style.setProperty("--peak", (0.5 + Math.random() * 0.5).toFixed(2));
    sky.appendChild(s);
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  function shoot() {
    const s = document.createElement("span");
    s.className = "shooting";
    s.style.left = 40 + Math.random() * 60 + "%";
    s.style.top = Math.random() * 40 + "%";
    sky.appendChild(s);
    s.addEventListener("animationend", () => s.remove());
    setTimeout(shoot, 6000 + Math.random() * 9000);
  }
  setTimeout(shoot, 3000);
})();
