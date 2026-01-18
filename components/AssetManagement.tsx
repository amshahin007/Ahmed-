
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Machine, Location, Sector, Division, BreakdownRecord, Item, BOMRecord } from '../types';
import * as XLSX from 'xlsx';
import { fetchRawCSV, extractSheetIdFromUrl, DEFAULT_SHEET_ID } from '../services/googleSheetsService';
import SearchableSelect, { Option } from './SearchableSelect';

interface AssetManagementProps {
  machines: Machine[];
  items: Item[]; // Needed for BOM
  bomRecords: BOMRecord[]; // Needed for BOM
  locations: Location[];
  sectors: Sector[];
  divisions: Division[];
  breakdowns: BreakdownRecord[];
  
  onAddMachine: (machine: Machine) => void;
  onUpdateMachine: (machine: Machine) => void;
  onDeleteMachines: (ids: string[]) => void;
  
  onAddBreakdown: (breakdown: BreakdownRecord) => void;
  onUpdateBreakdown: (breakdown: BreakdownRecord) => void;
  
  onAddBOM: (bom: BOMRecord) => void;
  onUpdateBOM: (bom: BOMRecord) => void;
  onDeleteBOMs: (ids: string[]) => void;

  onBulkImport: (tab: string, added: any[], updated: any[]) => void;
  setCurrentView: (view: string) => void;
}

const ITEMS_PER_PAGE = 50;

