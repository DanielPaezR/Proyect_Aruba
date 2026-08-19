export const INVENTORY_ITEM_TYPES = ["HERRAMIENTA", "MATERIAL"] as const;
export type InventoryItemType = (typeof INVENTORY_ITEM_TYPES)[number];

export interface InventoryItem {
  id: string;
  name: string;
  type: InventoryItemType;
  unit: string;
  stockQuantity: number;
  lowStockThreshold: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const MATERIAL_REQUEST_STATUSES = ["PENDIENTE", "APROBADA", "RECHAZADA", "ENTREGADA"] as const;
export type MaterialRequestStatus = (typeof MATERIAL_REQUEST_STATUSES)[number];

export interface MaterialRequest {
  id: string;
  requestedById: string;
  requestedBy: { id: string; name: string; role: string };
  itemId: string | null;
  item: { id: string; name: string; unit: string; type: InventoryItemType } | null;
  itemNameFreeText: string | null;
  quantity: number;
  reason: string;
  status: MaterialRequestStatus;
  resolvedById: string | null;
  resolvedBy: { id: string; name: string } | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

export interface ToolAssignment {
  id: string;
  itemId: string;
  item: { id: string; name: string; unit: string; type: InventoryItemType };
  userId: string;
  user: { id: string; name: string };
  assignedAt: string;
  returnedAt: string | null;
  condition: string | null;
}

export const TOOL_INCIDENT_TYPES = ["DANIO", "PERDIDA"] as const;
export type ToolIncidentType = (typeof TOOL_INCIDENT_TYPES)[number];

export interface ToolIncidentReport {
  id: string;
  toolAssignmentId: string;
  toolAssignment: {
    id: string;
    item: { id: string; name: string };
    user: { id: string; name: string };
  };
  reportedById: string;
  reportedBy: { id: string; name: string };
  type: ToolIncidentType;
  description: string;
  reportedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
}
