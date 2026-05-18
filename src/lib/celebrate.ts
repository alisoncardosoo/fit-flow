import confetti from "canvas-confetti";

export function celebrate() {
  const duration = 1800;
  const end = Date.now() + duration;
  const colors = ["#a3e635", "#84cc16", "#facc15", "#ffffff"];

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.7 },
      colors,
      scalar: 0.9,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.7 },
      colors,
      scalar: 0.9,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();

  confetti({
    particleCount: 120,
    spread: 100,
    origin: { y: 0.55 },
    colors,
    scalar: 1.1,
    ticks: 220,
  });
}
