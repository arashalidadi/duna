/**
 * Phase 2 party-master types (Shipper, Consignee, Agent, AgentDestination).
 * Shared between API and web client.
 */

export interface ShipperListItem {
  id: string;
  code: string;
  name: string;
  taxId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ShipperDetail = ShipperListItem;

export interface ConsigneeListItem {
  id: string;
  code: string;
  name: string;
  taxId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ConsigneeDetail = ConsigneeListItem;

export interface AgentListItem {
  id: string;
  code: string;
  name: string;
  taxId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AgentDetail = AgentListItem & {
  destinations: AgentDestinationListItem[];
};

export interface AgentDestinationListItem {
  id: string;
  agentId: string;
  portId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  port: {
    id: string;
    name: string;
    code: string;
  };
}

export interface PaginatedShipperResult {
  data: ShipperListItem[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface PaginatedConsigneeResult {
  data: ConsigneeListItem[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface PaginatedAgentResult {
  data: AgentListItem[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface PaginatedAgentDestinationResult {
  data: AgentDestinationListItem[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
