import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Stat, Sparkline, AreaSparkline, AITile } from '../src/index';

describe('Stat', () => {
  it('renders label and value', () => {
    render(<Stat label="INCOME" value="$8,240" />);
    expect(screen.getByText('INCOME')).toBeInTheDocument();
    expect(screen.getByText('$8,240')).toBeInTheDocument();
  });
  it('renders delta when provided', () => {
    render(<Stat label="X" value="$1" deltaText="+4.2%" deltaTone="income" />);
    expect(screen.getByText('+4.2%')).toBeInTheDocument();
  });
});

describe('Sparkline', () => {
  it('renders an SVG of the right dimensions', () => {
    render(<Sparkline data-testid="s" values={[1, 2, 3, 4]} />);
    const svg = screen.getByTestId('s');
    expect(svg.tagName).toBe('svg');
    expect(svg.getAttribute('viewBox')).toMatch(/0 0 \d+ \d+/);
  });
});

describe('AreaSparkline', () => {
  it('renders polyline + filled polygon', () => {
    render(<AreaSparkline data-testid="a" values={[1, 2, 3]} />);
    const svg = screen.getByTestId('a');
    expect(svg.querySelector('polyline')).toBeTruthy();
    expect(svg.querySelector('polygon')).toBeTruthy();
  });
});

describe('AITile', () => {
  it('renders headline + body + actions', () => {
    render(
      <AITile headline="Today's insight" body="Things look good." actions={<button>OK</button>} />,
    );
    expect(screen.getByText(/Today's insight/)).toBeInTheDocument();
    expect(screen.getByText('Things look good.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });
});
