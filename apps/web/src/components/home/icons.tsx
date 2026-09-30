import React from 'react';
import {
  ArrowRight,
  Check,
  Globe,
  Mail,
  MapPin,
  Menu,
  Ship,
  X,
  Warehouse,
  Truck,
  FileText,
  DollarSign,
  FileCheck,
  Receipt,
  UserRound,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icon registry used by the marketing/home page. The page renders icons by
 * name so content stays declarative; add new keys here when the page grows.
 */
const ICONS: Record<string, LucideIcon> = {
  // Required 8 core icons
  'arrow-right': ArrowRight,
  x: X,
  ship: Ship,
  menu: Menu,
  'map-pin': MapPin,
  mail: Mail,
  globe: Globe,
  check: Check,

  // Services & Capabilities icon names configured in i18n messages
  warehouse: Warehouse,
  shipping: Truck,
  'file-text': FileText,
  'dollar-sign': DollarSign,
  'file-check': FileCheck,
  receipt: Receipt,
  'user-round': UserRound,
};

export type IconName = keyof typeof ICONS | string;

export const ICON_NAMES = Object.keys(ICONS);

export function isIconName(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(ICONS, value);
}

export interface IconProps {
  name: IconName;
  className?: string;
  size?: number | string;
  strokeWidth?: number;
}

export function Icon({ name, className, size, strokeWidth }: IconProps) {
  const Cmp = ICONS[name] || HelpCircle;
  return <Cmp className={className} size={size} strokeWidth={strokeWidth} />;
}
