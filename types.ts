
export interface Item {
  id: string;
  name: string;
  category: string;
  unit: string;
}

export interface Sector {
  id: string;
  name: string;
}

export interface Division {
  id: string;
  name: string;
  sectorId: string;
}

export interface Machine {
  id: string;
  name: string;
  model: string;
  divisionId?: string; // Optional for backward compatibility, but used for filtering
}

export interface Location {
  id: string;
  name: string;
  email?: string; // Contact email for this location/site
}

export interface IssueRecord {
  id: string;
  timestamp: string; // ISO string
  locationId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  machineId: string;
  machineName: string;
  sectorName?: string;
  divisionName?: string;
  status: 'Pending' | 'Approved' | 'Completed' | 'Rejected';
  notes?: string; // For rejection reasons or approval comments
  warehouseEmail?: string;
  requesterEmail?: string;
}

export interface DashboardMetrics {
  totalIssues: number;
  topItem: string;
  topMachine: string;
  recentActivity: number; // Count in last 24h
}

export type UserRole = 'admin' | 'user';

export interface User {
  username: string;
  name: string;
  role: UserRole;
  email: string;
  password?: string; // In a real app, this would be hashed/handled by backend
}
