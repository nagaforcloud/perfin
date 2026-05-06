import { Tile, Button, Field } from '@perfin/ui';
import { saveLocaleAction } from './actions';

export default function LocalePage() {
  return (
    <Tile variant="hero" className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Pick your currency</h1>
        <p className="text-sm text-text-muted">You can change this later in Settings.</p>
      </header>
      <form action={saveLocaleAction} className="space-y-4">
        <Field label="Currency" htmlFor="currency">
          <select
            id="currency"
            name="currency"
            defaultValue="INR"
            className="h-10 w-full px-3 rounded-md bg-surface-2 border border-border-strong text-text"
          >
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
          </select>
        </Field>
        <Button type="submit" size="lg" className="w-full">Continue</Button>
      </form>
    </Tile>
  );
}
