import {
  Zap, Flame, Dog, Waves, Leaf, Users, Footprints, Bike, Sailboat, Fish,
  Tent, Caravan, Home, User, Baby, Car, Recycle, Landmark, type LucideIcon,
} from 'lucide-react';

// Named imports blijven tree-shakeable. Content verwijst met een string naar
// een icoon; dit is de enige plek waar die namen aan componenten koppelen.
const MAP: Record<string, LucideIcon> = {
  Zap, Flame, Dog, Waves, Leaf, Users, Footprints, Bike, Sailboat, Fish,
  Tent, Caravan, Home, User, Baby, Car, Recycle, Landmark,
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = MAP[name] ?? Leaf;
  return <Cmp className={className} aria-hidden="true" />;
}
