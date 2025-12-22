
export interface Item {
  id: string;          // Maps to "Item Number"
  name: string;        // Maps to "Description" or "Full Name"
  category: string;    // Default to 'General' if not provided
  unit: string;        // Maps to "UM"
  
  // New Extended Fields
  secondId?: string;       // "2nd Item Number"
  thirdId?: string;        // "3rd Item Number"
  description2?: string;   // "Description Line 2"
  fullName?: string;       // "Full Name"
  oem?: string;            // "OEM"
  partNumber?: string;     // "Part No"
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

export type UserRole = 'admin' | 'warehouse_manager' | 'maintenance_manager' | 'maintenance_engineer' | 'warehouse_supervisor' | 'user';

export interface User {
  username: string;
  name: string;
  role: UserRole;
  email: string;
  password?: string; // In a real app, this would be hashed/handled by backend
}
