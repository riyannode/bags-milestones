/**
 * Subtle constellation backdrop inspired by Aura Protocol —
 * fixed-seed nodes connected by thin lines. Pure SVG, no JS.
 *
 * Used on the landing hero. `aria-hidden` because it is purely
 * decorative.
 */
export function Constellation({ className = "" }: { className?: string }) {
  // Hand-picked node coordinates on a 100x60 viewBox. Symmetrical-ish
  // graph that reads as a "network of holders."
  const nodes: ReadonlyArray<readonly [number, number, number]> = [
    [10, 14, 1.4],
    [22, 8, 0.9],
    [34, 18, 1.1],
    [48, 6, 1.3],
    [60, 16, 0.8],
    [72, 9, 1],
    [86, 18, 1.2],
    [16, 30, 0.9],
    [30, 36, 1.4],
    [44, 30, 1],
    [56, 38, 0.9],
    [70, 32, 1.3],
    [84, 38, 1],
    [12, 50, 1],
    [28, 54, 0.8],
    [42, 48, 1.2],
    [58, 56, 1],
    [74, 50, 0.9],
    [90, 54, 1.3],
  ];

  // Connections between node indices (sparse network look).
  const edges: ReadonlyArray<readonly [number, number]> = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [0, 7],
    [7, 8],
    [2, 8],
    [3, 9],
    [9, 10],
    [4, 10],
    [10, 11],
    [11, 12],
    [6, 12],
    [7, 13],
    [13, 14],
    [8, 14],
    [9, 15],
    [14, 15],
    [15, 16],
    [10, 16],
    [11, 17],
    [16, 17],
    [12, 17],
    [17, 18],
  ];

  return (
    <svg
      viewBox="0 0 100 60"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={`pointer-events-none ${className}`}
    >
      <defs>
        <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#9DFF3D" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#9DFF3D" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g stroke="rgba(157,255,61,0.12)" strokeWidth="0.08" fill="none">
        {edges.map(([a, b], i) => {
          const [x1, y1] = nodes[a];
          const [x2, y2] = nodes[b];
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>

      <g>
        {nodes.map(([x, y, r], i) => (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r={r * 0.9}
              fill="url(#node-glow)"
              opacity="0.55"
            />
            <circle
              cx={x}
              cy={y}
              r={0.35}
              fill="#9DFF3D"
              className="animate-twinkle"
              style={{ animationDelay: `${(i % 7) * 0.45}s` }}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
