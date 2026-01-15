
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
  brand?: string;          // "Brand"
  oem?: string;            // "OEM"
  partNumber?: string;     // "Part No"
  modelNo?: string;        // "Model No (طراز المعده)" - NEW
  stockQuantity?: number;  // Current Warehouse Stock
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
  machineLocalNo?: string; 
  status: 'Working' | 'Not Working' | 'Outside Maintenance'; // Renamed from name
  chaseNo: string;       // Renamed from model (Chase No)
  modelNo?: string;    // "Model No (طراز المعده)"
  divisionId?: string; 
  locationId?: string; // NEW
  sectorId?: string;   // NEW
  
  // New Classification Fields
  mainGroup?: string;
  subGroup?: string;
  category?: string;   // Maps to "إسم المعدة" (Equipment Name) - Effectively the Machine Name now
  brand?: string;
}

export interface Location {
  id: string;
  name: string;
  email?: string; // Contact email for this location/site
}

export interface MaintenancePlan {
  id: string;
  name: string; // e.g., "Preventive Maintenance", "Periodic Maintenance"
}

export interface IssueRecord {
  id: string;
  timestamp: string; // ISO string
  locationId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit?: string; // Added Unit
  machineId: string;
  machineName: string;
  sectorName?: string;
  divisionName?: string;
  maintenancePlan?: string; // The selected maintenance plan name
  status: 'Pending' | 'Approved' | 'Completed' | 'Rejected';
  notes?: string; // For rejection reasons or approval comments
  warehouseEmail?: string;
  requesterEmail?: string;
}

export interface BreakdownRecord {
  id: string;
  machineId: string;
  machineName: string;
  locationId: string; // Required for filtering/context
  sectorId?: string;
  divisionId?: string; // Added
  machineLocalNo?: string; // Added
  
  startTime: string; // ISO String
  endTime?: string; // ISO String (nullable if open)
  
  failureType: string; // e.g., Mechanical, Electrical
  operatorName: string;
  
  rootCause?: string;
  actionTaken?: string;
  
  status: 'Open' | 'Closed';
}

// NEW: BOM Record
export interface BOMRecord {
  id: string;
  machineCategory: string; // Machine Name
  modelNo: string;         // Machine Model
  itemId: string;          // Link to Item Master
  quantity: number;        // Standard Qty per unit
  notes?: string;
}

// NEW: Agri Work Order Record
export interface AgriOrderRecord {
  id: string;
  date: string;
  branch: string; // الفرع / Location
  tractor: string; // موديل الجرار
  machineLocalNo: string; // محلي رقم
  attached: string; // المعدة الملحقة
  attachedLocalNo: string; // محلي رقم (attached)
  department: string; // الادارة
  pivot: string; // رقم البيفوت
  driver: string; // اسم السائق
  
  startCounter: number;
  endCounter: number;
  rowNumber: string;
  
  unitType: string; // يومية / فدان (Unit)
  achievement: number; // الانجاز
  actualOrReturn: number; // الاعادة او الفعلي
  calculated: number; // الانجاز الحسابي
  timeSpent: number; // الزمن / ساعة
  
  notes: string;
  sector?: string; // قطاع (Data Out)
  services?: string; // الخدمات (Data Out)
}

export interface IrrigationLogRecord {
  id: string;
  date: string;
  locationName: string;
  generatorModel: string;
  engineStart: number;
  engineEnd: number;
  totalHours: number;
  notes?: string;
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
  allowedLocationIds?: string[]; // Array of Location IDs this user is permitted to create issues for
  allowedSectorIds?: string[];   // Array of Sector IDs
  allowedDivisionIds?: string[]; // Array of Division IDs
}
