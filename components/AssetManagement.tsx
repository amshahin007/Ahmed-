
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Machine, Location, Sector, Division, BreakdownRecord } from '../types';
import * as XLSX from 'xlsx';
import { fetchRawCSV, extractSheetIdFromUrl, DEFAULT_SHEET_ID } from '../services/googleSheetsService';
import SearchableSelect, { Option } from './SearchableSelect';

interface AssetManagementProps {
  machines: Machine[];
  locations: Location[];
  sectors: Sector[];
  divisions: Division[];
  breakdowns: BreakdownRecord[];
  onAddMachine: (machine: Machine) => void;
  onUpdateMachine: (machine: Machine) => void;
  onDeleteMachines: (ids: string[]) => void;
  onAddBreakdown: (breakdown: BreakdownRecord) => void;
  onUpdateBreakdown: (breakdown: BreakdownRecord) => void;
  onBulkImport: (tab: string, added: any[], updated: any[]) => void;
  setCurrentView: (view: string) => void;
}

const AssetManagement: React.FC<AssetManagementProps> = ({
  machines, locations, sectors, divisions, breakdowns,
  onAddMachine, onUpdateMachine, onDeleteMachines,
  onAddBreakdown, onUpdateBreakdown, onBulkImport, setCurrentView
}) => {
  const [activeTab, setActiveTab] = useState<'assets' | 'breakdowns'>('assets');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  
  // Filters
  const [filterLocationId, setFilterLocationId] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Open' | 'Closed'>('All'); // For Breakdowns
  const [assetFilterStatus, setAssetFilterStatus] = useState('All'); // For Machines
  
  // Sync State
  const [syncConfig, setSyncConfig] = useState<Record<string, { sheetId: string }>>(() => {
     try {
         const saved = localStorage.getItem('wf_asset_sync_config');
         return saved ? JSON.parse(saved) : { machines: { sheetId: DEFAULT_SHEET_ID }, breakdowns: { sheetId: DEFAULT_SHEET_ID } };
     } catch { return { machines: { sheetId: DEFAULT_SHEET_ID }, breakdowns: { sheetId: DEFAULT_SHEET_ID } }; }
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
  }, [syncConfig]);

  const handleSheetUrlPaste = (val: string) => {
      const tabKey = activeTab === 'assets' ? 'machines' : 'breakdowns';
      setSyncConfig(prev => ({
          ...prev,
          [tabKey]: { sheetId: val }
      }));
  };

  const handleSyncData = async () => {
      const tabKey = activeTab === 'assets' ? 'machines' : 'breakdowns';
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
             if(h.includes('id') && !obj.id) obj.id = row[i];
             else if(h.includes('name') || h.includes('desc')) {
                 if(tab === 'machines') obj.category = row[i];
                 if(tab === 'breakdowns') obj.machineName = row[i];
             }
             else if (h.includes('status')) obj.status = row[i];
             else if (h.includes('brand')) obj.brand = row[i];
             else if (h.includes('model')) obj.modelNo = row[i];
             else if (h.includes('chase')) obj.chaseNo = row[i];
             else if (h.includes('division')) obj.divisionId = row[i];
             else if (h.includes('sector')) obj.sectorId = row[i];
             else if (h.includes('location')) obj.locationId = row[i];
             else if ((h.includes('main') && h.includes('group'))) obj.mainGroup = row[i];
             else if ((h.includes('sub') && h.includes('group'))) obj.subGroup = row[i];
             else if (h.includes('local') && h.includes('no')) obj.machineLocalNo = row[i];
          });
          
          if(obj.id) {
              // check existence
              const list = tab === 'machines' ? machines : breakdowns;
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
      const data = activeTab === 'assets' ? machines : breakdowns;
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
          processImport(data, activeTab === 'assets' ? 'machines' : 'breakdowns');
      };
      reader.readAsBinaryString(file);
      e.target.value = ''; // reset
  };
  
  const handleDeleteAssets = () => {
      if(confirm(`Delete ${selectedAssetIds.size} assets?`)) {
          onDeleteMachines(Array.from(selectedAssetIds));
          setSelectedAssetIds(new Set());
      }
  };

  const openAssetForm = (asset?: Machine) => {
      setFormData(asset || {});
      setIsEditing(!!asset);
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
          setFormData({ ...bd, duration: durationStr });
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
              locationId: filterLocationId || '',
              sectorId: '', 
              divisionId: '',
              duration: ''
          });
          setIsEditing(false);
      }
      setShowForm(true);
  };

  // --- TIME & DURATION LOGIC ---
  const handleStartTimeChange = (val: string) => {
      const updates: any = { startTime: val };
      // If End time exists, update Duration
      if (formData.endTime) {
          const start = new Date(val).getTime();
          const end = new Date(formData.endTime).getTime();
          if (!isNaN(start) && !isNaN(end) && end > start) {
              updates.duration = ((end - start) / (1000 * 60 * 60)).toFixed(2);
          } else {
              updates.duration = '';
          }
      } else if (formData.duration) {
          // If Duration exists but End Time is empty (or invalid), recalc End Time? 
          const start = new Date(val).getTime();
          const dur = parseFloat(formData.duration);
          if (!isNaN(start) && !isNaN(dur) && dur > 0) {
              const newEnd = new Date(start + (dur * 60 * 60 * 1000));
              updates.endTime = new Date(newEnd.getTime() - (newEnd.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
          }
      }
      setFormData({ ...formData, ...updates });
  };

  const handleEndTimeChange = (val: string) => {
      const updates: any = { endTime: val };
      if (formData.startTime) {
          const start = new Date(formData.startTime).getTime();
          const end = new Date(val).getTime();
          if (!isNaN(start) && !isNaN(end)) {
              if (end > start) {
                  updates.duration = ((end - start) / (1000 * 60 * 60)).toFixed(2);
              } else {
                  updates.duration = ''; // Reset if end is before start
              }
          }
      }
      setFormData({ ...formData, ...updates });
  };

  const handleDurationChange = (val: string) => {
      const updates: any = { duration: val };
      const hours = parseFloat(val);
      
      if (formData.startTime && !isNaN(hours) && hours > 0) {
          const start = new Date(formData.startTime).getTime();
          const endMs = start + (hours * 60 * 60 * 1000);
          const endDate = new Date(endMs);
          // Adjust for local input format
          updates.endTime = new Date(endDate.getTime() - (endDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      }
      setFormData({ ...formData, ...updates });
  };
  
  const handleFormSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(activeTab === 'assets') {
          if(isEditing) onUpdateMachine(formData as Machine);
          else onAddMachine({...formData, id: formData.id || `M-${Date.now()}`} as Machine);
      } else {
          // Breakdown Logic
          // Validate Time
          if (formData.startTime && formData.endTime) {
              const start = new Date(formData.startTime);
              const end = new Date(formData.endTime);
              if (end < start) {
                  alert("⚠️ Error: End Time cannot be earlier than Start Time.");
                  return;
              }
          }

          const selectedMachine = machines.find(m => m.id === formData.machineId);
          // Clean up form data (remove UI-only duration if needed, or keep it)
          const { duration, ...cleanData } = formData;
          
          const finalRecord: BreakdownRecord = {
             ...cleanData,
             machineName: selectedMachine?.category || formData.machineName || 'Unknown',
             locationId: formData.locationId || selectedMachine?.locationId || 'Unknown',
             sectorId: formData.sectorId || selectedMachine?.sectorId || '', // Prioritize form selection if manual override allowed
          };
          if(isEditing) onUpdateBreakdown(finalRecord);
          else onAddBreakdown(finalRecord);

          // Update Machine Status based on Breakdown
          if (selectedMachine) {
              if (finalRecord.status === 'Open') {
                  onUpdateMachine({ ...selectedMachine, status: 'Not Working' });
              } else if (finalRecord.status === 'Closed') {
                  onUpdateMachine({ ...selectedMachine, status: 'Working' });
              }
          }
      }
      setShowForm(false);
  };

  const handleMaterialRequest = () => {
    if (!formData.locationId || !formData.machineId) {
        alert("Please select Location and Machine first.");
        return;
    }
    
    // Ensure sector is populated if division exists
    let derivedSectorId = formData.sectorId;
    if (!derivedSectorId && formData.divisionId) {
        const div = divisions.find(d => d.id === formData.divisionId);
        if (div) derivedSectorId = div.sectorId;
    }

    // Save context to local storage to be picked up by IssueForm
    localStorage.setItem('wf_issue_prefill', JSON.stringify({
        locationId: formData.locationId,
        sectorId: derivedSectorId,
        divisionId: formData.divisionId,
        machineId: formData.machineId,
        maintenancePlanId: 'MP-003' // Auto-select "Sudden Breakdown"
    }));
    // Close modal and switch view
    setShowForm(false);
    setCurrentView('issue-form');
  };

  // --- RENDER HELPERS ---

  // Determine the location name if a location ID is selected for filtering
  const selectedFilterLocation = locations.find(l => l.id === filterLocationId);

  const filteredMachines = machines.filter(m => 
      ((m.category || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.brand || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.mainGroup || '').toLowerCase().includes(searchTerm.toLowerCase())) &&
      (!filterLocationId || m.locationId === filterLocationId || (selectedFilterLocation && m.locationId === selectedFilterLocation.name)) &&
      (assetFilterStatus === 'All' || m.status === assetFilterStatus)
  );

  const filteredBreakdowns = breakdowns.filter(b => 
      (b.machineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.id.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (!filterLocationId || b.locationId === filterLocationId || (selectedFilterLocation && b.locationId === selectedFilterLocation.name)) &&
      (filterStatus === 'All' || b.status === filterStatus)
  ).sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  // --- BREAKDOWN FORM CASCADING FILTER LOGIC ---
  // Calculates derived options for dropdowns based on strict hierarchy:
  // Location -> Sector -> Division -> Machine Name -> Asset

  const selectedFormLocation = locations.find(l => l.id === formData.locationId);

  // 1. Machines in Location (Robust Check: Match ID OR Name)
  const machinesInLoc = useMemo(() => {
      if (!formData.locationId) return []; 
      const locName = selectedFormLocation?.name;

      return machines.filter(m => {
          // Normalize to string to be safe against numerical IDs
          const mLoc = String(m.locationId || '');
          const formLocId = String(formData.locationId);
          
          return mLoc === formLocId || (locName && mLoc === locName);
      });
  }, [machines, formData.locationId, selectedFormLocation]);

  // 2. Sectors available in Location (via machines)
  const availableSectors = useMemo(() => {
      const candidates = new Set<string>();
      
      machinesInLoc.forEach(m => {
          // Case A: Direct Sector
          if (m.sectorId) candidates.add(m.sectorId);
          
          // Case B: Via Division (Look up Division to get its Sector ID)
          if (m.divisionId) {
              const div = divisions.find(d => d.id === m.divisionId || d.name === m.divisionId);
              if (div) candidates.add(div.sectorId);
          }
      });

      // Filter sectors that match ID OR Name in the candidates set
      return sectors.filter(s => candidateContains(candidates, s.id) || candidateContains(candidates, s.name));
  }, [machinesInLoc, divisions, sectors]);

  // 3. Machines in Selected Sector
  const machinesInSec = useMemo(() => {
      if (!formData.sectorId) return machinesInLoc;
      
      const selectedSector = sectors.find(s => s.id === formData.sectorId);
      const secName = selectedSector?.name;

      return machinesInLoc.filter(m => {
          // Direct Check (ID or Name)
          if (m.sectorId === formData.sectorId) return true;
          if (secName && m.sectorId === secName) return true;

          // Via Division
          if (m.divisionId) {
              const div = divisions.find(d => d.id === m.divisionId || d.name === m.divisionId);
              if (div) {
                  // Check if the parent sector of this division matches our selected sector
                  return div.sectorId === formData.sectorId || (secName && div.sectorId === secName);
              }
          }
          return false;
      });
  }, [machinesInLoc, formData.sectorId, divisions, sectors]);

  // 4. Divisions available in Sector
  // UPDATED LOGIC: If a Sector is selected, show divisions defined in Master Data for this Sector
  // This allows selection even if no machines are currently assigned to a division in the context.
  const availableDivisions = useMemo(() => {
      if (formData.sectorId) {
          const selectedSector = sectors.find(s => s.id === formData.sectorId);
          return divisions.filter(d => 
              d.sectorId === formData.sectorId || 
              (selectedSector && d.sectorId === selectedSector.name)
          );
      }
      
      // Fallback if no sector selected (UI usually prevents this): Filter by machines
      const candidates = new Set<string>();
      machinesInSec.forEach(m => {
          if (m.divisionId) candidates.add(m.divisionId);
      });
      
      return divisions.filter(d => {
          return candidateContains(candidates, d.id) || candidateContains(candidates, d.name);
      });
  }, [machinesInSec, divisions, formData.sectorId, sectors]);

  // 5. Machines in Selected Division (Used for narrowing down Asset IDs when no name is selected)
  const machinesInDiv = useMemo(() => {
      if (!formData.divisionId) return machinesInSec;
      
      const selectedDiv = divisions.find(d => d.id === formData.divisionId);
      const divName = selectedDiv?.name;

      return machinesInSec.filter(m => 
          m.divisionId === formData.divisionId || 
          (divName && m.divisionId === divName)
      );
  }, [machinesInSec, formData.divisionId, divisions]);

  // Helper to check set efficiently
  function candidateContains(set: Set<string>, value: string) {
      if (!value) return false;
      return set.has(value);
  }

  // 6. Available Machine Names
  // CHANGED: Use machinesInSec instead of machinesInDiv to show all names in Sector, ignoring Division filter
  const availableMachineNames = useMemo(() => {
      return Array.from(new Set(machinesInSec.map(m => m.category).filter(Boolean))).sort();
  }, [machinesInSec]);

  // 7. Final Assets (Filtered by Name if selected)
  const finalAssetOptions = useMemo(() => {
      // Start with machines in the Sector
      let filtered = machinesInSec;

      if (formData.machineName) {
          // If Name is selected, filter ONLY by Name (Ignore Division filter to handle data mismatches)
          filtered = filtered.filter(m => m.category === formData.machineName);
      } else if (formData.divisionId) {
          // If No Name selected, but Division IS selected, filter by Division (Drill-down behavior)
          const selectedDiv = divisions.find(d => d.id === formData.divisionId);
          const divName = selectedDiv?.name;
          filtered = filtered.filter(m => 
              m.divisionId === formData.divisionId || 
              (divName && m.divisionId === divName)
          );
      }

      return filtered.map(m => ({
          id: m.id,
          label: `${m.id} ${m.category ? `- ${m.category}` : ''}`, 
          subLabel: `${m.brand || ''} ${m.modelNo || ''} (Chase: ${m.chaseNo})`
      }));
  }, [machinesInSec, formData.machineName, formData.divisionId, divisions]);

  const handleSelectAllAssets = () => {
      const allSelected = filteredMachines.length > 0 && filteredMachines.every(m => selectedAssetIds.has(m.id));
      const newSet = new Set(selectedAssetIds);
      
      if (allSelected) {
          filteredMachines.forEach(m => newSet.delete(m.id));
      } else {
          filteredMachines.forEach(m => newSet.add(m.id));
      }
      setSelectedAssetIds(newSet);
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in-up">
      {/* Top Header & Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          
          {/* Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
                <button 
                    onClick={() => setActiveTab('assets')}
                    className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'assets' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Machines (Assets)
                </button>
                <button 
                    onClick={() => setActiveTab('breakdowns')}
                    className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'breakdowns' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Breakdowns
                </button>
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
                       value={syncConfig[activeTab === 'assets' ? 'machines' : 'breakdowns']?.sheetId || ''}
                       onChange={(e) => handleSheetUrlPaste(e.target.value)}
                    />
                    <button 
                        onClick={handleSyncData} 
                        disabled={syncLoading}
                        className="px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition shadow-sm disabled:opacity-50 text-xs font-bold"
                        title="Fetch data from URL"
                    >
                       {syncLoading ? <span className="animate-spin">↻</span> : <span>⬇️</span>}
                    </button>
                </div>

                <button onClick={handleBackup} disabled={syncLoading} className="flex-1 xl:flex-none px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 border border-indigo-200 flex items-center justify-center gap-1 whitespace-nowrap">
                     <span>☁️</span> Backup
                </button>
                <button onClick={handleExport} className="flex-1 xl:flex-none px-3 py-2 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 border border-green-200 flex items-center justify-center gap-1 whitespace-nowrap">
                     <span>📊</span> Export
                </button>
                <button onClick={handleImportClick} className="flex-1 xl:flex-none px-3 py-2 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold hover:bg-orange-100 border border-orange-200 flex items-center justify-center gap-1 whitespace-nowrap">
                     <span>📂</span> Import
                </button>

                <div className="relative flex-1 xl:w-48 min-w-[150px]">
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    />
                    <span className="absolute left-2.5 top-2.5 text-gray-400 text-sm">🔍</span>
                </div>
          </div>
      </div>
      
      {/* Sync Status Message */}
      {syncMsg && (
        <div className={`text-xs px-4 py-2 rounded-lg border flex items-center gap-2 ${syncMsg.includes('Failed') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
            <span className="text-lg">{syncMsg.includes('Failed') ? '⚠️' : 'ℹ️'}</span>
            {syncMsg}
        </div>
      )}

      {/* CONTENT AREA */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          
          {/* --- TAB 1: ASSETS --- */}
          {activeTab === 'assets' && (
              <>
                <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between bg-gray-50 items-start sm:items-center gap-4">
                    <h3 className="font-bold text-gray-700">Machine List</h3>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <select 
                            value={filterLocationId} 
                            onChange={(e) => setFilterLocationId(e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-48"
                        >
                            <option value="">All Locations</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                        <select 
                            value={assetFilterStatus} 
                            onChange={(e) => setAssetFilterStatus(e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-40"
                        >
                            <option value="All">All Status</option>
                            <option value="Working">Working</option>
                            <option value="Not Working">Not Working</option>
                            <option value="Outside Maintenance">Outside Maintenance</option>
                        </select>
                        
                        {selectedAssetIds.size > 0 && (
                            <button onClick={handleDeleteAssets} className="px-3 py-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200 text-xs font-bold transition">Delete ({selectedAssetIds.size})</button>
                        )}
                        <button onClick={() => openAssetForm()} className="px-4 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-bold transition shadow-sm whitespace-nowrap">+ New Asset</button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-100 text-gray-700 sticky top-0 border-b border-gray-200">
                            <tr>
                                <th className="p-4 w-10">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        checked={filteredMachines.length > 0 && filteredMachines.every(m => selectedAssetIds.has(m.id))}
                                        onChange={handleSelectAllAssets}
                                    />
                                </th>
                                <th className="p-4">ID</th>
                                <th className="p-4">Local No</th>
                                <th className="p-4">Machine Name</th>
                                <th className="p-4">Main Group</th>
                                <th className="p-4">Sub Group</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Brand</th>
                                <th className="p-4">Model No</th>
                                <th className="p-4">Chase No</th>
                                <th className="p-4">Location</th>
                                <th className="p-4">Sector</th>
                                <th className="p-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredMachines.map(m => (
                                <tr key={m.id} className="hover:bg-orange-50">
                                    <td className="p-4">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={selectedAssetIds.has(m.id)} 
                                            onChange={() => {
                                                const newSet = new Set(selectedAssetIds);
                                                newSet.has(m.id) ? newSet.delete(m.id) : newSet.add(m.id);
                                                setSelectedAssetIds(newSet);
                                            }}
                                        />
                                    </td>
                                    <td className="p-4 font-mono">{m.id}</td>
                                    <td className="p-4 font-mono text-blue-600">{m.machineLocalNo || '-'}</td>
                                    <td className="p-4 font-bold text-gray-800">{m.category}</td>
                                    <td className="p-4 text-gray-600">{m.mainGroup || '-'}</td>
                                    <td className="p-4 text-gray-600">{m.subGroup || '-'}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs ${m.status === 'Working' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {m.status}
                                        </span>
                                    </td>
                                    <td className="p-4">{m.brand}</td>
                                    <td className="p-4">{m.modelNo}</td>
                                    <td className="p-4">{m.chaseNo}</td>
                                    <td className="p-4">{m.locationId}</td>
                                    <td className="p-4">{m.sectorId}</td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => openAssetForm(m)} className="text-blue-600 hover:underline">Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </>
          )}

          {/* --- TAB 2: BREAKDOWNS --- */}
          {activeTab === 'breakdowns' && (
               <>
               <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between bg-gray-50 items-start sm:items-center gap-4">
                   <h3 className="font-bold text-gray-700">Breakdown List</h3>
                   
                   <div className="flex gap-2 w-full sm:w-auto">
                        <select 
                            value={filterLocationId} 
                            onChange={(e) => setFilterLocationId(e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-48"
                        >
                            <option value="">All Locations</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                        <select 
                            value={filterStatus} 
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-32"
                        >
                            <option value="All">All Status</option>
                            <option value="Open">Open</option>
                            <option value="Closed">Closed</option>
                        </select>
                        <button onClick={() => openBreakdownForm()} className="px-4 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-bold transition shadow-sm whitespace-nowrap">+ New Breakdown</button>
                   </div>
               </div>
               <div className="flex-1 overflow-auto">
                   <table className="w-full text-left text-sm whitespace-nowrap">
                       <thead className="bg-gray-100 text-gray-700 sticky top-0 border-b border-gray-200">
                           <tr>
                               <th className="p-4">ID</th>
                               <th className="p-4">Start Time</th>
                               <th className="p-4">End Time</th>
                               <th className="p-4">Location</th>
                               <th className="p-4">Machine</th>
                               <th className="p-4">Type</th>
                               <th className="p-4">Operator</th>
                               <th className="p-4">Root Cause</th>
                               <th className="p-4">Action Taken</th>
                               <th className="p-4">Status</th>
                               <th className="p-4 text-right">Action</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100">
                           {filteredBreakdowns.map(b => (
                               <tr key={b.id} className="hover:bg-red-50">
                                   <td className="p-4 font-mono">{b.id}</td>
                                   <td className="p-4">{new Date(b.startTime).toLocaleString()}</td>
                                   <td className="p-4 text-gray-500">{b.endTime ? new Date(b.endTime).toLocaleString() : '-'}</td>
                                   <td className="p-4">{locations.find(l => l.id === b.locationId)?.name || b.locationId}</td>
                                   <td className="p-4 font-bold">{b.machineName}</td>
                                   <td className="p-4">{b.failureType}</td>
                                   <td className="p-4">{b.operatorName}</td>
                                   <td className="p-4 max-w-xs truncate" title={b.rootCause}>{b.rootCause || '-'}</td>
                                   <td className="p-4 max-w-xs truncate" title={b.actionTaken}>{b.actionTaken || '-'}</td>
                                   <td className="p-4">
                                       <span className={`px-2 py-1 rounded-full text-xs ${b.status === 'Open' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>
                                           {b.status}
                                       </span>
                                   </td>
                                   <td className="p-4 text-right">
                                       <button onClick={() => openBreakdownForm(b)} className="text-blue-600 hover:underline">Edit</button>
                                   </td>
                               </tr>
                           ))}
                           {filteredBreakdowns.length === 0 && (
                               <tr><td colSpan={11} className="p-8 text-center text-gray-400">No breakdowns found.</td></tr>
                           )}
                       </tbody>
                   </table>
               </div>
             </>
          )}
      </div>
      
      {/* --- FORM MODAL --- */}
      {showForm && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" dir={activeTab === 'breakdowns' ? 'rtl' : 'ltr'}>
              <div className={`bg-white rounded-lg shadow-2xl w-full ${activeTab === 'breakdowns' ? 'max-w-6xl font-cairo' : 'max-w-lg'} overflow-hidden animate-fade-in-up flex flex-col max-h-[95vh]`}>
                  
                  {/* Header */}
                  <div className="px-5 py-3 border-b border-gray-200 flex justify-between items-center bg-gray-50 sticky top-0 z-10 shrink-0">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                            {activeTab === 'assets' ? (isEditing ? 'Edit Asset' : 'New Asset') : (isEditing ? 'تعديل عطل (Edit)' : 'تسجيل عطل جديد (New Log)')}
                        </h3>
                      </div>
                      <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 transition p-1.5 hover:bg-gray-200 rounded-full">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>

                  <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto bg-gray-50/30 p-4">
                      
                      {activeTab === 'assets' ? (
                          <div className="space-y-4">
                            {/* ASSET FIELDS (Original simple layout for Assets) */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Asset ID</label>
                                    <input type="text" className="w-full border rounded p-2" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value})} disabled={isEditing} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Local No</label>
                                    <input type="text" className="w-full border rounded p-2" value={formData.machineLocalNo || ''} onChange={e => setFormData({...formData, machineLocalNo: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Machine Name (Category)</label>
                                <input type="text" className="w-full border rounded p-2" value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} required />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Main Group</label>
                                    <input type="text" className="w-full border rounded p-2" value={formData.mainGroup || ''} onChange={e => setFormData({...formData, mainGroup: e.target.value})} placeholder="e.g. Production" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Sub Group</label>
                                    <input type="text" className="w-full border rounded p-2" value={formData.subGroup || ''} onChange={e => setFormData({...formData, subGroup: e.target.value})} placeholder="e.g. Line 1" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                                    <input type="text" className="w-full border rounded p-2" value={formData.brand || ''} onChange={e => setFormData({...formData, brand: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <select className="w-full border rounded p-2" value={formData.status || 'Working'} onChange={e => setFormData({...formData, status: e.target.value})}>
                                        <option value="Working">Working</option>
                                        <option value="Not Working">Not Working</option>
                                        <option value="Outside Maintenance">Outside Maintenance</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                    <select className="w-full border rounded p-2" value={formData.locationId || ''} onChange={e => setFormData({...formData, locationId: e.target.value})}>
                                        <option value="">Select Location...</option>
                                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
                                    <select className="w-full border rounded p-2" value={formData.sectorId || ''} onChange={e => setFormData({...formData, sectorId: e.target.value})}>
                                        <option value="">Select Sector...</option>
                                        {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>
                          </div>
                      ) : (
                          <div className="space-y-3">
                             {/* ROW 1: IDENTIFICATION & CONTEXT */}
                             <div className="bg-white p-3 rounded border border-gray-200 shadow-sm">
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">الموقع / Location</label>
                                        <select 
                                            className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 h-9 text-sm px-2 bg-white" 
                                            value={formData.locationId || ''} 
                                            onChange={e => setFormData({
                                                ...formData, 
                                                locationId: e.target.value, 
                                                sectorId: '',
                                                divisionId: '',
                                                machineName: '',
                                                machineId: ''
                                            })}
                                        >
                                            <option value="">-- الموقع --</option>
                                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">القطاع / Sector</label>
                                        <select 
                                            className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 h-9 text-sm px-2 bg-white disabled:bg-gray-100 disabled:text-gray-400" 
                                            value={formData.sectorId || ''} 
                                            onChange={e => setFormData({
                                                ...formData, 
                                                sectorId: e.target.value, 
                                                divisionId: '',
                                                machineName: '',
                                                machineId: ''
                                            })}
                                            disabled={!formData.locationId}
                                        >
                                            <option value="">{formData.locationId ? '-- القطاع --' : '-'}</option>
                                            {availableSectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">القسم / Division</label>
                                        <select 
                                            className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 h-9 text-sm px-2 bg-white disabled:bg-gray-100 disabled:text-gray-400" 
                                            value={formData.divisionId || ''} 
                                            onChange={e => setFormData({
                                                ...formData, 
                                                divisionId: e.target.value,
                                                machineName: '',
                                                machineId: ''
                                            })}
                                            disabled={!formData.sectorId}
                                        >
                                            <option value="">{formData.sectorId ? '-- القسم --' : '-'}</option>
                                            {availableDivisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">اسم المعدة / Machine Name</label>
                                        <select 
                                            className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 h-9 text-sm px-2 bg-white disabled:bg-gray-100 disabled:text-gray-400" 
                                            value={formData.machineName || ''} 
                                            onChange={e => setFormData({
                                                ...formData, 
                                                machineName: e.target.value,
                                                machineId: '' // Clear asset ID if category/name changes
                                            })}
                                            disabled={!formData.locationId} // Available even if intermediate steps skipped, though list logic handles it
                                        >
                                            <option value="">{formData.locationId ? '-- الاسم --' : '-'}</option>
                                            {availableMachineNames.map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="md:col-span-1">
                                        <SearchableSelect 
                                            label="كود الأصل / Asset ID"
                                            placeholder={!formData.locationId ? '...' : 'Code...'}
                                            options={finalAssetOptions}
                                            value={formData.machineId || ''}
                                            onChange={(val) => {
                                                const m = machines.find(mac => mac.id === val);
                                                const updates: any = { machineId: val };
                                                
                                                if (m) {
                                                    updates.machineName = m.category;
                                                    // Back-fill hierarchy only if missing (Optional, but helps data integrity)
                                                    if (!formData.sectorId) {
                                                        if (m.sectorId) updates.sectorId = m.sectorId;
                                                        else if (m.divisionId) {
                                                            const div = divisions.find(d => d.id === m.divisionId);
                                                            if (div) updates.sectorId = div.sectorId;
                                                        }
                                                    }
                                                    if (!formData.divisionId && m.divisionId) {
                                                        updates.divisionId = m.divisionId;
                                                    }
                                                }
                                                
                                                setFormData(prev => ({ ...prev, ...updates }));
                                            }}
                                            disabled={!formData.locationId}
                                            required
                                            compact={true}
                                        />
                                        {formData.locationId && finalAssetOptions.length === 0 && (
                                            <p className="text-[10px] text-red-500 mt-0.5 font-bold leading-tight">⚠️ لا توجد أصول (No Assets)</p>
                                        )}
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">اسم المشغل / Operator</label>
                                        <input 
                                            type="text" 
                                            className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 h-9 px-2 text-sm"
                                            value={formData.operatorName || ''} 
                                            onChange={e => setFormData({...formData, operatorName: e.target.value})} 
                                        />
                                    </div>
                                </div>
                             </div>

                             {/* ROW 2: TIMING & STATUS */}
                             <div className="bg-white p-3 rounded border border-gray-200 shadow-sm">
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">وقت البداية / Start Time</label>
                                        <input 
                                            type="datetime-local" 
                                            className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 h-9 px-2 text-sm"
                                            value={formData.startTime ? formData.startTime.slice(0, 16) : ''} 
                                            onChange={e => handleStartTimeChange(e.target.value)} 
                                            required 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">وقت النهاية / End Time</label>
                                        <input 
                                            type="datetime-local" 
                                            className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 h-9 px-2 text-sm"
                                            value={formData.endTime ? formData.endTime.slice(0, 16) : ''} 
                                            onChange={e => handleEndTimeChange(e.target.value)} 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">مدة (ساعة) / Duration</label>
                                        <input 
                                            type="number"
                                            step="0.1" 
                                            className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 h-9 px-2 text-sm bg-yellow-50"
                                            value={formData.duration || ''} 
                                            onChange={e => handleDurationChange(e.target.value)} 
                                            placeholder="Hrs..." 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">نوع العطل / Failure Type</label>
                                        <input 
                                            type="text" 
                                            list="failureTypes" 
                                            className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 h-9 px-2 text-sm"
                                            value={formData.failureType || ''} 
                                            onChange={e => setFormData({...formData, failureType: e.target.value})} 
                                            placeholder="Mechanical, etc..."
                                            required 
                                        />
                                        <datalist id="failureTypes">
                                            <option value="Mechanical" />
                                            <option value="Electrical" />
                                            <option value="Software" />
                                            <option value="Hydraulic" />
                                            <option value="Operator Error" />
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">حالة العطل / Status</label>
                                        <select 
                                            className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 h-9 px-2 text-sm bg-white"
                                            value={formData.status || 'Open'} 
                                            onChange={e => setFormData({...formData, status: e.target.value})}
                                        >
                                            <option value="Open">🔴 مفتوح (Open)</option>
                                            <option value="Closed">🟢 مغلق (Closed)</option>
                                        </select>
                                    </div>
                                </div>
                             </div>

                             {/* ROW 3: TECHNICAL DETAILS */}
                             <div className="bg-white p-3 rounded border border-gray-200 shadow-sm">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">السبب الجذري / Root Cause</label>
                                        <textarea 
                                            className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-sm min-h-[60px]" 
                                            rows={2} 
                                            value={formData.rootCause || ''} 
                                            onChange={e => setFormData({...formData, rootCause: e.target.value})} 
                                            placeholder="..." 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">الإجراء المتخذ / Action Taken</label>
                                        <textarea 
                                            className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-sm min-h-[60px]" 
                                            rows={2} 
                                            value={formData.actionTaken || ''} 
                                            onChange={e => setFormData({...formData, actionTaken: e.target.value})} 
                                            placeholder="..." 
                                        />
                                    </div>
                                </div>
                             </div>
                          </div>
                      )}

                       {/* FOOTER ACTIONS */}
                       <div className="mt-2 pt-3 border-t border-gray-200 sticky bottom-0 bg-white flex items-center justify-between gap-3 shrink-0">
                           <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 border border-gray-300 text-gray-700 font-bold text-sm rounded hover:bg-gray-50 transition w-28">
                               إلغاء
                           </button>
                           <div className="flex gap-3">
                               {activeTab === 'breakdowns' && (
                                   <button 
                                      type="button"
                                      onClick={handleMaterialRequest}
                                      className="px-5 py-2 bg-blue-100 text-blue-700 font-bold text-sm rounded hover:bg-blue-200 transition"
                                   >
                                      طلب صرف (Material Request)
                                   </button>
                               )}
                               <button type="submit" className={`px-6 py-2 text-white font-bold text-sm rounded shadow-sm transition transform active:scale-95 w-40 ${activeTab === 'assets' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}>
                                   {activeTab === 'assets' ? 'Save Asset' : 'حفظ (Save)'}
                               </button>
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
