
import React, { useState, useRef, useEffect } from 'react';
import { Machine, Location, Sector, Division, BreakdownRecord } from '../types';
import * as XLSX from 'xlsx';
import { fetchRawCSV, extractSheetIdFromUrl, DEFAULT_SHEET_ID } from '../services/googleSheetsService';

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
}

const AssetManagement: React.FC<AssetManagementProps> = ({
  machines, locations, sectors, divisions, breakdowns,
  onAddMachine, onUpdateMachine, onDeleteMachines,
  onAddBreakdown, onUpdateBreakdown, onBulkImport
}) => {
  const [activeTab, setActiveTab] = useState<'assets' | 'breakdowns'>('assets');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  
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
          // Assuming GID logic is similar to MasterData or simplified (fetch first tab if GID not specified)
          // For simplicity here, we assume user pastes full URL or we default to '0' if not found.
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
  
  const handleFormSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(activeTab === 'assets') {
          if(isEditing) onUpdateMachine(formData as Machine);
          else onAddMachine({...formData, id: formData.id || `M-${Date.now()}`} as Machine);
      } else {
          // Breakdown logic placeholder
      }
      setShowForm(false);
  };

  // --- RENDER HELPERS ---

  const filteredMachines = machines.filter(m => 
      (m.category || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.brand || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.mainGroup || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredBreakdowns = breakdowns.filter(b => 
      b.machineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.id.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

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
                <div className="p-4 border-b border-gray-100 flex justify-between bg-gray-50 items-center">
                    <h3 className="font-bold text-gray-700">Machine List</h3>
                    <div className="flex gap-2">
                        {selectedAssetIds.size > 0 && (
                            <button onClick={handleDeleteAssets} className="px-3 py-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200 text-xs font-bold transition">Delete ({selectedAssetIds.size})</button>
                        )}
                        <button onClick={() => openAssetForm()} className="px-4 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-bold transition shadow-sm">+ New Asset</button>
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
              <div className="p-4 flex flex-col items-center justify-center text-gray-400 h-full">
                  <p>Breakdown Management Interface</p>
                  <p className="text-sm">(Coming soon in next update)</p>
              </div>
          )}
      </div>
      
      {/* --- FORM MODAL --- */}
      {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                      <h3 className="font-bold text-gray-800">{isEditing ? 'Edit Asset' : 'New Asset'}</h3>
                      <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                  <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                      {/* Simplified Form for Fix */}
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Asset ID</label>
                          <input type="text" className="w-full border rounded p-2" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value})} disabled={isEditing} required />
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
                       <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                           <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                           <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                       </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default AssetManagement;
