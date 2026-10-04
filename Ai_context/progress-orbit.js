(() => {
  const stars = [...document.querySelectorAll('.orbit-star')];
  if (stars.length !== 6 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Uneven starting gaps look natural; a small separation force prevents clustering.
  const angles = [4, 57, 132, 177, 246, 302];
  const speeds = [-4.22, -4.81, -4.39, -5.03, -4.57, -4.94];
  const phases = [0.3, 1.9, 3.6, 5.1, 2.7, 4.4];
  const cycles = [12.1, 15.7, 10.9, 17.3, 13.8, 11.6];
  const wrap = angle => ((angle % 360) + 360) % 360;
  let previous = 0;

  function frame(now) {
    if (!previous) previous = now;
    const dt = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    const seconds = now / 1000;
    const velocity = speeds.map((base, index) =>
      base + 0.34 * Math.sin(seconds / cycles[index] + phases[index])
    );

    const order = angles.map((angle, index) => ({ angle: wrap(angle), index }))
      .sort((a, b) => a.angle - b.angle);
    for (let i = 0; i < order.length; i++) {
      const first = order[i];
      const next = order[(i + 1) % order.length];
      const gap = wrap(next.angle - first.angle);
      if (gap < 43) {
        const push = Math.min(1.25, (43 - gap) * 0.07);
        velocity[first.index] -= push;
        velocity[next.index] += push;
      }
    }

    stars.forEach((star, index) => {
      angles[index] = wrap(angles[index] + velocity[index] * dt);
      star.style.transform = `rotate(${angles[index]}deg)`;
    });
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
