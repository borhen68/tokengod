const racks = [
  { x: 20, y: 420, width: 126, height: 240 },
  { x: 153, y: 458, width: 102, height: 202 },
  { x: 1352, y: 444, width: 102, height: 216 },
  { x: 1462, y: 402, width: 126, height: 258 },
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
        </defs>

        <g className="cooling-pipes">
          <path className="cooling-pipe-shadow" d="M-80 566 C195 516 368 590 602 552 S1018 508 1240 548 S1480 578 1680 528" />
          <path className="cooling-pipe-shell" d="M-80 566 C195 516 368 590 602 552 S1018 508 1240 548 S1480 578 1680 528" />
          <path className="cooling-pipe-flow" d="M-80 566 C195 516 368 590 602 552 S1018 508 1240 548 S1480 578 1680 528" />
        </g>

        <g className="cooling-server-farm">
          {racks.map((rack) => (
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
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
