import React, { useState, useEffect, useRef } from 'react';
import { Item, Machine, Location, Sector, Division, User, IssueRecord } from '../types';
import SearchableSelect from './SearchableSelect';
import { fetchItemsFromSheet, DEFAULT_SHEET_ID, DEFAULT_ITEMS_GID, extractSheetIdFromUrl, extractGidFromUrl, APP_SCRIPT_TEMPLATE, sendIssueToSheet, parseCSVLine } from '../services/googleSheetsService';

interface MasterDataProps {
  history: IssueRecord[];
  items: Item[];
  machines: Machine[];
  locations: Location[];
  sectors: Sector[];
  divisions: Division[];
  users: User[];
  
  onAddItem: (item: Item) => void;
  onAddMachine: (machine: Machine) => void;
  onAddLocation: (location: Location) => void;
  onAddSector: (sector: Sector) => void;
  onAddDivision: (division: Division) => void;
  onAddUser: (user: User) => void;

  onUpdateItem: (item: Item) => void;
  onUpdateMachine: (machine: Machine) => void;
  onUpdateLocation: (location: Location) => void;
  onUpdateSector: (sector: Sector) => void;
  onUpdateDivision: (division: Division) => void;
  onUpdateUser: (user: User) => void;

  onDeleteItem: (itemId: string) => void;
}

type TabType = 'items' | 'machines' | 'locations' | 'sectors' | 'divisions' | 'users';

const ITEMS_PER_PAGE = 80;

// Base configuration for columns
const COLUMNS_CONFIG: Record<TabType, { key: string, label: string }[]> = {
  items: [
    { key: 'id', label: 'Item Number' },
    { key: 'thirdId', label: '3rd Item No' },
    { key: 'name', label: 'Description' },
    { key: 'description2', label: 'Desc Line 2' },
    { key: 'fullName', label: 'Full Name' },
    { key: 'category', label: 'Category' },
    { key: 'brand', label: 'Brand / Manufacturer' },
    { key: 'oem', label: 'OEM' },
    { key: 'partNumber', label: 'Part No' },
    { key: 'unit', label: 'UM' }
  ],
  machines: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'model', label: 'Model' },
    { key: 'mainGroup', label: 'Main Group' },
    { key: 'subGroup', label: 'Sub Group' },
    { key: 'category', label: 'Category' },
    { key: 'brand', label: 'Brand / Manufacturer' },
    { key: 'divisionId', label: 'Division' }
  ],
  locations: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Site Email' }
  ],
  sectors: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' }
  ],
  divisions: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'sectorId', label: 'Parent Sector' }
  ],
  users: [
    { key: 'username', label: 'Username' },
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'email', label: 'Email' },
    { key: 'allowedLocationIds', label: 'Locations' }
  ]
};

const MasterData: React.FC<MasterDataProps> = ({ 
  history, items, machines, locations, sectors, divisions, users,
  onAddItem, onAddMachine, onAddLocation, onAddSector, onAddDivision, onAddUser,
  onUpdateItem, onUpdateMachine, onUpdateLocation, onUpdateSector, onUpdateDivision, onUpdateUser,
  onDeleteItem
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('items');
  const [showForm, setShowForm] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  
  // File Import Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Sync State
  const [sheetId, setSheetId] = useState(localStorage.getItem('wf_sheet_id') || DEFAULT_SHE