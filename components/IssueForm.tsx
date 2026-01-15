
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { IssueRecord, Item, Location, Machine, Sector, Division, User, MaintenancePlan } from '../types';
import { generateIssueEmail } from '../services/geminiService';
import { sendIssueToSheet, uploadFileToDrive, DEFAULT_SCRIPT_URL } from '../services/googleSheetsService';
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
  unit: string;
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

  // --- Machine Filters (Strict Hierarchy) ---
  const [filterCategory, setFilterCategory] = useState(''); // 1. Equipment Name
  const [filterBrand, setFilterBrand] = useState('');       // 2. Brand
  const [filterModelNo, setFilterModelNo] = useState('');   // 3. Model Name
  const [filterLocalNo, setFilterLocalNo] = useState('');   // 4. Local No
  const [filterChaseNo, setFilterChaseNo] = useState('');   // 5. Chase No

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
  const [emailStatus, setEmailStatus] = useState<string>('');
  
  // --- Upload State ---
  const [uploadingToDrive, setUploadingToDrive] = useState(false);
  const [driveLink, setDriveLink] = useState('');

  // --- Refs for Scanner Navigation ---
  const itemInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const sectorInputRef = useRef<HTMLInputElement>(null); // Added Ref for Sector
  
  // Flags to ignore resetting fields when prefilling
  const ignoreNextSectorChange = useRef(false);
  const ignoreNextDivisionChange = useRef(false);

  // --- PRE-FILL LOGIC from LocalStorage ---
  useEffect(() => {
     const prefillStr = localStorage.getItem('wf_issue_prefill');
     if (prefillStr) {
         try {
             const data = JSON.parse(prefillStr);
             
             let prefillSectorId = data.sectorId;
             
             // Infer Sector from Division if missing (common if machine doesn't have sectorId explicitly)
             if (!prefillSectorId && data.divisionId) {
                 const div = divisions.find(d => d.id === data.divisionId);
                 if (div) prefillSectorId = div.sectorId;
             }

             if (data.locationId) setLocationId(data.locationId);
             
             // Set flag to prevent useEffect from clearing division immediately
             if (prefillSectorId) {
                 ignoreNextSectorChange.current = true;
                 setSectorId(prefillSectorId);
             }
             
             if (data.divisionId) {
                 // Important: set this immediately after sector so validation logic sees it
                 ignoreNextDivisionChange.current = true;
                 setDivisionId(data.divisionId);
             }

             if (data.machineId) {
                 const m = machines.find(mac => mac.id === data.machineId);
                 if (m) {
                     setFilterCategory(m.category || '');
                     setFilterBrand(m.brand || '');
                     setFilterModelNo(m.modelNo || '');
                     setFilterLocalNo(m.machineLocalNo || '');
                     setFilterChaseNo(m.chaseNo || '');
                     setMachineId(data.machineId);
                 }
             }
             
             // Auto-Select Maintenance Plan if provided (e.g. Sudden Breakdown)
             if (data.maintenancePlanId) setSelectedPlanId(data.maintenancePlanId);
             
         } catch(e) { console.error("Prefill error", e); }
         
         // Clear it so it doesn't persist on reload
         localStorage.removeItem('wf_issue_prefill');
     }
  }, [divisions, machines]); 

  // Auto-lookup Item Name for current input (Maintains the string for Line Item creation)
  const selectedItemObj = useMemo(() => items.find(i => i.id === currentItemId), [items, currentItemId]);
  
  useEffect(() => {
    if (selectedItemObj) {
      // Prioritize Full Name from Master Data
      setCurrentItemName(selectedItemObj.fullName || selectedItemObj.name);
    } else {
      setCurrentItemName('');
    }
  }, [currentItemId, selectedItemObj]);

  // Reset downstream fields when upstream changes (Org Structure)
  useEffect(() => {
    if (ignoreNextSectorChange.current) {
        ignoreNextSectorChange.current = false;
        return;
    }
    setDivisionId('');
    // NOTE: We do NOT reset Technical Filters here anymore to allow disconnection if desired, 
    // BUT typically if Sector changes, machines change. 
    // Given the request "disconnect division from equipment name", Sector is still a parent.
    resetTechnicalFilters(); 
  }, [sectorId]);

  useEffect(() => {
    if (ignoreNextDivisionChange.current) {
        ignoreNextDivisionChange.current = false;
        return;
    }
    // REQUEST: "disconnect division from equipment name"
    // So we do NOT reset Technical Filters when Division changes.
    // resetTechnicalFilters(); 
  }, [divisionId]);

  const resetTechnicalFilters = () => {
      setFilterCategory('');
      setFilterBrand('');
      setFilterModelNo('');
      setFilterLocalNo('');
      setFilterChaseNo('');
      setMachineId('');
  };

  // Auto-fill Requester (Site) Email based on Location
  useEffect(() => {
    const location = locations.find(l => l.id === locationId);
    if (location && location.email) {
      setRequesterEmail(location.email);
    } else {
      setRequesterEmail('');
    }
    // When location changes, focus Sector input to guide user flow
    if (locationId) {
        setTimeout(() => sectorInputRef.current?.focus(), 100);
    }
  }, [locationId, locations]);


  const handleAddLineItem = () => {
    if (!currentItemId || !currentQuantity || Number(currentQuantity) <= 0) return;

    if (selectedItemObj && (selectedItemObj.stockQuantity || 0) < Number(currentQuantity)) {
        if (!confirm(`Warning: Requested Quantity (${currentQuantity}) exceeds Available Stock (${selectedItemObj.stockQuantity || 0}). Continue?`)) {
            return;
        }
    }

    const newItem: LineItem = {
      itemId: currentItemId,
      itemName: currentItemName,
      unit: selectedItemObj?.unit || 'pcs',
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
    setDriveLink('');
    
    try {
        if (!locationId) { alert("Please select a 'Warehouse Location'."); return; }
        if (!machineId) { alert("Please select a 'Machine'."); return; }
        if (lineItems.length === 0) { alert("Please add at least one item."); return; }
        if (!selectedPlanId) { alert("Please select a 'Maintenance Plan'."); return; }
        if (!warehouseEmail) { alert("Please provide a Warehouse Email."); return; }

        setIsSubmitting(true);
        setEmailStatus('Processing Request...');
        
        const machine = machines.find(m => m.id === machineId);
        const sector = sectors.find(s => s.id === sectorId);
        const division = divisions.find(d => d.id === divisionId);
        const plan = maintenancePlans.find(p => p.id === selectedPlanId);

        const timestamp = new Date().toISOString();
        const batchIdBase = Date.now().toString().slice(-6);
        
        const newRecords: IssueRecord[] = [];
        const machineDisplayName = machine 
            ? (machine.category ? machine.category : `Machine ${machine.id}`) 
            : 'Unknown Machine';

        for (let i = 0; i < lineItems.length; i++) {
            const line = lineItems[i];
            newRecords.push({
                id: `REQ-${batchIdBase}-${i + 1}`,
                timestamp: timestamp,
                locationId,
                itemId: line.itemId,
                itemName: line.itemName,
                quantity: line.quantity,
                unit: line.unit, // Pass unit to Record
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

        await new Promise(resolve => setTimeout(resolve, 800));
        const emailData = await generateIssueEmail(newRecords);
        console.log(`[System] Email prepared: ${emailData.subject}`);
        
        const scriptUrl = localStorage.getItem('wf_script_url_v3') || DEFAULT_SCRIPT_URL;
        if (scriptUrl) {
            Promise.all(newRecords.map(r => sendIssueToSheet(scriptUrl, r))).catch(console.error);
        }

        newRecords.forEach(record => onAddIssue(record));
        setLastSubmittedBatch(newRecords);
        setEmailStatus(`Sent to: ${warehouseEmail}`);
        
        // Reset Logic
        resetTechnicalFilters();
        setLineItems([]);
        setSelectedPlanId('');
        
    } catch (error) {
        console.error("Submission Error:", error);
        alert("An unexpected error occurred.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handlePrint = () => window.print();

  const getExcelWorkbook = () => {
    if (!lastSubmittedBatch || lastSubmittedBatch.length === 0) return null;
    const headers = ["Request ID", "Date", "Location", "Sector", "Division", "Machine", "Maint. Plan", "Item Number", "Item Name", "Unit", "Quantity", "Warehouse Email", "Site Email"];
    const rows = lastSubmittedBatch.map(item => [
        item.id, new Date(item.timestamp).toLocaleString(), item.locationId, item.sectorName || '', item.divisionName || '', 
        item.machineName, item.maintenancePlan || '', item.itemId, item.itemName, item.unit || 'pcs', item.quantity, item.warehouseEmail || '', item.requesterEmail || ''
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "RequestSlip");
    return wb;
  };

  const handleExportExcel = () => {
    const wb = getExcelWorkbook();
    if (!wb || !lastSubmittedBatch) return;
    XLSX.writeFile(wb, `Request_Slip_${lastSubmittedBatch[0].id.split('-')[1]}.xlsx`);
  };

  const handleSaveToDrive = async () => {
    const scriptUrl = localStorage.getItem('wf_script_url_v3') || DEFAULT_SCRIPT_URL;
    if (!scriptUrl || !lastSubmittedBatch) return;
    setUploadingToDrive(true);
    try {
        const wb = getExcelWorkbook();
        if (!wb) throw new Error("No data");
        const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        const url = await uploadFileToDrive(scriptUrl, `Request_Slip_${lastSubmittedBatch[0].id.split('-')[1]}.xlsx`, wbOut);
        setDriveLink(url || 'saved');
        if(!url) alert("Saved to Drive folder.");
    } catch (e) { alert("Failed to upload."); } finally { setUploadingToDrive(false); }
  };

  // --- HIERARCHY LOGIC & OPTIONS ---

  // 1. FILTER SECTORS BY LOCATION (New Request)
  const availableSectors = useMemo(() => {
      if (!locationId) return sectors; 
      const loc = locations.find(l => l.id === locationId);
      const locName = loc?.name;

      // Find all machines in this location
      const machinesInLoc = machines.filter(m => {
          const mLoc = String(m.locationId || '');
          const formLoc = String(locationId);
          return mLoc === formLoc || mLoc === locName;
      });

      // Collect Sector IDs from these machines
      const allowedSectorIds = new Set<string>();
      machinesInLoc.forEach(m => {
          if (m.sectorId) allowedSectorIds.add(m.sectorId);
          if (m.divisionId) {
              const div = divisions.find(d => d.id === m.divisionId || d.name === m.divisionId);
              if (div) allowedSectorIds.add(div.sectorId);
          }
      });

      // Filter Sector List
      return sectors.filter(s => allowedSectorIds.has(s.id) || allowedSectorIds.has(s.name));
  }, [locationId, machines, sectors, divisions, locations]);

  // 2. MACHINES SCOPE FOR TECHNICAL FILTERS (Decoupled from Division)
  // This list is used to populate Equipment Name, Brand, etc.
  // It ONLY looks at Location and Sector, IGNORING Division.
  const machinesForTechnicalFilters = useMemo(() => {
      return machines.filter(m => {
          // 1. Location Check
          if (locationId) {
              const loc = locations.find(l => l.id === locationId);
              const mLoc = String(m.locationId || '');
              if (mLoc !== locationId && mLoc !== loc?.name) return false;
          }

          // 2. Sector Check
          if (sectorId) {
              const sec = sectors.find(s => s.id === sectorId);
              const secName = sec?.name;
              
              // Direct Match
              const directMatch = m.sectorId === sectorId || (secName && m.sectorId === secName);
              
              // Match via Division (if direct doesn't match)
              let divisionMatch = false;
              if (m.divisionId) {
                  const div = divisions.find(d => d.id === m.divisionId || d.name === m.divisionId);
                  if (div) {
                      divisionMatch = div.sectorId === sectorId || (secName && div.sectorId === secName);
                  }
              }

              if (!directMatch && !divisionMatch) return false;
          }

          // 3. Division Check - SKIPPED deliberately to decouple Equipment Name from Division
          return true;
      });
  }, [machines, locationId, sectorId, locations, sectors, divisions]);

  // --- CASCADING TECHNICAL OPTIONS (Based on machinesForTechnicalFilters) ---

  // 1. Equipment Name (Category) Options
  const categoryOptions = useMemo(() => {
      const set = new Set<string>();
      machinesForTechnicalFilters.forEach(m => { if(m.category) set.add(m.category); });
      return Array.from(set).sort().map(c => ({ id: c, label: c }));
  }, [machinesForTechnicalFilters]);

  // 2. Brand Options (Filtered by Category)
  const machinesInCat = useMemo(() => {
      return filterCategory ? machinesForTechnicalFilters.filter(m => m.category === filterCategory) : machinesForTechnicalFilters;
  }, [machinesForTechnicalFilters, filterCategory]);

  const brandOptions = useMemo(() => {
      const set = new Set<string>();
      machinesInCat.forEach(m => { if(m.brand) set.add(m.brand); });
      return Array.from(set).sort().map(b => ({ id: b, label: b }));
  }, [machinesInCat]);

  // 3. Model Name Options (Filtered by Category + Brand)
  const machinesInBrand = useMemo(() => {
      return filterBrand ? machinesInCat.filter(m => m.brand === filterBrand) : machinesInCat;
  }, [machinesInCat, filterBrand]);

  const modelOptions = useMemo(() => {
      const set = new Set<string>();
      machinesInBrand.forEach(m => { if(m.modelNo) set.add(m.modelNo); });
      return Array.from(set).sort().map(m => ({ id: m, label: m }));
  }, [machinesInBrand]);

  // 4. Local Number Options (Filtered by Category + Brand + Model)
  const machinesInModel = useMemo(() => {
      return filterModelNo ? machinesInBrand.filter(m => m.modelNo === filterModelNo) : machinesInBrand;
  }, [machinesInBrand, filterModelNo]);

  const localNoOptions = useMemo(() => {
      const set = new Set<string>();
      machinesInModel.forEach(m => { if(m.machineLocalNo) set.add(m.machineLocalNo); });
      return Array.from(set).sort((a,b) => a.localeCompare(b, undefined, {numeric: true})).map(l => ({ id: l, label: l }));
  }, [machinesInModel]);

  // 5. Chase No Options (Filtered by Category + Brand + Model + Local)
  const machinesInLocal = useMemo(() => {
      return filterLocalNo ? machinesInModel.filter(m => m.machineLocalNo === filterLocalNo) : machinesInModel;
  }, [machinesInModel, filterLocalNo]);

  const chaseNoOptions = useMemo(() => {
      const set = new Set<string>();
      machinesInLocal.forEach(m => { if(m.chaseNo) set.add(m.chaseNo); });
      return Array.from(set).sort().map(c => ({ id: c, label: c }));
  }, [machinesInLocal]);

  // 6. Asset ID Options (Final)
  const machinesFinal = useMemo(() => {
      return filterChaseNo ? machinesInLocal.filter(m => m.chaseNo === filterChaseNo) : machinesInLocal;
  }, [machinesInLocal, filterChaseNo]);

  const machineOptions = useMemo(() => {
      return machinesFinal.map(m => ({
          id: m.id,
          label: `${m.id} ${m.category ? `- ${m.category}` : ''}`,
          subLabel: `Local: ${m.machineLocalNo || '-'} | Chase: ${m.chaseNo || '-'}`
      }));
  }, [machinesFinal]);

  // --- Handlers for Hierarchy ---
  const handleCategoryChange = (val: string) => {
      setFilterCategory(val);
      setFilterBrand(''); setFilterModelNo(''); setFilterLocalNo(''); setFilterChaseNo(''); setMachineId('');
  };
  const handleBrandChange = (val: string) => {
      setFilterBrand(val);
      setFilterModelNo(''); setFilterLocalNo(''); setFilterChaseNo(''); setMachineId('');
  };
  const handleModelChange = (val: string) => {
      setFilterModelNo(val);
      setFilterLocalNo(''); setFilterChaseNo(''); setMachineId('');
  };
  
  // NEW: Flexible Handler for Local No
  const handleLocalNoChange = (val: string) => {
      setFilterLocalNo(val);
      setFilterChaseNo(''); 
      setMachineId(''); // Reset specific ID until resolved

      if (!val) return;

      // Use machinesInCat to ensure we only look within the selected Equipment Name
      // This respects the user's wish to not change Category when selecting Local No
      const matches = machinesInCat.filter(m => m.machineLocalNo === val);
      
      if (matches.length > 0) {
          const first = matches[0];
          
          // Auto-fill other fields ONLY (Brand, Model), DO NOT update Category
          setFilterBrand(first.brand || '');
          setFilterModelNo(first.modelNo || '');
          
          // If unique, we can also identify the Chase No and Asset ID
          if (matches.length === 1) {
              setMachineId(first.id);
              setFilterChaseNo(first.chaseNo);
          }
      }
  };

  // NEW: Flexible Handler for Chase No
  const handleChaseChange = (val: string) => {
      setFilterChaseNo(val);
      setMachineId('');
      
      if (!val) return;

      // Scoped to Category for consistency
      const matches = machinesInCat.filter(m => m.chaseNo === val);
      if (matches.length > 0) {
          const first = matches[0];
          // Do not update category
          setFilterBrand(first.brand || '');
          setFilterModelNo(first.modelNo || '');
          setFilterLocalNo(first.machineLocalNo || '');
          if (matches.length === 1) setMachineId(first.id);
      }
  };

  // NEW: Flexible Handler for Asset ID (Global override still allowed)
  const handleMachineIdChange = (val: string) => {
      setMachineId(val);
      // Always back-fill everything from the specific Asset ID
      const m = machines.find(mac => mac.id === val);
      if (m) {
          setFilterCategory(m.category || '');
          setFilterBrand(m.brand || '');
          setFilterModelNo(m.modelNo || '');
          setFilterLocalNo(m.machineLocalNo || '');
          setFilterChaseNo(m.chaseNo || '');
      }
  };

  // Standard Options
  const locationOptions = useMemo(() => locations.map(l => ({ id: l.id, label: l.name })), [locations]);
  // Use Available Sectors (Filtered by Location)
  const sectorOptions = useMemo(() => availableSectors.map(s => ({ id: s.id, label: s.name })), [availableSectors]);
  const divisionOptions = useMemo(() => divisions.filter(d => !sectorId || d.sectorId === sectorId).map(d => ({ id: d.id, label: d.name })), [divisions, sectorId]);
  
  const itemOptions = useMemo(() => items.map(i => {
      const parts = [i.partNumber ? `PN: ${i.partNumber}` : '', i.modelNo ? `Model: ${i.modelNo}` : ''].filter(Boolean).join(' | ');
      return { id: i.id, label: i.id, subLabel: parts ? `${i.name} | ${parts}` : i.name };
  }), [items]);
  const itemNameOptions = useMemo(() => items.map(i => ({ id: i.id, label: i.fullName || i.name, subLabel: i.id })), [items]);

  // Scanner Handlers
  const handleItemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); setTimeout(() => { if (currentItemId) qtyInputRef.current?.focus(); }, 100); }
  };
  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddLineItem(); }
  };

  // Render Helpers
  const allowedLocations = currentUser.role === 'admin' ? locations : locations.filter(l => currentUser.allowedLocationIds?.includes(l.id));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* SUCCESS MODAL POPUP (Unchanged) */}
      {lastSubmittedBatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-fade-in-up">
             <div className="bg-blue-600 p-6 text-white text-center">
               <h2 className="text-2xl font-bold">Request Sent!</h2>
               <p className="opacity-90 mt-1">Notification sent to {lastSubmittedBatch[0].warehouseEmail}</p>
             </div>
             <div className="p-8 space-y-3">
                <button onClick={handlePrint} className="w-full py-3 bg-gray-900 text-white rounded-xl hover:bg-black font-bold flex items-center justify-center gap-3 shadow-lg"><span>🖨️</span> Print Request Slip</button>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleExportExcel} className="py-3 bg-green-100 text-green-800 rounded-xl hover:bg-green-200 font-semibold flex items-center justify-center gap-2 transition border border-green-200"><span>📊</span> Excel</button>
                    {driveLink && driveLink !== 'saved' ? (
                       <a href={driveLink} target="_blank" rel="noopener noreferrer" className="py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold flex items-center justify-center gap-2 transition shadow-md"><span>📂</span> Open File ↗</a>
                    ) : (
                       <button onClick={handleSaveToDrive} disabled={uploadingToDrive} className={`py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition border ${uploadingToDrive ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'}`}>{uploadingToDrive ? 'Saving...' : 'Save to Drive'}</button>
                    )}
                </div>
             </div>
             <div className="bg-gray-50 p-4 border-t border-gray-100 text-center">
                <button onClick={() => setLastSubmittedBatch(null)} className="text-gray-500 hover:text-gray-800 font-medium px-6 py-2">Start New Request</button>
             </div>
          </div>
          {/* Print Template (Hidden) */}
          <div className="hidden print:block fixed inset-0 bg-white z-[100] p-10 h-screen w-screen overflow-auto">
            <h1 className="text-3xl font-bold uppercase tracking-widest border-b-2 border-black pb-4 mb-8">Material Request</h1>
            <div className="grid grid-cols-2 gap-8 mb-8 text-lg">
                <div>
                   <p><span className="font-bold">Date:</span> {new Date(lastSubmittedBatch[0].timestamp).toLocaleString()}</p>
                   <p><span className="font-bold">Location:</span> {lastSubmittedBatch[0].locationId}</p>
                </div>
                <div>
                   <p><span className="font-bold">Machine:</span> {lastSubmittedBatch[0].machineName}</p>
                   <p><span className="font-bold">Machine ID:</span> {lastSubmittedBatch[0].machineId}</p>
                </div>
            </div>
            <table className="w-full text-left border-collapse border border-black mb-8">
                <thead><tr className="bg-gray-100"><th className="border border-black p-2">Item</th><th className="border border-black p-2">Name</th><th className="border border-black p-2">Unit</th><th className="border border-black p-2 text-right">Qty</th></tr></thead>
                <tbody>{lastSubmittedBatch.map(item => (<tr key={item.id}><td className="border border-black p-2">{item.itemId}</td><td className="border border-black p-2">{item.itemName}</td><td className="border border-black p-2 text-center">{item.unit || 'pcs'}</td><td className="border border-black p-2 text-right">{item.quantity}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* FORM CONTAINER */}
      <div className="bg-white p-4 md:p-8 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <span className="mr-3 p-2 bg-blue-100 text-blue-600 rounded-lg text-lg md:text-xl">📝</span>
          Create New Request
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
          
          {/* Section 1: HEADER */}
          <div className="bg-blue-50 p-4 md:p-5 rounded-lg border border-blue-100">
             <div className="mb-2">
                 <SearchableSelect label="1. Select Warehouse Location" required options={locationOptions} value={locationId} onChange={setLocationId} placeholder="Start typing to search zone..." disabled={allowedLocations.length === 0}/>
             </div>
             {allowedLocations.length === 0 && <p className="text-xs text-red-500">Permission denied.</p>}
          </div>

          {/* Section 2: Machine Allocation (NEW STRUCTURE) */}
          <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200">
             <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">2. Allocation Details (Machine)</h3>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Org Filters */}
                <SearchableSelect label="Sector" options={sectorOptions} value={sectorId} onChange={setSectorId} placeholder={!locationId ? "Select Location First" : "Select Sector..."} disabled={!locationId} inputRef={sectorInputRef} />
                <SearchableSelect label="Division" disabled={!sectorId} options={divisionOptions} value={divisionId} onChange={setDivisionId} placeholder="Select Division..." />
             </div>

             <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-100">
                 <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Technical Filter (Hierarchy)</h4>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                     {/* 1. Equip Name */}
                     <SearchableSelect 
                        label="Equipment Name (Category)" 
                        options={categoryOptions} 
                        value={filterCategory} 
                        onChange={handleCategoryChange} 
                        placeholder="e.g. Tractor, Conveyor..." 
                        disabled={false}
                     />
                     {/* 2. Brand */}
                     <SearchableSelect 
                        label="Brand Name" 
                        options={brandOptions} 
                        value={filterBrand} 
                        onChange={handleBrandChange} 
                        placeholder="Select Brand..." 
                        disabled={!filterCategory}
                     />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                     {/* 3. Model */}
                     <SearchableSelect 
                        label="Model Name" 
                        options={modelOptions} 
                        value={filterModelNo} 
                        onChange={handleModelChange} 
                        placeholder="Select Model..." 
                        disabled={!filterCategory}
                     />
                     {/* 4. Local No */}
                     <SearchableSelect 
                        label="Local Number" 
                        options={localNoOptions} 
                        value={filterLocalNo} 
                        onChange={handleLocalNoChange} 
                        placeholder="Select Local No..." 
                        disabled={!filterCategory}
                     />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {/* 5. Chase No */}
                     <SearchableSelect 
                        label="Chase No" 
                        options={chaseNoOptions} 
                        value={filterChaseNo} 
                        onChange={handleChaseChange} 
                        placeholder="Select Chase..." 
                        disabled={!filterCategory}
                     />
                     {/* 6. Asset ID */}
                     <SearchableSelect 
                        label="Asset ID / Code (Final)" 
                        required
                        options={machineOptions} 
                        value={machineId} 
                        onChange={handleMachineIdChange} 
                        placeholder={machineOptions.length === 0 ? "..." : "Select Asset ID"} 
                        disabled={false}
                     />
                 </div>
             </div>
          </div>

          {/* Section 3: LINES */}
          <div className="bg-gray-50 p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm relative">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 border-b pb-2 flex justify-between items-center">
                <span>3. Scan / Enter Items</span>
            </h3>
            <div className="flex flex-col md:flex-row gap-4 items-end mb-4">
               <div className="flex-[2] w-full">
                 <SearchableSelect label="Item Number (Scan Here)" options={itemOptions} value={currentItemId} onChange={setCurrentItemId} placeholder="Scan Item No..." inputRef={itemInputRef} onKeyDown={handleItemKeyDown}/>
               </div>
               <div className="flex-[2] w-full">
                 <SearchableSelect label="Item Name" options={itemNameOptions} value={currentItemId} onChange={setCurrentItemId} placeholder="Search by name..." />
               </div>
               {/* Unit Display Field - New */}
               <div className="w-full md:w-20">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                 <input type="text" disabled value={selectedItemObj?.unit || ''} className="w-full px-3 py-2 border border-gray-200 bg-gray-100 rounded-lg text-center text-gray-500 font-bold" />
               </div>
               <div className="w-full md:w-24">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Qty</label>
                 <input ref={qtyInputRef} type="number" min="1" value={currentQuantity} onChange={(e) => setCurrentQuantity(Number(e.target.value))} onKeyDown={handleQtyKeyDown} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-center" />
               </div>
               <button type="button" onClick={handleAddLineItem} disabled={!currentItemId || !currentQuantity} className="w-full md:w-auto px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 transition shadow-sm h-[42px]">+ Add</button>
               {selectedItemObj && (
                  <div className="w-full md:w-auto bg-white px-3 py-2 rounded-lg border border-blue-200 shadow-sm whitespace-nowrap h-[42px] flex items-center justify-center">
                      <span className="text-gray-500 font-medium text-xs uppercase mr-2">Stock:</span>
                      <span className={`font-bold text-lg ${(selectedItemObj.stockQuantity || 0) <= 0 ? 'text-red-600' : 'text-green-600'}`}>{selectedItemObj.stockQuantity || 0}</span>
                      <span className="text-xs text-gray-400 ml-1">{selectedItemObj.unit}</span>
                  </div>
               )}
            </div>
            {lineItems.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                    <table className="w-full text-sm text-left min-w-[500px]">
                        <thead className="bg-gray-100 text-gray-700 font-semibold"><tr><th className="px-4 py-2">Item Number</th><th className="px-4 py-2">Item Name</th><th className="px-4 py-2">Unit</th><th className="px-4 py-2 text-center">Qty</th><th className="px-4 py-2 text-center">Action</th></tr></thead>
                        <tbody className="divide-y divide-gray-100">{lineItems.map((line, idx) => (<tr key={idx} className="hover:bg-gray-50"><td className="px-4 py-2 font-mono text-gray-600 font-bold">{line.itemId}</td><td className="px-4 py-2">{line.itemName}</td><td className="px-4 py-2 text-sm text-gray-500">{line.unit}</td><td className="px-4 py-2 text-center font-bold text-lg">{line.quantity}</td><td className="px-4 py-2 text-center"><button type="button" onClick={() => handleRemoveLineItem(idx)} className="text-red-500 hover:text-red-700 font-medium">Remove</button></td></tr>))}</tbody>
                    </table>
                </div>
            ) : <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">List is empty.</div>}
          </div>
          
          {/* Section 4: Maintenance Plan */}
          <div className="bg-orange-50 p-4 md:p-5 rounded-lg border border-orange-200">
             <h3 className="text-sm font-bold text-orange-800 uppercase tracking-wider mb-4 border-b border-orange-200 pb-2">4. Maintenance Plan (Mandatory)</h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {maintenancePlans && maintenancePlans.map((plan) => (
                    <label key={plan.id} className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedPlanId === plan.id ? 'bg-orange-100 border-orange-500 ring-1 ring-orange-500' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                        <input type="radio" name="maintenance_plan" value={plan.id} checked={selectedPlanId === plan.id} onChange={(e) => setSelectedPlanId(e.target.value)} className="form-radio h-5 w-5 text-orange-600 focus:ring-orange-500" />
                        <span className={`text-sm font-medium ${selectedPlanId === plan.id ? 'text-orange-900' : 'text-gray-700'}`}>{plan.name}</span>
                    </label>
                ))}
             </div>
          </div>

          {/* Section 5: Notification */}
          <div className="bg-gray-50 p-4 md:p-5 rounded-lg border border-gray-200">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div><label className="block text-sm font-medium text-gray-700 mb-1">Warehouse Email (To)</label><input type="email" required value={warehouseEmail} onChange={(e) => setWarehouseEmail(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                 <div><label className="block text-sm font-medium text-gray-700 mb-1">Site Email (CC)</label><div className="flex items-center px-4 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 overflow-hidden text-ellipsis">{requesterEmail || "Select Location first"}</div></div>
             </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button type="submit" disabled={isSubmitting || allowedLocations.length === 0} className={`w-full md:w-auto px-8 py-4 rounded-xl text-white font-bold text-lg shadow-md transition-all flex items-center justify-center gap-2 ${isSubmitting || allowedLocations.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 hover:shadow-lg transform hover:-translate-y-1'}`}>
              {isSubmitting ? 'Sending...' : <><span>🚀</span> Submit Request</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IssueForm;
