import React, { useState, useEffect, useMemo } from 'react';
import { IssueRecord, Item, Location, Machine, Sector, Division, User } from '../types';
import { generateIssueEmail } from '../services/geminiService';
import { sendIssueToSheet } from '../services/googleSheetsService';
import SearchableSelect, { Option } from './SearchableSelect';

interface IssueFormProps {
  onAddIssue: (issue: IssueRecord) => void;
  items: Item[];
  locations: Location[];
  machines: Machine[];
  sectors: Sector[];
  divisions: Division[];
  currentUser: User;
}

interface LineItem {
  itemId: string;
  itemName: string;
  quantity: number;
}

const IssueForm: React.FC<IssueFormProps> = ({ 
  onAddIssue, items, locations, machines, sectors, divisions, currentUser 
}) => {
  // --- Header State (Context) ---
  const [locationId, setLocationId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [machineId, setMachineId] = useState('');

  // --- Machine Filters ---
  const [filterMainGroup, setFilterMainGroup] = useState('');
  const [filterSubGroup, setFilterSubGroup] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');

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

  // Auto-lookup Item Name for current input (Maintains the string for Line Item creation)
  useEffect(() => {
    const item = items.find(i => i.id === currentItemId);
    if (item) {
      setCurrentItemName(item.name);
    } else {
      setCurrentItemName('');
    }
  }, [currentItemId, items]);

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
  }, [locationId, locations]);


  const handleAddLineItem = () => {
    if (!currentItemId || !currentQuantity || Number(currentQuantity) <= 0) return;

    const newItem: LineItem = {
      itemId: currentItemId,
      itemName: currentItemName,
      quantity: Number(currentQuantity)
    };

    setLineItems([...lineItems, newItem]);
    
    // Reset item input fields
    setCurrentItemId('');
    setCurrentItemName('');
    setCurrentQuantity('');
  };

  const handleRemoveLineItem = (index: number) => {
    const newItems = [...lineItems];
    newItems.splice(index, 1);
    setLineItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
    if (!warehouseEmail) {
        alert("Please provide a Warehouse Email address.");
        return;
    }

    setIsSubmitting(true);
    setEmailStatus('Processing Request & Sending Email...');
    
    const machine = machines.find(m => m.id === machineId);
    const sector = sectors.find(s => s.id === sectorId);
    const division = divisions.find(d => d.id === divisionId);

    const timestamp = new Date().toISOString();
    const batchIdBase = Date.now().toString().slice(-6);
    
    const newRecords: IssueRecord[] = [];

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
        machineName: machine ? machine.name : 'Unknown Machine',
        sectorName: sector ? sector.name : '',
        divisionName: division ? division.name : '',
        status: 'Pending',
        warehouseEmail,
        requesterEmail
      };
      newRecords.push(newIssue);
    }

    // Simulate Network Delay & Email Sending
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 1. Trigger AI Email Generation (Simulation of sending)
    // Note: This is client-side simulation + Gemini call
    const emailData = await generateIssueEmail(newRecords);
    console.log(`[System] Email sent to ${warehouseEmail} with subject: ${emailData.subject}`);
    
    // 2. Check for Google Sheet Script URL
    const scriptUrl = localStorage.getItem('wf_script_url');
    if (scriptUrl) {
       console.log("Syncing with Google Sheet...");
       newRecords.forEach(r => sendIssueToSheet(scriptUrl, r));
    }

    // 3. Save records locally
    newRecords.forEach(record => onAddIssue(record));
    
    setLastSubmittedBatch(newRecords);
    setEmailStatus(`Sent to: ${warehouseEmail}`);
    
    // 4. Reset Form logic
    setLocationId('');
    setSectorId('');
    setDivisionId('');
    setMachineId('');
    setFilterMainGroup('');
    setFilterSubGroup('');
    setFilterCategory('');
    setFilterBrand('');
    setLineItems([]);
    
    setIsSubmitting(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!lastSubmittedBatch || lastSubmittedBatch.length === 0) return;

    const headers = ["Request ID", "Date", "Location", "Sector", "Division", "Machine", "Item Number", "Item Name", "Quantity", "Warehouse Email", "Site Email"];
    const rows = lastSubmittedBatch.map(item => [
        item.id,
        new Date(item.timestamp).toLocaleString(),
        item.locationId,
        item.sectorName || '',
        item.divisionName || '',
        item.machineName,
        item.itemId,
        item.itemName,
        item.quantity,
        item.warehouseEmail || '',
        item.requesterEmail || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const batchId = lastSubmittedBatch[0].id.split('-')[1]; 
    link.setAttribute("download", `Request_Slip_${batchId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Filtering & Logic ---

  // Helper to infer unique upstream values based on current selection
  const inferUpstreamFilters = (
     currentMain: string, 
     currentSub: string, 
     currentCat: string, 
     currentBrand: string
  ) => {
    // Get all machines that match the non-empty filters provided
    const matchingMachines = machines.filter(m => {
        if (currentMain && m.mainGroup !== currentMain) return false;
        if (currentSub && m.subGroup !== currentSub) return false;
        if (currentCat && m.category !== currentCat) return false;
        if (currentBrand && m.brand !== currentBrand) return false;
        return true;
    });

    if (matchingMachines.length === 0) return;

    // Check uniqueness for each field
    const uniqueMains = Array.from(new Set(matchingMachines.map(m => m.mainGroup).filter(Boolean)));
    const uniqueSubs = Array.from(new Set(matchingMachines.map(m => m.subGroup).filter(Boolean)));
    const uniqueCats = Array.from(new Set(matchingMachines.map(m => m.category).filter(Boolean)));
    const uniqueBrands = Array.from(new Set(matchingMachines.map(m => m.brand).filter(Boolean)));

    // Auto-fill if there's exactly one possibility and it's not already set
    if (uniqueMains.length === 1 && !currentMain) setFilterMainGroup(uniqueMains[0] as string);
    if (uniqueSubs.length === 1 && !currentSub) setFilterSubGroup(uniqueSubs[0] as string);
    if (uniqueCats.length === 1 && !currentCat) setFilterCategory(uniqueCats[0] as string);
    if (uniqueBrands.length === 1 && !currentBrand) setFilterBrand(uniqueBrands[0] as string);
  };

  // Handlers with cascading clear logic
  const handleMainGroupChange = (val: string) => {
    setFilterMainGroup(val);
    setFilterSubGroup('');
    setFilterCategory('');
    setFilterBrand('');
    setMachineId('');
  };

  const handleSubGroupChange = (val: string) => {
    setFilterSubGroup(val);
    setFilterCategory('');
    setFilterBrand('');
    setMachineId('');
    inferUpstreamFilters(filterMainGroup, val, '', '');
  };

  const handleCategoryChange = (val: string) => {
    setFilterCategory(val);
    setFilterBrand('');
    setMachineId('');
    inferUpstreamFilters(filterMainGroup, filterSubGroup, val, '');
  };

  const handleBrandChange = (val: string) => {
    setFilterBrand(val);
    setMachineId('');
    inferUpstreamFilters(filterMainGroup, filterSubGroup, filterCategory, val);
  };

  const handleMachineChange = (val: string) => {
    setMachineId(val);
    const m = machines.find(machine => machine.id === val);
    if (m) {
        // Auto-fill everything based on the selected machine
        if (m.mainGroup) setFilterMainGroup(m.mainGroup);
        if (m.subGroup) setFilterSubGroup(m.subGroup);
        if (m.category) setFilterCategory(m.category);
        if (m.brand) setFilterBrand(m.brand);
    }
  };

  // --- Calculate Options ---
  // The logic here is to show options that are VALID given the upstream selection.
  // However, for inference to work best, sometimes we want to see all options if upstream is empty.
  
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

  const availableMachines = machines.filter(m => {
    if (divisionId && m.divisionId !== divisionId) return false;
    if (filterMainGroup && m.mainGroup !== filterMainGroup) return false;
    if (filterSubGroup && m.subGroup !== filterSubGroup) return false;
    if (filterCategory && m.category !== filterCategory) return false;
    if (filterBrand && m.brand !== filterBrand) return false;
    return true;
  });

  const availableDivisions = sectorId ? divisions.filter(d => d.sectorId === sectorId) : [];

  // --- Permission Logic for Locations ---
  const allowedLocations = useMemo(() => {
    // Admin sees all
    if (currentUser.role === 'admin') return locations;
    
    // If user has specific allowed locations, filter the list
    if (currentUser.allowedLocationIds && currentUser.allowedLocationIds.length > 0) {
      return locations.filter(loc => currentUser.allowedLocationIds!.includes(loc.id));
    }

    // Default: If no restrictions set, allow all
    return locations;
  }, [locations, currentUser]);


  // --- Options Generation ---
  const locationOptions: Option[] = allowedLocations.map(l => ({ id: l.id, label: l.name }));
  const sectorOptions: Option[] = sectors.map(s => ({ id: s.id, label: s.name }));
  const divisionOptions: Option[] = availableDivisions.map(d => ({ id: d.id, label: d.