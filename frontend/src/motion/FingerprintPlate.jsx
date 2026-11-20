import React, { useEffect, useId, useRef, useState } from 'react';
import './fingerprint.css';

const ART = '/art';

// Coordinates are in the specimen's viewBox, so the leader lines and print scale together.
function CalibrationMarks() {
  const ticks = [];
  for (let i = 0; i <= 26; i += 1) {
    const y = 42 + i * 12;
    ticks.push(<path key={i} d={`M14 ${y} h${i % 5 === 0 ? 11 : 5}`} />);
  }
  return (
    <g
      fill="none"
      stroke="currentColor"
      className="fq-plate__calibration"
      strokeWidth="1.2"
    >
      {ticks}
      <path d="M40 25h12m-6-6v12M588 25h12m-6-6v12M40 356h12m-6-6v12M588 356h12m-6-6v12" />
    </g>
  );
}

function ScanGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M3 7V3h4m6 0h4v4m0 6v4h-4m-6 0H3v-4M2.5 10h15" />
    </svg>
  );
}

export default function FingerprintPlate({ theme = 'light' }) {
  const key = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const grid = `fq-grid-${key}`;
  const specimenId = `fq-impression-${key}`;
  const blueInk = `fq-blue-ink-${key}`;
  const lensId = `fq-lens-${key}`;
  const plate = useRef(null);
  const lens = useRef(null);
  const magnifiedPrint = useRef(null);
  const scanTimer = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => () => window.clearTimeout(scanTimer.current), []);

  function inspect() {
    if (scanning) return;
    setMessage('Scanning the illustrative specimen.');
    setScanning(true);
    scanTimer.current = window.setTimeout(() => {
      setScanning(false);
      setMessage('Specimen scan complete.');
    }, 1500);
  }

  function trackPointer(event) {
    if (event.pointerType === 'touch' || !plate.current) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    plate.current.style.setProperty('--specimen-x', `${x * 9}px`);
    plate.current.style.setProperty('--specimen-y', `${y * 6}px`);
    const sx = (x + 0.5) * 640;
    const sy = (y + 0.5) * 382;
    // The optical loupe appears only over the impression, leaving callouts unobstructed.
    const overPrint = ((sx - 315) / 108) ** 2 + ((sy - 187) / 164) ** 2 < 1;
    lens.current?.classList.toggle('fq-plate__loupe--active', overPrint);
    if (overPrint) {
      lens.current?.setAttribute('transform', `translate(${sx} ${sy})`);
      magnifiedPrint.current?.setAttribute(
        'transform',
        `scale(1.7) translate(${-sx} ${-sy})`,
      );
    }
  }

  function center() {
    lens.current?.classList.remove('fq-plate__loupe--active');
    plate.current?.style.removeProperty('--specimen-x');
    plate.current?.style.removeProperty('--specimen-y');
  }

  return (
    <div
      className={`fq-plate${scanning ? ' fq-plate--scanning' : ''}`}
      ref={plate}
      onPointerMove={trackPointer}
      onPointerLeave={center}
    >
      <button
        type="button"
        className="fq-plate__surface"
        onClick={inspect}
        aria-label="Run a visual scan of the illustrative fingerprint"
      >
        <svg
          className="fq-plate__diagram"
          viewBox="0 0 640 382"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <pattern
              id={grid}
              width="26"
              height="26"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M26 0H0v26"
                fill="none"
                stroke="currentColor"
                strokeWidth=".8"
              />
              <circle r=".95" fill="currentColor" />
            </pattern>
            <filter id={blueInk} colorInterpolationFilters="sRGB">
              {/* Preserve density and transparency while developing the light-mode ridges in blue ink. */}
              <feColorMatrix type="matrix" values="
                0.14  0  0  0  0.025
                0.36  0  0  0  0.055
                0.48  0  0  0  0.16
                0     0  0  1  0"
              />
            </filter>
            <clipPath id={lensId}>
              <circle r="39" />
            </clipPath>
            <g id={specimenId} transform="rotate(13 316 188)">
              <image
                href={`${ART}/${theme === 'dark' ? 'latent-print-phosphor.png' : 'latent-print.png'}`}
                filter={theme === 'dark' ? undefined : `url(#${blueInk})`}
                x="194"
                y="2"
                width="245"
                height="376"
              />
            </g>
          </defs>
          <rect
            width="640"
            height="382"
            fill={`url(#${grid})`}
            className="fq-plate__grid"
          />
          <g fill="none" stroke="currentColor" className="fq-plate__registration">
            <circle cx="316" cy="187" r="139" strokeDasharray="1 7" />
            <path d="M67 31h32m4 0h11m4 0h5m425 320h23m4 0h9" strokeWidth="2" />
          </g>
          <CalibrationMarks />
          <g className="fq-plate__stage">
            <use className="fq-plate__specimen" href={`#${specimenId}`} />
            <g
              className="fq-plate__annotation"
              stroke="currentColor"
              fill="none"
            >
              <path d="M88 105h76l62 29" />
              <circle cx="229" cy="136" r="5" />
              <path d="M322 168l100-59h86" />
              <circle cx="317" cy="172" r="7.5" />
            </g>
            <g className="fq-plate__type" fill="currentColor">
              <text x="88" y="96">
                Ridge flow
              </text>
              <text x="429" y="100">
                Whorl core
              </text>
            </g>
            <g
              className="fq-plate__target"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            >
              <path d="M194 72V55h17m210 0h17v17m0 226v17h-17m-210 0h-17v-17" />
            </g>
          </g>
          <g
            ref={lens}
            className="fq-plate__loupe"
            transform="translate(317 172)"
          >
            <g clipPath={`url(#${lensId})`}>
              <circle r="39.5" fill="var(--plate-paper)" />
              <use ref={magnifiedPrint} href={`#${specimenId}`} />
            </g>
            <circle
              r="40"
              fill="none"
              stroke="var(--plate-target)"
              strokeWidth="1.2"
            />
            <path
              d="M-43 0h6m74 0h6M0-43v6m0 74v6"
              fill="none"
              stroke="var(--plate-target)"
              strokeWidth="1.5"
            />
          </g>
        </svg>
        <span className="fq-plate__sweep" aria-hidden="true">
          <i />
        </span>
        <span className="fq-plate__action" aria-hidden="true">
          <ScanGlyph />
          {scanning ? 'Scanning…' : 'Scan print'}
        </span>
      </button>
      <span className="fq-plate__sr" role="status" aria-live="polite">
        {message}
      </span>
    </div>
  );
}