const AssetManagement: React.FC<AssetManagementProps> = ({
  machines, items, bomRecords, locations, sectors, divisions, breakdowns,
  onAddMachine, onUpdateMachine, onDeleteMachines,
  onAddBreakdown, onUpdateBreakdown,
  onAddBOM, onUpdateBOM, onDeleteBOMs,
  onBulkImport, setCurrentView
}) => {
  const [activeTab, setActiveTab] = useState<'assets' | 'breakdowns' | 'bom'>('assets');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filters
  const [filterLocationId, setFilterLocationId] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Open' | 'Closed'>('All'); // For Breakdowns
  const [assetFilterStatus, setAssetFilterStatus] = useState('All'); // For Machines
  const [filterLocalNo, setFilterLocalNo] = useState(''); 
  const [filterMachineName, setFilterMachineName] = useState('');
  
  // BOM Filters
  const [bomFilterMachine, setBomFilterMachine] = useState('');
  const [bomFilterModel, setBomFilterModel] = useState('');
  
  // Sync State
  const [syncConfig, setSyncConfig] = useState<Record<string, { sheetId: string }>>(() => {
     try {
         const saved = localStorage.getItem('wf_asset_sync_config');
         return saved ? JSON.parse(saved) : { machines: { sheetId: DEFAULT_SHEET_ID }, breakdowns: { sheetId: DEFAULT_SHEET_ID }, bom: { sheetId: DEFAULT_SHEET_ID } };
     } catch { return { machines: { sheetId: DEFAULT_SHEET_ID }, breakdowns: { sheetId: DEFAULT_SHEET_ID }, bom: { sheetId: DEFAULT_SHEET_ID } }; }
  });
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      localStorage.setItem('wf_asset_sync_config', JSON.stringify(syncConfig));
      setSelectedIds(new Set());
  }, [syncConfig, activeTab]);

  // Reset pagination on tab or filter change
  useEffect(() => {
      setCurrentPage(1);
      setSelectedIds(new Set());
  }, [activeTab, searchTerm, filterLocationId, filterStatus, assetFilterStatus, filterLocalNo, filterMachineName, bomFilterMachine, bomFilterModel]);

  // --- OPTIMIZATION: Memoize Item Map for O(1) Lookups ---
  const itemsMap = useMemo(() => {
      const map = new Map<string, Item>();
      items.forEach(i => map.set(i.id, i));
      return map;
  }, [items]);

  const handleSheetUrlPaste = (val: string) => {
      let tabKey = 'machines';
      if (activeTab === 'breakdowns') tabKey = 'breakdowns';
      if (activeTab === 'bom') tabKey = 'bom';

      setSyncConfig(prev => ({
          ...prev,
          [tabKey]: { sheetId: val }
      }));
  };

  const handleSyncData = async () => {
      let tabKey = 'machines';
      if (activeTab === 'breakdowns') tabKey = 'breakdowns';
      if (activeTab === 'bom') tabKey = 'bom';

      const config = syncConfig[tabKey];
      
      if (!config?.sheetId) {
          setSyncMsg("Please enter a Sheet ID/URL.");
          return;
      }
      
      setSyncLoading(true);
      setSyncMsg(`Syncing ${tabKey}...`);
      
      try {
          const cleanId = extractSheetIdFromUrl(config.sheetId);
          const rows = await fetchRawCSV(cleanId, '0'); // defaulting to first tab
          if(rows && rows.length > 1) {
             processImport(rows, tabKey);
             setSyncMsg("Sync success!");
          } else {
             setSyncMsg("No data found or empty sheet.");
          }
      } catch (e: any) {
          setSyncMsg(`Error: ${e.message}`);
      } finally {
          setSyncLoading(false);
      }
  };

  const processImport = (rows: any[][], tab: string) => {
      const headers = rows[0].map(h => String(h).toLowerCase().trim());
      const dataRows = rows.slice(1);
      
      const toAdd: any[] = [];
      const toUpdate: any[] = [];
      
      dataRows.forEach(row => {
          const obj: any = {};
          headers.forEach((h, i) => {
             // Map headers to keys
             if(h.includes('id') && !obj.id) obj.id = String(row[i]);
             else if(h.includes('name') || h.includes('desc')) {
                 if(tab === 'machines') obj.category = String(row[i]);
                 if(tab === 'breakdowns') obj.machineName = String(row[i]);
             }
             else if (h.includes('status')) obj.status = String(row[i]);
             else if (h.includes('brand')) obj.brand = String(row[i]);
             else if (h.includes('model') && tab !== 'bom') obj.modelNo = String(row[i]); // for machines
             else if (h.includes('model') && tab === 'bom') obj.modelNo = String(row[i]); // for bom
             else if (h.includes('chase')) obj.chaseNo = String(row[i]);
             else if (h.includes('division')) obj.divisionId = String(row[i]);
             else if (h.includes('sector')) obj.sectorId = String(row[i]);
             else if (h.includes('location')) obj.locationId = String(row[i]);
             else if ((h.includes('main') && h.includes('group'))) obj.mainGroup = String(row[i]);
             else if ((h.includes('sub') && h.includes('group'))) obj.subGroup = String(row[i]);
             else if (h.includes('local') && h.includes('no')) obj.machineLocalNo = String(row[i]);
             
             // BOM Specifics
             if (tab === 'bom') {
                 if (h.includes('machine') && h.includes('name')) obj.machineCategory = String(row[i]);
                 if (h.includes('item') && h.includes('id')) obj.itemId = String(row[i]);
                 if (h.includes('qty') || h.includes('quantity')) obj.quantity = Number(row[i]);
             }
          });
          
          if(obj.id) {
              // Ensure defaults for critical fields to prevent crashes
              if (tab === 'machines') {
                  obj.category = obj.category || 'Unknown Machine';
                  obj.status = obj.status || 'Working';
                  obj.machineLocalNo = obj.machineLocalNo || '';
              } else if (tab === 'breakdowns') {
                  obj.machineName = obj.machineName || 'Unknown Machine';
                  obj.status = obj.status || 'Open';
              } else if (tab === 'bom') {
                  obj.machineCategory = obj.machineCategory || 'Unknown';
                  obj.modelNo = obj.modelNo || 'Unknown';
                  obj.itemId = obj.itemId || 'Unknown';
              }

              // check existence
              const list = tab === 'machines' ? machines : (tab === 'breakdowns' ? breakdowns : bomRecords);
              const exists = list.find((i:any) => i.id === obj.id);
              if(exists) toUpdate.push({...exists, ...obj});
              else toAdd.push(obj);
          }
      });
      
      onBulkImport(tab, toAdd, toUpdate);
  };
  
  const handleBackup = async () => {
      alert("Backup feature requires configuring specific script endpoint for this module.");
  };

  const handleExport = () => {
      let data: any[] = [];
      if (activeTab === 'assets') data = machines;
      if (activeTab === 'breakdowns') data = breakdowns;
      if (activeTab === 'bom') data = bomRecords;

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeTab);
      XLSX.writeFile(wb, `${activeTab}_export.xlsx`);
  };

  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(!file) return;
      
      const reader = new FileReader();
      reader.onload = (evt) => {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, {type: 'binary'});
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, {header: 1}) as any[][];
          
          let tab = 'machines';
          if (activeTab === 'breakdowns') tab = 'breakdowns';
          if (activeTab === 'bom') tab = 'bom';

          processImport(data, tab);
      };
      reader.readAsBinaryString(file);
      e.target.value = ''; // reset
  };
  
  const handleBulkDelete = () => {
      if(selectedIds.size === 0) return;
      if(confirm(`Delete ${selectedIds.size} records?`)) {
          const ids = Array.from(selectedIds);
          if (activeTab === 'assets') onDeleteMachines(ids);
          if (activeTab === 'bom') onDeleteBOMs(ids);
          // Breakdown bulk delete not implemented in props, can be added
          setSelectedIds(new Set());
      }
  };

  const openAssetForm = (asset?: Machine) => {
      setFormData(asset || {});
      setIsEditing(!!asset);
      setShowForm(true);
  };

  const openBOMForm = (bom?: BOMRecord) => {
      setFormData(bom || { id: `BOM-${Date.now()}`, quantity: 1 });
      setIsEditing(!!bom);
      setShowForm(true);
  };

  const openBreakdownForm = (bd?: BreakdownRecord) => {
      if (bd) {
          // Calculate initial duration if start and end exist
          let durationStr = '';
          if (bd.startTime && bd.endTime) {
              const start = new Date(bd.startTime).getTime();
              const end = new Date(bd.endTime).getTime();
              if (end > start) {
                  durationStr = ((end - start) / (1000 * 60 * 60)).toFixed(2);
              }
          }
          // Find machine to get Local No if not saved
          const m = machines.find(mac => mac.id === bd.machineId);
          setFormData({ ...bd, duration: durationStr, machineLocalNo: bd.machineLocalNo || m?.machineLocalNo || '' });
          setIsEditing(true);
      } else {
          setFormData({
              id: `BD-${Date.now()}`,
              startTime: new Date().toISOString().slice(0, 16),
              status: 'Open',
              failureType: 'Mechanical',
              operatorName: '',
              machineId: '',
              machineName: '',
              machineLocalNo: '',
              locationId: filterLocationId || '',
              sectorId: '', 
              divisionId: '',
              duration: ''
          });
          setIsEditing(false);
      }
      setShowForm(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      if(activeTab === 'assets') {
          if(isEditing) onUpdateMachine(formData as Machine);
          else onAddMachine({...formData, id: formData.id || `M-${Date.now()}`} as Machine);
      } else if (activeTab === 'bom') {
          if(isEditing) onUpdateBOM(formData as BOMRecord);
          else onAddBOM({...formData, id: formData.id || `BOM-${Date.now()}`} as BOMRecord);
      } else {
          // Breakdown Logic
          if (formData.startTime && formData.endTime) {
              const start = new Date(formData.startTime);
              const end = new Date(formData.endTime);
              if (end < start) {
                  alert("⚠️ Error: End Time cannot be earlier than Start Time.");
                  return;
              }
          }
          const selectedMachine = machines.find(m => m.id === formData.machineId);
          const { duration, ...cleanData } = formData;
          const finalRecord: BreakdownRecord = {
             ...cleanData,
             machineName: selectedMachine?.category || formData.machineName || 'Unknown',
             locationId: formData.locationId || selectedMachine?.locationId || 'Unknown',
             sectorId: formData.sectorId || selectedMachine?.sectorId || '', 
             divisionId: formData.divisionId || selectedMachine?.divisionId || '',
             machineLocalNo: formData.machineLocalNo || selectedMachine?.machineLocalNo || '',
          };
          if(isEditing) onUpdateBreakdown(finalRecord);
          else onAddBreakdown(finalRecord);
          if (selectedMachine) {
              if (finalRecord.status === 'Open') onUpdateMachine({ ...selectedMachine, status: 'Not Working' });
              else if (finalRecord.status === 'Closed') onUpdateMachine({ ...selectedMachine, status: 'Working' });
          }
      }
      setShowForm(false);
  };

  const handleMaterialRequest = () => {
    if (!formData.locationId || !formData.machineId) {
        alert("Please select Location and Machine first.");
        return;
    }
    let derivedSectorId = formData.sectorId;
    if (!derivedSectorId && formData.divisionId) {
        const div = divisions.find(d => d.id === formData.divisionId);
        if (div) derivedSectorId = div.sectorId;
    }
    localStorage.setItem('wf_issue_prefill', JSON.stringify({
        locationId: formData.locationId,
        sectorId: derivedSectorId,
        divisionId: formData.divisionId,
        machineId: formData.machineId,
        maintenancePlanId: 'MP-003' 
    }));
    setShowForm(false);
    setCurrentView('issue-form');
  };

  // --- FILTER HELPERS (Memoized for Performance) ---
  const selectedFilterLocation = useMemo(() => locations.find(l => l.id === filterLocationId), [locations, filterLocationId]);

  // Filter machines for ASSETS View
  const filteredMachines = useMemo(() => machines.filter(m => 
      ((m.category || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (m.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.brand || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.mainGroup || '').toLowerCase().includes(searchTerm.toLowerCase())) &&
      (!filterLocationId || m.locationId === filterLocationId || (selectedFilterLocation && m.locationId === selectedFilterLocation.name)) &&
      (assetFilterStatus === 'All' || m.status === assetFilterStatus) &&
      (!filterLocalNo || m.machineLocalNo === filterLocalNo) &&
      (!filterMachineName || m.category === filterMachineName)
  ), [machines, searchTerm, filterLocationId, selectedFilterLocation, assetFilterStatus, filterLocalNo, filterMachineName]);

  // Filter BOMs
  const filteredBOMs = useMemo(() => bomRecords.filter(b => {
      const item = itemsMap.get(b.itemId); // O(1) Lookup
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        (b.machineCategory || '').toLowerCase().includes(term) ||
        (b.modelNo || '').toLowerCase().includes(term) ||
        (b.itemId || '').toLowerCase().includes(term) ||
        (item?.name || '').toLowerCase().includes(term) ||
        (item?.partNumber || '').toLowerCase().includes(term);

      const matchesMachine = bomFilterMachine ? b.machineCategory === bomFilterMachine : true;
      const matchesModel = bomFilterModel ? b.modelNo === bomFilterModel : true;

      return matchesSearch && matchesMachine && matchesModel;
  }), [bomRecords, itemsMap, searchTerm, bomFilterMachine, bomFilterModel]);

  // Filter Breakdowns
  const filteredBreakdowns = useMemo(() => breakdowns.filter(b => 
      ((b.machineName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.id || '').toLowerCase().includes(searchTerm.toLowerCase())) &&
      (!filterLocationId || b.locationId === filterLocationId || (selectedFilterLocation && b.locationId === selectedFilterLocation.name)) &&
      (filterStatus === 'All' || b.status === filterStatus)
  ).sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()), 
  [breakdowns, searchTerm, filterLocationId, selectedFilterLocation, filterStatus]);


  // --- PAGINATION HELPERS ---
  const getPaginatedData = (data: any[]) => {
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      return data.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  };

  const renderPagination = (totalItems: number) => {
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
      if (totalPages <= 1) return null;
      return (
          <div className="flex justify-between items-center p-3 border-t bg-gray-50 text-xs">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1 border rounded bg-white disabled:opacity-50">Previous</button>
              <span>Page {currentPage} of {totalPages} ({totalItems} records)</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1 border rounded bg-white disabled:opacity-50">Next</button>
          </div>
      );
  };

  // --- OPTIONS GENERATORS ---
  const machineNameOptions = useMemo(() => Array.from(new Set(machines.map(m => m.category).filter(Boolean))).sort().map(n => ({ id: String(n), label: String(n) })), [machines]);
  
  // Options for Models specifically for BOM creation form (dependent on selected Machine Name)
  const bomFormModelOptions = useMemo(() => {
      if (!formData.machineCategory) return [];
      const relevantMachines = machines.filter(m => m.category === formData.machineCategory);
      const models = new Set(relevantMachines.map(m => m.modelNo).filter(Boolean));
      return Array.from(models).sort().map(m => ({ id: String(m), label: String(m) }));
  }, [machines, formData.machineCategory]);

  const bomModelOptions = useMemo(() => {
      if (!bomFilterMachine) return [];
      const relevantMachines = machines.filter(m => m.category === bomFilterMachine);
      const models = new Set(relevantMachines.map(m => m.modelNo).filter(Boolean));
      return Array.from(models).sort().map(m => ({ id: String(m), label: String(m) }));
  }, [machines, bomFilterMachine]);

  const itemOptions = useMemo(() => items.map(i => ({ id: i.id, label: i.id, subLabel: i.name })), [items]);

  // Helper for BOM table display
  const getItemDisplay = (itemId: string) => itemsMap.get(itemId);

  // Define Current View Data for Selection Logic
  const currentViewData = activeTab === 'assets' ? filteredMachines : (activeTab === 'bom' ? filteredBOMs : []);

  const handleSelectAllPage = (pageItems: any[]) => {
      const allSelected = pageItems.every((i: any) => selectedIds.has(i.id));
      const newSet = new Set(selectedIds);
      pageItems.forEach((i: any) => allSelected ? newSet.delete(i.id) : newSet.add(i.id));
      setSelectedIds(newSet);
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in-up">
      {/* Top Header & Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          
          {/* Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-lg shrink-0 overflow-x-auto">
                <button onClick={() => setActiveTab('assets')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'assets' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Machines</button>
                <button onClick={() => setActiveTab('bom')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'bom' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>BOM (Parts)</button>
                <button onClick={() => setActiveTab('breakdowns')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'breakdowns' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Breakdowns</button>
          </div>
          
          {/* Global Actions Toolbar */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.csv" onChange={handleFileChange} />
                
                {/* Sync Controls */}
                <div className="flex items-center gap-1 bg-blue-50 p-1 rounded-lg border border-blue-100">
                    <input 
                       type="text" 
                       className="text-xs bg-white border border-blue-200 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-400 focus:outline-none w-32 xl:w-48 text-blue-800 placeholder-blue-300" 
                       placeholder={`ID or URL for ${activeTab}...`}
                       value={syncConfig[activeTab === 'assets' ? 'machines' : activeTab === 'bom' ? 'bom' : 'breakdowns']?.sheetId || ''}
                       onChange={(e) => handleSheetUrlPaste(e.target.value)}
                    />
                    <button onClick={handleSyncData} disabled={syncLoading} className="px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition shadow-sm disabled:opacity-50 text-xs font-bold" title="Fetch data">
                       {syncLoading ? <span className="animate-spin">↻</span> : <span>⬇️</span>}
                    </button>
                </div>
                <button onClick={handleExport} className="px-3 py-2 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 border border-green-200 flex items-center justify-center gap-1 whitespace-nowrap"><span>📊</span> Export</button>
                <button onClick={handleImportClick} className="px-3 py-2 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold hover:bg-orange-100 border border-orange-200 flex items-center justify-center gap-1 whitespace-nowrap"><span>📂</span> Import</button>
                <div className="relative flex-1 xl:w-48 min-w-[150px]">
                    <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                    <span className="absolute left-2.5 top-2.5 text-gray-400 text-sm">🔍</span>
                </div>
          </div>
      </div>
      
      {syncMsg && <div className={`text-xs px-4 py-2 rounded-lg border flex items-center gap-2 ${syncMsg.includes('Failed') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}><span className="text-lg">{syncMsg.includes('Failed') ? '⚠️' : 'ℹ️'}</span>{syncMsg}</div>}

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          
          {/* --- TAB 1: ASSETS --- */}
          {activeTab === 'assets' && (
              <>
                <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row justify-between bg-gray-50 items-start lg:items-end gap-4">
                    <h3 className="font-bold text-gray-700 pb-2">Machine List</h3>
                    <div className="flex flex-wrap gap-2 w-full lg:w-auto items-end">
                        <select value={filterLocationId} onChange={(e) => setFilterLocationId(e.target.value)} className="w-36 h-9 px-2 border border-gray-300 rounded text-sm bg-white"><option value="">All Locations</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
                        <div className="w-40"><SearchableSelect label="" placeholder="Machine Name" options={machineNameOptions} value={filterMachineName} onChange={setFilterMachineName} compact={true}/></div>
                        <div className="flex gap-2">
                            {selectedIds.size > 0 && <button onClick={handleBulkDelete} className="h-9 px-3 bg-red-100 text-red-600 rounded hover:bg-red-200 text-xs font-bold">Delete ({selectedIds.size})</button>}
                            <button onClick={() => openAssetForm()} className="h-9 px-4 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-bold whitespace-nowrap">+ New</button>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-gray-100 text-gray-700 sticky top-0 border-b border-gray-200">
                            <tr>
                                <th className="p-2 w-10">
                                    <input type="checkbox" checked={getPaginatedData(filteredMachines).length > 0 && getPaginatedData(filteredMachines).every(m => selectedIds.has(m.id))} onChange={() => handleSelectAllPage(getPaginatedData(filteredMachines))} />
                                </th>
                                <th className="p-2">ID</th><th className="p-2">Local No</th><th className="p-2">Machine Name</th><th className="p-2">Status</th><th className="p-2">Brand</th><th className="p-2">Model</th><th className="p-2">Loc</th><th className="p-2 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {getPaginatedData(filteredMachines).map(m => (
                                <tr key={m.id} className="hover:bg-orange-50">
                                    <td className="p-2"><input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => {const newSet = new Set(selectedIds); newSet.has(m.id) ? newSet.delete(m.id) : newSet.add(m.id); setSelectedIds(newSet);}} /></td>
                                    <td className="p-2 font-mono">{m.id}</td><td className="p-2 font-mono text-blue-600">{m.machineLocalNo}</td><td className="p-2 font-bold">{m.category}</td>
                                    <td className="p-2"><span className={`px-2 py-0.5 rounded text-[10px] ${m.status === 'Working' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.status}</span></td>
                                    <td className="p-2">{m.brand}</td><td className="p-2">{m.modelNo}</td><td className="p-2">{m.locationId}</td>
                                    <td className="p-2 text-right"><button onClick={() => openAssetForm(m)} className="text-blue-600 hover:underline">Edit</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {renderPagination(filteredMachines.length)}
              </>
          )}

          {/* --- TAB 3: BOM --- */}
          {activeTab === 'bom' && (
              <>
                <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row justify-between bg-gray-50 items-start lg:items-end gap-4">
                    <h3 className="font-bold text-gray-700 pb-2">Bill of Materials (Spare Parts)</h3>
                    <div className="flex flex-wrap gap-2 w-full lg:w-auto items-end">
                        <div className="w-48">
                            <label className="block text-xs font-bold text-gray-600 mb-1">Filter by Machine Name</label>
                            <SearchableSelect label="" placeholder="All Machines" options={machineNameOptions} value={bomFilterMachine} onChange={(v) => {setBomFilterMachine(v); setBomFilterModel('');}} compact={true} />
                        </div>
                        <div className="w-48">
                             <label className="block text-xs font-bold text-gray-600 mb-1">Filter by Model</label>
                             <SearchableSelect label="" placeholder="All Models" options={bomModelOptions} value={bomFilterModel} onChange={setBomFilterModel} compact={true} disabled={!bomFilterMachine} />
                        </div>
                        <div className="flex gap-2 pb-0.5">
                            {selectedIds.size > 0 && <button onClick={handleBulkDelete} className="h-9 px-3 bg-red-100 text-red-600 rounded hover:bg-red-200 text-xs font-bold">Delete ({selectedIds.size})</button>}
                            <button onClick={() => openBOMForm()} className="h-9 px-4 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-bold whitespace-nowrap flex items-center">+ New Part</button>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-gray-100 text-gray-700 sticky top-0 border-b border-gray-200">
                            <tr>
                                <th className="p-2 w-10">
                                    <input type="checkbox" checked={getPaginatedData(filteredBOMs).length > 0 && getPaginatedData(filteredBOMs).every(b => selectedIds.has(b.id))} onChange={() => handleSelectAllPage(getPaginatedData(filteredBOMs))} />
                                </th>
                                <th className="p-2">Machine Name</th>
                                <th className="p-2">Model No</th>
                                <th className="p-2">Item Code</th>
                                <th className="p-2">Full Name</th>
                                <th className="p-2">Part No</th>
                                <th className="p-2">Std Qty</th>
                                <th className="p-2">Unit</th>
                                <th className="p-2 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {getPaginatedData(filteredBOMs).map(b => {
                                const item = getItemDisplay(b.itemId);
                                return (
                                    <tr key={b.id} className="hover:bg-blue-50">
                                        <td className="p-2"><input type="checkbox" checked={selectedIds.has(b.id)} onChange={() => {const newSet = new Set(selectedIds); newSet.has(b.id) ? newSet.delete(b.id) : newSet.add(b.id); setSelectedIds(newSet);}} /></td>
                                        <td className="p-2 font-bold">{b.machineCategory}</td>
                                        <td className="p-2">{b.modelNo}</td>
                                        <td className="p-2 font-mono text-blue-700 font-semibold">{b.itemId}</td>
                                        <td className="p-2">{item?.fullName || item?.name || '-'}</td>
                                        <td className="p-2">{item?.partNumber || '-'}</td>
                                        <td className="p-2 font-bold text-center">{b.quantity}</td>
                                        <td className="p-2 text-gray-500">{item?.unit || '-'}</td>
                                        <td className="p-2 text-right"><button onClick={() => openBOMForm(b)} className="text-blue-600 hover:underline">Edit</button></td>
                                    </tr>
                                )
                            })}
                            {filteredBOMs.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-gray-400">No BOM records found.</td></tr>}
                        </tbody>
                    </table>
                </div>
                {renderPagination(filteredBOMs.length)}
              </>
          )}

          {/* --- TAB 2: BREAKDOWNS (Existing) --- */}
          {activeTab === 'breakdowns' && (
               <>
               <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between bg-gray-50 items-start sm:items-center gap-4">
                   <h3 className="font-bold text-gray-700">Breakdown List</h3>
                   <div className="flex gap-2 w-full sm:w-auto">
                        <select value={filterLocationId} onChange={(e) => setFilterLocationId(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white w-full sm:w-48"><option value="">All Locations</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white w-full sm:w-32"><option value="All">All Status</option><option value="Open">Open</option><option value="Closed">Closed</option></select>
                        <button onClick={() => openBreakdownForm()} className="px-4 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-bold transition whitespace-nowrap">+ New Breakdown</button>
                   </div>
               </div>
               <div className="flex-1 overflow-auto">
                   <table className="w-full text-left text-xs whitespace-nowrap">
                       <thead className="bg-gray-100 text-gray-700 sticky top-0 border-b border-gray-200">
                           <tr><th className="p-2">ID</th><th className="p-2">Date</th><th className="p-2">Loc Name</th><th className="p-2">Machine</th><th className="p-2">Type</th><th className="p-2">Status</th><th className="p-2 text-right">Action</th></tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100">
                           {getPaginatedData(filteredBreakdowns).map(b => (
                               <tr key={b.id} className="hover:bg-red-50">
                                   <td className="p-2 font-mono text-gray-500">{b.id}</td><td className="p-2">{new Date(b.startTime).toLocaleDateString()}</td>
                                   <td className="p-2 font-bold">{locations.find(l => l.id === b.locationId)?.name || '-'}</td><td className="p-2 font-bold">{b.machineName}</td>
                                   <td className="p-2">{b.failureType}</td>
                                   <td className="p-2"><span className={`px-2 py-0.5 rounded-full text-[10px] ${b.status === 'Open' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>{b.status}</span></td>
                                   <td className="p-2 text-right"><button onClick={() => openBreakdownForm(b)} className="text-blue-600 hover:underline">Edit</button></td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
               {renderPagination(filteredBreakdowns.length)}
             </>
          )}
      </div>
      
      {/* --- FORM MODAL --- */}
      {showForm && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" dir={activeTab === 'breakdowns' ? 'rtl' : 'ltr'}>
              <div className={`bg-white rounded-lg shadow-2xl w-full ${activeTab === 'breakdowns' ? 'max-w-6xl font-cairo' : 'max-w-lg'} overflow-hidden animate-fade-in-up flex flex-col max-h-[95vh]`}>
                  <div className="px-5 py-3 border-b border-gray-200 flex justify-between items-center bg-gray-50 sticky top-0 z-10 shrink-0">
                      <div><h3 className="text-lg font-bold text-gray-900">{activeTab === 'assets' ? (isEditing ? 'Edit Asset' : 'New Asset') : activeTab === 'bom' ? 'BOM Record' : (isEditing ? 'تعديل عطل (Edit)' : 'تسجيل عطل جديد (New Log)')}</h3></div>
                      <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 transition p-1.5 hover:bg-gray-200 rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                  <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto bg-gray-50/30 p-4">
                      {activeTab === 'assets' ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Asset ID</label><input type="text" className="w-full border rounded p-2" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value})} disabled={isEditing} required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Local No</label><input type="text" className="w-full border rounded p-2" value={formData.machineLocalNo || ''} onChange={e => setFormData({...formData, machineLocalNo: e.target.value})} /></div></div>
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Machine Name (Category)</label><input type="text" className="w-full border rounded p-2" value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} required /></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Main Group</label><input type="text" className="w-full border rounded p-2" value={formData.mainGroup || ''} onChange={e => setFormData({...formData, mainGroup: e.target.value})} /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Sub Group</label><input type="text" className="w-full border rounded p-2" value={formData.subGroup || ''} onChange={e => setFormData({...formData, subGroup: e.target.value})} /></div></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Brand</label><input type="text" className="w-full border rounded p-2" value={formData.brand || ''} onChange={e => setFormData({...formData, brand: e.target.value})} /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Model No</label><input type="text" className="w-full border rounded p-2" value={formData.modelNo || ''} onChange={e => setFormData({...formData, modelNo: e.target.value})} /></div></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Location</label><select className="w-full border rounded p-2" value={formData.locationId || ''} onChange={e => setFormData({...formData, locationId: e.target.value})}><option value="">Select Location...</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label><select className="w-full border rounded p-2" value={formData.status || 'Working'} onChange={e => setFormData({...formData, status: e.target.value})}><option value="Working">Working</option><option value="Not Working">Not Working</option><option value="Outside Maintenance">Outside Maintenance</option></select></div></div>
                          </div>
                      ) : activeTab === 'bom' ? (
                          <div className="space-y-4">
                              <div><label className="block text-sm font-medium text-gray-700 mb-1">Machine Name</label><SearchableSelect label="" options={machineNameOptions} value={formData.machineCategory || ''} onChange={v => setFormData({...formData, machineCategory: v, modelNo: ''})} required /></div>
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Model No</label>
                                  <SearchableSelect 
                                      label="" 
                                      options={bomFormModelOptions} 
                                      value={formData.modelNo || ''} 
                                      onChange={v => setFormData({...formData, modelNo: v})} 
                                      disabled={!formData.machineCategory}
                                      placeholder={!formData.machineCategory ? 'Select Machine Name first' : 'Select Model...'}
                                      required 
                                  />
                              </div>
                              <div><label className="block text-sm font-medium text-gray-700 mb-1">Item Code (Part)</label><SearchableSelect label="" options={itemOptions} value={formData.itemId || ''} onChange={v => setFormData({...formData, itemId: v})} required /></div>
                              <div><label className="block text-sm font-medium text-gray-700 mb-1">Standard Quantity</label><input type="number" className="w-full border rounded p-2" value={formData.quantity || 1} onChange={e => setFormData({...formData, quantity: e.target.value})} required /></div>
                          </div>
                      ) : (
                          // Breakdown Form (Condensed)
                          <div className="space-y-3">
                             {/* ... Breakdown form fields (same as existing) ... */}
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><div><label className="block text-xs font-bold text-gray-600 mb-1">Machine</label><input type="text" className="block w-full rounded border-gray-300 h-9 px-2 text-sm" value={formData.machineName} onChange={e => setFormData({...formData, machineName: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-600 mb-1">Failure Type</label><input type="text" className="block w-full rounded border-gray-300 h-9 px-2 text-sm" value={formData.failureType} onChange={e => setFormData({...formData, failureType: e.target.value})} /></div></div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><div><label className="block text-xs font-bold text-gray-600 mb-1">Start Time</label><input type="datetime-local" className="block w-full rounded border-gray-300 h-9 px-2 text-sm" value={formData.startTime?.slice(0,16)} onChange={e => setFormData({...formData, startTime: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-600 mb-1">Status</label><select className="block w-full rounded border-gray-300 h-9 px-2 text-sm" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}><option value="Open">Open</option><option value="Closed">Closed</option></select></div></div>
                             <div><label className="block text-xs font-bold text-gray-600 mb-1">Action Taken</label><textarea className="block w-full rounded border-gray-300 p-2 text-sm" rows={3} value={formData.actionTaken} onChange={e => setFormData({...formData, actionTaken: e.target.value})} /></div>
                          </div>
                      )}
                       <div className="mt-2 pt-3 border-t border-gray-200 sticky bottom-0 bg-white flex items-center justify-between gap-3 shrink-0">
                           <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 border border-gray-300 text-gray-700 font-bold text-sm rounded hover:bg-gray-50 transition w-28">Cancel</button>
                           <div className="flex gap-3">
                               {activeTab === 'breakdowns' && <button type="button" onClick={handleMaterialRequest} className="px-5 py-2 bg-blue-100 text-blue-700 font-bold text-sm rounded hover:bg-blue-200 transition">Material Request</button>}
                               <button type="submit" className={`px-6 py-2 text-white font-bold text-sm rounded shadow-sm transition transform active:scale-95 w-40 ${activeTab === 'breakdowns' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>Save</button>
                           </div>
                       </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default AssetManagement;
