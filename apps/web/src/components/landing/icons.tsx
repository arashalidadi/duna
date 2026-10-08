import {
  Activity,
  Anchor,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Container,
  ExternalLink,
  FileCheck,
  FileText,
  Forklift,
  Globe,
  Languages,
  Mail,
  MapPin,
  Menu,
  Phone,
  Receipt,
  Ship,
  ShieldCheck,
  Users,
  Wallet,
  Warehouse,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Icon registry for the public landing page.
 *
 * Icons are referenced by name from the message catalogues so that content stays
 * declarative and translators never touch code. Add a key here before using it
 * in `messages/{en,fa,ar}.json`.
 */
const ICONS: Record<string, LucideIcon> = {
  anchor: Anchor,
  ship: Ship,
  container: Container,
  globe: Globe,
  'shield-check': ShieldCheck,
  clock: Clock,
  'file-check': FileCheck,
  'file-text': FileText,
  receipt: Receipt,
  warehouse: Warehouse,
  'clipboard-check': ClipboardCheck,
  activity: Activity,
  wallet: Wallet,
  users: Users,
  phone: Phone,
  mail: Mail,
  'map-pin': MapPin,
  building: Building2,
  forklift: Forklift,
  languages: Languages,
  'chevron-down': ChevronDown,
  'external-link': ExternalLink,
  'arrow-right': ArrowRight,
  check: Check,
  menu: Menu,
  x: X,
};

/**
 * Icons whose meaning is directional. Within an RTL layout they are mirrored on
 * the horizontal axis (`scaleX(-1)`) so an "onward" arrow still points forward.
 */
const MIRRORED_IN_RTL = new Set(['arrow-right']);

export type IconName = string;

export interface IconProps {
  name: IconName;
  className?: string;
  /** Stroke weight — landing icons default to a light 1.6 for an editorial feel. */
  strokeWidth?: number;
  'aria-hidden'?: boolean;
}

export function Icon({ name, className, strokeWidth = 1.6, ...rest }: IconProps) {
  const Cmp = ICONS[name] ?? Anchor;
  return (
    <Cmp
      className={cn(className, MIRRORED_IN_RTL.has(name) && 'rtl:-scale-x-100')}
      strokeWidth={strokeWidth}
      aria-hidden={rest['aria-hidden'] ?? true}
    />
  );
}
