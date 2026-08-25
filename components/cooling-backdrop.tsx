const racks = [
  { x: 12, y: 382, width: 132, height: 278 },
  { x: 154, y: 425, width: 112, height: 235 },
  { x: 1324, y: 405, width: 112, height: 255 },
  { x: 1446, y: 350, width: 142, height: 310 },
];

export function CoolingBackdrop() {
  return (
    <div className="cooling-backdrop" aria-hidden="true">
      <svg viewBox="0 0 1600 620" preserveAspectRatio="none" focusable="false">
        <defs>
          <linearGradient id="cooling-pipe-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1a8dab" />
            <stop offset="0.48" stopColor="#7cecff" />
            <stop offset="1" stopColor="#1181a5" />
          </linearGradient>
          <linearGradient id="rack-face-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#17495b" />
            <stop offset="1" stopColor="#041923" />
          </linearGradient>
          <radialGradient id="heat-halo">
            <stop offset="0" stopColor="#ff765c" stopOpacity=".42" />
            <stop offset="1" stopColor="#ff765c" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse className="cooling-heat-halo" cx="795" cy="492" rx="245" ry="150" fill="url(#heat-halo)" />

        <g className="cooling-pipes">
          <path className="cooling-pipe-shadow" d="M-80 525 C170 430 320 575 535 505 S905 420 1115 485 S1435 565 1680 455" />
          <path className="cooling-pipe-shell" d="M-80 525 C170 430 320 575 535 505 S905 420 1115 485 S1435 565 1680 455" />
          <path className="cooling-pipe-flow" d="M-80 525 C170 430 320 575 535 505 S905 420 1115 485 S1435 565 1680 455" />

          <path className="cooling-pipe-shadow cooling-pipe-shadow-thin" d="M115 660 C100 485 205 382 365 380 C548 378 590 232 760 214 C942 195 1012 330 1165 305 C1320 280 1375 165 1660 178" />
          <path className="cooling-pipe-shell cooling-pipe-shell-thin" d="M115 660 C100 485 205 382 365 380 C548 378 590 232 760 214 C942 195 1012 330 1165 305 C1320 280 1375 165 1660 178" />
          <path className="cooling-pipe-flow cooling-pipe-flow-reverse" d="M115 660 C100 485 205 382 365 380 C548 378 590 232 760 214 C942 195 1012 330 1165 305 C1320 280 1375 165 1660 178" />
        </g>

        <g className="cooling-server-farm">
          {racks.map((rack, rackIndex) => (
            <g className="cooling-rack" key={rack.x} transform={`translate(${rack.x} ${rack.y})`}>
              <rect className="cooling-rack-shell" width={rack.width} height={rack.height} rx="9" />
              <rect className="cooling-rack-rail" x="10" y="12" width={rack.width - 20} height={rack.height - 24} rx="5" />
              {Array.from({ length: 6 }, (_, slotIndex) => {
                const y = 24 + slotIndex * 37;
                return (
                  <g className="cooling-rack-slot" key={slotIndex}>
                    <rect x="20" y={y} width={rack.width - 40} height="24" rx="4" />
                    <circle className="cooling-led" cx={rack.width - 32} cy={y + 12} r="2.8" />
                    <circle className="cooling-led cooling-led-hot" cx={rack.width - 43} cy={y + 12} r="2.2" />
                  </g>
                );
              })}
              <path className="cooling-rack-water" d={`M${rack.width - 13} 18 V${rack.height - 18}`} />
              <circle className="cooling-rack-port" cx={rack.width - 13} cy="26" r="5" />
              <circle className="cooling-rack-port" cx={rack.width - 13} cy={rack.height - 26} r="5" />
              <rect className="cooling-rack-base" x="-8" y={rack.height - 7} width={rack.width + 16} height="14" rx="7" />
              <path className={`cooling-heat cooling-heat-${rackIndex + 1}`} d={`M${rack.width / 2 - 17} 2 C${rack.width / 2 - 45} -42 ${rack.width / 2 + 36} -62 ${rack.width / 2 + 5} -116`} />
            </g>
          ))}
        </g>

        <g className="cooling-fan" transform="translate(1170 425)">
          <circle r="82" />
          <circle r="17" />
          <path d="M0-15 C18-72 66-61 57-27 C48 1 19 7 0 0Z" />
          <path d="M13 8 C54 51 18 83-8 59 C-30 39-21 10-7-3Z" />
          <path d="M-13 8 C-69 22-81-24-46-36 C-17-46 2-23 7-8Z" />
        </g>

        <g className="cooling-current-dots">
          {Array.from({ length: 13 }, (_, index) => (
            <circle key={index} cx={430 + index * 61} cy={486 + Math.sin(index) * 26} r={index % 3 === 0 ? 4 : 2.4} />
          ))}
        </g>
      </svg>
    </div>
  );
}
