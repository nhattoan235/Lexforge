(() => {
  const svg = document.querySelector('.puzzle-wheel');
  if (!svg) return;
  const pieces = svg.querySelector('.puzzle-pieces');
  const number = svg.querySelector('.puzzle-number');
  const namespace = 'http://www.w3.org/2000/svg';
  const total = 12;
  const offsets = [0, 0, 0, 3, -4, 5, 2, -3, 4, -5, 3, -2];
  const polar = (radius, degrees) => {
    const radians = (degrees - 90) * Math.PI / 180;
    return [80 + radius * Math.cos(radians), 80 + radius * Math.sin(radians)];
  };
  const point = (radius, degrees) => polar(radius, degrees).map(n => n.toFixed(2)).join(' ');

  function draw() {
    const progress = Math.max(0, Math.min(100, Number(svg.dataset.progress) || 0));
    const completed = Math.round(total * progress / 100);
    pieces.replaceChildren();
    number.textContent = `${progress}%`;
    svg.setAttribute('aria-label', `Vòng ghép tiến độ: ${progress} phần trăm đã hoàn thiện`);

    for (let index = 0; index < total; index++) {
      const angle = index * 30;
      const start = angle + 2.2;
      const end = angle + 27.8;
      const middle = (start + end) / 2;
      const complete = index < completed;
      const group = document.createElementNS(namespace, 'g');
      group.classList.add('puzzle-piece-group', complete ? 'complete' : 'unfinished');
      group.style.setProperty('--piece-index', index);
      if (!complete) {
        const radius = offsets[index];
        const [dx, dy] = polar(radius, middle).map(n => n - 80);
        group.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`);
      }

      const shape = document.createElementNS(namespace, 'path');
      shape.setAttribute('d', `M ${point(73, start)} A 73 73 0 0 1 ${point(73, end)} L ${point(48, end)} A 48 48 0 0 0 ${point(48, start)} Z`);
      shape.classList.add('puzzle-piece');
      group.append(shape);

      if (!complete) {
        const crack = document.createElementNS(namespace, 'path');
        crack.setAttribute('d', `M ${point(49, middle - 5)} L ${point(56, middle + 3)} L ${point(63, middle - 4)} L ${point(71, middle + 4)}`);
        crack.classList.add('puzzle-crack');
        group.append(crack);
      }
      pieces.append(group);
    }
  }

  draw();
  new MutationObserver(draw).observe(svg, { attributes: true, attributeFilter: ['data-progress'] });
})();
