
import { Item, Machine, Location, IssueRecord, Sector, Division, User, MaintenancePlan, BreakdownRecord, PurchaseOrder, MaintenanceTask, MaintenanceSchedule, MaintenanceWorkOrder } from './types';

export const USERS: User[] = [
  { 
    username: 'admin', 
    name: 'Admin Manager', 
    role: 'admin', 
    email: 'admin@wareflow.com',
    password: 'admin' 
  },
  { 
    username: 'operator', 
    name: 'Site Operator', 
    role: 'user', 
    email: 'operator@site.com',
    password: 'user' 
  },
  { 
    username: 'warehouse_mgr', 
    name: 'Warehouse Mgr.', 
    role: 'warehouse_manager', 
    email: 'wm@site.com',
    password: 'user' 
  },
  { 
    username: 'warehouse_sup', 
    name: 'Warehouse Sup.', 
    role: 'warehouse_supervisor', 
    email: 'ws@site.com',
    password: 'user' 
  },
  { 
    username: 'maint_mgr', 
    name: 'Maintenance Mgr.', 
    role: 'maintenance_manager', 
    email: 'mm@site.com',
    password: 'user' 
  },
  { 
    username: 'maint_eng', 
    name: 'Maint. Engineer', 
    role: 'maintenance_engineer', 
    email: 'me@site.com',
    password: 'user' 
  }
];

export const LOCATIONS: Location[] = [
  { id: 'WH-001', name: 'Main Warehouse (Zone A)', email: 'zone.a@site.com' },
  { id: 'WH-002', name: 'Assembly Line Buffer (Zone B)', email: 'zone.b@site.com' },
  { id: 'WH-003', name: 'Cold Storage (Zone C)', email: 'cold.store@site.com' },
  { id: 'WH-004', name: 'Maintenance Workshop', email: 'workshop@site.com' },
];

export const SECTORS: Sector[] = [
  { id: 'SEC-001', name: 'Production' },
  { id: 'SEC-002', name: 'Packaging' },
  { id: 'SEC-003', name: 'Utilities' },
];

export const DIVISIONS: Division[] = [
  { id: 'DIV-001', name: 'Machinery 1 (Heavy)', sectorId: 'SEC-001' },
  { id: 'DIV-002', name: 'Machinery 2 (Light)', sectorId: 'SEC-001' },
  { id: 'DIV-003', name: 'Final Pack Line', sectorId: 'SEC-002' },
  { id: 'DIV-004', name: 'Power Plant', sectorId: 'SEC-003' },
];

export const MAINTENANCE_PLANS: MaintenancePlan[] = [
  { id: 'MP-001', name: 'Periodic Maintenance (صيانة دورية)' },
  { id: 'MP-002', name: 'Preventive Maintenance (صيانة وقائية)' },
  { id: 'MP-003', name: 'Sudden Breakdown (صيانة اعطال فجائية)' },
  { id: 'MP-004', name: 'Repair Maintenance (صيانة اصلاح)' },
  { id: 'MP-005', name: 'Overhauls (عمرات)' },
  { id: 'MP-006', name: 'Annual Maintenance (صيانة سنوية)' },
  { id: 'MP-007', name: 'Investment Project (مشروع استثماري)' },
];

export const MACHINES: Machine[] = [
  { id: 'M-101', category: 'Conveyor Belt Alpha', status: 'Working', chaseNo: 'CV-2000', divisionId: 'DIV-001', brand: 'Cat', modelNo: 'V100' },
  { id: 'M-102', category: 'Robotic Arm Bravo', status: 'Working', chaseNo: 'KUKA-KR6', divisionId: 'DIV-002', brand: 'Kuka', modelNo: 'KR6' },
  { id: 'M-103', category: 'Packaging Unit Charlie', status: 'Not Working', chaseNo: 'PAC-X1', divisionId: 'DIV-003', brand: 'PackMaster', modelNo: 'X1' },
  { id: 'M-104', category: 'CNC Lathe Delta', status: 'Outside Maintenance', chaseNo: 'Mazak-500', divisionId: 'DIV-001', brand: 'Mazak', modelNo: '500' },
  { id: 'M-105', category: 'Hydraulic Press Echo', status: 'Working', chaseNo: 'HP-50T', divisionId: 'DIV-002', brand: 'Hydra', modelNo: '50T' },
];

