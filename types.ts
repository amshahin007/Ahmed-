export interface Item {
  id: string;
  name: string;
  category: string;
  unit: string;
}

export interface Machine {
  id: string;
  name: string;
  model: string;
}

export interface Location {
  id: string;
  name: string;
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
  status: 'Pending' | 'Approved' | 'Completed';
}

export interface DashboardMetrics {
  totalIssues: number;
  topItem: string;
  topMachine: string;
  recentActivity: number; // Count in last 24h
}
