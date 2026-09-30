/** Phase 2 party-master types shared between API and web client. */

/** Compact reference used in list rows. */
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

export interface AgentDestinationRef {
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
  } | null;
}

/** Destination list item (use when listing an agent's destinations). */
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

export interface PaginatedShippersResult {
  data: ShipperListItem[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface PaginatedConsigneesResult {
  data: ConsigneeListItem[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface PaginatedAgentsResult {
  data: AgentListItem[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface PaginatedAgentDestinationsResult {
  data: AgentDestinationListItem[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