export const ITEMS: Item[] = [
  { 
    id: 'ITM-001', name: 'Ball Bearing 50mm', category: 'Spare Parts', unit: 'pcs', stockQuantity: 150,
    minStock: 50, maxStock: 300, reorderPoint: 80, leadTimeDays: 7, preferredSupplier: 'Bearings Inc.', 
    criticality: 'High', abcClass: 'A', status: 'Active', unitCost: 25, annualUsage: 1200
  },
  { 
    id: 'ITM-002', name: 'Hydraulic Fluid 5L', category: 'Consumables', unit: 'can', stockQuantity: 45,
    minStock: 20, maxStock: 100, reorderPoint: 40, leadTimeDays: 3, preferredSupplier: 'Fluids Co.', 
    criticality: 'Medium', abcClass: 'B', status: 'Active', unitCost: 15, annualUsage: 400
  },
  { 
    id: 'ITM-003', name: 'M10 Stainless Bolt', category: 'Fasteners', unit: 'box', stockQuantity: 500,
    minStock: 200, maxStock: 1000, reorderPoint: 300, leadTimeDays: 2, preferredSupplier: 'Fastener World', 
    criticality: 'Low', abcClass: 'C', status: 'Active', unitCost: 5, annualUsage: 2000
  },
  { 
    id: 'ITM-004', name: 'Rubber Seal Ring', category: 'Spare Parts', unit: 'pcs', stockQuantity: 200,
    minStock: 100, maxStock: 500, reorderPoint: 150, leadTimeDays: 14, preferredSupplier: 'Seals Direct', 
    criticality: 'Medium', abcClass: 'B', status: 'Active', unitCost: 2, annualUsage: 1000
  },
  { 
    id: 'ITM-005', name: 'Safety Gloves (L)', category: 'PPE', unit: 'pair', stockQuantity: 100,
    minStock: 50, maxStock: 200, reorderPoint: 80, leadTimeDays: 5, preferredSupplier: 'Safety First', 
    criticality: 'Low', abcClass: 'C', status: 'Active', unitCost: 3, annualUsage: 600
  },
  { 
    id: 'ITM-006', name: 'Circuit Board PCB-X', category: 'Electronics', unit: 'pcs', stockQuantity: 12,
    minStock: 5, maxStock: 20, reorderPoint: 8, leadTimeDays: 30, preferredSupplier: 'Tech Components', 
    criticality: 'High', abcClass: 'A', status: 'Active', unitCost: 250, annualUsage: 60
  },
  { 
    id: 'ITM-007', name: 'Lubricant Spray', category: 'Consumables', unit: 'can', stockQuantity: 60,
    minStock: 20, maxStock: 100, reorderPoint: 30, leadTimeDays: 4, preferredSupplier: 'Fluids Co.', 
    criticality: 'Low', abcClass: 'C', status: 'Active', unitCost: 8, annualUsage: 300
  },
  { 
    id: 'ITM-008', name: 'V-Belt B45', category: 'Spare Parts', unit: 'pcs', stockQuantity: 30,
    minStock: 10, maxStock: 50, reorderPoint: 15, leadTimeDays: 10, preferredSupplier: 'Belts & Hoses', 
    criticality: 'Medium', abcClass: 'B', status: 'Active', unitCost: 18, annualUsage: 150
  },
];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  { id: 'PO-2024-001', supplier: 'Bearings Inc.', itemId: 'ITM-001', orderedQuantity: 50, expectedDeliveryDate: new Date(Date.now() + 86400000 * 2).toISOString(), status: 'Open' },
  { id: 'PO-2024-002', supplier: 'Tech Components', itemId: 'ITM-006', orderedQuantity: 5, expectedDeliveryDate: new Date(Date.now() + 86400000 * 15).toISOString(), status: 'Open' },
];

