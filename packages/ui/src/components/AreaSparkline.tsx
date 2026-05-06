import type { SVGProps } from 'react';

export interface AreaSparklineProps extends Omit<SVGProps<SVGSVGElement>, 'values'> {
  values: number[];
  height?: number;
  width?: number;
  stroke?: string;
}

export function AreaSparkline({ values, height = 60, width = 400, stroke = 'var(--positive)', ...rest }: AreaSparklineProps) {
  if (values.length < 2) return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} {...rest} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const pts = values.map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`).join(' ');
  const polyId = `area-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" {...rest}>
      <defs>
        <linearGradient id={polyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={stroke} strokeWidth={2} points={pts} />
      <polygon fill={`url(#${polyId})`} points={`${pts} ${width},${height} 0,${height}`} />
    </svg>
  );
}
