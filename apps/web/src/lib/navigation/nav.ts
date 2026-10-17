import {
  Anchor,
  Archive,
  Banknote,
  Bell,
  BellRing,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CalendarCheck,
  ClipboardList,
  SlidersHorizontal,
  Container,
  CreditCard,
  FileCheck,
  FileText,
  Globe,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  Mail,
  MapPin,
  PackageMinus,
  PackageOpen,
  Quote,
  ScanSearch,
  ScrollText,
  ShieldCheck,
  Ship,
  Truck,
  UserCircle,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

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
  /** Hide office-only pages from accounts signed in through the external portal. */
  officeOnly?: boolean;
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
      { labelKey: 'notifications', href: '/notifications', icon: Bell, status: 'implemented',
        description: 'Office reminders', requiredPermission: 'notification:read' },
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
        href: '/settings',
        icon: LockKeyhole,
        status: 'implemented',
        description: 'Company identity, TRN and currencies',
        requiredPermission: 'settings:read',
      },
      {
        labelKey: 'rateManagement', href: '/currency-rates', icon: Globe,
        status: 'implemented', description: 'Currency rates and allocation policy',
        requiredPermission: 'currency_rate:read',
      },
      {
        labelKey: 'templates', href: '/templates', icon: FileText,
        status: 'implemented', description: 'Versioned document layouts and company artwork',
        requiredPermission: 'document:manage',
      },
      {
        labelKey: 'configuration', href: '/configuration', icon: SlidersHorizontal,
        status: 'implemented', description: 'Managed fields, document types and workflows',
        requiredPermission: 'configuration:manage',
      },
      { labelKey: 'notificationRules', href: '/notification-rules', icon: BellRing, status: 'implemented',
        description: 'Notification rules, delivery health and audit', requiredPermission: 'notification:manage' },
    ],
  },
  {
    titleKey: 'operations',
    items: [
      {
        labelKey: 'configuredDocuments', href: '/configured-documents', icon: FileText,
        status: 'implemented', description: 'Additional versioned office documents',
        requiredPermission: 'config_document:read',
      },
      {
        labelKey: 'jobs',
        href: '/jobs',
        icon: Briefcase,
        status: 'implemented',
        description: 'Job register with costing',
        requiredPermission: 'job:read',
      },
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
        labelKey: 'discharges',
        href: '/discharges',
        icon: PackageMinus,
        status: 'implemented',
        description: 'Record unloading at destination',
        requiredPermission: 'discharge:read',
      },
      {
        labelKey: 'bookings',
        href: '/bookings',
        icon: CalendarCheck,
        status: 'implemented',
        description: 'Agent booking desk',
        requiredPermission: 'booking:read',
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
      {
        labelKey: 'deliveryOrders',
        icon: Truck,
        status: 'planned',
        description: 'Delivery orders',
      },
    ],
  },
  {
    titleKey: 'commercial',
    items: [
      { labelKey: 'jobs', icon: ClipboardList, status: 'planned', description: 'Job costing' },
      {
        labelKey: 'quotations',
        href: '/quotations',
        icon: Quote,
        status: 'implemented',
        description: 'Quotations (price quotes)',
        requiredPermission: 'quotation:read',
      },
      {
        labelKey: 'proformas',
        href: '/proformas',
        icon: FileText,
        status: 'implemented',
        description: 'Proforma invoices (quotes)',
        requiredPermission: 'proforma:read',
      },
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
        description: 'Customer statements (derived)',
        requiredPermission: 'ledger:read',
      },
      {
        labelKey: 'generalLedger', href: '/accounting', icon: ScrollText,
        status: 'implemented', description: 'General journal and office expenses',
        requiredPermission: 'journal:read',
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
      // Phase 1: the stale `planned` "Agent portal" entry was removed here. The
      // Agent Portal is implemented — see the `portal` section below
      // (`labelKey: 'agentPortal'`, href `/portal`). This entry duplicated it,
      // shared the `agents` translation key with Agent master data, and could
      // never render: sidebar.tsx keeps an item only when it has an href or its
      // label is not already implemented. Agent master data (`/agents`) is a
      // separate, also-implemented item in the master-data section.
    ],
  },
  {
    titleKey: 'people',
    items: [
      {
        labelKey: 'employees',
        href: '/employees',
        icon: UserCircle,
        status: 'implemented',
        description: 'Employee master data',
        requiredPermission: 'employee:read',
      },
      {
        labelKey: 'salaryRecords',
        href: '/salary-records',
        icon: Banknote,
        status: 'implemented',
        description: 'Monthly payslips (draft/approve/pay)',
        requiredPermission: 'salary:read',
      },
    ],
  },
  {
    titleKey: 'correspondence',
    items: [
      {
        labelKey: 'letters',
        href: '/letters',
        icon: Mail,
        status: 'implemented',
        description: 'Official correspondence register',
        requiredPermission: 'letter:read',
      },
      {
        labelKey: 'archive', href: '/archive', icon: Archive,
        status: 'implemented', description: 'Permission-scoped correspondence archive and retention',
        requiredPermission: 'letter:read',
        officeOnly: true,
      },
    ],
  },
  {
    titleKey: 'portal',
    items: [
      {
        labelKey: 'agentPortal',
        href: '/portal',
        icon: Globe,
        status: 'implemented',
        description: 'Agent self-service portal',
        requiredPermission: 'portal:access',
      },
    ],
  },

  {
    titleKey: 'masterData',
    items: [
      {
        labelKey: 'shippers',
        href: '/shippers',
        icon: Building2,
        status: 'implemented',
        description: 'Shipper master data',
        requiredPermission: 'shipper:read',
      },
      {
        labelKey: 'consignees',
        href: '/consignees',
        icon: Building2,
        status: 'implemented',
        description: 'Consignee master data',
        requiredPermission: 'consignee:read',
      },
      {
        labelKey: 'agents',
        href: '/agents',
        icon: UserCircle,
        status: 'implemented',
        description: 'Agent master data and destinations',
        requiredPermission: 'agent:read',
      },
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
      { labelKey: 'reports', href: '/reports', icon: BarChart3, status: 'implemented',
        description: 'Permission-aware reports, P&L and report builder', requiredPermission: 'report:read' },
      { labelKey: 'auditTrail', href: '/audit', icon: ScrollText, status: 'implemented',
        description: 'Read-only audit trail; export requires a separate permission',
        requiredPermission: 'audit:read' },
    ],
  },
];

/** Shared operational order for the sidebar and overview. */
export const NAV_SECTION_ORDER = [
  'overview',
  'operations',
  'commercial',
  'masterData',
  'people',
  'correspondence',
  'portal',
  'accessControl',
  'administration',
  'insightControl',
];