// Initial mock history
export const INITIAL_HISTORY: IssueRecord[] = [
  {
    id: 'ISS-1001',
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    locationId: 'WH-001',
    itemId: 'ITM-001',
    itemName: 'Ball Bearing 50mm',
    quantity: 4,
    machineId: 'M-101',
    machineName: 'Conveyor Belt Alpha',
    maintenancePlan: 'Periodic Maintenance (صيانة دورية)',
    status: 'Completed'
  },
  {
    id: 'ISS-1002',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    locationId: 'WH-004',
    itemId: 'ITM-007',
    itemName: 'Lubricant Spray',
    quantity: 2,
    machineId: 'M-104',
    machineName: 'CNC Lathe Delta',
    maintenancePlan: 'Preventive Maintenance (صيانة وقائية)',
    status: 'Approved'
  },
  {
    id: 'ISS-1003',
    timestamp: new Date().toISOString(),
    locationId: 'WH-002',
    itemId: 'ITM-002',
    itemName: 'Hydraulic Fluid 5L',
    quantity: 1,
    machineId: 'M-105',
    machineName: 'Hydraulic Press Echo',
    maintenancePlan: 'Sudden Breakdown (صيانة اعطال فجائية)',
    status: 'Pending'
  },
];

export const INITIAL_BREAKDOWNS: BreakdownRecord[] = [
  {
    id: 'BD-2024-001',
    machineId: 'M-103',
    machineName: 'Packaging Unit Charlie',
    locationId: 'WH-002',
    startTime: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    failureType: 'Mechanical',
    operatorName: 'Ahmed Ali',
    status: 'Open'
  },
  {
    id: 'BD-2024-000',
    machineId: 'M-101',
    machineName: 'Conveyor Belt Alpha',
    locationId: 'WH-001',
    startTime: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    endTime: new Date(Date.now() - 1000 * 60 * 60 * 46).toISOString(),
    failureType: 'Electrical',
    operatorName: 'Sarah John',
    rootCause: 'Fuse Blown',
    actionTaken: 'Replaced Fuse',
    status: 'Closed'
  }
];

// --- MAINTENANCE PLANNING MOCK DATA ---

export const INITIAL_TASKS: MaintenanceTask[] = [
  {
    id: 'TSK-001',
    description: 'Quarterly Conveyor Inspection',
    type: 'Preventive',
    machineId: 'M-101',
    machineName: 'Conveyor Belt Alpha',
    requiredMroItems: [{ itemId: 'ITM-007', quantity: 1 }],
    standardDurationHours: 4,
    requiredSkills: 'Mechanical Level 2',
    priority: 'Medium',
    defaultLocationId: 'WH-001',
    status: 'Active'
  },
  {
    id: 'TSK-002',
    description: 'Robotic Arm Calibration',
    type: 'Preventive',
    machineId: 'M-102',
    machineName: 'Robotic Arm Bravo',
    requiredMroItems: [{ itemId: 'ITM-002', quantity: 2 }],
    standardDurationHours: 6,
    requiredSkills: 'Electrical Level 3',
    priority: 'High',
    defaultLocationId: 'WH-002',
    status: 'Active'
  }
];

export const INITIAL_SCHEDULES: MaintenanceSchedule[] = [
  {
    id: 'SCH-2025-001',
    taskId: 'TSK-001',
    machineId: 'M-101',
    locationId: 'WH-001',
    plannedStartDate: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 days from now
    plannedEndDate: new Date(Date.now() + 86400000 * 3 + 14400000).toISOString(), // +4 hours
    frequency: 'Quarterly',
    assignedTechnician: 'Ahmed Ali',
    checkMroAvailability: true,
    status: 'Planned'
  }
];

export const INITIAL_MAINTENANCE_WOS: MaintenanceWorkOrder[] = [
  {
    id: 'WO-2025-1001',
    taskId: 'TSK-001',
    machineId: 'M-101',
    locationId: 'WH-001',
    type: 'Preventive',
    plannedDate: new Date(Date.now() + 86400000).toISOString(),
    plannedDurationHours: 4,
    mroItemsReserved: true,
    mroItemsConsumed: [],
    status: 'Released'
  },
  {
    id: 'WO-2025-1002', // Corrective from breakdown
    taskId: 'TSK-000-CORR',
    machineId: 'M-103',
    locationId: 'WH-002',
    type: 'Corrective',
    plannedDate: new Date(Date.now()).toISOString(),
    plannedDurationHours: 2,
    mroItemsReserved: false,
    mroItemsConsumed: [],
    status: 'Draft',
    rootCause: 'Motor Overheat'
  }
];
