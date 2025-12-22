import { Item, Machine, Location, IssueRecord } from './types';

export const LOCATIONS: Location[] = [
  { id: 'WH-001', name: 'Main Warehouse (Zone A)' },
  { id: 'WH-002', name: 'Assembly Line Buffer (Zone B)' },
  { id: 'WH-003', name: 'Cold Storage (Zone C)' },
  { id: 'WH-004', name: 'Maintenance Workshop' },
];

export const MACHINES: Machine[] = [
  { id: 'M-101', name: 'Conveyor Belt Alpha', model: 'CV-2000' },
  { id: 'M-102', name: 'Robotic Arm Bravo', model: 'KUKA-KR6' },
  { id: 'M-103', name: 'Packaging Unit Charlie', model: 'PAC-X1' },
  { id: 'M-104', name: 'CNC Lathe Delta', model: 'Mazak-500' },
  { id: 'M-105', name: 'Hydraulic Press Echo', model: 'HP-50T' },
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
