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

const IssueForm: React.FC<IssueFormProps> = ({ 
  onAddIssue, items, locations, machines, sectors, divisions 
}) => {
  // Form State
  const [locationId, setLocationId] = useState('');
  
  // Cascade State
  const [sectorId, setSectorId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [machineId, setMachineId] = useState('');

  const [itemId, setItemId] = useState('');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmitted, setLastSubmitted] = useState<IssueRecord | null>(null);
  const [emailStatus, setEmailStatus] = useState<string>('');

  // Auto-lookup Item Name
  useEffect(() => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      setItemName(item.name);
    } else {
      setItemName('');
    }
  }, [itemId, items]);

  // Reset downstream fields when upstream changes
  useEffect(() => {
    setDivisionId('');
    setMachineId('');
  }, [sectorId]);

  useEffect(() => {
    setMachineId('');
  }, [divisionId]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationId || !itemId || !quantity || !machineId || !itemName) return;

    setIsSubmitting(true);
    
    const machine = machines.find(m => m.id === machineId);
    
    const newIssue: IssueRecord = {
      id: `ISS-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      locationId,
      itemId,
      itemName,
      quantity: Number(quantity),
      machineId,
      machineName: machine ? machine.name : 'Unknown Machine',
      status: 'Pending'
    };

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    onAddIssue(newIssue);
    setLastSubmitted(newIssue);
    
    // Reset form
    // Keep location as sticky, maybe useful? No, reset all for clean state.
    setLocationId('');
    setSectorId('');
    setDivisionId('');
    setMachineId('');
    setItemId('');
    setItemName('');
    setQuantity('');
    
    setIsSubmitting(false);
    setEmailStatus('');
  };

  const handleSendEmail = async () => {
    if (!lastSubmitted) return;
    setEmailStatus('Generating email...');
    const emailData = await generateIssueEmail(lastSubmitted);
    console.log("Email Sent (Simulated):", emailData);
    setEmailStatus(`Email sent: "${emailData.subject}"`);
  };

  const handlePrint = () => {
    window.print();
  };

  // --- Filtering Logic for Cascade ---

  const availableDivisions = sectorId 
    ? divisions.filter(d => d.sectorId === sectorId) 
    : [];

  const availableMachines = divisionId
    ? machines.filter(m => m.divisionId === divisionId)
    : [];

  // --- Options Generation ---

  const locationOptions: Option[] = locations.map(l => ({ 
    id: l.id, label: l.name, subLabel: l.id 
  }));

  const sectorOptions: Option[] = sectors.map(s => ({
    id: s.id, label: s.name
  }));

  const divisionOptions: Option[] = availableDivisions.map(d => ({
    id: d.id, label: d.name
  }));

  const machineOptions: Option[] = availableMachines.map(m => ({ 
    id: m.id, label: m.name, subLabel: `${m.model} (${m.id})` 
  }));

  const itemOptions: Option[] = items.map(i => ({ 
    id: i.id, label: i.id, subLabel: i.name 
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <span className="mr-3 p-2 bg-blue-100 text-blue-600 rounded-lg text-xl">📝</span>
          Create New Issue
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Section 1: Where & What Machine */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
             <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Location & Machine Context</h3>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <SearchableSelect
                    label="Warehouse Location"
                    required
                    options={locationOptions}
                    value={locationId}
                    onChange={setLocationId}
                    placeholder="Search warehouse zone..."
                  />
                </div>
                
                {/* Sector Select */}
                <div>
                   <SearchableSelect
                    label="Sector"
                    options={sectorOptions}
                    value={sectorId}
                    onChange={setSectorId}
                    placeholder="Select Sector first..."
                   />
                </div>

                {/* Division Select (Dependent on Sector) */}
                <div>
                   <SearchableSelect
                    label="Division"
                    disabled={!sectorId}
                    options={divisionOptions}
                    value={divisionId}
                    onChange={setDivisionId}
                    placeholder={!sectorId ? "Select Sector first" : "Select Division..."}
                   />
                </div>

                {/* Machine Select (Dependent on Division) */}
                <div>
                  <SearchableSelect
                    label="Select Machine"
                    required
                    disabled={!divisionId}
                    options={machineOptions}
                    value={machineId}
                    onChange={setMachineId}
                    placeholder={!divisionId ? "Select Division first" : "Search machine..."}
                  />
                </div>
             </div>
          </div>

          {/* Section 2: What Item */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Item Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Item ID Input */}
              <div>
                 <SearchableSelect
                  label="Item Number"
                  required
                  options={itemOptions}
                  value={itemId}
                  onChange={setItemId}
                  placeholder="Search Item ID..."
                />
              </div>

              {/* Item Name (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                <input
                  type="text"
                  readOnly
                  value={itemName}
                  placeholder="Auto-populated..."
                  className="w-full px-4 py-2 bg-gray-200 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed"
                />
              </div>

              {/* Quantity */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-8 py-3 rounded-lg text-white font-semibold shadow-md transition-all ${
                isSubmitting 
                ? 'bg-blue-400 cursor-wait' 
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5'
              }`}
            >
              {isSubmitting ? 'Recording...' : 'Record Issue'}
            </button>
          </div>
        </form>
      </div>

      {/* Post-submission Actions */}
      {lastSubmitted && (
        <div className="bg-green-50 p-6 rounded-xl border border-green-200 animate-fade-in-up">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-green-800">✅ Issue Recorded Successfully</h3>
              <p className="text-green-700 mt-1">
                Issue <strong>{lastSubmitted.id}</strong> created for <strong>{lastSubmitted.itemName}</strong>.
              </p>
              {emailStatus && (
                 <p className="mt-2 text-sm font-medium text-blue-600">{emailStatus}</p>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center shadow-sm"
              >
                🖨️ Print
              </button>
              <button
                onClick={handleSendEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm flex items-center"
              >
                📧 Email Notification
              </button>
            </div>
          </div>
          
          {/* Hidden Print Section */}
          <div className="hidden print:block fixed inset-0 bg-white z-50 p-10">
            <h1 className="text-3xl font-bold mb-4">Material Issue Slip</h1>
            <table className="w-full text-left border-collapse">
                <tbody>
                    <tr className="border-b"><th className="py-2">Issue ID</th><td>{lastSubmitted.id}</td></tr>
                    <tr className="border-b"><th className="py-2">Date</th><td>{new Date(lastSubmitted.timestamp).toLocaleString()}</td></tr>
                    <tr className="border-b"><th className="py-2">Location</th><td>{lastSubmitted.locationId}</td></tr>
                    <tr className="border-b"><th className="py-2">Item</th><td>{lastSubmitted.itemName} ({lastSubmitted.itemId})</td></tr>
                    <tr className="border-b"><th className="py-2">Quantity</th><td>{lastSubmitted.quantity}</td></tr>
                    <tr className="border-b"><th className="py-2">Machine</th><td>{lastSubmitted.machineName} ({lastSubmitted.machineId})</td></tr>
                </tbody>
            </table>
            <div className="mt-10 border-t pt-4 flex justify-between">
                <span>Authorized Signature: _________________</span>
                <span>Receiver Signature: _________________</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IssueForm;