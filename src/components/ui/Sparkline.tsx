/**
 * Tiny dependency-free SVG sparkline (area + line). Server-renderable, no JS shipped — keeps the
 * dashboard light on the Raspberry Pi. Colour follows the trend (up = green, down = red).
 */
export function Sparkline({
  data,
  width = 240,
  height = 56,
  id = "spark",
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  id?: string;
  className?: string;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const pad = 3; // keep the stroke off the edges
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / span);

  const points = data.map((v, i) => `${(i * stepX).toFixed(1)},${y(v).toFixed(1)}`);
  const line = points.join(" ");
  const area = `0,${height} ${line} ${width},${height}`;
  const up = data[data.length - 1] >= data[0];
  const color = up ? "var(--color-up)" : "var(--color-down)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id}-fill)`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
