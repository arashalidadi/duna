/**
 * Master-data contract types (Phase 3 — Customers, Ports, Yards) shared between
 * the API and the web client. Mirror the /customers, /ports and /yards endpoints.
 * All money/status values are surfaced through the API; the client never derives
 * operational metrics that do not exist.
 */

export interface CustomerListItem {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  type: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  country: string | null;
  taxId: string | null;
  currency: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CustomerDetail = CustomerListItem;

export interface PortListItem {
  id: string;
  code: string;
  name: string;
  country: string;
  city: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PortYardRef {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
}

export interface PortDetail extends PortListItem {
  yards: PortYardRef[];
}

export interface YardPortRef {
  id: string;
  code: string;
  name: string;
  country: string;
  city: string | null;
}

export interface YardListItem {
  id: string;
  portId: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  port: YardPortRef;
}

export type YardDetail = YardListItem;