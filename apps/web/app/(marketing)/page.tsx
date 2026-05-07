import { Hero } from '@/components/marketing/Hero';
import { FeatureGrid } from '@/components/marketing/FeatureGrid';
import { LiveDemoWidget } from '@/components/marketing/LiveDemoWidget';

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureGrid />
      <LiveDemoWidget />
    </>
  );
}
