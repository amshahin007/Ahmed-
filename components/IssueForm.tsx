
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
  const [filterChaseNo, setFilterChaseNo] = useState(''); // Was Model
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
  const [emailStatus, setEmailStatus] = useState<string>('');
  
  // --- Upload State ---
  const [uploadingToDrive, setUploadingToDrive] = useState(false);
  const [driveLink, setDriveLink] = useState('');

  // --- Refs for Scanner Navigation ---
  const itemInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

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
    setDivisionId('');
    setMachineId('');
  }, [sectorId]);

  useEffect(() => {
    setMachineId('');
  }, [divisionId]);

  // Auto-fill Requester (Site) Email based on Location
  useEffect(() => {
    const location = locations.find(l => l.id === locationId);
    if (location && location.email) {
      setRequesterEmail(location.email);
    } else {
      setRequesterEmail('');
    }
    // When location changes, focus item input if it's not the first load
    if (locationId) {
        setTimeout(() => itemInputRef.current?.focus(), 100);
    }
  }, [locationId, locations]);


  const handleAddLineItem = () => {
    if (!currentItemId || !currentQuantity || Number(currentQuantity) <= 0) return;

    // Optional: Validation check against stock (User can force it, but visual cue helps)
    if (selectedItemObj && (selectedItemObj.stockQuantity || 0) < Number(currentQuantity)) {
        if (!confirm(`Warning: Requested Quantity (${currentQuantity}) exceeds Available Stock (${selectedItemObj.stockQuantity || 0}). Continue?`)) {
            return;
        }
    }

    const newItem: LineItem = {
      itemId: currentItemId,
      itemName: currentItemName,
      quantity: Number(currentQuantity)
    };

    setLineItems([...lineItems, newItem]);
    
    // Reset item input fields and focus back to item for next scan
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
    setDriveLink(''); // Reset drive link
    
    try {
        // Validation Checks
        if (!locationId) {
            alert("Please select a 'Warehouse Location' from the dropdown list.");
            return;
        }
        if (!machineId) {
            alert("Please select a 'Machine' from the dropdown list.");
            return;
        }
        if (lineItems.length === 0) {
            alert("Please add at least one item to the list before submitting.");
            return;
        }
        if (!selectedPlanId) {
            alert("Please check a 'Maintenance Plan' before submitting.");
            return;
        }
        if (!warehouseEmail) {
            alert("Please provide a Warehouse Email address.");
            return;
        }

        setIsSubmitting(true);
        setEmailStatus('Processing Request & Sending Email...');
        
        const machine = machines.find(m => m.id === machineId);
        const sector = sectors.find(s => s.id === sectorId);
        const division = divisions.find(d => d.id === divisionId);
        const plan = maintenancePlans.find(p => p.id === selectedPlanId);

        const timestamp = new Date().toISOString();
        const batchIdBase = Date.now().toString().slice(-6);
        
        const newRecords: IssueRecord[] = [];

        // Determine machine name display. 
        const machineDisplayName = machine 
            ? (machine.category ? machine.category : `Machine ${machine.id}`) 
            : 'Unknown Machine';

        // Create a record for each line item
        for (let i = 0; i < lineItems.length; i++) {
        const line = lineItems[i];
        const newIssue: IssueRecord = {
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
        };
        newRecords.push(newIssue);
        }

        // Simulate Network Delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // 1. Trigger AI Email Generation (Simulation of sending)
        const emailData = await generateIssueEmail(newRecords);
        console.log(`[System] Email prepared for ${warehouseEmail}: ${emailData.subject}`);
        
        // 2. Check for Google Sheet Script URL
        const scriptUrl = localStorage.getItem('wf_script_url_v3') || DEFAULT_SCRIPT_URL;
        if (scriptUrl) {
            console.log("Syncing with Google Sheet...");
            // Non-blocking sync
            Promise.all(newRecords.map(r => sendIssueToSheet(scriptUrl, r)))
                .catch(err => console.error("Sheet Sync Failed", err));
        }

        // 3. Save records locally
        newRecords.forEach(record => onAddIssue(record));
        
        setLastSubmittedBatch(newRecords);
        setEmailStatus(`Sent to: ${warehouseEmail}`);
        
        // 4. Reset Form logic
        setMachineId('');
        setLineItems([]);
        setSelectedPlanId('');
        
    } catch (error) {
        console.error("Critical Error during submission:", error);
        alert("An unexpected error occurred while processing the request. Please check the console for details.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getExcelWorkbook = () => {
    if (!lastSubmittedBatch || lastSubmittedBatch.length === 0) return null;
    
    const headers = ["Request ID", "Date", "Location", "Sector", "Division", "Machine", "Maint. Plan", "Item Number", "Item Name", "Quantity", "Warehouse Email", "Site Email"];
    const rows = lastSubmittedBatch.map(item => [
        item.id,
        new Date(item.timestamp).toLocaleString(),
        item.locationId,
        item.sectorName || '',
        item.divisionName || '',
        item.machineName,
        item.maintenancePlan || '',
        item.itemId,
        item.itemName,
        item.quantity,
        item.warehouseEmail || '',
        item.requesterEmail || ''
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "RequestSlip");
    return wb;
  };

  const handleExportExcel = () => {
    const wb = getExcelWorkbook();
    if (!wb || !lastSubmittedBatch) return;
    const batchId = lastSubmittedBatch[0].id.split('-')[1]; 
    XLSX.writeFile(wb, `Request_Slip_${batchId}.xlsx`);
  };

  const handleSaveToDrive = async () => {
    const scriptUrl = localStorage.getItem('wf_script_url_v3') || DEFAULT_SCRIPT_URL;
    if (!scriptUrl) {
        alert("Please configure the Web App URL in Master Data settings first.");
        return;
    }
    if (!lastSubmittedBatch) return;

    setUploadingToDrive(true);
    const batchId = lastSubmittedBatch[0].id.split('-')[1];
    const fileName = `Request_Slip_${batchId}.xlsx`;

    try {
        const wb = getExcelWorkbook();
        if (!wb) throw new Error("Could not create workbook");

        // Convert to Base64
        const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        
        const url = await uploadFileToDrive(scriptUrl, fileName, wbOut);
        
        if (url) {
            setDriveLink(url);
        } else {
            setDriveLink('saved'); // Fallback if CORS blocked reading the return
            alert("File saved to 'WareFlow Reports' folder in your Drive!");
        }
    } catch (e) {
        console.error(e);
        alert("Failed to upload to Drive.");
    } finally {
        setUploadingToDrive(false);
    }
  };

  // --- Scanner Handlers ---
  const handleItemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        setTimeout(() => {
            if (currentItemId) {
                qtyInputRef.current?.focus();
            }
        }, 100);
    }
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleAddLineItem();
    }
  };


  // --- Filtering & Logic (Remains unchanged) ---
  const inferUpstreamFilters = (
     currentMain: string, currentSub: string, currentCat: string, currentBrand: string, currentChaseNo: string, currentModelNo: string
  ) => {
    if (!machines) return;
    const matchingMachines = machines.filter(m => {
        if (currentMain && m.mainGroup !== currentMain) return false;
        if (currentSub && m.subGroup !== currentSub) return false;
        if (currentCat && m.category !== currentCat) return false;
        if (currentBrand && m.brand !== currentBrand) return false;
        if (currentChaseNo && m.chaseNo !== currentChaseNo) return false;
        if (currentModelNo && m.modelNo !== currentModelNo) return false;
        return true;
    });

    if (matchingMachines.length === 0) return;

    const uniqueMains = Array.from(new Set(matchingMachines.map(m => m.mainGroup).filter(Boolean)));
    const uniqueSubs = Array.from(new Set(matchingMachines.map(m => m.subGroup).filter(Boolean)));
    const uniqueCats = Array.from(new Set(matchingMachines.map(m => m.category).filter(Boolean)));
    const uniqueBrands = Array.from(new Set(matchingMachines.map(m => m.brand).filter(Boolean)));
    const uniqueChaseNos = Array.from(new Set(matchingMachines.map(m => m.chaseNo).filter(Boolean)));
    const uniqueModelNos = Array.from(new Set(matchingMachines.map(m => m.modelNo).filter(Boolean)));

    if (uniqueMains.length === 1 && !currentMain) setFilterMainGroup(uniqueMains[0] as string);
    if (uniqueSubs.length === 1 && !currentSub) setFilterSubGroup(uniqueSubs[0] as string);
    if (uniqueCats.length === 1 && !currentCat) setFilterCategory(uniqueCats[0] as string);
    if (uniqueBrands.length === 1 && !currentBrand) setFilterBrand(uniqueBrands[0] as string);
    if (uniqueChaseNos.length === 1 && !currentChaseNo) setFilterChaseNo(uniqueChaseNos[0] as string);
    if (uniqueModelNos.length === 1 && !currentModelNo) setFilterModelNo(uniqueModelNos[0] as string);
  };

  const handleMainGroupChange = (val: string) => {
    setFilterMainGroup(val); setFilterSubGroup(''); setFilterCategory(''); setFilterBrand(''); setFilterChaseNo(''); setFilterModelNo(''); setMachineId('');
    inferUpstreamFilters(val, '', '', '', '', '');
  };
  const handleSubGroupChange = (val: string) => {
    setFilterSubGroup(val); setFilterCategory(''); setFilterBrand(''); setFilterChaseNo(''); setFilterModelNo(''); setMachineId('');
    inferUpstreamFilters(filterMainGroup, val, '', '', '', '');
  };
  const handleCategoryChange = (val: string) => {
    setFilterCategory(val); setFilterBrand(''); setFilterChaseNo(''); setFilterModelNo(''); setMachineId('');
    inferUpstreamFilters(filterMainGroup, filterSubGroup, val, '', '', '');
  };
  const handleBrandChange = (val: string) => {
    setFilterBrand(val); setFilterChaseNo(''); setFilterModelNo(''); setMachineId('');
    inferUpstreamFilters(filterMainGroup, filterSubGroup, filterCategory, val, '', '');
  };
  const handleChaseNoChange = (val: string) => {
    setFilterChaseNo(val); setFilterModelNo(''); setMachineId('');
    inferUpstreamFilters(filterMainGroup, filterSubGroup, filterCategory, filterBrand, val, '');
  };
  const handleModelNoChange = (val: string) => {
    setFilterModelNo(val); setMachineId('');
    inferUpstreamFilters(filterMainGroup, filterSubGroup, filterCategory, filterBrand, filterChaseNo, val);
  };
  const handleMachineChange = (val: string) => {
    setMachineId(val);
    const m = machines.find(machine => machine.id === val);
    if (m) {
        if (m.mainGroup) setFilterMainGroup(m.mainGroup);
        if (m.subGroup) setFilterSubGroup(m.subGroup);
        if (m.category) setFilterCategory(m.category);
        if (m.brand) setFilterBrand(m.brand);
        if (m.chaseNo) setFilterChaseNo(m.chaseNo);
        if (m.modelNo) setFilterModelNo(m.modelNo);
    }
  };

  const mainGroupOptions = useMemo(() => {
    const groups = new Set<string>();
    machines.forEach(m => { if(m.mainGroup) groups.add(m.mainGroup) });
    return Array.from(groups).map(g => ({ id: g, label: g }));
  }, [machines]);

  const subGroupOptions = useMemo(() => {
    const subs = new Set<string>();
    machines.forEach(m => {
       if (filterMainGroup && m.mainGroup !== filterMainGroup) return; 
       if (m.subGroup) subs.add(m.subGroup);
    });
    return Array.from(subs).map(g => ({ id: g, label: g }));
  }, [machines, filterMainGroup]);

  const categoryOptions = useMemo(() => {
    const cats = new Set<string>();
    machines.forEach(m => {
       if (filterMainGroup && m.mainGroup !== filterMainGroup) return;
       if (filterSubGroup && m.subGroup !== filterSubGroup) return;
       if (m.category) cats.add(m.category);
    });
    return Array.from(cats).map(c => ({ id: c, label: c }));
  }, [machines, filterMainGroup, filterSubGroup]);

  const brandOptions = useMemo(() => {
    const brands = new Set<string>();
    machines.forEach(m => {
       if (filterMainGroup && m.mainGroup !== filterMainGroup) return;
       if (filterSubGroup && m.subGroup !== filterSubGroup) return;
       if (filterCategory && m.category !== filterCategory) return;
       if (m.brand) brands.add(m.brand);
    });
    return Array.from(brands).map(b => ({ id: b, label: b }));
  }, [machines, filterMainGroup, filterSubGroup, filterCategory]);

  const chaseNoOptions = useMemo(() => {
    const chases = new Set<string>();
    machines.forEach(m => {
       if (filterMainGroup && m.mainGroup !== filterMainGroup) return;
       if (filterSubGroup && m.subGroup !== filterSubGroup) return;
       if (filterCategory && m.category !== filterCategory) return;
       if (filterBrand && m.brand !== filterBrand) return;
       if (m.chaseNo) chases.add(m.chaseNo);
    });
    return Array.from(chases).map(c => ({ id: c, label: c }));
  }, [machines, filterMainGroup, filterSubGroup, filterCategory, filterBrand]);

  const modelNoOptions = useMemo(() => {
    const models = new Set<string>();
    machines.forEach(m => {
       if (filterMainGroup && m.mainGroup !== filterMainGroup) return;
       if (filterSubGroup && m.subGroup !== filterSubGroup) return;
       if (filterCategory && m.category !== filterCategory) return;
       if (filterBrand && m.brand !== filterBrand) return;
       if (filterChaseNo && m.chaseNo !== filterChaseNo) return;
       if (m.modelNo) models.add(m.modelNo);
    });
    return Array.from(models).map(mod => ({ id: mod, label: mod }));
  }, [machines, filterMainGroup, filterSubGroup, filterCategory, filterBrand, filterChaseNo]);

  const allowedLocations = useMemo(() => {
    if (currentUser.role === 'admin') return locations;
    if (currentUser.allowedLocationIds && currentUser.allowedLocationIds.length > 0) {
      return locations.filter(loc => currentUser.allowedLocationIds!.includes(loc.id));
    }
    return locations;
  }, [locations, currentUser]);

  const allowedSectors = useMemo(() => {
    if (currentUser.role === 'admin') return sectors;
    if (currentUser.allowedSectorIds && currentUser.allowedSectorIds.length > 0) {
      return sectors.filter(s => currentUser.allowedSectorIds!.includes(s.id));
    }
    return sectors;
  }, [sectors, currentUser]);

  const allowedDivisions = useMemo(() => {
    let divs = divisions;
    if (sectorId) {
        divs = divs.filter(d => d.sectorId === sectorId);
    } else {
        return [];
    }
    if (currentUser.role !== 'admin' && currentUser.allowedDivisionIds && currentUser.allowedDivisionIds.length > 0) {
        divs = divs.filter(d => currentUser.allowedDivisionIds!.includes(d.id));
    }
    return divs;
  }, [divisions, sectorId, currentUser]);

  useEffect(() => {
    if (allowedSectors.length === 1 && !sectorId) {
        setSectorId(allowedSectors[0].id);
    }
  }, [allowedSectors, sectorId]);

  useEffect(() => {
      if (allowedDivisions.length === 1 && !divisionId) {
          setDivisionId(allowedDivisions[0].id);
      }
  }, [allowedDivisions, divisionId]);

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

  const locationOptions: Option[] = useMemo(() => allowedLocations.map(l => ({ id: l.id, label: l.name })), [allowedLocations]);
  const sectorOptions: Option[] = useMemo(() => allowedSectors.map(s => ({ id: s.id, label: s.name })), [allowedSectors]);
  const divisionOptions: Option[] = useMemo(() => allowedDivisions.map(d => ({ id: d.id, label: d.name })), [allowedDivisions]);
  const machineOptions: Option[] = useMemo(() => availableMachines.map(m => {
      let label = m.category || `Machine ${m.id}`;
      let sub = `Chase No: ${m.chaseNo}`;
      if (m.brand) sub += ` | Brand: ${m.brand}`;
      return { id: m.id, label: label, subLabel: sub };
  }), [availableMachines]);
  
  const itemOptions: Option[] = useMemo(() => items.map(i => {
      const parts = [];
      if (i.partNumber) parts.push(`PN: ${i.partNumber}`);
      if (i.modelNo) parts.push(`Model: ${i.modelNo}`);
      if (i.oem) parts.push(`OEM: ${i.oem}`);
      
      const displayName = i.fullName || i.name;
      const sub = parts.length > 0 ? `${displayName} | ${parts.join(' | ')}` : displayName;
      
      return { id: i.id, label: i.id, subLabel: sub };
  }), [items]);
  
  const itemNameOptions: Option[] = useMemo(() => items.map(i => {
      const parts = [i.id];
      if (i.partNumber) parts.push(`PN: ${i.partNumber}`);
      if (i.modelNo) parts.push(`Model: ${i.modelNo}`);
      return { id: i.id, label: i.fullName || i.name, subLabel: parts.join(' | ') };
  }), [items]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* SUCCESS MODAL POPUP */}
      {lastSubmittedBatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-fade-in-up">
             <div className="bg-blue-600 p-6 text-white text-center">
               <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
                 <span className="text-3xl">📧</span>
               </div>
               <h2 className="text-2xl font-bold">Request Sent!</h2>
               <p className="opacity-90 mt-1">Notification sent to {lastSubmittedBatch[0].warehouseEmail}</p>
             </div>
             
             <div className="p-8 space-y-3">
                <div className="text-center text-sm bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4">
                   <p className="font-medium text-gray-700">Request IDs generated:</p>
                   <p className="text-gray-500">{lastSubmittedBatch.length} items waiting for approval</p>
                </div>
                
                <button onClick={handlePrint} className="w-full py-3 bg-gray-900 text-white rounded-xl hover:bg-black font-bold flex items-center justify-center gap-3 shadow-lg transition-transform hover:scale-[1.02]">
                   <span>🖨️</span> Print Request Slip
                </button>
                
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleExportExcel} className="py-3 bg-green-100 text-green-800 rounded-xl hover:bg-green-200 font-semibold flex items-center justify-center gap-2 transition border border-green-200">
                        <span>📊</span> Excel
                    </button>
                    
                    {driveLink && driveLink !== 'saved' ? (
                       <a 
                          href={driveLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold flex items-center justify-center gap-2 transition shadow-md"
                       >
                          <span>📂</span> Open File ↗
                       </a>
                    ) : (
                       <button 
                          onClick={handleSaveToDrive} 
                          disabled={uploadingToDrive}
                          className={`py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition border ${
                             uploadingToDrive ? 'bg-gray-100 text-gray-500 border-gray-200' :
                             'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200'
                          }`}
                       >
                          {uploadingToDrive ? <span className="animate-spin">↻</span> : <span>☁️</span>} 
                          {uploadingToDrive ? 'Saving...' : 'Save to Drive'}
                       </button>
                    )}
                </div>
             </div>

             <div className="bg-gray-50 p-4 border-t border-gray-100 text-center">
                <button onClick={() => setLastSubmittedBatch(null)} className="text-gray-500 hover:text-gray-800 font-medium px-6 py-2">
                   Start New Request
                </button>
             </div>
          </div>
          
          <div className="hidden print:block fixed inset-0 bg-white z-[100] p-10 h-screen w-screen overflow-auto">
            <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-8">
               <h1 className="text-3xl font-bold uppercase tracking-widest">Material Request</h1>
               <div className="text-right">
                 <p className="text-sm">Status: <strong>PENDING APPROVAL</strong></p>
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-8 mb-8 text-lg">
                <div>
                   <p><span className="font-bold">Date:</span> {new Date(lastSubmittedBatch[0].timestamp).toLocaleString()}</p>
                   <p><span className="font-bold">Location:</span> {lastSubmittedBatch[0].locationId}</p>
                   <p><span className="font-bold">Maint. Plan:</span> {lastSubmittedBatch[0].maintenancePlan}</p>
                </div>
                <div>
                   <p><span className="font-bold">Machine:</span> {lastSubmittedBatch[0].machineName}</p>
                   <p><span className="font-bold">Machine ID:</span> {lastSubmittedBatch[0].machineId}</p>
                </div>
            </div>

            <table className="w-full text-left border-collapse border border-black mb-8">
                <thead>
                    <tr className="bg-gray-100">
                         <th className="border border-black p-2 whitespace-nowrap">Item Number</th>
                         <th className="border border-black p-2 whitespace-nowrap">Item Name</th>
                         <th className="border border-black p-2 text-right whitespace-nowrap">Qty</th>
                    </tr>
                </thead>
                <tbody>
                    {lastSubmittedBatch.map(item => (
                        <tr key={item.id}>
                            <td className="border border-black p-2 whitespace-nowrap">{item.itemId}</td>
                            <td className="border border-black p-2 whitespace-nowrap">{item.itemName}</td>
                            <td className="border border-black p-2 text-right font-bold whitespace-nowrap">{item.quantity}</td>
                        </tr>
                    ))}
                </tbody>
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
          
          {/* Section 1: HEADER (LOCATION ONLY) */}
          <div className="bg-blue-50 p-4 md:p-5 rounded-lg border border-blue-100">
             <div className="mb-2">
                 <SearchableSelect 
                  label="1. Select Warehouse Location" 
                  required 
                  options={locationOptions} 
                  value={locationId} 
                  onChange={setLocationId} 
                  placeholder={allowedLocations.length === 0 ? "No access to locations" : "Start typing to search zone..."}
                  disabled={allowedLocations.length === 0}
                />
             </div>
             {allowedLocations.length === 0 && (
               <p className="text-xs text-red-500">You do not have permission to create issues for any locations.</p>
             )}
          </div>

          {/* Section 2: Machine Allocation (Moved up) */}
          <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200">
             <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">2. Allocation Details (Machine)</h3>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                
                {/* Org Filters */}
                <div className="space-y-3">
                   <h4 className="text-xs font-bold text-gray-400 uppercase">Organizational Filter</h4>
                   <SearchableSelect label="Sector" options={sectorOptions} value={sectorId} onChange={setSectorId} placeholder="Select Sector..." />
                   <SearchableSelect label="Division" disabled={!sectorId} options={divisionOptions} value={divisionId} onChange={setDivisionId} placeholder="Select Division..." />
                </div>

                {/* Tech Filters */}
                <div className="space-y-3">
                   <h4 className="text-xs font-bold text-gray-400 uppercase">Technical Filter</h4>
                   <SearchableSelect label="Main Group" options={mainGroupOptions} value={filterMainGroup} onChange={handleMainGroupChange} placeholder="Filter by Group..." />
                   <div className="grid grid-cols-2 gap-2">
                     <SearchableSelect label="Sub Group" options={subGroupOptions} value={filterSubGroup} onChange={handleSubGroupChange} placeholder="Sub Group..." />
                     <SearchableSelect label="إسم المعدة" options={categoryOptions} value={filterCategory} onChange={handleCategoryChange} placeholder="Cat..." />
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                      <SearchableSelect label="Brand" options={brandOptions} value={filterBrand} onChange={handleBrandChange} placeholder="Brand..." />
                      <SearchableSelect label="Chase No (Model)" options={chaseNoOptions} value={filterChaseNo} onChange={handleChaseNoChange} placeholder="Chase No..." />
                   </div>
                   <SearchableSelect label="Model No (طراز المعده)" options={modelNoOptions} value={filterModelNo} onChange={handleModelNoChange} placeholder="Model No..." />
                </div>
                
                {/* Machine Select */}
                <div className="md:col-span-2">
                    <SearchableSelect 
                       label="Machine Selection" 
                       required 
                       options={machineOptions} 
                       value={machineId} 
                       onChange={handleMachineChange} 
                       placeholder={availableMachines.length === 0 ? "No machines found match filters" : "Select Specific Equipment / Machine..."} 
                    />
                </div>
             </div>
          </div>

          {/* Section 3: LINES (Primary Action) (Moved down) */}
          <div className="bg-gray-50 p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm relative">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 border-b pb-2 flex justify-between items-center">
                <span>3. Scan / Enter Items</span>
                <span className="text-xs font-normal text-gray-500 normal-case bg-white px-2 py-1 rounded border">Press 'Enter' to Add</span>
            </h3>
            
            <div className="flex flex-col md:flex-row gap-4 items-end mb-4">
               <div className="flex-[2] w-full">
                 <SearchableSelect 
                    label="Item Number (Scan Here)" 
                    options={itemOptions} 
                    value={currentItemId} 
                    onChange={setCurrentItemId} 
                    placeholder="Scan or type Item No..." 
                    inputRef={itemInputRef}
                    onKeyDown={handleItemKeyDown}
                 />
               </div>
               <div className="flex-[2] w-full">
                 {/* Read-only name display or Alternative Search */}
                 <SearchableSelect 
                    label="Item Name" 
                    options={itemNameOptions} 
                    value={currentItemId} 
                    onChange={setCurrentItemId} 
                    placeholder="Search by name..." 
                 />
               </div>
               <div className="w-full md:w-24">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Qty</label>
                 <input 
                    ref={qtyInputRef}
                    type="number" 
                    min="1" 
                    value={currentQuantity} 
                    onChange={(e) => setCurrentQuantity(Number(e.target.value))} 
                    onKeyDown={handleQtyKeyDown}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-center" 
                 />
               </div>
               <button 
                 type="button" 
                 onClick={handleAddLineItem}
                 disabled={!currentItemId || !currentQuantity}
                 className="w-full md:w-auto px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-sm h-[42px]"
               >
                 + Add
               </button>

               {/* STOCK DISPLAY - MOVED HERE */}
               {selectedItemObj && (
                  <div className="w-full md:w-auto bg-white px-3 py-2 rounded-lg border border-blue-200 shadow-sm whitespace-nowrap h-[42px] flex items-center justify-center md:justify-start">
                      <span className="text-gray-500 font-medium text-xs uppercase mr-2">Stock:</span>
                      <span className={`font-bold text-lg ${(selectedItemObj.stockQuantity || 0) <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {selectedItemObj.stockQuantity !== undefined ? selectedItemObj.stockQuantity : 0} 
                      </span>
                      <span className="text-xs text-gray-400 ml-1">{selectedItemObj.unit}</span>
                  </div>
               )}
            </div>

            {/* Added Items Table */}
            {lineItems.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                    <table className="w-full text-sm text-left min-w-[500px]">
                        <thead className="bg-gray-100 text-gray-700 font-semibold">
                            <tr>
                                <th className="px-4 py-2 whitespace-nowrap">Item Number</th>
                                <th className="px-4 py-2 whitespace-nowrap">Item Name</th>
                                <th className="px-4 py-2 text-center whitespace-nowrap">Stock</th>
                                <th className="px-4 py-2 w-24 text-center whitespace-nowrap">Qty</th>
                                <th className="px-4 py-2 w-24 text-center whitespace-nowrap">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {lineItems.map((line, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-mono text-gray-600 font-bold whitespace-nowrap">{line.itemId}</td>
                                    <td className="px-4 py-2 whitespace-nowrap">{line.itemName}</td>
                                    <td className="px-4 py-2 text-center whitespace-nowrap text-gray-500">
                                        {items.find(i => i.id === line.itemId)?.stockQuantity || 0}
                                    </td>
                                    <td className="px-4 py-2 text-center font-bold text-lg whitespace-nowrap">{line.quantity}</td>
                                    <td className="px-4 py-2 text-center whitespace-nowrap">
                                        <button type="button" onClick={() => handleRemoveLineItem(idx)} className="text-red-500 hover:text-red-700 font-medium">Remove</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                    <div className="text-2xl mb-2">📦</div>
                    List is empty. Scan an item to begin.
                </div>
            )}
          </div>
          
          {/* Section 4: Maintenance Plan Selection */}
          <div className="bg-orange-50 p-4 md:p-5 rounded-lg border border-orange-200">
             <h3 className="text-sm font-bold text-orange-800 uppercase tracking-wider mb-4 border-b border-orange-200 pb-2">4. Maintenance Plan (Mandatory)</h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {maintenancePlans && maintenancePlans.length > 0 ? maintenancePlans.map((plan) => (
                    <label 
                        key={plan.id} 
                        className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedPlanId === plan.id 
                                ? 'bg-orange-100 border-orange-500 ring-1 ring-orange-500' 
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <input 
                            type="radio" 
                            name="maintenance_plan"
                            value={plan.id}
                            checked={selectedPlanId === plan.id}
                            onChange={(e) => setSelectedPlanId(e.target.value)}
                            className="form-radio h-5 w-5 text-orange-600 focus:ring-orange-500"
                        />
                        <span className={`text-sm font-medium ${selectedPlanId === plan.id ? 'text-orange-900' : 'text-gray-700'}`}>
                            {plan.name}
                        </span>
                    </label>
                )) : <p className="text-sm text-gray-500">No maintenance plans available.</p>}
             </div>
             {!selectedPlanId && <p className="text-xs text-red-500 mt-2">* You must select a maintenance plan.</p>}
          </div>

          {/* Section 5: Notification Details */}
          <div className="bg-gray-50 p-4 md:p-5 rounded-lg border border-gray-200 opacity-80 hover:opacity-100 transition">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse Email (To)</label>
                    <input 
                        type="email" 
                        required
                        value={warehouseEmail}
                        onChange={(e) => setWarehouseEmail(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Site/Requester Email (CC)</label>
                    <div className="flex items-center px-4 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 overflow-hidden text-ellipsis">
                       {requesterEmail || "Select Location first"}
                    </div>
                 </div>
             </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || allowedLocations.length === 0}
              className={`w-full md:w-auto px-8 py-4 rounded-xl text-white font-bold text-lg shadow-md transition-all flex items-center justify-center gap-2 ${
                isSubmitting || allowedLocations.length === 0
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-700 hover:shadow-lg transform hover:-translate-y-1'
              }`}
            >
              {isSubmitting ? 'Sending Request...' : (
                 <>
                   <span>🚀</span> Submit Request
                 </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IssueForm;
