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
    if (!locationId || !machineId || lineItems.length === 0) return;

    setIsSubmitting(true);
    
    const machine = machines.find(m => m.id === machineId);
    const timestamp = new Date().toISOString();
    const batchIdBase = Date.now().toString().slice(-6);
    
    const newRecords: IssueRecord[] = [];

    // Create a record for each line item
    for (let i = 0; i < lineItems.length; i++) {
      const line = lineItems[i];
      const newIssue: IssueRecord = {
        id: `ISS-${batchIdBase}-${i + 1}`, // Unique ID per line
        timestamp: timestamp,
        locationId,
        itemId: line.itemId,
        itemName: line.itemName,
        quantity: line.quantity,
        machineId,
        machineName: machine ? machine.name : 'Unknown Machine',
        status: 'Pending'
      };
      newRecords.push(newIssue);
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Save all records
    newRecords.forEach(record => onAddIssue(record));
    
    setLastSubmittedBatch(newRecords);
    
    // Reset Form completely
    setLocationId('');
    setSectorId('');
    setDivisionId('');
    setMachineId('');
    setLineItems([]);
    
    setIsSubmitting(false);
    setEmailStatus('');
  };

  const handleSendEmail = async () => {
    if (!lastSubmittedBatch || lastSubmittedBatch.length === 0) return;
    setEmailStatus('Generating email...');
    
    // Send the whole batch to the email service
    const emailData = await generateIssueEmail(lastSubmittedBatch);
    
    console.log("Email Sent (Simulated):", emailData);
    setEmailStatus(`Email sent: "${emailData.subject}"`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!lastSubmittedBatch || lastSubmittedBatch.length === 0) return;

    const headers = ["Issue ID", "Date", "Location", "Machine", "Machine ID", "Item ID", "Item Name", "Quantity"];
    const rows = lastSubmittedBatch.map(item => [
        item.id,
        new Date(item.timestamp).toLocaleString(),
        item.locationId,
        item.machineName,
        item.machineId,
        item.itemId,
        item.itemName,
        item.quantity
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    // Use the batch ID (derived from the first item ID parts) for the filename
    const batchId = lastSubmittedBatch[0].id.split('-')[1]; 
    link.setAttribute("download", `Issue_Slip_${batchId}.csv`);
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
      
      {/* SUCCESS MESSAGE */}
      {lastSubmittedBatch && (
        <div className="bg-green-50 p-6 rounded-xl border border-green-200 animate-fade-in-up mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-green-800">✅ Issue Slip Recorded</h3>
              <p className="text-green-700 mt-1">
                Successfully recorded <strong>{lastSubmittedBatch.length}</strong> items for <strong>{lastSubmittedBatch[0].machineName}</strong>.
              </p>
              {emailStatus && (
                 <p className="mt-2 text-sm font-medium text-blue-600">{emailStatus}</p>
              )}
            </div>
            <div className="flex space-x-3">
              <button onClick={() => setLastSubmittedBatch(null)} className="text-sm text-gray-500 hover:text-gray-700 underline">Close</button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center shadow-sm"
              >
                🖨️ Print Slip
              </button>
              <button
                onClick={handleExportExcel}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm flex items-center"
              >
                📊 Export Excel
              </button>
              <button
                onClick={handleSendEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm flex items-center"
              >
                📧 Email Slip
              </button>
            </div>
          </div>
          
          {/* PRINT VIEW (Hidden on screen) */}
          <div className="hidden print:block fixed inset-0 bg-white z-50 p-10 h-screen w-screen">
            <div className="text-center mb-8">
               <h1 className="text-3xl font-bold uppercase tracking-widest border-b-2 border-black pb-4 inline-block">Material Issue Slip</h1>
            </div>
            
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

            <table className="w-full text-left border-collapse border border-black">
                <thead>
                    <tr className="bg-gray-100">
                         <th className="border border-black p-2">Line ID</th>
                         <th className="border border-black p-2">Item ID</th>
                         <th className="border border-black p-2">Description</th>
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
            
            <div className="mt-16 flex justify-between px-10">
                <div className="text-center">
                    <div className="border-t border-black w-64 pt-2">Authorized Signature</div>
                </div>
                <div className="text-center">
                    <div className="border-t border-black w-64 pt-2">Receiver Signature</div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* FORM CONTAINER */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <span className="mr-3 p-2 bg-blue-100 text-blue-600 rounded-lg text-xl">📝</span>
          Create New Issue Slip
        </h2>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section 1: HEADER (Location & Machine) */}
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
             <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">1. Location & Machine</h3>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SearchableSelect label="Warehouse Location" required options={locationOptions} value={locationId} onChange={setLocationId} placeholder="Search warehouse zone..." />
                
                <SearchableSelect label="Sector" options={sectorOptions} value={sectorId} onChange={setSectorId} placeholder="Select Sector..." />
                
                <SearchableSelect label="Division" disabled={!sectorId} options={divisionOptions} value={divisionId} onChange={setDivisionId} placeholder="Select Division..." />
                
                <SearchableSelect label="Machine" required disabled={!divisionId} options={machineOptions} value={machineId} onChange={setMachineId} placeholder="Select Machine..." />
             </div>
          </div>

          {/* Section 2: LINES (Add Items) */}
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">2. Add Items</h3>
            
            <div className="flex flex-col md:flex-row gap-4 items-end mb-4">
               <div className="flex-1 w-full">
                 <SearchableSelect label="Find Item" options={itemOptions} value={currentItemId} onChange={setCurrentItemId} placeholder="Search Item ID or Name..." />
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
                                <th className="px-4 py-2">Item ID</th>
                                <th className="px-4 py-2">Name</th>
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

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || lineItems.length === 0 || !locationId || !machineId}
              className={`px-8 py-3 rounded-lg text-white font-semibold shadow-md transition-all text-lg ${
                isSubmitting 
                ? 'bg-blue-400 cursor-wait' 
                : (lineItems.length === 0 || !locationId || !machineId)
                   ? 'bg-gray-400 cursor-not-allowed'
                   : 'bg-green-600 hover:bg-green-700 hover:shadow-lg transform hover:-translate-y-0.5'
              }`}
            >
              {isSubmitting ? 'Recording Issue...' : `Record Issue (${lineItems.length} items)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IssueForm;