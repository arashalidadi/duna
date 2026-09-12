import { Anchor, BarChart3, BookOpen, Building2, ClipboardList, Container, CreditCard, FileCheck, FileText, KeyRound, LayoutDashboard, ListChecks, LockKeyhole, MapPin, PackageOpen, ScanSearch, ScrollText, ShieldCheck, Ship, Truck, UserCircle, Users, Warehouse, type LucideIcon } from 'lucide-react';

export type NavItemStatus = 'implemented' | 'planned';

export interface NavItem {
  /** Translation key under the "nav" namespace */
  labelKey: string;
  href?: string;
  icon: LucideIcon;
  status: NavItemStatus;
  description?: string;
  /** Only show this nav item if the current user holds this permission. */
  requiredPermission?: string;
  children?: NavItem[];
}

export interface NavSection {
  /** Translation key under the "nav" namespace */
  titleKey: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: 'overview',
    items: [
      {
        labelKey: 'dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        status: 'implemented',
        description: 'System overview and status',
        requiredPermission: 'dashboard:read',
      },
    ],
  },
  {
    titleKey: 'accessControl',
    items: [
      {
        labelKey: 'users',
        href: '/users',
        icon: Users,
        status: 'implemented',
        description: 'Staff accounts, roles and access',
        requiredPermission: 'user:read',
      },
      {
        labelKey: 'roles',
        href: '/roles',
        icon: ShieldCheck,
        status: 'implemented',
        description: 'Role definitions and permissions',
        requiredPermission: 'role:read',
      },
      {
        labelKey: 'permissions',
        href: '/permissions',
        icon: KeyRound,
        status: 'implemented',
        description: 'Permission catalogue',
        requiredPermission: 'permission:read',
      },
    ],
  },
  {
    titleKey: 'administration',
    items: [
      {
        labelKey: 'settings',
        icon: LockKeyhole,
        status: 'planned',
        description: 'Settings, templates & controls',
      },
    ],
  },
  {
    titleKey: 'operations',
    items: [
      {
        labelKey: 'cargo',
        href: '/cargo',
        icon: Container,
        status: 'implemented',
        description: 'Cargo management',
        requiredPermission: 'cargo:read',
      },
      {
        labelKey: 'yardInventory',
        href: '/yard-inventory',
        icon: Warehouse,
        status: 'implemented',
        description: 'Yard stock and slots',
        requiredPermission: 'yard-inventory:read',
      },
      {
        labelKey: 'inspection',
        href: '/inspections',
        icon: ScanSearch,
        status: 'implemented',
        description: 'Cargo inspections',
        requiredPermission: 'inspection:read',
      },
      {
        labelKey: 'loadLists',
        href: '/load-lists',
        icon: ListChecks,
        status: 'implemented',
        description: 'Manage vessel load lists',
        requiredPermission: 'load_list:read',
      },
      {
        labelKey: 'loadPlanning',
        icon: ClipboardList,
        status: 'planned',
        description: 'Plan vessel loadings',
      },
      {
        labelKey: 'actualLoading',
        href: '/actual-loading',
        icon: PackageOpen,
        status: 'implemented',
        description: 'Record actual loading',
        requiredPermission: 'actual_loading:read',
      },
      {
        labelKey: 'vessels',
        href: '/vessels',
        icon: Ship,
        status: 'implemented',
        description: 'Vessel master data',
        requiredPermission: 'vessel:read',
      },
      {
        labelKey: 'voyages',
        href: '/voyages',
        icon: Anchor,
        status: 'implemented',
        description: 'Voyage management',
        requiredPermission: 'voyage:read',
      },
      {
        labelKey: 'manifest',
        href: '/manifest',
        icon: FileText,
        status: 'implemented',
        description: 'Cargo manifest',
        requiredPermission: 'manifest:read',
      },
      {
        labelKey: 'billOfLading',
        href: '/bills',
        icon: ScrollText,
        status: 'implemented',
        description: 'B/L documents',
        requiredPermission: 'bill:read',
      },
      {
        labelKey: 'discharge',
        icon: PackageOpen,
        status: 'planned',
        description: 'Discharge operations',
      },
      { labelKey: 'deliveryOrders', icon: Truck, status: 'planned', description: 'Delivery orders' },
    ],
  },
  {
    titleKey: 'commercial',
    items: [
      { labelKey: 'jobs', icon: ClipboardList, status: 'planned', description: 'Job costing' },
      {
        labelKey: 'invoices',
        href: '/invoices',
        icon: FileCheck,
        status: 'implemented',
        description: 'Billing & invoicing',
        requiredPermission: 'invoice:read',
      },
      {
        labelKey: 'vouchers',
        href: '/vouchers',
        icon: CreditCard,
        status: 'implemented',
        description: 'Receipt & payment vouchers',
        requiredPermission: 'voucher:read',
      },
      {
        labelKey: 'ledger',
        href: '/ledger',
        icon: BookOpen,
        status: 'implemented',
        description: 'Customer statements / ledger',
        requiredPermission: 'ledger:read',
      },
      {
        labelKey: 'delivery',
        href: '/delivery-orders',
        icon: Truck,
        status: 'implemented',
        description: 'Delivery orders (D/O)',
        requiredPermission: 'delivery:read',
      },
      {
        labelKey: 'release',
        href: '/release-orders',
        icon: FileCheck,
        status: 'implemented',
        description: 'Release orders (R/O)',
        requiredPermission: 'release:read',
      },
      { labelKey: 'agents', icon: UserCircle, status: 'planned', description: 'Agent portal' },
    ],
  },
  {
    titleKey: 'masterData',
    items: [
      {
        labelKey: 'customers',
        href: '/customers',
        icon: Users,
        status: 'implemented',
        description: 'Customer master data',
        requiredPermission: 'customer:read',
      },
      {
        labelKey: 'ports',
        href: '/ports',
        icon: Building2,
        status: 'implemented',
        description: 'Ports and facilities',
        requiredPermission: 'port:read',
      },
      {
        labelKey: 'yards',
        href: '/yards',
        icon: MapPin,
        status: 'implemented',
        description: 'Yards within ports',
        requiredPermission: 'yard:read',
      },
    ],
  },
  {
    titleKey: 'insightControl',
    items: [
      { labelKey: 'reports', icon: BarChart3, status: 'planned', description: 'Reporting & P&L' },
    ],
  },
];
