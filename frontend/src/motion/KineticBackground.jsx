import React, { useEffect, useRef } from 'react';
import { createInkField } from './createInkField.js';
import './kinetic.css';

const imagePath = '/art/crimson-suspension.webp';
const clamp = (n, min, max) => Math.max(min, Math.min(n, max));

export default function KineticBackground() {
  const shell = useRef(null);
  const canvas = useRef(null);

  useEffect(() => {
    const host = shell.current;
    const element = canvas.current;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const image = new Image();
    let field = null;
    let disposed = false;
    let frame = 0;
    let previousTime = 0;
    let animationTime = 0;
    const cursor = {
      x: 0.5,
      y: 0.5,
      tx: 0.5,
      ty: 0.5,
      vx: 0,
      vy: 0,
      energy: 0,
    };
    let dark = document.documentElement.dataset.theme === 'dark';
    const themeObserver = new MutationObserver(() => {
      dark = document.documentElement.dataset.theme === 'dark';
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
    }
    function draw(stamp) {
      frame = requestAnimationFrame(draw);
      if (stamp - previousTime < 32) return;
      const dt = previousTime
        ? Math.min((stamp - previousTime) / 1000, 0.08)
        : 1 / 30;
      previousTime = stamp;
      animationTime += dt;
      const smoothing = 1 - Math.exp(-dt * 6.5);
      cursor.x += (cursor.tx - cursor.x) * smoothing;
      cursor.y += (cursor.ty - cursor.y) * smoothing;
      cursor.vx *= Math.exp(-dt * 3.4);
      cursor.vy *= Math.exp(-dt * 3.4);
      cursor.energy *= Math.exp(-dt * 1.65);
      field?.draw({ ...cursor, time: animationTime, dark });
    }
    function sync() {
      stop();
      const running = field && !document.hidden && !media.matches;
      host.classList.toggle('fq-ink--gl', Boolean(field && !media.matches));
      if (running) frame = requestAnimationFrame(draw);
    }
    function resize() {
      const bounds = host.getBoundingClientRect();
      field?.resize(Math.max(1, bounds.width), Math.max(1, bounds.height));
    }
    function initialize() {
      if (disposed || !image.naturalWidth || field || media.matches) return;
      field = createInkField(element, image);
      resize();
      sync();
    }
    function motionPreference() {
      if (!media.matches) initialize();
      sync();
    }
    function track(event) {
      if (media.matches) return;
      const x = clamp(event.clientX / Math.max(window.innerWidth, 1), 0, 1);
      const y = clamp(event.clientY / Math.max(window.innerHeight, 1), 0, 1);
      const dx = x - cursor.tx;
      const dy = y - cursor.ty;
      cursor.tx = x;
      cursor.ty = y;
      cursor.vx = clamp(cursor.vx + dx * 7, -1, 1);
      cursor.vy = clamp(cursor.vy + dy * 7, -1, 1);
      cursor.energy = clamp(cursor.energy + Math.hypot(dx, dy) * 5, 0, 1);
      if (!field) {
        host.style.setProperty('--flow-x', `${(x - 0.5) * 26}px`);
        host.style.setProperty('--flow-y', `${(y - 0.5) * 18}px`);
      }
    }
    function contextLost(event) {
      // preventDefault allows the browser to restore the context; retain a static
      // photographic fallback while the GPU resources are unavailable.
      event.preventDefault();
      stop();
      field = null;
      host.classList.remove('fq-ink--gl');
    }
    element.addEventListener('webglcontextlost', contextLost);
    element.addEventListener('webglcontextrestored', initialize);
    image.onload = initialize;
    image.src = imagePath;
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    window.addEventListener('pointermove', track, { passive: true });
    window.addEventListener('pointerdown', track, { passive: true });
    document.addEventListener('visibilitychange', sync);
    media.addEventListener('change', motionPreference);

    return () => {
      disposed = true;
      stop();
      image.onload = null;
      field?.dispose();
      observer.disconnect();
      themeObserver.disconnect();
      window.removeEventListener('pointermove', track);
      window.removeEventListener('pointerdown', track);
      document.removeEventListener('visibilitychange', sync);
      media.removeEventListener('change', motionPreference);
      element.removeEventListener('webglcontextlost', contextLost);
      element.removeEventListener('webglcontextrestored', initialize);
    };
  }, []);

  return (
    <div className="fq-ink" ref={shell} aria-hidden="true">
      <div className="fq-ink__photo fq-ink__photo--left" />
      <div className="fq-ink__photo fq-ink__photo--right" />
      <canvas ref={canvas} className="fq-ink__field" />
    </div>
  );
}
