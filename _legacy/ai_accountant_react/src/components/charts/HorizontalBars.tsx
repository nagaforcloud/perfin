import { fmt } from '@/lib/utils';
import { color } from './theme';

interface DataItem {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  data: DataItem[];
  maxItems?: number;
}

/**
 * Editorial ranked list — like a broadsheet sidebar chart.
 * Numeric rank, label, hairline bar with ink fill, mono value.
 */
export function HorizontalBars({ data, maxItems = 10 }: Props) {
  const items = data.slice(0, maxItems);
  const max = Math.max(...items.map((d) => d.value), 1);

  return (
    <div className="flex flex-col">
      {items.map((item, i) => {
        const c = item.color || color(i);
        const pct = (item.value / max) * 100;
        return (
          <div
            key={item.label}
            className="flex items-center gap-3 py-2"
            style={{
              borderBottom: i === items.length - 1 ? 'none' : '1px dotted rgba(26,24,20,0.18)',
            }}
          >
            <span
              className="font-serif italic shrink-0 text-right"
              style={{ width: 18, fontSize: 12, color: '#A89680' }}
            >
              {i + 1}.
            </span>
            <div
              className="w-32 truncate shrink-0 font-serif"
              style={{ fontSize: 13, color: '#1A1814' }}
              title={item.label}
            >
              {item.label}
            </div>
            <div
              className="flex-1 overflow-hidden relative"
              style={{ background: 'rgba(26,24,20,0.06)', height: 6, borderRadius: 0 }}
            >
              <div
                className="h-full"
                style={{ width: `${pct}%`, background: c }}
              />
            </div>
            <div
              className="fin text-right shrink-0"
              style={{ width: 74, fontSize: 11.5, fontWeight: 600, color: '#1A1814' }}
            >
              {fmt(item.value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
