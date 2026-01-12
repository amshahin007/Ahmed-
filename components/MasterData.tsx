
import React, { useState, useEffect, useRef } from 'react';
import { Item, Machine, Location, Sector, Division, User, IssueRecord, MaintenancePlan } from '../types';
import SearchableSelect from './SearchableSelect';
import { fetchRawCSV, DEFAULT_SHEET_ID, DEFAULT_ITEMS_GID, extractSheetIdFromUrl, extractGidFromUrl, APP_SCRIPT_TEMPLATE, sendIssueToSheet } from '../services/googleSheetsService';
import * as XLSX from 'xlsx';

interface MasterDataProps {
  history: IssueRecord[];
  items: Item[];
  machines: Machine[];
  locations: Location[];
  sectors: Sector[];
  divisions: Division[];
  plans: MaintenancePlan[];
  users: User[];
  
  onAddItem: (item: Item) => void;
  onAddMachine: (machine: Machine) => void;
  onAddLocation: (location: Location) => void;
  onAddSector: (sector: Sector) => void;
  onAddDivision: (division: Division) => void;
  onAddPlan: (plan: MaintenancePlan) => void;
  onAddUser: (user: User) => void;

  onUpdateItem: (item: Item) => void;
  onUpdateMachine: (machine: Machine) => void;
  onUpdateLocation: (location: Location) => void;
  onUpdateSector: (sector: Sector) => void;
  onUpdateDivision: (division: Division) => void;
  onUpdatePlan: (plan: MaintenancePlan) => void;
  onUpdateUser: (user: User) => void;

  onDeleteItems: (ids: string[]) => void;
  onDeleteMachines: (ids: string[]) => void;
  onDeleteLocations: (ids: string[]) => void;
  onDeleteSectors: (ids: string[]) => void;
  onDeleteDivisions: (ids: string[]) => void;
  onDeletePlans: (ids: string[]) => void;
  onDeleteUsers: (usernames: string[]) => void;

  onBulkImport: (tab: string, added: any[], updated: any[]) => void;
}

type TabType = 'items' | 'machines' | 'locations' | 'sectors' | 'divisions' | 'users' | 'plans';

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
    { key: 'brand', label: 'Brand' },
    { key: 'modelNo', label: 'Model No (طراز)' },
    { key: 'oem', label: 'OEM' },
    { key: 'partNumber', label: 'Part No' },
    { key: 'unit', label: 'UM' }
  ],
  machines: [
    { key: 'id', label: 'ID' },
    { key: 'machineLocalNo', label: 'Machine Local No' },
    { key: 'status', label: 'Status' }, 
    { key: 'chaseNo', label: 'Chase No' }, 
    { key: 'modelNo', label: 'Model No (طراز)' },
    { key: 'category', label: 'إسم المعدة' },
    { key: 'mainGroup', label: 'Main Group' },
    { key: 'subGroup', label: 'Sub Group' },
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
  plans: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Plan Name' }
  ],
  users: [
    { key: 'username', label: 'Username' },
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'email', label: 'Email' },
    { key: 'allowedLocationIds', label: 'Locations' },
    { key: 'allowedSectorIds', label: 'Sectors' },
    { key: 'allowedDivisionIds', label: 'Divisions' }
  ]
};

