import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Button, Tile, Input, Field, Badge, Skeleton, Toast, Modal,
} from '../src/index';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('applies primary variant by default', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-accent');
  });

  it('applies secondary variant when set', () => {
    render(<Button variant="secondary">Go</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-surface-2');
  });

  it('applies size classes', () => {
    render(<Button size="lg">Go</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-12');
  });

  it('forwards extra className', () => {
    render(<Button className="custom-x">Go</Button>);
    expect(screen.getByRole('button')).toHaveClass('custom-x');
  });

  it('respects disabled state', () => {
    render(<Button disabled>Go</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('Tile', () => {
  it('renders children', () => {
    render(<Tile>hello</Tile>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('uses surface bg by default', () => {
    render(<Tile data-testid="t">x</Tile>);
    expect(screen.getByTestId('t')).toHaveClass('bg-surface');
  });

  it('hero variant uses larger padding', () => {
    render(<Tile data-testid="t" variant="hero">x</Tile>);
    expect(screen.getByTestId('t')).toHaveClass('p-6');
  });

  it('raised variant has surface-2 bg and shadow', () => {
    render(<Tile data-testid="t" variant="raised">x</Tile>);
    expect(screen.getByTestId('t')).toHaveClass('bg-surface-2');
    expect(screen.getByTestId('t')).toHaveClass('shadow-1');
  });
});

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Email" />);
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  });

  it('exposes h-10 token class', () => {
    render(<Input data-testid="i" />);
    expect(screen.getByTestId('i')).toHaveClass('h-10');
  });
});

describe('Field', () => {
  it('renders label and hint', () => {
    render(
      <Field label="Email" hint="We'll never share it">
        <Input data-testid="i" />
      </Field>,
    );
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText("We'll never share it")).toBeInTheDocument();
  });

  it('renders error in place of hint', () => {
    render(
      <Field label="Email" hint="hint" error="bad email">
        <Input data-testid="i" />
      </Field>,
    );
    expect(screen.getByText('bad email')).toBeInTheDocument();
    expect(screen.queryByText('hint')).not.toBeInTheDocument();
  });
});

describe('Badge', () => {
  it('renders text', () => {
    render(<Badge>Income</Badge>);
    expect(screen.getByText('Income')).toBeInTheDocument();
  });

  it('income variant uses positive-soft bg', () => {
    render(<Badge variant="income">x</Badge>);
    expect(screen.getByText('x')).toHaveClass('bg-positive-soft');
  });

  it('expense variant uses negative-soft bg', () => {
    render(<Badge variant="expense">x</Badge>);
    expect(screen.getByText('x')).toHaveClass('bg-negative-soft');
  });

  it('warning, info, accent, neutral all render', () => {
    render(<><Badge variant="warning">w</Badge><Badge variant="info">i</Badge><Badge variant="accent">a</Badge><Badge variant="neutral">n</Badge></>);
    expect(screen.getByText('w')).toHaveClass('bg-warning-soft');
    expect(screen.getByText('i')).toHaveClass('bg-info-soft');
    expect(screen.getByText('a')).toHaveClass('bg-accent-soft');
    expect(screen.getByText('n')).toHaveClass('bg-surface-3');
  });
});

describe('Skeleton', () => {
  it('renders with skeleton class for animation', () => {
    render(<Skeleton data-testid="s" />);
    expect(screen.getByTestId('s')).toHaveClass('skeleton');
  });

  it('row variant default sizing', () => {
    render(<Skeleton data-testid="s" variant="row" />);
    expect(screen.getByTestId('s')).toHaveClass('h-4');
  });

  it('tile variant is taller', () => {
    render(<Skeleton data-testid="s" variant="tile" />);
    expect(screen.getByTestId('s')).toHaveClass('h-32');
  });
});

describe('Toast', () => {
  it('renders title and description', () => {
    render(<Toast title="Saved" description="All good" />);
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('uses info stripe by default', () => {
    render(<Toast data-testid="t" title="x" />);
    expect(screen.getByTestId('t')).toHaveClass('border-l-info');
  });

  it('error tone uses negative stripe', () => {
    render(<Toast data-testid="t" title="x" tone="error" />);
    expect(screen.getByTestId('t')).toHaveClass('border-l-negative');
  });
});

describe('Modal', () => {
  it('renders content when open', () => {
    render(
      <Modal open onOpenChange={() => undefined} title="Hi">
        <p>body content</p>
      </Modal>,
    );
    expect(screen.getByText('Hi')).toBeInTheDocument();
    expect(screen.getByText('body content')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(
      <Modal open={false} onOpenChange={() => undefined} title="Hi">
        <p>body content</p>
      </Modal>,
    );
    expect(screen.queryByText('body content')).not.toBeInTheDocument();
  });
});
