import type { SVGProps } from 'react';

export interface SparklineProps extends Omit<SVGProps<SVGSVGElement>, 'values'> {
  values: number[];
  height?: number;
  width?: number;
  stroke?: string;
}

export function Sparkline({ values, height = 30, width = 200, stroke = 'var(--accent)', ...rest }: SparklineProps) {
  if (!values.length) return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} {...rest} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / Math.max(1, values.length - 1);
  const points = values
    .map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`)
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" {...rest}>
      <polyline fill="none" stroke={stroke} strokeWidth={2} points={points} />
    </svg>
  );
}
