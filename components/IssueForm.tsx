
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { IssueRecord, Item, Location, Machine, Sector, Division, User, MaintenancePlan } from '../types';
import { generateIssueEmail } from '../services/geminiService';
import { sendIssueToSheet, DEFAULT_SCRIPT_URL } from '../services/googleSheetsService';
import SearchableSelect, { Option } from './SearchableSelect';
import * as XLSX from 'xlsx';

interface IssueFormProps {
  onAddIssue: (issue: IssueRecord) => void;
  items: Item[];
  locations: Location[];
  machines: Machine[];
  sectors: Sector[];
  divisions: Division[];
  maintenancePlans: MaintenancePlan[];
  currentUser: User;
}

interface LineItem {
  itemId: string;
  itemName: string;
  quantity: number;
}

const IssueForm: React.FC<IssueFormProps> = ({ 
  onAddIssue, items, locations, machines, sectors, divisions, maintenancePlans, currentUser 
}) => {
  // --- Header State (Context) ---
  const [locationId, setLocationId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [machineId, setMachineId] = useState('');
  
  // --- Maintenance Plan State ---
  const [selectedPlanId, setSelectedPlanId] = useState('');

  // --- Machine Filters ---
  const [filterMainGroup, setFilterMainGroup] = useState('');
  const [filterSubGroup, setFilterSubGroup] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterChaseNo, setFilterChaseNo] = useState(''); 
  const [filterModelNo, setFilterModelNo] = useState(''); 

  // --- Email/Notification State ---
  const [warehouseEmail, setWarehouseEmail] = useState('warehouse@company.com');
  const [requesterEmail, setRequesterEmail] = useState('');

  // --- Line Item State (Current Input) ---
  const [currentItemId, setCurrentItemId] = useState('');
  const [currentItemName, setCurrentItemName] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState<number | ''>('');
  
  // --- List State ---
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // --- Submission State ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmittedBatch, setLastSubmittedBatch] = useState<IssueRecord[] | null>(null);
  
  // --- Refs for Scanner Navigation ---
  const itemInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Auto-lookup Item Name
  const selectedItemObj = useMemo(() => items.find(i => i.id === currentItemId), [items, currentItemId]);
  
  useEffect(() => {
    if (selectedItemObj) {
      setCurrentItemName(selectedItemObj.fullName || selectedItemObj.name);
    } else {
      setCurrentItemName('');
    }
  }, [currentItemId, selectedItemObj]);

  // Reset downstream fields
  useEffect(() => { setDivisionId(''); setMachineId(''); }, [sectorId]);
  useEffect(() => { setMachineId(''); }, [divisionId]);

  // Auto-fill Requester Email
  useEffect(() => {
    const location = locations.find(l => l.id === locationId);
    if (location && location.email) setRequesterEmail(location.email);
    else setRequesterEmail('');
    
    if (locationId) setTimeout(() => itemInputRef.current?.focus(), 100);
  }, [locationId, locations]);


  const handleAddLineItem = () => {
    if (!currentItemId || !currentQuantity || Number(currentQuantity) <= 0) return;

    if (selectedItemObj && (selectedItemObj.stockQuantity || 0) < Number(currentQuantity)) {
        if (!confirm(`Warning: Quantity (${currentQuantity}) exceeds Stock (${selectedItemObj.stockQuantity || 0}). Continue?`)) return;
    }

    const newItem: LineItem = {
      itemId: currentItemId,
      itemName: currentItemName,
      quantity: Number(currentQuantity)
    };

    setLineItems([...lineItems, newItem]);
    setCurrentItemId('');
    setCurrentItemName('');
    setCurrentQuantity('');
    setTimeout(() => itemInputRef.current?.focus(), 50);
  };

  const handleRemoveLineItem = (index: number) => {
    const newItems = [...lineItems];
    newItems.splice(index, 1);
    setLineItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationId || !machineId || lineItems.length === 0 || !selectedPlanId || !warehouseEmail) {
        alert("Please complete all required fields (Location, Machine, Plan, Email, Lines).");
        return;
    }

    setIsSubmitting(true);
    
    const machine = machines.find(m => m.id === machineId);
    const sector = sectors.find(s => s.id === sectorId);
    const division = divisions.find(d => d.id === divisionId);
    const plan = maintenancePlans.find(p => p.id === selectedPlanId);
    const timestamp = new Date().toISOString();
    const batchIdBase = Date.now().toString().slice(-6);
    const newRecords: IssueRecord[] = [];
    const machineDisplayName = machine ? (machine.category ? machine.category : `Machine ${machine.id}`) : 'Unknown';

    for (let i = 0; i < lineItems.length; i++) {
        const line = lineItems[i];
        newRecords.push({
            id: `REQ-${batchIdBase}-${i + 1}`,
            timestamp: timestamp,
            locationId,
            itemId: line.itemId,
            itemName: line.itemName,
            quantity: line.quantity,
            machineId,
            machineName: machineDisplayName,
            sectorName: sector ? sector.name : '',
            divisionName: division ? division.name : '',
            maintenancePlan: plan ? plan.name : '',
            status: 'Pending',
            warehouseEmail,
            requesterEmail
        });
    }

    // Process submission
    try {
        const scriptUrl = localStorage.getItem('wf_script_url_v3') || DEFAULT_SCRIPT_URL;
        if (scriptUrl) {
            Promise.all(newRecords.map(r => sendIssueToSheet(scriptUrl, r))).catch(console.error);
        }
        await generateIssueEmail(newRecords); // Trigger AI Email logic
        newRecords.forEach(record => onAddIssue(record));
        setLastSubmittedBatch(newRecords);
        
        // Reset
        setMachineId('');
        setLineItems([]);
        setSelectedPlanId('');
    } catch (error) {
        console.error("Submission Error:", error);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handlePrint = () => window.print();

  // --- Filtering Logic ---
  const availableMachines = useMemo(() => {
    return machines.filter(m => {
        if (divisionId && m.divisionId !== divisionId) return false;
        if (filterMainGroup && m.mainGroup !== filterMainGroup) return false;
        if (filterSubGroup && m.subGroup !== filterSubGroup) return false;
        if (filterCategory && m.category !== filterCategory) return false;
        if (filterBrand && m.brand !== filterBrand) return false;
        if (filterChaseNo && m.chaseNo !== filterChaseNo) return false;
        if (filterModelNo && m.modelNo !== filterModelNo) return false;
        return true;
    });
  }, [machines, divisionId, filterMainGroup, filterSubGroup, filterCategory, filterBrand, filterChaseNo, filterModelNo]);

  // Options Helpers
  const getOpts = (key: keyof Machine) => Array.from(new Set(availableMachines.map(m => m[key]).filter(Boolean))).map(v => ({ id: v as string, label: v as string }));
  
  const itemOptions: Option[] = useMemo(() => items.map(i => {
      const parts = [i.partNumber, i.modelNo, i.oem].filter(Boolean);
      return { id: i.id, label: i.id, subLabel: `${i.name} ${parts.length > 0 ? '| ' + parts.join(' ') : ''}` };
  }), [items]);

  const machineOptions: Option[] = useMemo(() => availableMachines.map(m => ({
      id: m.id, 
      label: m.category || `ID: ${m.id}`,
      subLabel: `${m.brand || ''} ${m.modelNo || ''} (Chase: ${m.chaseNo})`
  })), [availableMachines]);

  // UI Components
  const Label = ({ children }: { children: React.ReactNode }) => (
      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{children}</label>
  );

  return (
    <div className="h-full flex flex-col font-cairo bg-gray-50/50" dir="ltr">
        
        {/* SUCCESS MODAL */}
        {lastSubmittedBatch && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
                    <div className="text-6xl mb-4">✅</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Request Submitted</h2>
                    <p className="text-gray-500 mb-6">{lastSubmittedBatch.length} items logged successfully.</p>
                    <div className="flex gap-2 justify-center">
                        <button onClick={handlePrint} className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-black">Print Slip</button>
                        <button onClick={() => setLastSubmittedBatch(null)} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
                    </div>
                </div>
            </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6 h-full p-2">
            
            {/* LEFT SIDEBAR: CONTEXT */}
            <div className="w-full lg:w-72 flex flex-col gap-4 shrink-0">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-xs font-bold text-gray-900 border-b border-gray-100 pb-2 mb-3">📍 Context</h3>
                    <div className="space-y-4">
                        <div>
                            <Label>Warehouse Location</Label>
                            <SearchableSelect 
                                label="" 
                                options={locations.map(l => ({ id: l.id, label: l.name }))} 
                                value={locationId} 
                                onChange={setLocationId} 
                                placeholder="Select Zone..."
                                compact
                            />
                        </div>
                        <div>
                            <Label>Sector</Label>
                            <SearchableSelect 
                                label="" 
                                options={sectors.map(s => ({ id: s.id, label: s.name }))} 
                                value={sectorId} 
                                onChange={setSectorId} 
                                placeholder="Sector..."
                                compact
                            />
                        </div>
                        <div>
                            <Label>Division</Label>
                            <SearchableSelect 
                                label="" 
                                options={divisions.filter(d => d.sectorId === sectorId).map(d => ({ id: d.id, label: d.name }))} 
                                value={divisionId} 
                                onChange={setDivisionId} 
                                placeholder="Division..." 
                                disabled={!sectorId}
                                compact
                            />
                        </div>
                        
                        <div className="pt-2 border-t border-gray-100">
                            <Label>Tech Filters</Label>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <SearchableSelect label="" options={getOpts('mainGroup')} value={filterMainGroup} onChange={setFilterMainGroup} placeholder="Group" compact />
                                <SearchableSelect label="" options={getOpts('subGroup')} value={filterSubGroup} onChange={setFilterSubGroup} placeholder="Sub" compact />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <SearchableSelect label="" options={getOpts('brand')} value={filterBrand} onChange={setFilterBrand} placeholder="Brand" compact />
                                <SearchableSelect label="" options={getOpts('category')} value={filterCategory} onChange={setFilterCategory} placeholder="Cat" compact />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex-1">
                    <h4 className="text-blue-800 font-bold text-sm mb-2">Tips</h4>
                    <p className="text-xs text-blue-600 leading-relaxed">
                        Use the technical filters to narrow down the machine list. Ensure the correct Maintenance Plan is selected for reporting accuracy.
                    </p>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">New Material Request</h2>
                        <p className="text-xs text-gray-500">Create a new issue slip for warehouse items</p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-bold text-gray-400 uppercase">Date</div>
                        <div className="text-sm font-mono text-gray-700">{new Date().toLocaleDateString()}</div>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    
                    {/* Machine Selection */}
                    <div>
                        <Label>Target Equipment / Machine</Label>
                        <SearchableSelect 
                            label="" 
                            required 
                            options={machineOptions} 
                            value={machineId} 
                            onChange={setMachineId} 
                            placeholder={availableMachines.length === 0 ? "No machines found" : "Select Equipment..."} 
                        />
                    </div>

                    {/* Scanning Bar */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-[2] w-full">
                                <Label>Item Number (Scan)</Label>
                                <SearchableSelect 
                                    label=""
                                    options={itemOptions}
                                    value={currentItemId}
                                    onChange={setCurrentItemId}
                                    placeholder="Scan Item No..."
                                    inputRef={itemInputRef}
                                    compact={false}
                                />
                            </div>
                            <div className="flex-[2] w-full">
                                <Label>Item Name</Label>
                                <input 
                                    className="w-full h-[42px] px-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                    value={currentItemName}
                                    readOnly
                                    placeholder="Item name will appear here..."
                                />
                            </div>
                            <div className="w-24">
                                <Label>Qty</Label>
                                <input 
                                    ref={qtyInputRef}
                                    type="number"
                                    className="w-full h-[42px] px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-center font-bold"
                                    value={currentQuantity}
                                    onChange={e => setCurrentQuantity(Number(e.target.value))}
                                    onKeyDown={e => e.key === 'Enter' && handleAddLineItem()}
                                />
                            </div>
                            <button 
                                onClick={handleAddLineItem}
                                disabled={!currentItemId || !currentQuantity}
                                className="h-[42px] px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-bold shadow-sm"
                            >
                                Add
                            </button>
                        </div>
                        {selectedItemObj && (
                            <div className="mt-2 text-xs flex items-center gap-2">
                                <span className="text-gray-500 font-bold uppercase">Stock:</span>
                                <span className={`font-mono font-bold ${selectedItemObj.stockQuantity! > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {selectedItemObj.stockQuantity} {selectedItemObj.unit}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Lines Table */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden min-h-[150px]">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3">Item #</th>
                                    <th className="px-4 py-3">Description</th>
                                    <th className="px-4 py-3 text-center">Qty</th>
                                    <th className="px-4 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {lineItems.map((line, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-mono text-gray-700">{line.itemId}</td>
                                        <td className="px-4 py-3">{line.itemName}</td>
                                        <td className="px-4 py-3 text-center font-bold text-gray-900">{line.quantity}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => handleRemoveLineItem(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">✕</button>
                                        </td>
                                    </tr>
                                ))}
                                {lineItems.length === 0 && (
                                    <tr><td colSpan={4} className="p-8 text-center text-gray-400">No items added yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                        <div>
                            <Label>Maintenance Plan</Label>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                                {maintenancePlans.map(p => (
                                    <label key={p.id} className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs transition ${selectedPlanId === p.id ? 'bg-orange-50 border-orange-200 text-orange-800' : 'hover:bg-gray-50'}`}>
                                        <input type="radio" name="plan" value={p.id} checked={selectedPlanId === p.id} onChange={e => setSelectedPlanId(e.target.value)} />
                                        {p.name}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <Label>Warehouse Email</Label>
                                <input type="email" value={warehouseEmail} onChange={e => setWarehouseEmail(e.target.value)} className="w-full h-9 px-3 border border-gray-300 rounded text-sm" />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                                <span className="font-bold">CC:</span> {requesterEmail || 'None'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || lineItems.length === 0}
                        className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold shadow-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:-translate-y-0.5"
                    >
                        {isSubmitting ? 'Processing...' : 'Submit Request 🚀'}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default IssueForm;
