/* Subtle scroll reveals + hero keyword cycler */
(function () {
  // Reveal on scroll
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  // Hero keyword positions — cycle slowly
  const kwHost = document.querySelector(".hero-keywords");
  if (kwHost) {
    const words = [
      "CONFORMAL PREDICTION",
      "ADVERSARIAL ROBUSTNESS",
      "UNCERTAINTY QUANTIFICATION",
      "GRAPH NEURAL NETWORKS",
      "TRUSTWORTHY AI",
      "DISTRIBUTION-FREE GUARANTEES",
      "COVERAGE BOUNDS",
      "EPISTEMIC UNCERTAINTY",
      "ROBUSTNESS CERTIFICATES",
      "LLM CALIBRATION",
    ];
    const positions = [
      { top: "8%", left: "72%", delay: 0 },
      { top: "82%", left: "6%", delay: 4 },
      { top: "92%", left: "62%", delay: 8 },
      { top: "18%", left: "88%", delay: 6 },
    ];
    positions.forEach((p, i) => {
      const el = document.createElement("span");
      el.className = "kw";
      el.style.top = p.top;
      el.style.left = p.left;
      el.style.animationDelay = `-${p.delay}s`;
      el.textContent = words[i % words.length];
      kwHost.appendChild(el);
    });

    // Periodically swap text
    let cursor = positions.length;
    setInterval(() => {
      const els = kwHost.querySelectorAll(".kw");
      const idx = Math.floor(Math.random() * els.length);
      els[idx].textContent = words[cursor % words.length];
      cursor++;
    }, 4000);
  }
})();
