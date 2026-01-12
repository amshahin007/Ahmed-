
import React, { useState, useEffect, useRef } from 'react';
import { Item, Machine, Location, Sector, Division, User, IssueRecord, MaintenancePlan } from '../types';
import SearchableSelect from './SearchableSelect';
import { fetchRawCSV, DEFAULT_SHEET_ID, DEFAULT_ITEMS_GID, extractSheetIdFromUrl, extractGidFromUrl, APP_SCRIPT_TEMPLATE, sendIssueToSheet, DEFAULT_SCRIPT_URL, locateRemoteData } from '../services/googleSheetsService';
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

type TabType = 'items' | 'machines' | 'locations' | 'sectors' | 'divisions' | 'users' | 'plans' | 'history';

const ITEMS_PER_PAGE = 80;

// Base configuration for columns
const COLUMNS_CONFIG: Record<Exclude<TabType, 'history'>, { key: string, label: string }[]> = {
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
  const [activeTab, setActiveTab] = useState<Exclude<TabType, 'history'>>('items');
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

  // --- SYNC STATE MANAGEMENT (PER TAB) ---
  const [syncConfig, setSyncConfig] = useState<Record<string, { sheetId: string; gid: string }>>(() => {
    try {
        const saved = localStorage.getItem('wf_sync_config_v2');
        if (saved) return JSON.parse(saved);
    } catch(e) { console.error(e); }
    
    // Default fallback
    return {
        items: { sheetId: DEFAULT_SHEET_ID, gid: DEFAULT_ITEMS_GID }
    };
  });

  const [scriptUrl, setScriptUrl] = useState(localStorage.getItem('wf_script_url') || DEFAULT_SCRIPT_URL);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [remoteLinks, setRemoteLinks] = useState<{folderUrl: string, sheetUrl: string} | null>(null);

  // Column Management State
  const [columnSettings, setColumnSettings] = useState<Record<Exclude<TabType, 'history'>, { key: string; label: string; visible: boolean }[]>>(() => {
    const defaults: Record<string, any> = {};
    (Object.keys(COLUMNS_CONFIG) as Exclude<TabType, 'history'>[]).forEach(tab => {
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
  useEffect(() => { 
      localStorage.setItem('wf_sync_config_v2', JSON.stringify(syncConfig)); 
  }, [syncConfig]);
  
  useEffect(() => { localStorage.setItem('wf_script_url', scriptUrl); }, [scriptUrl]);
  useEffect(() => { localStorage.setItem('wf_column_settings', JSON.stringify(columnSettings)); }, [columnSettings]);

  // Reset pagination and selection when tab changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
    setSyncMsg(''); // Clear sync message on tab change
    setRemoteLinks(null);
  }, [activeTab]);

  // -- Config Handlers --
  
  const updateSyncConfig = (tabKey: string, field: 'sheetId' | 'gid', value: string) => {
      setSyncConfig(prev => ({
          ...prev,
          [tabKey]: {
              ...(prev[tabKey] || { sheetId: '', gid: '' }),
              [field]: value
          }
      }));
  };

  const handleSheetUrlPaste = (val: string) => {
    const extractedId = extractSheetIdFromUrl(val);
    const extractedGid = extractGidFromUrl(val);

    setSyncConfig(prev => {
        const currentForTab = prev[activeTab] || { sheetId: '', gid: '' };
        return {
            ...prev,
            [activeTab]: {
                sheetId: extractedId || currentForTab.sheetId,
                gid: extractedGid || currentForTab.gid 
            }
        };
    });
  };

  const handleResetDefaults = () => {
    setSyncConfig(prev => ({
        ...prev,
        [activeTab]: { sheetId: DEFAULT_SHEET_ID, gid: activeTab === 'items' ? DEFAULT_ITEMS_GID : '0' }
    }));
    setSyncMsg('Defaults restored for this tab.');
  };

  const handleLocateData = async () => {
      if (!scriptUrl) {
          setSyncMsg('Please ensure Web App URL is set.');
          return;
      }
      setSyncLoading(true);
      setSyncMsg('Locating storage folder and database...');
      const result = await locateRemoteData(scriptUrl);
      setSyncLoading(false);
      
      if (result) {
          setRemoteLinks(result);
          setSyncMsg('Data located successfully! Use the links below.');
      } else {
          setSyncMsg('Failed to locate data. Check URL or permissions.');
      }
  };

  // --- AUTO CONFIG FROM SHEET LOGIC ---
  const handleAutoConfigFromSheet = async () => {
      const currentId = syncConfig[activeTab]?.sheetId || '';
      if (!currentId) {
          setSyncMsg("Error: Enter Sheet ID first.");
          return;
      }

      const cleanId = extractSheetIdFromUrl(currentId);
      
      if (!confirm(`This will try to read the FIRST tab (GID=0) of the sheet to find GID mappings for ALL tabs.\n\nEnsure your first tab has two columns:\nColumn A: Tab Name (e.g. 'items', 'machines')\nColumn B: GID (e.g. '123456')`)) {
          return;
      }

      setSyncLoading(true);
      setSyncMsg("Reading Master Config (GID=0)...");

      try {
          // Fetch GID 0 (Default first tab)
          const rows = await fetchRawCSV(cleanId, '0');
          
          if (!rows || rows.length === 0) {
              throw new Error("Config tab is empty or unreadable.");
          }

          const newConfig = { ...syncConfig };
          let foundCount = 0;

          rows.forEach(row => {
              if (row.length < 2) return;
              const key = row[0].toString().toLowerCase().trim();
              const val = row[1].toString().trim();

              // Check if key matches one of our supported tabs
              if (['items', 'machines', 'locations', 'sectors', 'divisions', 'plans', 'users', 'history'].includes(key) && val) {
                  newConfig[key] = {
                      sheetId: cleanId, // Assume all data is in the same workbook
                      gid: val
                  };
                  foundCount++;
              }
          });

          if (foundCount === 0) {
             setSyncMsg("No valid config rows found. Check spelling in Column A (items, machines, etc).");
          } else {
             setSyncConfig(newConfig);
             setSyncMsg(`Success! Configured ${foundCount} tabs automatically.`);
          }

      } catch (e) {
          console.error(e);
          setSyncMsg("Auto-Config Failed: " + (e as Error).message);
      } finally {
          setSyncLoading(false);
      }
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

  // Generalized Cloud Sync (Single Tab)
  const handleSyncData = async (targetTab: string = activeTab) => {
    setSyncLoading(true);
    setSyncMsg(`Fetching ${targetTab} data...`);
    
    const config = syncConfig[targetTab] || { sheetId: '', gid: '' };

    if (!config.sheetId) {
        setSyncMsg(`Error: No Sheet ID for ${targetTab}.`);
        setSyncLoading(false);
        return;
    }

    try {
      const cleanId = extractSheetIdFromUrl(config.sheetId);
      const currentGid = config.gid || '0';
      
      const rawRows = await fetchRawCSV(cleanId, currentGid);
      
      if (!rawRows || rawRows.length < 2) {
        setSyncMsg(`No data found for ${targetTab}. Check ID/GID.`);
      } else {
         processImportData(rawRows, targetTab);
         setSyncMsg(`${targetTab} Sync Complete!`);
      }
    } catch (e) {
      setSyncMsg(`Error syncing ${targetTab}: ` + (e as Error).message);
    } finally {
      if (targetTab === activeTab) setSyncLoading(false); // Only unset if single sync
    }
  };

  const handleFullSync = async () => {
      const tabs: string[] = ['items', 'machines', 'locations', 'sectors', 'divisions', 'plans', 'users', 'history'];
      setSyncLoading(true);
      let successCount = 0;
      let errors = [];

      for (const tab of tabs) {
          if (syncConfig[tab]?.sheetId && syncConfig[tab]?.gid) {
              setSyncMsg(`Restoring ${tab}...`);
              try {
                  const cleanId = extractSheetIdFromUrl(syncConfig[tab].sheetId);
                  const rawRows = await fetchRawCSV(cleanId, syncConfig[tab].gid);
                  if (rawRows && rawRows.length > 1) {
                      processImportData(rawRows, tab);
                      successCount++;
                  }
              } catch (e) {
                  errors.push(`${tab}: ${(e as Error).message}`);
              }
              // Small delay to prevent rate limits
              await new Promise(r => setTimeout(r, 200));
          }
      }
      
      setSyncLoading(false);
      if (errors.length > 0) {
          setSyncMsg(`Restored ${successCount} tabs. Errors: ${errors.join(', ')}`);
      } else {
          setSyncMsg(`Full Restore Complete! ${successCount} tabs updated.`);
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
            setTimeout(() => { processImportData(jsonData, activeTab); }, 50);
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

  const processImportData = (rows: any[][], targetTab: string) => {
    if (!rows || rows.length < 2) {
        if (targetTab === activeTab) {
             setProcessingStatus(null);
             if (processingStatus) alert("File/Sheet appears to be empty.");
        }
        return;
    }

    let headerRowIndex = -1;
    const primaryKeywords = targetTab === 'users' ? ['username', 'user'] : 
                            targetTab === 'history' ? ['id', 'date', 'location'] :
                            ['id', 'item number', 'item no', 'name', 'description'];
    
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
    if (targetTab === 'items') {
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
    } else if (targetTab === 'machines') {
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
    } else if (targetTab === 'locations') {
        fieldMap = {
            id: ['id', 'location id', 'zone id'],
            name: ['name', 'location name', 'zone'],
            email: ['email', 'site email', 'contact']
        };
    } else if (targetTab === 'sectors') {
        fieldMap = { id: ['id'], name: ['name', 'sector name'] };
    } else if (targetTab === 'divisions') {
        fieldMap = { id: ['id'], name: ['name', 'division name'], sectorId: ['sector id', 'sector'] };
    } else if (targetTab === 'plans') {
        fieldMap = { id: ['id'], name: ['name', 'plan name', 'plan'] };
    } else if (targetTab === 'users') {
        fieldMap = {
            username: ['username', 'user', 'login'],
            name: ['name', 'full name'],
            role: ['role', 'permission'],
            email: ['email']
        };
    } else if (targetTab === 'history') {
        fieldMap = {
            id: ['id', 'issue id'],
            timestamp: ['date', 'timestamp', 'time'],
            locationId: ['location', 'site', 'location id'],
            sectorName: ['sector'],
            divisionName: ['division'],
            machineName: ['machine'],
            maintenancePlan: ['maint. plan', 'plan', 'maintenance plan'],
            itemId: ['item id', 'item number'],
            itemName: ['item name', 'item'],
            quantity: ['quantity', 'qty'],
            status: ['status'],
            notes: ['notes', 'remarks'],
            warehouseEmail: ['warehouse email'],
            requesterEmail: ['site email', 'requester email']
        };
    }

    const colIndexMap: Record<string, number> = {};
    Object.keys(fieldMap).forEach(fieldKey => {
        const candidates = fieldMap[fieldKey];
        const index = headers.findIndex(h => candidates.some(c => h === c));
        if (index !== -1) colIndexMap[fieldKey] = index;
    });

    const idKey = targetTab === 'users' ? 'username' : 'id';
    
    // Only warn if not history (history ID might be generated if missing, but better to have)
    if (colIndexMap[idKey] === undefined && targetTab !== 'history') {
         setProcessingStatus(null);
         if (targetTab === activeTab) alert(`Could not find a column for '${idKey}'. Checked headers: ${headers.join(', ')}`);
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

        const idVal = colIndexMap[idKey] !== undefined ? getIdValue(colIndexMap[idKey]) : '';
        if (!idVal && targetTab !== 'history') return; 

        let payload: any = {};
        Object.keys(colIndexMap).forEach(key => {
            const idx = colIndexMap[key];
            if (row[idx] !== undefined && row[idx] !== null) payload[key] = String(row[idx]).trim();
        });

        if (targetTab === 'items') {
             if (!payload.category) payload.category = 'General';
             if (!payload.unit) payload.unit = 'pcs';
        } else if (targetTab === 'machines') {
             if (!payload.status) payload.status = 'Working';
             if (!payload.chaseNo) payload.chaseNo = 'Unknown';
        } else if (targetTab === 'history') {
             if (!payload.id) return; // Skip invalid history lines
             if (!payload.timestamp) payload.timestamp = new Date().toISOString();
             // Ensure quantity is number
             payload.quantity = Number(payload.quantity) || 0;
        }

        const list = targetTab === 'items' ? items : 
                     targetTab === 'machines' ? machines :
                     targetTab === 'locations' ? locations :
                     targetTab === 'sectors' ? sectors :
                     targetTab === 'divisions' ? divisions :
                     targetTab === 'plans' ? plans : 
                     targetTab === 'users' ? users : history;
        
        // @ts-ignore
        const exists = list.find((item: any) => item[idKey] === (payload[idKey] || idVal));

        if (exists) {
            toUpdate.push({ ...exists, ...payload });
            updatedCount++;
        } else {
            toAdd.push(payload);
            addedCount++;
        }
    });

    onBulkImport(targetTab, toAdd, toUpdate);
    setProcessingStatus(null);
    
    if (targetTab === activeTab && processingStatus) {
         setTimeout(() => { alert(`Import Complete!\n\nTotal Processed: ${dataRows.length}\nAdded: ${addedCount}\nUpdated: ${updatedCount}`); }, 100);
    }
  };

  // --- Drag & Drop Handlers for Columns ---
  const handleDragStart = (e: React.DragEvent<HTMLTableHeaderCellElement>, position: number) => {
    dragItem.current = position;
  };

  const handleDragEnter = (e: React.DragEvent<HTMLTableHeaderCellElement>, position: number) => {
    dragOverItem.current = position;
  };

  const handleDrop = (e: React.DragEvent<HTMLTableHeaderCellElement>) => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    
    // We are reordering the 'visibleColumns' list visually
    // We need to apply this reordering to 'columnSettings'
    const currentColumns = [...columnSettings[activeTab]];
    const visibleCols = currentColumns.filter(c => c.visible);
    
    // Get the item being dragged and the target item from visible list
    const itemToMove = visibleCols[dragItem.current];
    const itemTarget = visibleCols[dragOverItem.current];
    
    // Find their actual indices in the main list
    const realFromIndex = currentColumns.findIndex(c => c.key === itemToMove.key);
    const realToIndex = currentColumns.findIndex(c => c.key === itemTarget.key);
    
    // Perform move in main list
    currentColumns.splice(realFromIndex, 1);
    currentColumns.splice(realToIndex, 0, itemToMove);

    dragItem.current = null;
    dragOverItem.current = null;
    
    setColumnSettings(prev => ({
        ...prev,
        [activeTab]: currentColumns
    }));
  };

  // --- Form Handlers ---
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = { ...formData };
    
    // Handle array conversions for Users
    if (activeTab === 'users') {
        ['allowedLocationIds', 'allowedSectorIds', 'allowedDivisionIds'].forEach(key => {
            if (typeof payload[key] === 'string') {
                payload[key] = payload[key].split(',').map((s: string) => s.trim()).filter(Boolean);
            }
        });
    }

    if (isEditing) {
        switch(activeTab) {
            case 'items': onUpdateItem(payload); break;
            case 'machines': onUpdateMachine(payload); break;
            case 'locations': onUpdateLocation(payload); break;
            case 'sectors': onUpdateSector(payload); break;
            case 'divisions': onUpdateDivision(payload); break;
            case 'plans': onUpdatePlan(payload); break;
            case 'users': onUpdateUser(payload); break;
        }
    } else {
        switch(activeTab) {
            case 'items': onAddItem(payload); break;
            case 'machines': onAddMachine(payload); break;
            case 'locations': onAddLocation(payload); break;
            case 'sectors': onAddSector(payload); break;
            case 'divisions': onAddDivision(payload); break;
            case 'plans': onAddPlan(payload); break;
            case 'users': onAddUser(payload); break;
        }
    }
    setShowForm(false);
  };

  const renderForm = () => {
    if (!showForm) return null;

    const fields = COLUMNS_CONFIG[activeTab];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-xl font-bold text-gray-800">
                        {isEditing ? 'Edit' : 'Add New'} {activeTab.slice(0, -1)}
                    </h3>
                    <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 transition">
                        ✕
                    </button>
                </div>
                
                <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fields.map(field => {
                            const val = formData[field.key];
                            // Handle array display for users
                            const displayVal = Array.isArray(val) ? val.join(', ') : (val || '');
                            
                            return (
                                <div key={field.key} className={field.key === 'name' || field.key === 'fullName' ? "md:col-span-2 space-y-1" : "space-y-1"}>
                                    <label className="block text-sm font-medium text-gray-700">{field.label}</label>
                                    <input 
                                        type="text" 
                                        value={displayVal}
                                        onChange={(e) => setFormData({...formData, [field.key]: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                                        placeholder={`Enter ${field.label}`}
                                        disabled={isEditing && (field.key === 'id' || field.key === 'username')}
                                        required={field.key === 'id' || field.key === 'username'}
                                    />
                                    {activeTab === 'users' && field.key.includes('Ids') && (
                                        <p className="text-xs text-gray-400">Comma separated IDs</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="pt-6 mt-6 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white">
                        <button 
                            type="button" 
                            onClick={() => setShowForm(false)} 
                            className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-medium transition"
                        >
                            {isEditing ? 'Save Changes' : 'Create Record'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
  };

  const renderTable = () => {
    // Only render standard master data tables. History is handled by HistoryTable.tsx
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

  const renderSyncModal = () => {
    if (!showSyncModal) return null;

    const currentConfig = syncConfig[activeTab] || { sheetId: '', gid: '' };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 text-white">
                    <h2 className="text-xl font-bold flex items-center">
                        <span className="mr-2 text-2xl">☁️</span> Google Sheets Sync
                    </h2>
                    <p className="text-green-100 text-sm mt-1 opacity-90">
                        Connect your spreadsheet for <b>{activeTab.toUpperCase()}</b> or restore full backup.
                    </p>
                </div>
                
                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                            <p className="text-sm text-blue-800">
                                💡 <b>Tip:</b> Paste the full Google Sheet URL below to automatically extract the ID and GID.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Google Sheet ID / URL</label>
                            <input 
                                type="text" 
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 outline-none text-sm font-mono"
                                value={currentConfig.sheetId}
                                onChange={(e) => handleSheetUrlPaste(e.target.value)}
                                placeholder="Paste Sheet ID or URL..."
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1 capitalize">{activeTab} Tab GID (Number)</label>
                            <input 
                                type="text" 
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 outline-none text-sm font-mono"
                                value={currentConfig.gid}
                                onChange={(e) => updateSyncConfig(activeTab, 'gid', e.target.value)}
                                placeholder="e.g. 0 or 12345"
                            />
                        </div>

                        {/* History GID Input separately if needed for full restore */}
                        <div className="pt-2 border-t border-gray-100">
                             <label className="block text-sm font-bold text-gray-700 mb-1 capitalize">History / Issue Log GID</label>
                             <input 
                                type="text" 
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 outline-none text-sm font-mono"
                                value={syncConfig['history']?.gid || ''}
                                onChange={(e) => updateSyncConfig('history', 'gid', e.target.value)}
                                placeholder="GID for History tab (for full restore)"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Web App URL (for History Export & Uploads)</label>
                            <input 
                                type="text" 
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 outline-none text-sm font-mono"
                                value={scriptUrl}
                                onChange={(e) => setScriptUrl(e.target.value)}
                                placeholder="https://script.google.com/macros/s/..."
                            />
                        </div>

                        {/* Locate Data Button */}
                        <div className="pt-2 border-t border-gray-100">
                             <button
                                onClick={handleLocateData}
                                disabled={syncLoading || !scriptUrl}
                                className="w-full py-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg text-sm font-bold hover:bg-yellow-100 transition flex items-center justify-center gap-2"
                             >
                                {syncLoading ? <span className="animate-spin">↻</span> : <span>🔍</span>}
                                Test Connection & Locate Data
                             </button>
                             
                             {remoteLinks && (
                                 <div className="mt-2 text-xs text-center space-y-1 bg-yellow-50 p-2 rounded border border-yellow-100">
                                     <p className="font-bold">Found your files:</p>
                                     <a href={remoteLinks.folderUrl} target="_blank" rel="noopener noreferrer" className="block text-blue-600 underline">📂 Open "WareFlow Reports" Folder</a>
                                     <a href={remoteLinks.sheetUrl} target="_blank" rel="noopener noreferrer" className="block text-green-600 underline">📊 Open "WareFlow Database" Sheet</a>
                                 </div>
                             )}
                        </div>

                        <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-3">
                             <button
                                onClick={handleAutoConfigFromSheet}
                                className="col-span-2 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100 transition flex items-center justify-center gap-2"
                             >
                                <span>⚡</span> Auto-Configure All Tabs (Master Config)
                             </button>
                             
                             <button
                                onClick={handleFullSync}
                                className="col-span-2 py-3 bg-indigo-600 text-white rounded-lg font-bold shadow-sm hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                             >
                                {syncLoading ? <span className="animate-spin">↻</span> : <span>📥</span>}
                                Fetch All Data (Full Backup Restore)
                             </button>
                        </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-gray-100">
                        <button 
                            onClick={() => handleSyncData(activeTab)}
                            disabled={syncLoading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm flex items-center justify-center gap-2 capitalize"
                        >
                            {syncLoading ? <span className="animate-spin">↻</span> : <span>⬇️</span>}
                            Import Only {activeTab}
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
                        <div className={`p-3 rounded-lg text-sm text-center ${syncMsg.includes('Error') || syncMsg.includes('Failed') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
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
