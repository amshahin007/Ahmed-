import React, { useState, useEffect } from 'react';
import { IssueRecord, Item, Location, Machine, Sector, Division } from '../types';
import { generateIssueEmail } from '../services/geminiService';
import SearchableSelect, { Option } from './SearchableSelect';

interface IssueFormProps {
  onAddIssue: (issue: IssueRecord) => void;
  items: Item[];
  locations: Location[];
  machines: Machine[];
  sectors: Sector[];
  divisions: Division[];
}

interface LineItem {
  itemId: string;
  itemName: string;
  quantity: number;
}

const IssueForm: React.FC<IssueFormProps> = ({ 
  onAddIssue, items, locations, machines, sectors, divisions 
}) => {
  // --- Header State (Context) ---
  const [locationId, setLocationId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [machineId, setMachineId] = useState('');

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

  // Auto-lookup Item Name for current input
  useEffect(() => {
    const item = items.find(i => i.id === currentItemId);
    if (item) {
      setCurrentItemName(item.name);
    } else {
      setCurrentItemName('');
    }
  }, [currentItemId, items]);

  // Reset downstream fields when upstream changes
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
    const emailData = await generateIssueEmail(newRecords);
    console.log(`[System] Email sent to ${warehouseEmail} with subject: ${emailData.subject}`);
    if (requesterEmail) {
        console.log(`[System] CC Email sent to ${requesterEmail}`);
    }
    
    // 2. Save records
    newRecords.forEach(record => onAddIssue(record));
    
    setLastSubmittedBatch(newRecords);
    setEmailStatus(`Sent to: ${warehouseEmail}`);
    
    // 3. Reset Form logic
    setLocationId('');
    setSectorId('');
    setDivisionId('');
    setMachineId('');
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

  // --- Filtering Logic for Cascade ---
  const availableDivisions = sectorId ? divisions.filter(d => d.sectorId === sectorId) : [];
  const availableMachines = divisionId ? machines.filter(m => m.divisionId === divisionId) : [];

  // --- Options Generation ---
  const locationOptions: Option[] = locations.map(l => ({ id: l.id, label: l.name }));
  const sectorOptions: Option[] = sectors.map(s => ({ id: s.id, label: s.name }));
  const divisionOptions: Option[] = availableDivisions.map(d => ({ id: d.id, label: d.name }));
  const machineOptions: Option[] = availableMachines.map(m => ({ id: m.id, label: m.name, subLabel: `${m.model} (${m.id})` }));
  const itemOptions: Option[] = items.map(i => ({ id: i.id, label: i.id, subLabel: i.name }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* SUCCESS MODAL POPUP */}
      {lastSubmittedBatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-fade-in-up">
             
             {/* Header */}
             <div className="bg-blue-600 p-6 text-white text-center">
               <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
                 <span className="text-3xl">📧</span>
               </div>
               <h2 className="text-2xl font-bold">Request Sent!</h2>
               <p className="opacity-90 mt-1">Notification sent to {lastSubmittedBatch[0].warehouseEmail}</p>
             </div>
             
             {/* Actions Body */}
             <div className="p-8 space-y-4">
                <div className="text-center text-sm bg-gray-50 p-3 rounded-lg border border-gray-100 mb-6">
                   <p className="font-medium text-gray-700">Request IDs generated:</p>
                   <p className="text-gray-500">{lastSubmittedBatch.length} items waiting for approval</p>
                </div>
                
                <button onClick={handlePrint} className="w-full py-4 bg-gray-900 text-white rounded-xl hover:bg-black font-bold text-lg flex items-center justify-center gap-3 shadow-lg transition-transform hover:scale-[1.02]">
                   <span className="text-2xl">🖨️</span> Print Request Slip
                </button>
                
                <button onClick={handleExportExcel} className="w-full py-3 bg-green-100 text-green-800 rounded-xl hover:bg-green-200 font-semibold flex items-center justify-center gap-2 transition border border-green-200">
                    <span>📊</span> Download Excel
                </button>
             </div>

             {/* Footer */}
             <div className="bg-gray-50 p-4 border-t border-gray-100 text-center">
                <button onClick={() => setLastSubmittedBatch(null)} className="text-gray-500 hover:text-gray-800 font-medium px-6 py-2">
                   Start New Request
                </button>
             </div>
          </div>
          
          {/* PRINT VIEW (Hidden on screen, Visible on Print) */}
          <div className="hidden print:block fixed inset-0 bg-white z-[100] p-10 h-screen w-screen">
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
                   <p><span className="font-bold">Sent To:</span> {lastSubmittedBatch[0].warehouseEmail}</p>
                   {lastSubmittedBatch[0].sectorName && <p><span className="font-bold">Sector:</span> {lastSubmittedBatch[0].sectorName}</p>}
                </div>
                <div>
                   <p><span className="font-bold">Machine:</span> {lastSubmittedBatch[0].machineName}</p>
                   {lastSubmittedBatch[0].divisionName && <p><span className="font-bold">Division:</span> {lastSubmittedBatch[0].divisionName}</p>}
                   <p><span className="font-bold">Machine ID:</span> {lastSubmittedBatch[0].machineId}</p>
                   {lastSubmittedBatch[0].requesterEmail && (
                       <p><span className="font-bold">Site Email:</span> {lastSubmittedBatch[0].requesterEmail}</p>
                   )}
                </div>
            </div>

            <table className="w-full text-left border-collapse border border-black mb-8">
                <thead>
                    <tr className="bg-gray-100">
                         <th className="border border-black p-2">Request ID</th>
                         <th className="border border-black p-2">Item Number</th>
                         <th className="border border-black p-2">Item Name</th>
                         <th className="border border-black p-2 text-right">Qty</th>
                    </tr>
                </thead>
                <tbody>
                    {lastSubmittedBatch.map(item => (
                        <tr key={item.id}>
                            <td className="border border-black p-2">{item.id}</td>
                            <td className="border border-black p-2">{item.itemId}</td>
                            <td className="border border-black p-2">{item.itemName}</td>
                            <td className="border border-black p-2 text-right font-bold">{item.quantity}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            <div className="flex justify-between px-10 mt-20">
                <div className="text-center">
                    <div className="border-t border-black w-64 pt-2">Requester Signature</div>
                </div>
                <div className="text-center">
                    <div className="border-t border-black w-64 pt-2">Store Keeper Approval</div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* FORM CONTAINER */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <span className="mr-3 p-2 bg-blue-100 text-blue-600 rounded-lg text-xl">📝</span>
          Create New Request
        </h2>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section 1: HEADER */}
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
             <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">1. Location & Machine</h3>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SearchableSelect label="Warehouse Location" required options={locationOptions} value={locationId} onChange={setLocationId} placeholder="Search warehouse zone..." />
                
                <SearchableSelect label="Sector" options={sectorOptions} value={sectorId} onChange={setSectorId} placeholder="Select Sector..." />
                
                <SearchableSelect label="Division" disabled={!sectorId} options={divisionOptions} value={divisionId} onChange={setDivisionId} placeholder="Select Division..." />
                
                <SearchableSelect label="Machine" required disabled={!divisionId} options={machineOptions} value={machineId} onChange={setMachineId} placeholder="Select Machine..." />
             </div>
          </div>

          {/* Section 2: LINES */}
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">2. Add Items</h3>
            
            <div className="flex flex-col md:flex-row gap-4 items-end mb-4">
               <div className="flex-1 w-full">
                 <SearchableSelect label="Item Number" options={itemOptions} value={currentItemId} onChange={setCurrentItemId} placeholder="Scan or select Item No..." />
               </div>
               <div className="flex-1 w-full md:w-auto">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                 <input type="text" readOnly value={currentItemName} className="w-full px-4 py-2 bg-gray-200 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed" />
               </div>
               <div className="w-32">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Qty</label>
                 <input type="number" min="1" value={currentQuantity} onChange={(e) => setCurrentQuantity(Number(e.target.value))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
               </div>
               <button 
                 type="button" 
                 onClick={handleAddLineItem}
                 disabled={!currentItemId || !currentQuantity}
                 className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-sm h-[42px]"
               >
                 + Add
               </button>
            </div>

            {/* Added Items Table */}
            {lineItems.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 text-gray-700 font-semibold">
                            <tr>
                                <th className="px-4 py-2">Item Number</th>
                                <th className="px-4 py-2">Item Name</th>
                                <th className="px-4 py-2 w-24 text-center">Qty</th>
                                <th className="px-4 py-2 w-24 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {lineItems.map((line, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-mono text-gray-600">{line.itemId}</td>
                                    <td className="px-4 py-2">{line.itemName}</td>
                                    <td className="px-4 py-2 text-center font-bold">{line.quantity}</td>
                                    <td className="px-4 py-2 text-center">
                                        <button type="button" onClick={() => handleRemoveLineItem(idx)} className="text-red-500 hover:text-red-700 font-medium">Remove</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
                    No items added yet. Search and add items above.
                </div>
            )}
          </div>

          {/* Section 3: Notification Details */}
          <div className="bg-blue-50 p-5 rounded-lg border border-blue-100">
             <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-4 border-b border-blue-200 pb-2">3. Notification Details</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <div className="flex items-center px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600">
                       {requesterEmail ? (
                          <span className="font-medium text-gray-800">{requesterEmail}</span>
                       ) : (
                          <span className="text-gray-400 italic">Select a Location to auto-fill</span>
                       )}
                    </div>
                 </div>
             </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-8 py-4 rounded-xl text-white font-bold text-lg shadow-md transition-all flex items-center gap-2 ${
                isSubmitting 
                ? 'bg-blue-400 cursor-wait' 
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