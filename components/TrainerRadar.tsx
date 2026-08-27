type Props = {
  clarity: number;
  effort: number;
  honesty: number;
  chaos: number;
};

const AXES = [
  { key: "clarity", short: "CLR" },
  { key: "effort", short: "EFF" },
  { key: "honesty", short: "HON" },
  { key: "chaos", short: "CHA" },
] as const;

/** Four-axis trainer radar for the dossier HUD. */
export function TrainerRadar({ clarity, effort, honesty, chaos }: Props) {
  const values = { clarity, effort, honesty, chaos };
  const cx = 50;
  const cy = 50;
  const r = 32;

  const point = (index: number, value: number) => {
    const angle = (-Math.PI / 2) + (index * (Math.PI * 2)) / AXES.length;
    const t = Math.max(0, Math.min(100, value)) / 100;
    return {
      x: cx + Math.cos(angle) * r * t,
      y: cy + Math.sin(angle) * r * t,
    };
  };

  const poly = AXES.map((axis, i) => {
    const p = point(i, values[axis.key]);
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(" ");

  const ring = (scale: number) =>
    AXES.map((_, i) => {
      const angle = (-Math.PI / 2) + (i * (Math.PI * 2)) / AXES.length;
      const x = cx + Math.cos(angle) * r * scale;
      const y = cy + Math.sin(angle) * r * scale;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");

  return (
    <figure className="dossier-radar">
      <svg
        className="dossier-radar__svg"
        viewBox="0 0 100 100"
        role="img"
        aria-label={`Clarity ${clarity}, effort ${effort}, honesty ${honesty}, chaos ${chaos}`}
      >
        {[0.33, 0.66, 1].map((scale) => (
          <polygon
            key={scale}
            className="dossier-radar__grid"
            points={ring(scale)}
            fill="none"
          />
        ))}
        {AXES.map((_, i) => {
          const tip = point(i, 100);
          return (
            <line
              key={i}
              className="dossier-radar__axis"
              x1={cx}
              y1={cy}
              x2={tip.x}
              y2={tip.y}
            />
          );
        })}
        <polygon className="dossier-radar__plot" points={poly} />
        {AXES.map((axis, i) => {
          const tip = point(i, 108);
          return (
            <text
              key={axis.key}
              className="dossier-radar__label"
              x={tip.x}
              y={tip.y}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {axis.short}
            </text>
          );
        })}
      </svg>
    </figure>
  );
}
