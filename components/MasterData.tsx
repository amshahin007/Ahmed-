import React, { useState, useEffect } from 'react';
import { Item, Machine, Location, Sector, Division, User, IssueRecord } from '../types';
import SearchableSelect from './SearchableSelect';
import { fetchItemsFromSheet, DEFAULT_SHEET_ID, DEFAULT_ITEMS_GID, extractSheetIdFromUrl, extractGidFromUrl, APP_SCRIPT_TEMPLATE, sendIssueToSheet } from '../services/googleSheetsService';

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
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Sync State
  const [sheetId, setSheetId] = useState(localStorage.getItem('wf_sheet_id') || DEFAULT_SHEET_ID);
  const [gid, setGid] = useState(localStorage.getItem('wf_items_gid') || DEFAULT_ITEMS_GID);
  const [scriptUrl, setScriptUrl] = useState(localStorage.getItem('wf_script_url') || '');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // Save config when changed
  useEffect(() => { localStorage.setItem('wf_sheet_id', sheetId); }, [sheetId]);
  useEffect(() => { localStorage.setItem('wf_items_gid', gid); }, [gid]);
  useEffect(() => { localStorage.setItem('wf_script_url', scriptUrl); }, [scriptUrl]);

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

    } else if (activeTab === 'users') {
      const payload: User = {
        username: formData.username,
        name: formData.name,
        role: formData.role,
        email: formData.email,
        password: formData.password || (isEditing ? users.find(u => u.username === formData.username)?.password : 'password'),
        allowedLocationIds: formData.allowedLocationIds
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
                 {activeTab === 'items' ? '2. ' : ''}Record Issues to Sheet
               </h4>
               <p className="text-sm text-gray-600">
                 Configure the Google Apps Script URL to automatically log every new issue created in the app to a Google Sheet.
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

  const renderForm = () => {
    if (!showForm) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg animate-fade-in-up max-h-[90vh] overflow-y-auto">
          <h3 className="text-xl font-bold mb-4 capitalize">
            {isEditing ? 'Edit' : 'Add New'} {activeTab.slice(0, -1)}
          </h3>
          <form onSubmit={handleSave} className="space-y-4">
            
            {/* ID Field */}
            {activeTab === 'users' ? (
                <div>
                    <label className="block text-sm font-medium text-gray-700">Username</label>
                    <input 
                        required
                        className={`w-full border rounded p-2 ${isEditing ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500 outline-none'}`}
                        value={formData.username || ''}
                        onChange={e => setFormData({...formData, username: e.target.value})}
                        readOnly={isEditing}
                    />
                </div>
            ) : (
                <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {activeTab === 'items' ? 'Item Number (ID)' : 'ID'}
                    </label>
                    <input 
                        className={`w-full border rounded p-2 ${isEditing ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                        placeholder="Auto-generated if empty"
                        value={formData.id || ''}
                        onChange={e => setFormData({...formData, id: e.target.value})}
                        readOnly={isEditing}
                    />
                </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">
                 {activeTab === 'users' ? 'Full Name' : activeTab === 'items' ? 'Description' : 'Name'}
              </label>
              <input 
                required
                className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                value={formData.name || ''}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            {/* Custom fields for Items - Matches user request */}
            {activeTab === 'items' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">3rd Item Number</label>
                  <input 
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.thirdId || ''}
                    onChange={e => setFormData({...formData, thirdId: e.target.value})}
                  />
                </div>
                 <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Description Line 2</label>
                  <input 
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.description2 || ''}
                    onChange={e => setFormData({...formData, description2: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Full Name</label>
                  <input 
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.fullName || ''}
                    onChange={e => setFormData({...formData, fullName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <input 
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.category || ''}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    placeholder="e.g. Spare Parts"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Brand / Manufacturer</label>
                  <input 
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.brand || ''}
                    onChange={e => setFormData({...formData, brand: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">OEM</label>
                  <input 
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.oem || ''}
                    onChange={e => setFormData({...formData, oem: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Part No.</label>
                  <input 
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.partNumber || ''}
                    onChange={e => setFormData({...formData, partNumber: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Unit (UM)</label>
                  <input 
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.unit || ''}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                  />
                </div>
              </div>
            )}

            {/* Custom fields for Machines */}
            {activeTab === 'machines' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Model</label>
                  <input 
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.model || ''}
                    onChange={e => setFormData({...formData, model: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                   <div>
                      <label className="block text-sm font-medium text-gray-700">Main Group</label>
                      <input 
                        className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                        value={formData.mainGroup || ''}
                        onChange={e => setFormData({...formData, mainGroup: e.target.value})}
                        placeholder="e.g. Generators"
                      />
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-gray-700">Sub Group</label>
                      <input 
                        className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                        value={formData.subGroup || ''}
                        onChange={e => setFormData({...formData, subGroup: e.target.value})}
                        placeholder="e.g. Diesel"
                      />
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-gray-700">Brand / Manufacturer</label>
                      <input 
                        className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                        value={formData.brand || ''}
                        onChange={e => setFormData({...formData, brand: e.target.value})}
                        placeholder="e.g. Caterpillar"
                      />
                   </div>
                </div>
                <div className="mt-2">
                  <SearchableSelect
                     label="Division (Optional)"
                     options={divisions.map(d => ({ id: d.id, label: d.name }))}
                     value={formData.divisionId || ''}
                     onChange={(val) => setFormData({...formData, divisionId: val})}
                     placeholder="Select Division"
                  />
                </div>
              </>
            )}

            {/* Custom fields for Divisions */}
            {activeTab === 'divisions' && (
              <div className="mt-2">
                <SearchableSelect
                   label="Parent Sector"
                   required
                   options={sectors.map(s => ({ id: s.id, label: s.name }))}
                   value={formData.sectorId || ''}
                   onChange={(val) => setFormData({...formData, sectorId: val})}
                   placeholder="Select Sector"
                />
              </div>
            )}
            
            {/* Custom fields for Locations */}
            {activeTab === 'locations' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Site Email</label>
                <input 
                  type="email"
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="site.contact@email.com"
                  value={formData.email || ''}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
                <p className="text-xs text-gray-400 mt-1">Requests for this location will be CC'd here.</p>
              </div>
            )}

            {/* Custom fields for Users */}
            {activeTab === 'users' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input 
                    type="email"
                    required
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.email || ''}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <select
                     required
                     className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                     value={formData.role || 'user'}
                     onChange={e => setFormData({...formData, role: e.target.value})}
                  >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="warehouse_manager">Warehouse Manager</option>
                      <option value="warehouse_supervisor">Warehouse Supervisor</option>
                      <option value="maintenance_manager">Maintenance Manager</option>
                      <option value="maintenance_engineer">Maintenance Engineer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password {isEditing && '(Leave blank to keep current)'}</label>
                  <input 
                    type="password"
                    required={!isEditing}
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.password || ''}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Allowed Locations (Write Access)</label>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50 grid grid-cols-1 gap-2">
                    {locations.map(loc => (
                      <label key={loc.id} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-100 p-1 rounded">
                        <input
                          type="checkbox"
                          className="rounded text-blue-600 focus:ring-blue-500"
                          checked={formData.allowedLocationIds?.includes(loc.id) || false}
                          onChange={(e) => {
                             const current = formData.allowedLocationIds || [];
                             if (e.target.checked) setFormData({...formData, allowedLocationIds: [...current, loc.id]});
                             else setFormData({...formData, allowedLocationIds: current.filter((id: string) => id !== loc.id)});
                          }}
                        />
                        <span className="text-gray-700">{loc.name}</span>
                        <span className="text-gray-400 text-xs">({loc.id})</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">If none selected, user can create issues for <strong>ALL</strong> locations (unless they are Admin).</p>
                </div>
              </>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button 
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition shadow-sm"
              >
                {isEditing ? 'Update' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    let headers: string[] = [];
    let data: any[] = [];

    switch (activeTab) {
      case 'items':
        // Updated columns based on user request
        headers = ['Item Number', '3rd Item No', 'Description', 'Desc Line 2', 'Full Name', 'Category', 'Brand / Manufacturer', 'OEM', 'Part No', 'UM', 'Actions'];
        data = items;
        break;
      case 'machines':
        headers = ['ID', 'Name', 'Model', 'Main Group', 'Sub Group', 'Brand / Manufacturer', 'Division', 'Actions'];
        data = machines;
        break;
      case 'locations':
        headers = ['ID', 'Name', 'Site Email', 'Actions'];
        data = locations;
        break;
      case 'sectors':
        headers = ['ID', 'Name', 'Actions'];
        data = sectors;
        break;
      case 'divisions':
        headers = ['ID', 'Name', 'Parent Sector', 'Actions'];
        data = divisions;
        break;
      case 'users':
        headers = ['Username', 'Name', 'Role', 'Email', 'Locations', 'Actions'];
        data = users;
        break;
    }

    // Pagination Logic
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE) || 1;
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedData = data.slice(startIndex, endIndex);

    return (
      <div className="flex flex-col space-y-4">
        <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
            <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
                <tr>
                {headers.map(h => <th key={h} className="px-6 py-3 font-semibold text-gray-700 whitespace-nowrap">{h}</th>)}
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {paginatedData.map((row: any) => (
                <tr key={row.id || row.username} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-3 font-medium text-gray-900 align-top">{activeTab === 'users' ? row.username : row.id}</td>
                    
                    {/* Specific Columns for Items */}
                    {activeTab === 'items' && (
                    <>
                        <td className="px-6 py-3 text-gray-500 align-top">{row.thirdId || '-'}</td>
                        <td className="px-6 py-3 text-gray-800 align-top">{row.name}</td>
                        <td className="px-6 py-3 text-gray-500 align-top text-xs">{row.description2 || '-'}</td>
                        <td className="px-6 py-3 text-gray-500 align-top text-xs">{row.fullName || '-'}</td>
                        <td className="px-6 py-3 text-gray-500 align-top text-xs">{row.category || '-'}</td>
                        <td className="px-6 py-3 text-gray-500 align-top">{row.brand || '-'}</td>
                        <td className="px-6 py-3 text-gray-500 align-top">{row.oem || '-'}</td>
                        <td className="px-6 py-3 text-gray-500 font-mono text-xs align-top">{row.partNumber || '-'}</td>
                        <td className="px-6 py-3 text-gray-500 align-top">{row.unit}</td>
                    </>
                    )}

                    {activeTab !== 'items' && (
                    <td className="px-6 py-3 align-top">{row.name}</td>
                    )}
                    
                    {activeTab === 'machines' && (
                    <>
                        <td className="px-6 py-3 text-gray-500 align-top">{row.model}</td>
                         <td className="px-6 py-3 text-gray-500 align-top text-xs">{row.mainGroup || '-'}</td>
                         <td className="px-6 py-3 text-gray-500 align-top text-xs">{row.subGroup || '-'}</td>
                         <td className="px-6 py-3 text-gray-500 align-top text-xs">{row.brand || '-'}</td>
                        <td className="px-6 py-3 text-gray-500 align-top">
                        {divisions.find(d => d.id === row.divisionId)?.name || '-'}
                        </td>
                    </>
                    )}
                    {activeTab === 'divisions' && (
                    <td className="px-6 py-3 text-gray-500 align-top">
                        {sectors.find(s => s.id === row.sectorId)?.name || '-'}
                    </td>
                    )}
                    {activeTab === 'locations' && (
                    <td className="px-6 py-3 text-gray-500 font-mono text-xs align-top">
                        {row.email || <span className="text-gray-300 italic">No email set</span>}
                    </td>
                    )}
                    {activeTab === 'users' && (
                    <>
                        <td className="px-6 py-3 align-top">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                row.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                row.role.includes('manager') ? 'bg-orange-100 text-orange-700' :
                                'bg-blue-100 text-blue-700'
                            }`}>
                                {row.role.replace('_', ' ').toUpperCase()}
                            </span>
                        </td>
                        <td className="px-6 py-3 text-gray-500 text-xs align-top">
                            {row.email}
                        </td>
                        <td className="px-6 py-3 text-gray-500 text-xs align-top max-w-[150px]">
                           {row.role === 'admin' ? (
                             <span className="text-green-600 font-bold">All Access</span>
                           ) : (
                             row.allowedLocationIds && row.allowedLocationIds.length > 0 ? (
                               <div className="flex flex-wrap gap-1">
                                 {row.allowedLocationIds.map((lid: string) => (
                                   <span key={lid} className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200">
                                      {locations.find(l => l.id === lid)?.name || lid}
                                   </span>
                                 ))}
                               </div>
                             ) : (
                               <span className="text-gray-400 italic">No restrictions</span>
                             )
                           )}
                        </td>
                    </>
                    )}

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
                    <td colSpan={headers.length} className="px-6 py-8 text-center text-gray-400">
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div className="flex flex-wrap gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          {(['sectors', 'divisions', 'machines', 'items', 'locations', 'users'] as const).map(tab => (
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