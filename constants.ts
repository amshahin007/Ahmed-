import { Item, Machine, Location, IssueRecord, Sector, Division, User } from './types';

export const USERS: User[] = [
  { 
    username: 'admin', 
    name: 'Warehouse Manager', 
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

export const MACHINES: Machine[] = [
  { id: 'M-101', name: 'Conveyor Belt Alpha', model: 'CV-2000', divisionId: 'DIV-001' },
  { id: 'M-102', name: 'Robotic Arm Bravo', model: 'KUKA-KR6', divisionId: 'DIV-002' },
  { id: 'M-103', name: 'Packaging Unit Charlie', model: 'PAC-X1', divisionId: 'DIV-003' },
  { id: 'M-104', name: 'CNC Lathe Delta', model: 'Mazak-500', divisionId: 'DIV-001' },
  { id: 'M-105', name: 'Hydraulic Press Echo', model: 'HP-50T', divisionId: 'DIV-002' },
];

export const ITEMS: Item[] = [
  { id: 'ITM-001', name: 'Ball Bearing 50mm', category: 'Spare Parts', unit: 'pcs' },
  { id: 'ITM-002', name: 'Hydraulic Fluid 5L', category: 'Consumables', unit: 'can' },
  { id: 'ITM-003', name: 'M10 Stainless Bolt', category: 'Fasteners', unit: 'box' },
  { id: 'ITM-004', name: 'Rubber Seal Ring', category: 'Spare Parts', unit: 'pcs' },
  { id: 'ITM-005', name: 'Safety Gloves (L)', category: 'PPE', unit: 'pair' },
  { id: 'ITM-006', name: 'Circuit Board PCB-X', category: 'Electronics', unit: 'pcs' },
  { id: 'ITM-007', name: 'Lubricant Spray', category: 'Consumables', unit: 'can' },
  { id: 'ITM-008', name: 'V-Belt B45', category: 'Spare Parts', unit: 'pcs' },
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
    status: 'Pending'
  },
];