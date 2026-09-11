import {
  LayoutDashboard,
  Container,
  Warehouse,
  ScanSearch,
  ClipboardList,
  ListChecks,
  Ship,
  Anchor,
  FileText,
  ScrollText,
  PackageOpen,
  Truck,
  Users,
  CreditCard,
  FileCheck,
  UserCircle,
  BarChart3,
  ShieldCheck,
  KeyRound,
  LockKeyhole,
  Building2,
  MapPin,
  type LucideIcon,
} from 'lucide-react';

export type NavItemStatus = 'implemented' | 'planned';

export interface NavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  status: NavItemStatus;
  description?: string;
  /** Only show this nav item if the current user holds this permission. */
  requiredPermission?: string;
  children?: NavItem[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        status: 'implemented',
        description: 'System overview and status',
        requiredPermission: 'dashboard:read',
      },
    ],
  },
  {
    title: 'Access Control',
    items: [
      {
        label: 'Users',
        href: '/users',
        icon: Users,
        status: 'implemented',
        description: 'Staff accounts, roles and access',
        requiredPermission: 'user:read',
      },
      {
        label: 'Roles',
        href: '/roles',
        icon: ShieldCheck,
        status: 'implemented',
        description: 'Role definitions and permissions',
        requiredPermission: 'role:read',
      },
      {
        label: 'Permissions',
        href: '/permissions',
        icon: KeyRound,
        status: 'implemented',
        description: 'Permission catalogue',
        requiredPermission: 'permission:read',
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        label: 'Settings',
        icon: LockKeyhole,
        status: 'planned',
        description: 'Settings, templates & controls',
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        label: 'Cargo',
        href: '/cargo',
        icon: Container,
        status: 'implemented',
        description: 'Cargo management',
        requiredPermission: 'cargo:read',
      },
      {
        label: 'Yard Inventory',
        href: '/yard-inventory',
        icon: Warehouse,
        status: 'implemented',
        description: 'Yard stock and slots',
        requiredPermission: 'yard-inventory:read',
      },
      {
        label: 'Inspection',
        href: '/inspections',
        icon: ScanSearch,
        status: 'implemented',
        description: 'Cargo inspections',
        requiredPermission: 'inspection:read',
      },
      {
        label: 'Load Lists',
        href: '/load-lists',
        icon: ListChecks,
        status: 'implemented',
        description: 'Manage vessel load lists',
        requiredPermission: 'load_list:read',
      },
      {
        label: 'Load Planning',
        icon: ClipboardList,
        status: 'planned',
        description: 'Plan vessel loadings',
      },
      {
        label: 'Actual Loading',
        href: '/actual-loading',
        icon: PackageOpen,
        status: 'implemented',
        description: 'Record actual loading',
        requiredPermission: 'actual_loading:read',
      },
      {
        label: 'Vessels',
        href: '/vessels',
        icon: Ship,
        status: 'implemented',
        description: 'Vessel master data',
        requiredPermission: 'vessel:read',
      },
      {
        label: 'Voyages',
        href: '/voyages',
        icon: Anchor,
        status: 'implemented',
        description: 'Voyage management',
        requiredPermission: 'voyage:read',
      },
      { label: 'Manifest', icon: FileText, status: 'planned', description: 'Cargo manifest' },
      {
        label: 'Bill of Lading',
        icon: ScrollText,
        status: 'planned',
        description: 'B/L documents',
      },
      {
        label: 'Discharge',
        icon: PackageOpen,
        status: 'planned',
        description: 'Discharge operations',
      },
      { label: 'Delivery Orders', icon: Truck, status: 'planned', description: 'Delivery orders' },
    ],
  },
  {
    title: 'Commercial',
    items: [
      { label: 'Jobs', icon: ClipboardList, status: 'planned', description: 'Job costing' },
      { label: 'Invoices', icon: FileCheck, status: 'planned', description: 'Billing & invoicing' },
      { label: 'Payments', icon: CreditCard, status: 'planned', description: 'Customer payments' },
      { label: 'Release', icon: FileCheck, status: 'planned', description: 'Release orders' },
      { label: 'Agents', icon: UserCircle, status: 'planned', description: 'Agent portal' },
    ],
  },
  {
    title: 'Master Data',
    items: [
      {
        label: 'Customers',
        href: '/customers',
        icon: Users,
        status: 'implemented',
        description: 'Customer master data',
        requiredPermission: 'customer:read',
      },
      {
        label: 'Ports',
        href: '/ports',
        icon: Building2,
        status: 'implemented',
        description: 'Ports and facilities',
        requiredPermission: 'port:read',
      },
      {
        label: 'Yards',
        href: '/yards',
        icon: MapPin,
        status: 'implemented',
        description: 'Yards within ports',
        requiredPermission: 'yard:read',
      },
    ],
  },
  {
    title: 'Insight & Control',
    items: [
      { label: 'Reports', icon: BarChart3, status: 'planned', description: 'Reporting & P&L' },
    ],
  },
];