const MasterData: React.FC<MasterDataProps> = ({ 
  history, items, machines, locations, sectors, divisions, plans, users,
  onAddItem, onAddMachine, onAddLocation, onAddSector, onAddDivision, onAddPlan, onAddUser,
  onUpdateItem, onUpdateMachine, onUpdateLocation, onUpdateSector, onUpdateDivision, onUpdatePlan, onUpdateUser,
  onDeleteItems, onDeleteMachines, onDeleteLocations, onDeleteSectors, onDeleteDivisions, onDeletePlans, onDeleteUsers,
  onBulkImport
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('items');
  const [showForm, setShowForm] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Processing State for Uploads
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);

  // File Import Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Sync State
  const [sheetId, setSheetId] = useState(localStorage.getItem('wf_sheet_id') || DEFAULT_SHEET_ID);
  
  // Manage GIDs per Tab
  const [tabGids, setTabGids] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('wf_tab_gids');
    const initial = saved ? JSON.parse(saved) : {};
    // Ensure Items GID has default if not present
    if (!initial['items']) initial['items'] = DEFAULT_ITEMS_GID;
    return initial;
  });

  const [scriptUrl, setScriptUrl] = useState(localStorage.getItem('wf_script_url') || '');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // Column Management State
  const [columnSettings, setColumnSettings] = useState<Record<TabType, { key: string; label: string; visible: boolean }[]>>(() => {
    const defaults: Record<string, any> = {};
    (Object.keys(COLUMNS_CONFIG) as TabType[]).forEach(tab => {
      defaults[tab] = COLUMNS_CONFIG[tab].map(c => ({ ...c, visible: true }));
    });
    const saved = localStorage.getItem('wf_column_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const merged: Record<string, any> = { ...defaults };
        Object.keys(defaults).forEach(key => {
            if (parsed[key]) {
                const savedKeys = new Set(parsed[key].map((c: any) => c.key));
                const updatedSavedColumns = parsed[key].map((savedCol: any) => {
                    const freshCol = defaults[key].find((d: any) => d.key === savedCol.key);
                    return freshCol ? { ...savedCol, label: freshCol.label } : savedCol;
                });
                const newColumns = defaults[key].filter((c: any) => !savedKeys.has(c.key));
                merged[key] = [...updatedSavedColumns, ...newColumns];
            }
        });
        return merged;
      } catch (e) {
        console.error("Failed to load column settings", e);
      }
    }
    return defaults;
  });

  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Save config when changed
  useEffect(() => { localStorage.setItem('wf_sheet_id', sheetId); }, [sheetId]);
  useEffect(() => { localStorage.setItem('wf_tab_gids', JSON.stringify(tabGids)); }, [tabGids]);
  useEffect(() => { localStorage.setItem('wf_script_url', scriptUrl); }, [scriptUrl]);
  useEffect(() => { localStorage.setItem('wf_column_settings', JSON.stringify(columnSettings)); }, [columnSettings]);

  // Reset pagination and selection when tab changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [activeTab]);

  const handleSheetIdChange = (val: string) => {
    setSheetId(val);
    const extractedGid = extractGidFromUrl(val);
    if (extractedGid) {
        setTabGids(prev => ({ ...prev, [activeTab]: extractedGid }));
    }
  };
  
  const handleGidChange = (val: string) => {
      setTabGids(prev => ({ ...prev, [activeTab]: val }));
  };

  const handleResetDefaults = () => {
    setSheetId(DEFAULT_SHEET_ID);
    setTabGids(prev => ({ ...prev, items: DEFAULT_ITEMS_GID }));
    setSyncMsg('Defaults restored.');
  };

  const handleAddNew = () => {
    setFormData({});
    setIsEditing(false);
    setShowForm(true);
  };

  const handleEdit = (record: any) => {
    setFormData({ ...record });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleDeleteSingle = (id: string) => {
    if (confirm('Are you sure you want to remove this record?')) {
        handleDeleteImplementation([id]);
    }
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (confirm(`Are you sure you want to delete ${ids.length} records? This cannot be undone.`)) {
        handleDeleteImplementation(ids);
        setSelectedIds(new Set()); 
    }
  };

  const handleDeleteImplementation = (ids: string[]) => {
      switch (activeTab) {
        case 'items': onDeleteItems(ids); break;
        case 'machines': onDeleteMachines(ids); break;
        case 'locations': onDeleteLocations(ids); break;
        case 'sectors': onDeleteSectors(ids); break;
        case 'divisions': onDeleteDivisions(ids); break;
        case 'plans': onDeletePlans(ids); break;
        case 'users': onDeleteUsers(ids); break;
      }
  };

  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedIds(newSet);
  };

  const handleSelectAllPage = (pageItems: any[]) => {
      const allSelected = pageItems.every(item => selectedIds.has(item.id || item.username));
      const newSet = new Set(selectedIds);
      if (allSelected) {
          pageItems.forEach(item => newSet.delete(item.id || item.username));
      } else {
          pageItems.forEach(item => newSet.add(item.id || item.username));
      }
      setSelectedIds(newSet);
  };

  // Generalized Cloud Sync
  const handleSyncData = async () => {
    setSyncLoading(true);
    setSyncMsg(`Fetching ${activeTab} data...`);
    try {
      const cleanId = extractSheetIdFromUrl(sheetId);
      const currentGid = tabGids[activeTab] || '0';
      
      // Get Raw Rows (Array of strings)
      const rawRows = await fetchRawCSV(cleanId, currentGid);
      
      if (!rawRows || rawRows.length < 2) {
        setSyncMsg('No data found. Check ID/GID or if sheet is empty.');
      } else {
         // Reuse the existing robust import processor!
         // processImportData expects array of arrays (which rawRows is, mostly)
         // rawRows comes from parseCSVLine which returns string[]
         processImportData(rawRows);
         setSyncMsg(`Sync Complete! Check lists for updates.`);
      }
    } catch (e) {
      setSyncMsg('Error: ' + (e as Error).message);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleExportHistory = async () => {
    if (!scriptUrl) {
      setSyncMsg("Error: Please enter and save the Web App URL first.");
      return;
    }
    if (history.length === 0) {
      setSyncMsg("No history to export.");
      return;
    }
    if (!confirm(`Are you sure you want to export ${history.length} historical records to the Google Sheet?`)) return;

    setSyncLoading(true);
    setSyncMsg(`Starting export of ${history.length} records...`);
    
    let successCount = 0;
    for (let i = 0; i < history.length; i++) {
        const record = history[i];
        setSyncMsg(`Exporting ${i + 1}/${history.length}...`);
        try {
            await sendIssueToSheet(scriptUrl, record);
            successCount++;
            await new Promise(r => setTimeout(r, 600)); 
        } catch (e) {
            console.error(e);
        }
    }
    setSyncLoading(false);
    setSyncMsg(`Export Complete! Sent ${successCount} records.`);
  };

  const handleExportDataToExcel = (onlySelected: boolean = false) => {
    let headers: string[] = [];
    let rows: any[][] = [];
    const timestamp = new Date().toISOString().slice(0, 10);
    let data: any[] = [];
    
    switch (activeTab) {
      case 'items': data = items; break;
      case 'machines': data = machines; break;
      case 'locations': data = locations; break;
      case 'sectors': data = sectors; break;
      case 'divisions': data = divisions; break;
      case 'plans': data = plans; break;
      case 'users': data = users; break;
    }

    if (onlySelected && selectedIds.size > 0) {
        data = data.filter(d => selectedIds.has(d.id || d.username));
    }
    if (data.length === 0) {
        alert("No data to export.");
        return;
    }

    switch (activeTab) {
      case 'items':
        headers = ['Item Number', 'Description', 'Category', 'Unit', '3rd Item No', 'Desc Line 2', 'Full Name', 'Brand', 'OEM', 'Part No', 'Model No'];
        rows = data.map((i: Item) => [
            i.id, i.name, i.category, i.unit, 
            i.thirdId, i.description2, i.fullName, i.brand, i.oem, i.partNumber, i.modelNo
        ]);
        break;
      case 'machines':
        headers = ['ID', 'Machine Local No', 'Status', 'Chase No', 'Model No', 'Main Group', 'Sub Group', 'إسم المعدة', 'Brand', 'Division ID'];
        rows = data.map((m: Machine) => [
            m.id, m.machineLocalNo || '', m.status, m.chaseNo, m.modelNo,
            m.mainGroup, m.subGroup, m.category, m.brand, m.divisionId
        ]);
        break;
      case 'locations':
        headers = ['ID', 'Name', 'Email'];
        rows = data.map((l: Location) => [l.id, l.name, l.email]);
        break;
      case 'sectors':
        headers = ['ID', 'Name'];
        rows = data.map((s: Sector) => [s.id, s.name]);
        break;
      case 'divisions':
        headers = ['ID', 'Name', 'Sector ID'];
        rows = data.map((d: Division) => [d.id, d.name, d.sectorId]);
        break;
      case 'plans':
        headers = ['ID', 'Plan Name'];
        rows = data.map((p: MaintenancePlan) => [p.id, p.name]);
        break;
      case 'users':
        headers = ['Username', 'Name', 'Role', 'Email', 'Allowed Locations', 'Allowed Sectors', 'Allowed Divisions'];
        rows = data.map((u: User) => [
            u.username, u.name, u.role, u.email, 
            (u.allowedLocationIds || []).join(';'),
            (u.allowedSectorIds || []).join(';'),
            (u.allowedDivisionIds || []).join(';')
        ]);
        break;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "MasterData");
    XLSX.writeFile(wb, `WareFlow_${activeTab}_${onlySelected ? 'Selected' : 'All'}_${timestamp}.xlsx`);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProcessingStatus(`Reading ${file.name}...`);
    const reader = new FileReader();
    reader.onload = (e) => {
      setTimeout(() => {
        const data = e.target?.result;
        try {
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            
            if (jsonData.length > 2000) {
               setProcessingStatus(`Large file detected. Processing ${jsonData.length} rows... this may take a moment.`);
            } else {
               setProcessingStatus(`Analyzing ${jsonData.length} rows...`);
            }
            setTimeout(() => { processImportData(jsonData); }, 50);
        } catch (error) {
            console.error("Error parsing file:", error);
            setProcessingStatus(null);
            alert("Error parsing file. Please check format.");
        }
      }, 50);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const processImportData = (rows: any[][]) => {
    if (!rows || rows.length < 2) {
        setProcessingStatus(null);
        // Only alert if this came from a manual file import, to avoid annoying alerts on empty sheet syncs that might just need config
        if (processingStatus) alert("File/Sheet appears to be empty or contains no data rows.");
        return;
    }

    let headerRowIndex = -1;
    const primaryKeywords = activeTab === 'users' ? ['username', 'user'] : ['id', 'item number', 'item no', 'name', 'description'];
    
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const rowStr = rows[i].join(' ').toLowerCase();
        if (primaryKeywords.some(k => rowStr.includes(k))) {
            headerRowIndex = i;
            break;
        }
    }

    if (headerRowIndex === -1) headerRowIndex = 0; 

    const headers = rows[headerRowIndex].map(h => String(h).trim().toLowerCase());
    const dataRows = rows.slice(headerRowIndex + 1);

    let fieldMap: Record<string, string[]> = {};
    if (activeTab === 'items') {
        fieldMap = {
            id: ['item number', 'id', 'item no', 'code', 'item code'],
            name: ['description', 'name', 'item name', 'desc', 'material name'],
            category: ['category', 'cat', 'group'],
            unit: ['unit', 'um', 'uom', 'measure'],
            thirdId: ['3rd item no', '3rd item', 'third item'],
            description2: ['desc line 2', 'description 2', 'desc 2', 'spec'],
            fullName: ['full name', 'fullname', 'long description'],
            brand: ['brand', 'manufacturer', 'make'],
            oem: ['oem'],
            partNumber: ['part no', 'part number', 'pn', 'part num'],
            modelNo: ['model no', 'model', 'model number', 'طراز']
        };
    } else if (activeTab === 'machines') {
        fieldMap = {
            id: ['id', 'machine id', 'code'],
            machineLocalNo: ['local no', 'local number', 'local id', 'machine local no', 'asset no'],
            status: ['status', 'state', 'condition', 'name', 'machine name'], 
            chaseNo: ['chase no', 'chase number', 'model', 'model name'], 
            modelNo: ['model no', 'model number', 'طراز', 'type'],
            mainGroup: ['main group', 'group'],
            subGroup: ['sub group', 'subgroup'],
            category: ['category', 'إسم المعدة', 'equipment name'],
            brand: ['brand', 'manufacturer'],
            divisionId: ['division id', 'division', 'line']
        };
    } else if (activeTab === 'locations') {
        fieldMap = {
            id: ['id', 'location id', 'zone id'],
            name: ['name', 'location name', 'zone'],
            email: ['email', 'site email', 'contact']
        };
    } else if (activeTab === 'sectors') {
        fieldMap = { id: ['id'], name: ['name', 'sector name'] };
    } else if (activeTab === 'divisions') {
        fieldMap = { id: ['id'], name: ['name', 'division name'], sectorId: ['sector id', 'sector'] };
    } else if (activeTab === 'plans') {
        fieldMap = { id: ['id'], name: ['name', 'plan name', 'plan'] };
    } else if (activeTab === 'users') {
        fieldMap = {
            username: ['username', 'user', 'login'],
            name: ['name', 'full name'],
            role: ['role', 'permission'],
            email: ['email']
        };
    }

    const colIndexMap: Record<string, number> = {};
    Object.keys(fieldMap).forEach(fieldKey => {
        const candidates = fieldMap[fieldKey];
        const index = headers.findIndex(h => candidates.some(c => h === c));
        if (index !== -1) colIndexMap[fieldKey] = index;
    });

    const idKey = activeTab === 'users' ? 'username' : 'id';
    
    if (colIndexMap[idKey] === undefined) {
         setProcessingStatus(null);
         alert(`Could not find a column for '${idKey}'. Checked headers: ${headers.join(', ')}`);
         return;
    }

    let addedCount = 0;
    let updatedCount = 0;
    const toAdd: any[] = [];
    const toUpdate: any[] = [];

    dataRows.forEach((row: any[]) => {
        if (!row || row.length === 0) return;
        const getIdValue = (idx: number) => {
            if (row[idx] !== undefined && row[idx] !== null) return String(row[idx]).trim();
            return '';
        };

        const idVal = getIdValue(colIndexMap[idKey]);
        if (!idVal) return; 

        let payload: any = {};
        Object.keys(colIndexMap).forEach(key => {
            const idx = colIndexMap[key];
            if (row[idx] !== undefined && row[idx] !== null) payload[key] = String(row[idx]).trim();
        });

        if (activeTab === 'items') {
             if (!payload.category) payload.category = 'General';
             if (!payload.unit) payload.unit = 'pcs';
        } else if (activeTab === 'machines') {
             if (!payload.status) payload.status = 'Working';
             if (!payload.chaseNo) payload.chaseNo = 'Unknown';
        } else if (activeTab === 'users') {
             if (!payload.password) payload.password = 'password';
             if (!payload.role) payload.role = 'user';
        }

        const list = activeTab === 'items' ? items : 
                     activeTab === 'machines' ? machines :
                     activeTab === 'locations' ? locations :
                     activeTab === 'sectors' ? sectors :
                     activeTab === 'divisions' ? divisions :
                     activeTab === 'plans' ? plans : users;
        
        // @ts-ignore
        const exists = list.find((item: any) => item[idKey] === idVal);

        if (exists) {
            toUpdate.push({ ...exists, ...payload });
            updatedCount++;
        } else {
            toAdd.push(payload);
            addedCount++;
        }
    });

    onBulkImport(activeTab, toAdd, toUpdate);
    setProcessingStatus(null);
    
    if (processingStatus) {
         setTimeout(() => { alert(`Import Complete!\n\nTotal Processed: ${dataRows.length}\nAdded: ${addedCount}\nUpdated: ${updatedCount}`); }, 100);
    }
  };

  const toggleColumnVisibility = (key: string) => {
    setColumnSettings(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].map(col => 
        col.key === key ? { ...col, visible: !col.visible } : col
      )
    }));
  };

  const handleDragStart = (e: React.DragEvent<HTMLTableHeaderCellElement>, position: number) => { dragItem.current = position; };
  const handleDragEnter = (e: React.DragEvent<HTMLTableHeaderCellElement>, position: number) => { dragOverItem.current = position; };
  const handleDrop = (e: React.DragEvent<HTMLTableHeaderCellElement>) => {
    e.preventDefault();
    const copyListItems = [...columnSettings[activeTab]];
    const dragItemContent = copyListItems[dragItem.current!];
    copyListItems.splice(dragItem.current!, 1);
    copyListItems.splice(dragOverItem.current!, 0, dragItemContent);
    dragItem.current = null; dragOverItem.current = null;
    setColumnSettings(prev => ({ ...prev, [activeTab]: copyListItems }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const timestamp = Date.now().toString().slice(-4);
    
    // ... (Payload logic maintained as is, reduced for brevity in prompt context but fully preserved in output) ...
    // Reuse existing payload logic blocks for items, machines, etc.
    if (activeTab === 'items') {
      const payload: Item = {
        id: formData.id || `ITM-${timestamp}`,
        name: formData.name, category: formData.category || 'General', unit: formData.unit || 'pcs',
        secondId: formData.secondId, thirdId: formData.thirdId, description2: formData.description2,
        fullName: formData.fullName, brand: formData.brand, oem: formData.oem, partNumber: formData.partNumber, modelNo: formData.modelNo,
      };
      isEditing ? onUpdateItem(payload) : onAddItem(payload);
    } else if (activeTab === 'machines') {
      const payload: Machine = {
        id: formData.id || `M-${timestamp}`, machineLocalNo: formData.machineLocalNo, status: formData.status || 'Working',
        chaseNo: formData.chaseNo, modelNo: formData.modelNo, divisionId: formData.divisionId,
        mainGroup: formData.mainGroup, subGroup: formData.subGroup, category: formData.category, brand: formData.brand
      };
      isEditing ? onUpdateMachine(payload) : onAddMachine(payload);
    } else if (activeTab === 'sectors') {
      const payload: Sector = { id: formData.id || `SEC-${timestamp}`, name: formData.name };
      isEditing ? onUpdateSector(payload) : onAddSector(payload);
    } else if (activeTab === 'divisions') {
      const payload: Division = { id: formData.id || `DIV-${timestamp}`, name: formData.name, sectorId: formData.sectorId };
      isEditing ? onUpdateDivision(payload) : onAddDivision(payload);
    } else if (activeTab === 'plans') {
        const payload: MaintenancePlan = { id: formData.id || `MP-${timestamp}`, name: formData.name };
        isEditing ? onUpdatePlan(payload) : onAddPlan(payload);
    } else if (activeTab === 'users') {
      const payload: User = {
        username: formData.username, name: formData.name, role: formData.role, email: formData.email,
        password: formData.password || (isEditing ? users.find(u => u.username === formData.username)?.password : 'password'),
        allowedLocationIds: formData.allowedLocationIds as string[], allowedSectorIds: formData.allowedSectorIds as string[], allowedDivisionIds: formData.allowedDivisionIds as string[]
      };
      isEditing ? onUpdateUser(payload) : onAddUser(payload);
    } else { 
      const payload: Location = { id: formData.id || `WH-${timestamp}`, name: formData.name, email: formData.email };
      isEditing ? onUpdateLocation(payload) : onAddLocation(payload);
    }
    setShowForm(false); setFormData({}); setIsEditing(false);
  };

  const renderTable = () => {
    let data: any[] = [];
    switch (activeTab) {
      case 'items': data = items; break;
      case 'machines': data = machines; break;
      case 'locations': data = locations; break;
      case 'sectors': data = sectors; break;
      case 'divisions': data = divisions; break;
      case 'plans': data = plans; break;
      case 'users': data = users; break;
    }

    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentItems = data.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    const visibleColumns = columnSettings[activeTab].filter(c => c.visible);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
            <div className="overflow-auto flex-1">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 w-10 text-center">
                                <input type="checkbox" checked={currentItems.length > 0 && currentItems.every(i => selectedIds.has(i.id || i.username))} onChange={() => handleSelectAllPage(currentItems)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            </th>
                            {visibleColumns.map((col, index) => (
                                <th key={col.key} className="px-4 py-3 cursor-move hover:bg-gray-100 select-none" draggable onDragStart={(e) => handleDragStart(e, index)} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={handleDrop} onDragOver={(e) => e.preventDefault()}>
                                    {col.label}
                                </th>
                            ))}
                            <th className="px-4 py-3 text-right bg-gray-50 sticky right-0 shadow-sm border-l">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {currentItems.map((item, idx) => {
                            const itemId = item.id || item.username;
                            return (
                                <tr key={itemId} className="hover:bg-blue-50 transition-colors">
                                    <td className="px-4 py-2 text-center">
                                        <input type="checkbox" checked={selectedIds.has(itemId)} onChange={() => toggleSelection(itemId)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                    </td>
                                    {visibleColumns.map(col => (
                                        <td key={col.key} className="px-4 py-2 text-gray-600">
                                            {Array.isArray(item[col.key]) ? item[col.key].join(', ') : (item[col.key] || '-')}
                                        </td>
                                    ))}
                                    <td className="px-4 py-2 text-right sticky right-0 bg-white group-hover:bg-blue-50 border-l border-gray-100 flex items-center justify-end gap-2">
                                        <button onClick={() => handleEdit(item)} className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Edit">✏️</button>
                                        <button onClick={() => handleDeleteSingle(itemId)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Delete">🗑️</button>
                                    </td>
                                </tr>
                            );
                        })}
                        {currentItems.length === 0 && (
                            <tr><td colSpan={visibleColumns.length + 2} className="px-6 py-12 text-center text-gray-400">No records found in {activeTab}.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1 border rounded bg-white disabled:opacity-50 hover:bg-gray-100">Previous</button>
                    <span className="text-sm text-gray-600">Page {currentPage} of {totalPages} ({data.length} items)</span>
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1 border rounded bg-white disabled:opacity-50 hover:bg-gray-100">Next</button>
                </div>
            )}
        </div>
    );
  };

  const renderForm = () => {
      // ... (Existing Render Form logic, kept same but wrapped in xml for context if needed, usually short is better) ...
      // Assuming full content replacement, I will include the form rendering block here.
      if (!showForm) return null;
      return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">{isEditing ? 'Edit' : 'Add New'} {activeTab.slice(0, -1)}</h2>
                    <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {activeTab === 'items' && (
                        <>
                           <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-gray-700">Item Number (ID)</label><input required className="w-full px-3 py-2 border rounded-lg" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value})} disabled={isEditing} /></div>
                                <div><label className="block text-sm font-medium text-gray-700">Category</label><input className="w-full px-3 py-2 border rounded-lg" value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} /></div>
                           </div>
                           <div><label className="block text-sm font-medium text-gray-700">Description (Name)</label><input required className="w-full px-3 py-2 border rounded-lg" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                           <div className="grid grid-cols-3 gap-4">
                                <div><label className="block text-sm font-medium text-gray-700">Unit (UM)</label><input className="w-full px-3 py-2 border rounded-lg" value={formData.unit || ''} onChange={e => setFormData({...formData, unit: e.target.value})} /></div>
                                <div><label className="block text-sm font-medium text-gray-700">Part No</label><input className="w-full px-3 py-2 border rounded-lg" value={formData.partNumber || ''} onChange={e => setFormData({...formData, partNumber: e.target.value})} /></div>
                                <div><label className="block text-sm font-medium text-gray-700">Model No</label><input className="w-full px-3 py-2 border rounded-lg" value={formData.modelNo || ''} onChange={e => setFormData({...formData, modelNo: e.target.value})} /></div>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-gray-700">Brand</label><input className="w-full px-3 py-2 border rounded-lg" value={formData.brand || ''} onChange={e => setFormData({...formData, brand: e.target.value})} /></div>
                                <div><label className="block text-sm font-medium text-gray-700">OEM</label><input className="w-full px-3 py-2 border rounded-lg" value={formData.oem || ''} onChange={e => setFormData({...formData, oem: e.target.value})} /></div>
                           </div>
                        </>
                    )}
                    {activeTab === 'machines' && (
                        <>
                           <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-gray-700">Machine ID</label><input required className="w-full px-3 py-2 border rounded-lg" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value})} disabled={isEditing} /></div>
                                <div><label className="block text-sm font-medium text-gray-700">Local No</label><input className="w-full px-3 py-2 border rounded-lg" value={formData.machineLocalNo || ''} onChange={e => setFormData({...formData, machineLocalNo: e.target.value})} /></div>
                           </div>
                           <div><label className="block text-sm font-medium text-gray-700">Equipment Name (Category)</label><input required className="w-full px-3 py-2 border rounded-lg" value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} /></div>
                           <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-gray-700">Status</label><select className="w-full px-3 py-2 border rounded-lg" value={formData.status || 'Working'} onChange={e => setFormData({...formData, status: e.target.value})}><option value="Working">Working</option><option value="Not Working">Not Working</option><option value="Outside Maintenance">Outside Maintenance</option></select></div>
                                <div><label className="block text-sm font-medium text-gray-700">Division</label><SearchableSelect label="" options={divisions.map(d => ({id: d.id, label: d.name}))} value={formData.divisionId || ''} onChange={(val) => setFormData({...formData, divisionId: val})} /></div>
                           </div>
                        </>
                    )}
                    {activeTab === 'locations' && (
                        <>
                           <div><label className="block text-sm font-medium text-gray-700">Location ID</label><input required className="w-full px-3 py-2 border rounded-lg" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value})} disabled={isEditing} /></div>
                           <div><label className="block text-sm font-medium text-gray-700">Name</label><input required className="w-full px-3 py-2 border rounded-lg" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                           <div><label className="block text-sm font-medium text-gray-700">Email</label><input type="email" className="w-full px-3 py-2 border rounded-lg" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                        </>
                    )}
                    {activeTab === 'users' && (
                         <>
                            <div><label className="block text-sm font-medium text-gray-700">Username</label><input required className="w-full px-3 py-2 border rounded-lg" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} disabled={isEditing} /></div>
                            <div><label className="block text-sm font-medium text-gray-700">Full Name</label><input required className="w-full px-3 py-2 border rounded-lg" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-gray-700">Role</label><select className="w-full px-3 py-2 border rounded-lg" value={formData.role || 'user'} onChange={e => setFormData({...formData, role: e.target.value})}><option value="admin">Admin</option><option value="warehouse_manager">Warehouse Manager</option><option value="warehouse_supervisor">Warehouse Supervisor</option><option value="maintenance_manager">Maintenance Manager</option><option value="maintenance_engineer">Maintenance Engineer</option><option value="user">User (Operator)</option></select></div>
                                <div><label className="block text-sm font-medium text-gray-700">Email</label><input required type="email" className="w-full px-3 py-2 border rounded-lg" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                            </div>
                            <div><label className="block text-sm font-medium text-gray-700">Password</label><input type="password" className="w-full px-3 py-2 border rounded-lg" placeholder={isEditing ? "(Unchanged)" : ""} value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
                         </>
                    )}
                    {(activeTab === 'sectors' || activeTab === 'plans' || activeTab === 'divisions') && (
                        <>
                           <div><label className="block text-sm font-medium text-gray-700">ID</label><input required className="w-full px-3 py-2 border rounded-lg" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value})} disabled={isEditing} /></div>
                           <div><label className="block text-sm font-medium text-gray-700">Name</label><input required className="w-full px-3 py-2 border rounded-lg" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                           {activeTab === 'divisions' && (
                               <div><label className="block text-sm font-medium text-gray-700">Sector</label><SearchableSelect label="" options={sectors.map(s => ({id: s.id, label: s.name}))} value={formData.sectorId || ''} onChange={(val) => setFormData({...formData, sectorId: val})} /></div>
                           )}
                        </>
                    )}
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
  };

  const renderSyncModal = () => {
    if (!showSyncModal) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 text-white">
                    <h2 className="text-xl font-bold flex items-center">
                        <span className="mr-2 text-2xl">☁️</span> Google Sheets Sync
                    </h2>
                    <p className="text-green-100 text-sm mt-1 opacity-90">
                        Connect your spreadsheet for data synchronization.
                    </p>
                </div>
                
                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Google Sheet ID / URL</label>
                            <input 
                                type="text" 
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 outline-none text-sm font-mono"
                                value={sheetId}
                                onChange={(e) => handleSheetIdChange(e.target.value)}
                                placeholder="Paste Sheet ID or URL..."
                            />
                        </div>
                        
                        {/* Dynamic GID Input for the Active Tab */}
                        <div className="bg-gray-50 p-3 rounded border border-gray-200">
                            <label className="block text-sm font-bold text-blue-700 mb-1 capitalize">{activeTab} Tab GID (Number)</label>
                            <input 
                                type="text" 
                                className="w-full px-3 py-2 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                                value={tabGids[activeTab] || ''}
                                onChange={(e) => handleGidChange(e.target.value)}
                                placeholder={`e.g. 12345 (GID for ${activeTab} tab)`}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Open the "<b>{activeTab}</b>" tab in Google Sheets and copy the number after <code>#gid=</code> in the URL.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Web App URL (for History Export)</label>
                            <input 
                                type="text" 
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 outline-none text-sm font-mono"
                                value={scriptUrl}
                                onChange={(e) => setScriptUrl(e.target.value)}
                                placeholder="https://script.google.com/macros/s/..."
                            />
                        </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-gray-100">
                        <button 
                            onClick={handleSyncData}
                            disabled={syncLoading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm flex items-center justify-center gap-2 capitalize"
                        >
                            {syncLoading ? <span className="animate-spin">↻</span> : <span>⬇️</span>}
                            Import {activeTab} from Cloud
                        </button>
                        
                        <button 
                            onClick={handleExportHistory}
                            disabled={syncLoading || !scriptUrl}
                            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-bold shadow-sm flex items-center justify-center gap-2"
                        >
                            {syncLoading ? <span className="animate-spin">↻</span> : <span>⬆️</span>}
                            Export History to Cloud
                        </button>
                    </div>

                    {syncMsg && (
                        <div className={`p-3 rounded-lg text-sm text-center ${syncMsg.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                            {syncMsg}
                        </div>
                    )}

                    <div className="flex justify-between items-center text-xs text-gray-400 pt-2">
                        <button onClick={handleResetDefaults} className="hover:text-gray-600 underline">Restore Defaults</button>
                        <button onClick={() => setShowSyncModal(false)} className="font-bold text-gray-600 hover:text-gray-900">Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6">
      <input 
        type="file" 
        accept=".csv,.txt,.xlsx,.xls" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div className="flex flex-wrap gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          {(['sectors', 'divisions', 'machines', 'items', 'plans', 'locations', 'users'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${
                activeTab === tab 
                  ? 'bg-blue-100 text-blue-700 shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2">
           {selectedIds.size > 0 ? (
               <>
                 <button onClick={() => handleExportDataToExcel(true)} className="flex items-center px-4 py-2 bg-emerald-600 text-white border border-emerald-700 rounded-lg hover:bg-emerald-700 shadow-sm transition animate-fade-in-up">
                   <span className="mr-2">📥</span> Export Selected ({selectedIds.size})
                 </button>
                 <button onClick={handleBulkDelete} className="flex items-center px-4 py-2 bg-red-600 text-white border border-red-700 rounded-lg hover:bg-red-700 shadow-sm transition animate-fade-in-up">
                   <span className="mr-2">🗑️</span> Delete Selected ({selectedIds.size})
                 </button>
               </>
           ) : (
               <>
                <button onClick={handleImportClick} className="flex items-center px-4 py-2 bg-orange-100 text-orange-800 border border-orange-200 rounded-lg hover:bg-orange-200 shadow-sm transition">
                    <span className="mr-2 text-lg">📂</span> Import
                </button>
                <button onClick={() => handleExportDataToExcel(false)} className="flex items-center px-4 py-2 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg hover:bg-emerald-200 shadow-sm transition">
                    <span className="mr-2 text-lg">📥</span> Excel
                </button>

                {/* Updated Sync Button: Active for ALL tabs now */}
                <button
                    onClick={() => setShowSyncModal(true)}
                    className="flex items-center px-4 py-2 bg-white border border-green-200 text-green-700 rounded-lg shadow-sm hover:bg-green-50 transition"
                >
                    <span className="mr-2">📊</span> 
                    Sync {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                </button>

                <button onClick={() => setShowColumnMenu(!showColumnMenu)} className={`flex items-center px-4 py-2 bg-white border rounded-lg shadow-sm transition ${showColumnMenu ? 'bg-gray-100 ring-2 ring-blue-200' : 'hover:bg-gray-50'}`}>
                    <span className="mr-2">👁️</span> Columns
                </button>
               </>
           )}

           <button onClick={handleAddNew} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition">
             <span className="mr-2 text-xl">+</span> Add {activeTab.slice(0, -1)}
           </button>
        </div>
      </div>

      {renderTable()}
      {renderForm()}
      {renderSyncModal()}
    </div>
  );
};

export default MasterData;
