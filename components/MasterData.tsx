import React, { useState, useEffect, useRef } from 'react';
import { Item, Machine, Location, Sector, Division, User, IssueRecord, MaintenancePlan } from '../types';
import SearchableSelect from './SearchableSelect';
import { fetchItemsFromSheet, DEFAULT_SHEET_ID, DEFAULT_ITEMS_GID, extractSheetIdFromUrl, extractGidFromUrl, APP_SCRIPT_TEMPLATE, sendIssueToSheet, parseCSVLine } from '../services/googleSheetsService';

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

  onDeleteItem: (itemId: string) => void;
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
  const [sheetId, setSheetId] = useState(localStorage.getItem('wf_sheet_id') || DEFAULT_SHEET_ID);
  const [gid, setGid] = useState(localStorage.getItem('wf_items_gid') || DEFAULT_ITEMS_GID);
  const [scriptUrl, setScriptUrl] = useState(localStorage.getItem('wf_script_url') || '');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // Column Management State
  const [columnSettings, setColumnSettings] = useState<Record<TabType, { key: string; label: string; visible: boolean }[]>>(() => {
    // 1. Generate fresh defaults from config
    const defaults: Record<string, any> = {};
    (Object.keys(COLUMNS_CONFIG) as TabType[]).forEach(tab => {
      defaults[tab] = COLUMNS_CONFIG[tab].map(c => ({ ...c, visible: true }));
    });

    const saved = localStorage.getItem('wf_column_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // 2. Smart Merge: Ensure new columns in code (COLUMNS_CONFIG) appear even if localStorage has old data
        const merged: Record<string, any> = { ...defaults };
        
        Object.keys(defaults).forEach(key => {
            if (parsed[key]) {
                // Determine which keys exist in the saved config
                const savedKeys = new Set(parsed[key].map((c: any) => c.key));
                // Find columns that are in defaults but missing in saved (newly added features)
                const newColumns = defaults[key].filter((c: any) => !savedKeys.has(c.key));
                // Append new columns to the saved ones
                merged[key] = [...parsed[key], ...newColumns];
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
  useEffect(() => { localStorage.setItem('wf_items_gid', gid); }, [gid]);
  useEffect(() => { localStorage.setItem('wf_script_url', scriptUrl); }, [scriptUrl]);
  
  // Save column settings when changed
  useEffect(() => {
    localStorage.setItem('wf_column_settings', JSON.stringify(columnSettings));
  }, [columnSettings]);

  // Reset pagination when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const handleSheetIdChange = (val: string) => {
    setSheetId(val);
    // Auto-extract GID if user pastes a full URL containing gid=...
    const extractedGid = extractGidFromUrl(val);
    if (extractedGid) {
      setGid(extractedGid);
    }
  };

  const handleResetDefaults = () => {
    setSheetId(DEFAULT_SHEET_ID);
    setGid(DEFAULT_ITEMS_GID);
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

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this item? This action cannot be undone.')) {
      onDeleteItem(id);
    }
  };

  const handleSyncItems = async () => {
    setSyncLoading(true);
    setSyncMsg('Fetching data...');
    try {
      const cleanId = extractSheetIdFromUrl(sheetId);
      const newItems = await fetchItemsFromSheet(cleanId, gid);
      
      if (newItems.length === 0) {
        setSyncMsg('No items found. Check ID/GID or CSV headers.');
      } else {
        // Update items (Logic: Overwrite if ID matches, else add)
        let addedCount = 0;
        let updatedCount = 0;
        
        newItems.forEach(newItem => {
          const exists = items.find(i => i.id === newItem.id);
          if (exists) {
            onUpdateItem(newItem);
            updatedCount++;
          } else {
            onAddItem(newItem);
            addedCount++;
          }
        });
        setSyncMsg(`Success! Added: ${addedCount}, Updated: ${updatedCount}`);
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
    
    if (!confirm(`Are you sure you want to export ${history.length} historical records to the Google Sheet? This may take a moment.`)) return;

    setSyncLoading(true);
    setSyncMsg(`Starting export of ${history.length} records...`);
    
    let successCount = 0;
    
    // We process sequentially to avoid overwhelming Apps Script
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

  const handleExportDataToExcel = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    const timestamp = new Date().toISOString().slice(0, 10);

    const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    switch (activeTab) {
      case 'items':
        headers = ['Item Number', 'Description', 'Category', 'Unit', '3rd Item No', 'Desc Line 2', 'Full Name', 'Brand', 'OEM', 'Part No'];
        rows = items.map(i => [
            i.id, i.name, i.category, i.unit, 
            i.thirdId, i.description2, i.fullName, i.brand, i.oem, i.partNumber
        ].map(escapeCsv));
        break;
      case 'machines':
        headers = ['ID', 'Name', 'Model', 'Main Group', 'Sub Group', 'Category', 'Brand', 'Division ID'];
        rows = machines.map(m => [
            m.id, m.name, m.model, 
            m.mainGroup, m.subGroup, m.category, m.brand, m.divisionId
        ].map(escapeCsv));
        break;
      case 'locations':
        headers = ['ID', 'Name', 'Email'];
        rows = locations.map(l => [l.id, l.name, l.email].map(escapeCsv));
        break;
      case 'sectors':
        headers = ['ID', 'Name'];
        rows = sectors.map(s => [s.id, s.name].map(escapeCsv));
        break;
      case 'divisions':
        headers = ['ID', 'Name', 'Sector ID'];
        rows = divisions.map(d => [d.id, d.name, d.sectorId].map(escapeCsv));
        break;
      case 'plans':
        headers = ['ID', 'Plan Name'];
        rows = plans.map(p => [p.id, p.name].map(escapeCsv));
        break;
      case 'users':
        headers = ['Username', 'Name', 'Role', 'Email', 'Allowed Locations', 'Allowed Sectors', 'Allowed Divisions'];
        rows = users.map(u => [
            u.username, u.name, u.role, u.email, 
            (u.allowedLocationIds || []).join(';'),
            (u.allowedSectorIds || []).join(';'),
            (u.allowedDivisionIds || []).join(';')
        ].map(escapeCsv));
        break;
    }

    if (rows.length === 0) {
        alert("No data to export.");
        return;
    }

    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `WareFlow_${activeTab}_Master_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Import Logic ---
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      processCSVImport(text);
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  const processCSVImport = (csvText: string) => {
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) {
        alert("File appears to be empty or missing headers.");
        return;
    }

    const headers = parseCSVLine(lines[0]).map(h => h.trim());
    let added = 0;
    let updated = 0;

    // Helper to find header index case-insensitively
    const getIdx = (candidates: string[]) => 
        headers.findIndex(h => candidates.some(c => c.toLowerCase() === h.toLowerCase()));

    // Define Mappings based on Active Tab
    // Maps internal Key -> Array of possible CSV Header names
    let fieldMap: Record<string, string[]> = {};

    if (activeTab === 'items') {
        fieldMap = {
            id: ['Item Number', 'ID', 'Item No'],
            name: ['Description', 'Name', 'Item Name'],
            category: ['Category'],
            unit: ['Unit', 'UM', 'UOM'],
            thirdId: ['3rd Item No', '3rd Item'],
            description2: ['Desc Line 2', 'Description 2'],
            fullName: ['Full Name'],
            brand: ['Brand', 'Manufacturer'],
            oem: ['OEM'],
            partNumber: ['Part No', 'Part Number', 'PN']
        };
    } else if (activeTab === 'machines') {
        fieldMap = {
            id: ['ID', 'Machine ID'],
            name: ['Name', 'Machine Name'],
            model: ['Model'],
            mainGroup: ['Main Group'],
            subGroup: ['Sub Group'],
            category: ['Category'],
            brand: ['Brand'],
            divisionId: ['Division ID', 'Division']
        };
    } else if (activeTab === 'locations') {
        fieldMap = {
            id: ['ID', 'Location ID'],
            name: ['Name', 'Location Name'],
            email: ['Email', 'Site Email']
        };
    } else if (activeTab === 'sectors') {
        fieldMap = {
            id: ['ID'],
            name: ['Name']
        };
    } else if (activeTab === 'divisions') {
        fieldMap = {
            id: ['ID'],
            name: ['Name'],
            sectorId: ['Sector ID', 'Sector']
        };
    } else if (activeTab === 'plans') {
        fieldMap = {
            id: ['ID'],
            name: ['Name', 'Plan Name']
        };
    } else if (activeTab === 'users') {
        fieldMap = {
            username: ['Username', 'User'],
            name: ['Name', 'Full Name'],
            role: ['Role'],
            email: ['Email'],
            // Special handling for locations array not simple string map
        };
    }

    // Process Rows
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if(!line) continue;
        const values = parseCSVLine(line);
        const getValue = (key: string) => {
           const idx = getIdx(fieldMap[key] || []);
           if (idx > -1 && values[idx]) return values[idx].replace(/^"|"$/g, '').trim();
           return undefined;
        };

        // Determine ID Key (usually 'id', but 'username' for users)
        const idKey = activeTab === 'users' ? 'username' : 'id';
        const idVal = getValue(idKey);
        
        if (!idVal) continue; // Skip rows without ID

        // Construct Payload
        let payload: any = {};
        
        // Basic Fields
        Object.keys(fieldMap).forEach(key => {
            const val = getValue(key);
            if (val !== undefined) payload[key] = val;
        });

        // Defaults/Fallbacks based on Tab
        if (activeTab === 'items') {
             if (!payload.category) payload.category = 'General';
             if (!payload.unit) payload.unit = 'pcs';
        } else if (activeTab === 'users') {
             if (!payload.password) payload.password = 'password'; // Default password for bulk import
             if (!payload.role) payload.role = 'user';
        }

        // Action: Update or Add
        const list = activeTab === 'items' ? items : 
                     activeTab === 'machines' ? machines :
                     activeTab === 'locations' ? locations :
                     activeTab === 'sectors' ? sectors :
                     activeTab === 'divisions' ? divisions :
                     activeTab === 'plans' ? plans : users;
        
        // @ts-ignore - dynamic access
        const exists = list.find((item: any) => item[idKey] === idVal);

        if (exists) {
            // Merge existing data with imported data (imported takes precedence if present)
            const merged = { ...exists, ...payload };
            if (activeTab === 'items') onUpdateItem(merged);
            else if (activeTab === 'machines') onUpdateMachine(merged);
            else if (activeTab === 'locations') onUpdateLocation(merged);
            else if (activeTab === 'sectors') onUpdateSector(merged);
            else if (activeTab === 'divisions') onUpdateDivision(merged);
            else if (activeTab === 'plans') onUpdatePlan(merged);
            else if (activeTab === 'users') onUpdateUser(merged);
            updated++;
        } else {
            // Add new
            if (activeTab === 'items') onAddItem(payload);
            else if (activeTab === 'machines') onAddMachine(payload);
            else if (activeTab === 'locations') onAddLocation(payload);
            else if (activeTab === 'sectors') onAddSector(payload);
            else if (activeTab === 'divisions') onAddDivision(payload);
            else if (activeTab === 'plans') onAddPlan(payload);
            else if (activeTab === 'users') onAddUser(payload);
            added++;
        }
    }

    alert(`Import Complete!\nAdded: ${added}\nUpdated: ${updated}`);
  };

  // --- Column Management Logic ---
  const toggleColumnVisibility = (key: string) => {
    setColumnSettings(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].map(col => 
        col.key === key ? { ...col, visible: !col.visible } : col
      )
    }));
  };

  const handleDragStart = (e: React.DragEvent<HTMLTableHeaderCellElement>, position: number) => {
    dragItem.current = position;
  };

  const handleDragEnter = (e: React.DragEvent<HTMLTableHeaderCellElement>, position: number) => {
    dragOverItem.current = position;
  };

  const handleDrop = (e: React.DragEvent<HTMLTableHeaderCellElement>) => {
    e.preventDefault();
    const copyListItems = [...columnSettings[activeTab]];
    const dragItemContent = copyListItems[dragItem.current!];
    copyListItems.splice(dragItem.current!, 1);
    copyListItems.splice(dragOverItem.current!, 0, dragItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setColumnSettings(prev => ({ ...prev, [activeTab]: copyListItems }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const timestamp = Date.now().toString().slice(-4);
    
    if (activeTab === 'items') {
      const payload: Item = {
        id: formData.id || `ITM-${timestamp}`,
        name: formData.name, // Description
        category: formData.category || 'General',
        unit: formData.unit || 'pcs',
        // New Fields
        secondId: formData.secondId,
        thirdId: formData.thirdId,
        description2: formData.description2,
        fullName: formData.fullName,
        brand: formData.brand,
        oem: formData.oem,
        partNumber: formData.partNumber,
      };
      isEditing ? onUpdateItem(payload) : onAddItem(payload);

    } else if (activeTab === 'machines') {
      const payload: Machine = {
        id: formData.id || `M-${timestamp}`,
        name: formData.name,
        model: formData.model,
        divisionId: formData.divisionId,
        mainGroup: formData.mainGroup,
        subGroup: formData.subGroup,
        category: formData.category,
        brand: formData.brand
      };
      isEditing ? onUpdateMachine(payload) : onAddMachine(payload);

    } else if (activeTab === 'sectors') {
      const payload: Sector = {
        id: formData.id || `SEC-${timestamp}`,
        name: formData.name
      };
      isEditing ? onUpdateSector(payload) : onAddSector(payload);

    } else if (activeTab === 'divisions') {
      const payload: Division = {
        id: formData.id || `DIV-${timestamp}`,
        name: formData.name,
        sectorId: formData.sectorId
      };
      isEditing ? onUpdateDivision(payload) : onAddDivision(payload);

    } else if (activeTab === 'plans') {
        const payload: MaintenancePlan = {
            id: formData.id || `MP-${timestamp}`,
            name: formData.name
        };
        isEditing ? onUpdatePlan(payload) : onAddPlan(payload);

    } else if (activeTab === 'users') {
      const payload: User = {
        username: formData.username,
        name: formData.name,
        role: formData.role,
        email: formData.email,
        password: formData.password || (isEditing ? users.find(u => u.username === formData.username)?.password : 'password'),
        allowedLocationIds: formData.allowedLocationIds,
        allowedSectorIds: formData.allowedSectorIds,
        allowedDivisionIds: formData.allowedDivisionIds
      };
      isEditing ? onUpdateUser(payload) : onAddUser(payload);
    } else { // locations
      const payload: Location = {
        id: formData.id || `WH-${timestamp}`,
        name: formData.name,
        email: formData.email
      };
      isEditing ? onUpdateLocation(payload) : onAddLocation(payload);
    }

    setShowForm(false);
    setFormData({});
    setIsEditing(false);
  };

  const renderSyncModal = () => {
    if (!showSyncModal) return null;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
             <div className="flex items-center gap-3">
               <span className="text-2xl bg-green-100 p-2 rounded-lg">
                 {activeTab === 'items' ? '📊' : '☁️'}
               </span>
               <h3 className="text-xl font-bold text-gray-800">
                 {activeTab === 'items' ? 'Sync Items Data' : 'Cloud Configuration'}
               </h3>
             </div>
             <button onClick={() => setShowSyncModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
          </div>
          
          <div className="p-6 space-y-8">
             {/* Section 1: Import Items - Only show if Items tab is active */}
             {activeTab === 'items' && (
               <div className="space-y-4">
                 <div className="flex justify-between items-center border-b pb-2">
                   <h4 className="font-bold text-lg text-blue-700">1. Import Items from Sheet</h4>
                   <button 
                     onClick={handleResetDefaults}
                     className="text-xs text-blue-600 underline hover:text-blue-800"
                   >
                     Reset to Default Link
                   </button>
                 </div>
                 <p className="text-sm text-gray-600">
                   Read item master data directly from your Google Sheet. 
                   <br/><span className="font-semibold text-red-500">Note:</span> Paste your full "Published to web" link below and the GID will update automatically.
                 </p>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Spreadsheet ID / URL</label>
                      <input 
                        className="w-full border rounded p-2 text-sm" 
                        value={sheetId}
                        onChange={e => handleSheetIdChange(e.target.value)}
                        placeholder="Paste full URL or ID here..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">GID (Tab ID)</label>
                      <input 
                        className="w-full border rounded p-2 text-sm" 
                        value={gid}
                        onChange={e => setGid(e.target.value)}
                        placeholder="e.g. 229812258"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">If '0', it reads the first sheet.</p>
                    </div>
                 </div>
                 
                 <button 
                   onClick={handleSyncItems} 
                   disabled={syncLoading}
                   className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition flex items-center gap-2 w-full justify-center md:w-auto"
                 >
                   {syncLoading ? 'Syncing...' : '📥 Import Items Now'}
                 </button>
               </div>
             )}

             {/* Section 2: Write Config */}
             <div className="space-y-4">
               <h4 className="font-bold text-lg text-green-700 border-b pb-2">
                 {activeTab === 'items' ? '2. ' : ''}Record Issues to Cloud Database
               </h4>
               <p className="text-sm text-gray-600">
                 To create a cloud database for your records:
                 <br/>
                 1. Create a new Google Sheet named <strong className="text-black bg-yellow-100 px-1">"Main Issue Backup"</strong>.
                 <br/>
                 2. Open <b>Extensions &gt; Apps Script</b> in that sheet.
                 <br/>
                 3. Paste the code below and <b>Deploy as Web App</b> (Who has access: Anyone).
                 <br/>
                 4. Paste the URL below.
               </p>
               
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Web App URL (from Apps Script Deployment)</label>
                  <input 
                    className="w-full border rounded p-2 text-sm font-mono text-blue-600 bg-gray-50" 
                    value={scriptUrl}
                    onChange={e => setScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/..."
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty to disable auto-logging.</p>
               </div>

               {scriptUrl && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-100 flex flex-col items-center">
                      <p className="text-sm text-green-800 mb-2 font-medium">Bulk Actions</p>
                      <button 
                        onClick={handleExportHistory}
                        disabled={syncLoading}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 shadow-sm flex items-center justify-center gap-2"
                      >
                         <span>📤</span> Export All Existing History to Sheet
                      </button>
                  </div>
               )}

               <details className="text-sm border rounded-lg p-3 bg-gray-50">
                 <summary className="font-medium cursor-pointer text-blue-600 hover:text-blue-800">Show Apps Script Code to Copy</summary>
                 <div className="mt-3">
                   <pre className="bg-gray-800 text-green-400 p-3 rounded text-xs overflow-x-auto select-all">
                      {APP_SCRIPT_TEMPLATE}
                   </pre>
                 </div>
               </details>
             </div>
             
             {syncMsg && (
                <div className={`p-3 rounded text-sm ${syncMsg.includes('Error') || syncMsg.includes('No items') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                   {syncMsg}
                </div>
             )}
          </div>
          
          <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end">
            <button onClick={() => setShowSyncModal(false)} className="px-6 py-2 bg-gray-800 text-white rounded hover:bg-gray-900">Done</button>
          </div>
        </div>
      </div>
    );
  };

  const renderCellContent = (key: string, row: any) => {
    // Special Renderers
    if (activeTab === 'machines' && key === 'divisionId') {
      return divisions.find(d => d.id === row.divisionId)?.name || '-';
    }
    if (activeTab === 'divisions' && key === 'sectorId') {
      return sectors.find(s => s.id === row.sectorId)?.name || '-';
    }
    if (activeTab === 'users' && key === 'role') {
       return (
         <span className={`px-2 py-1 rounded-full text-xs font-bold ${
            row.role === 'admin' ? 'bg-purple-100 text-purple-700' :
            row.role.includes('manager') ? 'bg-orange-100 text-orange-700' :
            'bg-blue-100 text-blue-700'
         }`}>
            {row.role.replace('_', ' ').toUpperCase()}
         </span>
       );
    }
    if (activeTab === 'users' && key === 'allowedLocationIds') {
        if (row.role === 'admin') return <span className="text-green-600 font-bold text-xs">All Access</span>;
        if (!row.allowedLocationIds || row.allowedLocationIds.length === 0) return <span className="text-gray-400 italic text-xs">No restrictions</span>;
        
        return (
           <div className="flex flex-wrap gap-1 max-w-[200px]">
             {row.allowedLocationIds.map((lid: string) => (
               <span key={lid} className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200 text-xs">
                  {locations.find(l => l.id === lid)?.name || lid}
               </span>
             ))}
           </div>
        );
    }

    if (activeTab === 'users' && key === 'allowedSectorIds') {
        if (row.role === 'admin') return <span className="text-green-600 font-bold text-xs">All Access</span>;
        if (!row.allowedSectorIds || row.allowedSectorIds.length === 0) return <span className="text-gray-400 italic text-xs">No restrictions</span>;
        
        return (
           <div className="flex flex-wrap gap-1 max-w-[200px]">
             {row.allowedSectorIds.map((sid: string) => (
               <span key={sid} className="px-1.5 py-0.5 bg-indigo-100 rounded border border-indigo-200 text-xs text-indigo-800">
                  {sectors.find(s => s.id === sid)?.name || sid}
               </span>
             ))}
           </div>
        );
    }

    if (activeTab === 'users' && key === 'allowedDivisionIds') {
        if (row.role === 'admin') return <span className="text-green-600 font-bold text-xs">All Access</span>;
        if (!row.allowedDivisionIds || row.allowedDivisionIds.length === 0) return <span className="text-gray-400 italic text-xs">No restrictions</span>;
        
        return (
           <div className="flex flex-wrap gap-1 max-w-[200px]">
             {row.allowedDivisionIds.map((did: string) => (
               <span key={did} className="px-1.5 py-0.5 bg-pink-100 rounded border border-pink-200 text-xs text-pink-800">
                  {divisions.find(d => d.id === did)?.name || did}
               </span>
             ))}
           </div>
        );
    }
    
    // Default Text Render
    return <span className="text-gray-700">{row[key] || '-'}</span>;
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

    // Pagination Logic
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE) || 1;
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedData = data.slice(startIndex, endIndex);

    const visibleColumns = (columnSettings[activeTab] || []).filter(c => c.visible);

    return (
      <div className="flex flex-col space-y-4 relative">
        {/* Columns Management Tool (Hidden by default) */}
        {showColumnMenu && (
           <div className="absolute z-10 bg-white border border-gray-200 rounded-lg shadow-xl p-4 right-0 top-0 mt-2 w-64 max-h-96 overflow-y-auto animate-fade-in-up">
              <div className="flex justify-between items-center mb-2 border-b pb-2">
                 <h4 className="font-bold text-sm text-gray-700">Manage Columns</h4>
                 <button onClick={() => setShowColumnMenu(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              <div className="space-y-2">
                 {(columnSettings[activeTab] || []).map(col => (
                    <label key={col.key} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded select-none">
                       <input 
                         type="checkbox" 
                         checked={col.visible} 
                         onChange={() => toggleColumnVisibility(col.key)}
                         className="rounded text-blue-600 focus:ring-blue-500"
                       />
                       <span>{col.label}</span>
                    </label>
                 ))}
              </div>
              <div className="mt-3 pt-2 border-t text-xs text-gray-400">
                Drag headers in table to reorder.
              </div>
           </div>
        )}

        <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200 min-h-[400px]">
            <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
                <tr>
                {visibleColumns.map((col, index) => (
                    <th 
                      key={col.key} 
                      className="px-6 py-3 font-semibold text-gray-700 whitespace-nowrap cursor-move hover:bg-gray-100 select-none border-r border-transparent hover:border-gray-200 transition-colors"
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnter={(e) => handleDragEnter(e, index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 cursor-grab active:cursor-grabbing">⋮⋮</span>
                        {col.label}
                      </div>
                    </th>
                ))}
                <th className="px-6 py-3 font-semibold text-gray-700 whitespace-nowrap">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {paginatedData.map((row: any) => (
                <tr key={row.id || row.username} className="hover:bg-gray-50 transition">
                    {visibleColumns.map(col => (
                       <td key={col.key} className="px-6 py-3 align-top">
                          {renderCellContent(col.key, row)}
                       </td>
                    ))}

                    <td className="px-6 py-3 align-top">
                       <div className="flex items-center gap-3">
                        <button 
                            onClick={() => handleEdit(row)}
                            className="text-blue-600 hover:text-blue-900 font-medium hover:underline"
                        >
                            Edit
                        </button>
                        {activeTab === 'items' && (
                             <button 
                                onClick={() => handleDelete(row.id)}
                                className="text-red-600 hover:text-red-900 font-medium hover:underline text-xs"
                             >
                                Remove
                            </button>
                        )}
                       </div>
                    </td>
                </tr>
                ))}
                {data.length === 0 && (
                <tr>
                    <td colSpan={visibleColumns.length + 1} className="px-6 py-8 text-center text-gray-400">
                    No records found.
                    </td>
                </tr>
                )}
            </tbody>
            </table>
        </div>

        {/* Pagination Controls */}
        {data.length > ITEMS_PER_PAGE && (
            <div className="flex justify-between items-center px-4">
                <div className="text-sm text-gray-500">
                    Showing {startIndex + 1} to {Math.min(endIndex, data.length)} of {data.length} entries
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
                    >
                        ⬅️
                    </button>
                    <span className="text-sm font-medium text-gray-700">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
                    >
                        ➡️
                    </button>
                </div>
            </div>
        )}
      </div>
    );
  };

  const renderForm = () => {
    if (!showForm) return null;

    const commonInputClass = "w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none";
    const labelClass = "block text-sm font-medium text-gray-700 mb-1";

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
            <h3 className="text-xl font-bold text-gray-800">
              {isEditing ? 'Edit' : 'Add New'} {activeTab === 'items' ? 'Item' : activeTab === 'users' ? 'User' : activeTab.slice(0, -1)}
            </h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
          </div>
          
          <form onSubmit={handleSave} className="p-6 space-y-4">
            
            {/* ID Field */}
            {activeTab !== 'users' && (
              <div>
                <label className={labelClass}>ID {isEditing && <span className="text-xs text-gray-400">(Read-only)</span>}</label>
                <input
                  type="text"
                  className={`${commonInputClass} ${isEditing ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  value={formData.id || ''}
                  onChange={e => setFormData({ ...formData, id: e.target.value })}
                  placeholder={isEditing ? '' : 'Leave empty to auto-generate'}
                  disabled={isEditing}
                />
              </div>
            )}

            {/* ITEMS */}
            {activeTab === 'items' && (
              <>
                 <div>
                    <label className={labelClass}>Description / Name</label>
                    <input required className={commonInputClass} value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Category</label>
                      <input className={commonInputClass} value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="General" />
                    </div>
                    <div>
                      <label className={labelClass}>Unit (UM)</label>
                      <input className={commonInputClass} value={formData.unit || ''} onChange={e => setFormData({...formData, unit: e.target.value})} placeholder="pcs" />
                    </div>
                 </div>
                 <div>
                    <label className={labelClass}>Full Name</label>
                    <input className={commonInputClass} value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className={labelClass}>2nd Item No</label>
                       <input className={commonInputClass} value={formData.secondId || ''} onChange={e => setFormData({...formData, secondId: e.target.value})} />
                    </div>
                    <div>
                       <label className={labelClass}>3rd Item No</label>
                       <input className={commonInputClass} value={formData.thirdId || ''} onChange={e => setFormData({...formData, thirdId: e.target.value})} />
                    </div>
                 </div>
                 <div>
                    <label className={labelClass}>Desc Line 2</label>
                    <input className={commonInputClass} value={formData.description2 || ''} onChange={e => setFormData({...formData, description2: e.target.value})} />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className={labelClass}>Brand</label>
                       <input className={commonInputClass} value={formData.brand || ''} onChange={e => setFormData({...formData, brand: e.target.value})} />
                    </div>
                    <div>
                       <label className={labelClass}>Part Number</label>
                       <input className={commonInputClass} value={formData.partNumber || ''} onChange={e => setFormData({...formData, partNumber: e.target.value})} />
                    </div>
                 </div>
                 <div>
                       <label className={labelClass}>OEM</label>
                       <input className={commonInputClass} value={formData.oem || ''} onChange={e => setFormData({...formData, oem: e.target.value})} />
                 </div>
              </>
            )}

            {/* MACHINES */}
            {activeTab === 'machines' && (
              <>
                <div>
                   <label className={labelClass}>Machine Name</label>
                   <input required className={commonInputClass} value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                   <label className={labelClass}>Model</label>
                   <input className={commonInputClass} value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} />
                </div>
                <div>
                    <label className={labelClass}>Division</label>
                    <select 
                      className={commonInputClass}
                      value={formData.divisionId || ''}
                      onChange={e => setFormData({...formData, divisionId: e.target.value})}
                    >
                        <option value="">Select Division...</option>
                        {divisions.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className={labelClass}>Main Group</label>
                       <input className={commonInputClass} value={formData.mainGroup || ''} onChange={e => setFormData({...formData, mainGroup: e.target.value})} />
                    </div>
                    <div>
                       <label className={labelClass}>Sub Group</label>
                       <input className={commonInputClass} value={formData.subGroup || ''} onChange={e => setFormData({...formData, subGroup: e.target.value})} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className={labelClass}>Category</label>
                       <input className={commonInputClass} value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} />
                    </div>
                    <div>
                       <label className={labelClass}>Brand</label>
                       <input className={commonInputClass} value={formData.brand || ''} onChange={e => setFormData({...formData, brand: e.target.value})} />
                    </div>
                </div>
              </>
            )}

            {/* LOCATIONS */}
            {activeTab === 'locations' && (
              <>
                 <div>
                    <label className={labelClass}>Location Name</label>
                    <input required className={commonInputClass} value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                 </div>
                 <div>
                    <label className={labelClass}>Site Email</label>
                    <input type="email" className={commonInputClass} value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                 </div>
              </>
            )}

            {/* SECTORS */}
            {activeTab === 'sectors' && (
              <>
                 <div>
                    <label className={labelClass}>Sector Name</label>
                    <input required className={commonInputClass} value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                 </div>
              </>
            )}

            {/* DIVISIONS */}
            {activeTab === 'divisions' && (
              <>
                 <div>
                    <label className={labelClass}>Division Name</label>
                    <input required className={commonInputClass} value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                 </div>
                 <div>
                    <label className={labelClass}>Parent Sector</label>
                    <select 
                      required
                      className={commonInputClass}
                      value={formData.sectorId || ''}
                      onChange={e => setFormData({...formData, sectorId: e.target.value})}
                    >
                        <option value="">Select Sector...</option>
                        {sectors.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                 </div>
              </>
            )}

            {/* PLANS */}
            {activeTab === 'plans' && (
              <>
                 <div>
                    <label className={labelClass}>Maintenance Plan Name</label>
                    <input required className={commonInputClass} value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                 </div>
              </>
            )}

            {/* USERS */}
            {activeTab === 'users' && (
              <>
                 <div>
                    <label className={labelClass}>Username</label>
                    <input 
                       required 
                       className={`${commonInputClass} ${isEditing ? 'bg-gray-100 cursor-not-allowed' : ''}`} 
                       value={formData.username || ''} 
                       onChange={e => setFormData({...formData, username: e.target.value})}
                       disabled={isEditing}
                    />
                 </div>
                 <div>
                    <label className={labelClass}>Full Name</label>
                    <input required className={commonInputClass} value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                 </div>
                 <div>
                    <label className={labelClass}>Email</label>
                    <input required type="email" className={commonInputClass} value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                 </div>
                 <div>
                    <label className={labelClass}>Role</label>
                    <select 
                      required
                      className={commonInputClass}
                      value={formData.role || 'user'}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                    >
                        <option value="user">User (Operator)</option>
                        <option value="admin">Admin</option>
                        <option value="warehouse_manager">Warehouse Manager</option>
                        <option value="warehouse_supervisor">Warehouse Supervisor</option>
                        <option value="maintenance_manager">Maintenance Manager</option>
                        <option value="maintenance_engineer">Maintenance Engineer</option>
                    </select>
                 </div>
                 <div>
                    <label className={labelClass}>Password</label>
                    <input 
                      type="password" 
                      className={commonInputClass} 
                      value={formData.password || ''} 
                      onChange={e => setFormData({...formData, password: e.target.value})} 
                      placeholder={isEditing ? 'Leave blank to keep current' : 'Enter password'} 
                    />
                 </div>
                 {/* Multi-Select for Locations */}
                 <div>
                    <label className={labelClass}>Allowed Locations (Optional)</label>
                    <div className="border border-gray-300 rounded-lg p-2 max-h-32 overflow-y-auto bg-gray-50">
                        {locations.map(loc => (
                            <label key={loc.id} className="flex items-center space-x-2 p-1 hover:bg-white cursor-pointer rounded">
                                <input 
                                  type="checkbox"
                                  checked={(formData.allowedLocationIds || []).includes(loc.id)}
                                  onChange={(e) => {
                                      const current = formData.allowedLocationIds || [];
                                      if (e.target.checked) {
                                          setFormData({...formData, allowedLocationIds: [...current, loc.id]});
                                      } else {
                                          setFormData({...formData, allowedLocationIds: current.filter((id: string) => id !== loc.id)});
                                      }
                                  }}
                                  className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{loc.name}</span>
                            </label>
                        ))}
                        {locations.length === 0 && <p className="text-xs text-gray-400 p-1">No locations defined yet.</p>}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Users can only create issues for these locations. Admin has all access.</p>
                 </div>

                 {/* Multi-Select for Sectors */}
                 <div>
                    <label className={labelClass}>Allowed Sectors (Optional)</label>
                    <div className="border border-gray-300 rounded-lg p-2 max-h-32 overflow-y-auto bg-gray-50">
                        {sectors.map(sec => (
                            <label key={sec.id} className="flex items-center space-x-2 p-1 hover:bg-white cursor-pointer rounded">
                                <input 
                                  type="checkbox"
                                  checked={(formData.allowedSectorIds || []).includes(sec.id)}
                                  onChange={(e) => {
                                      const current = formData.allowedSectorIds || [];
                                      if (e.target.checked) {
                                          setFormData({...formData, allowedSectorIds: [...current, sec.id]});
                                      } else {
                                          setFormData({...formData, allowedSectorIds: current.filter((id: string) => id !== sec.id)});
                                      }
                                  }}
                                  className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{sec.name}</span>
                            </label>
                        ))}
                        {sectors.length === 0 && <p className="text-xs text-gray-400 p-1">No sectors defined.</p>}
                    </div>
                 </div>

                 {/* Multi-Select for Divisions */}
                 <div>
                    <label className={labelClass}>Allowed Divisions (Optional)</label>
                    <div className="border border-gray-300 rounded-lg p-2 max-h-32 overflow-y-auto bg-gray-50">
                        {divisions.map(div => (
                            <label key={div.id} className="flex items-center space-x-2 p-1 hover:bg-white cursor-pointer rounded">
                                <input 
                                  type="checkbox"
                                  checked={(formData.allowedDivisionIds || []).includes(div.id)}
                                  onChange={(e) => {
                                      const current = formData.allowedDivisionIds || [];
                                      if (e.target.checked) {
                                          setFormData({...formData, allowedDivisionIds: [...current, div.id]});
                                      } else {
                                          setFormData({...formData, allowedDivisionIds: current.filter((id: string) => id !== div.id)});
                                      }
                                  }}
                                  className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{div.name}</span>
                            </label>
                        ))}
                        {divisions.length === 0 && <p className="text-xs text-gray-400 p-1">No divisions defined.</p>}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Leave empty to allow all (unless filtered by Sector).</p>
                 </div>
              </>
            )}

            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-4">
               <button 
                 type="button"
                 onClick={() => setShowForm(false)}
                 className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
               >
                 Cancel
               </button>
               <button 
                 type="submit"
                 className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition transform hover:-translate-y-0.5"
               >
                 {isEditing ? 'Update' : 'Create'} {activeTab === 'users' ? 'User' : 'Record'}
               </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Input for Imports */}
      <input 
        type="file" 
        accept=".csv,.txt" 
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
           <button
             onClick={handleImportClick}
             className="flex items-center px-4 py-2 bg-orange-100 text-orange-800 border border-orange-200 rounded-lg hover:bg-orange-200 shadow-sm transition"
           >
             <span className="mr-2 text-lg">📂</span>
             Import Excel/CSV
           </button>

           <button
             onClick={handleExportDataToExcel}
             className="flex items-center px-4 py-2 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg hover:bg-emerald-200 shadow-sm transition"
           >
             <span className="mr-2 text-lg">📥</span>
             Export Excel
           </button>

           <button
               onClick={() => setShowSyncModal(true)}
               className={`flex items-center px-4 py-2 bg-white border rounded-lg shadow-sm transition ${
                 activeTab === 'items' 
                   ? 'text-green-700 border-green-200 hover:bg-green-50' 
                   : 'text-gray-700 border-gray-200 hover:bg-gray-50'
               }`}
           >
             <span className="mr-2">
               {activeTab === 'items' ? '📊' : '⚙️'}
             </span> 
             {activeTab === 'items' ? 'Sync Items' : 'Cloud Config'}
           </button>

           <button
             onClick={() => setShowColumnMenu(!showColumnMenu)}
             className={`flex items-center px-4 py-2 bg-white border rounded-lg shadow-sm transition ${
                showColumnMenu ? 'bg-gray-100 ring-2 ring-blue-200' : 'hover:bg-gray-50'
             }`}
           >
             <span className="mr-2">👁️</span>
             Columns
           </button>

           <button
             onClick={handleAddNew}
             className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition"
           >
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