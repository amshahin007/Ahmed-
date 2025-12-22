import React, { useState } from 'react';
import { IssueRecord } from '../types';

interface StockApprovalProps {
  history: IssueRecord[];
  onUpdateIssue: (updatedRecord: IssueRecord) => void;
}

const StockApproval: React.FC<StockApprovalProps> = ({ history, onUpdateIssue }) => {
  const [editedRecords, setEditedRecords] = useState<Record<string, { quantity: number; notes: string }>>({});

  const pendingIssues = history.filter(h => h.status === 'Pending');

  const getEditedValue = (id: string, field: 'quantity' | 'notes', originalValue: any) => {
    if (editedRecords[id] && editedRecords[id][field] !== undefined) {
      return editedRecords[id][field];
    }
    return originalValue;
  };

  const handleEdit = (id: string, field: 'quantity' | 'notes', value: any) => {
    setEditedRecords(prev => {
      const current = prev[id] || { quantity: 0, notes: '' }; // Defaults will be overwritten by component logic if not present
      
      // If we haven't started editing this row, grab the original quantity to start with
      const baseQuantity = prev[id]?.quantity ?? pendingIssues.find(p => p.id === id)?.quantity ?? 0;
      const baseNotes = prev[id]?.notes ?? pendingIssues.find(p => p.id === id)?.notes ?? '';

      return {
        ...prev,
        [id]: {
          quantity: field === 'quantity' ? Number(value) : baseQuantity,
          notes: field === 'notes' ? value : baseNotes
        }
      };
    });
  };

  const processAction = (record: IssueRecord, action: 'Approved' | 'Rejected') => {
    const edits = editedRecords[record.id];
    const finalQuantity = edits?.quantity ?? record.quantity;
    const finalNotes = edits?.notes ?? record.notes ?? '';

    if (finalQuantity <= 0 && action === 'Approved') {
        alert("Quantity must be greater than 0 to approve.");
        return;
    }

    const updated: IssueRecord = {
        ...record,
        quantity: finalQuantity,
        notes: finalNotes,
        status: action
    };

    onUpdateIssue(updated);
    
    // Clear local state
    const newEdits = { ...editedRecords };
    delete newEdits[record.id];
    setEditedRecords(newEdits);
  };

  return (
    <div className="space-y-6">
       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
         <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <span className="mr-2 text-2xl">✅</span> Pending Approvals
            </h2>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                {pendingIssues.length} Pending
            </span>
         </div>

         {pendingIssues.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <p className="text-lg">No pending requests.</p>
                <p className="text-sm">All caught up! 🎉</p>
            </div>
         ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-sm uppercase text-gray-500 font-semibold tracking-wider">
                            <th className="p-4">Date / ID</th>
                            <th className="p-4">Location / Machine</th>
                            <th className="p-4">Item Details</th>
                            <th className="p-4 w-32">Qty Request</th>
                            <th className="p-4 w-48">Notes</th>
                            <th className="p-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {pendingIssues.map(issue => {
                            const currentQty = getEditedValue(issue.id, 'quantity', issue.quantity);
                            const currentNotes = getEditedValue(issue.id, 'notes', issue.notes || '');
                            
                            return (
                                <tr key={issue.id} className="hover:bg-blue-50 transition-colors group">
                                    <td className="p-4 align-top">
                                        <div className="text-gray-900 font-medium">{issue.id}</div>
                                        <div className="text-xs text-gray-500">{new Date(issue.timestamp).toLocaleDateString()}</div>
                                        <div className="text-xs text-gray-400">{new Date(issue.timestamp).toLocaleTimeString()}</div>
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="text-sm font-medium text-gray-800">{issue.machineName}</div>
                                        <div className="text-xs text-gray-500">{issue.locationId}</div>
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="text-sm font-medium text-blue-700">{issue.itemName}</div>
                                        <div className="text-xs text-gray-500 font-mono">{issue.itemId}</div>
                                    </td>
                                    <td className="p-4 align-top">
                                        <input 
                                            type="number" 
                                            min="0"
                                            value={currentQty}
                                            onChange={(e) => handleEdit(issue.id, 'quantity', e.target.value)}
                                            className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-right font-bold text-gray-700"
                                        />
                                        {currentQty < issue.quantity && (
                                            <div className="text-xs text-orange-600 mt-1 font-medium">Reduced</div>
                                        )}
                                    </td>
                                    <td className="p-4 align-top">
                                        <textarea 
                                            placeholder="Add notes..."
                                            rows={2}
                                            value={currentNotes}
                                            onChange={(e) => handleEdit(issue.id, 'notes', e.target.value)}
                                            className="w-full text-sm px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                        />
                                    </td>
                                    <td className="p-4 align-top text-center space-y-2">
                                        <button 
                                            onClick={() => processAction(issue, 'Approved')}
                                            className="w-full px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 shadow-sm transition flex items-center justify-center gap-1"
                                        >
                                            <span>✓</span> Approve
                                        </button>
                                        <button 
                                            onClick={() => processAction(issue, 'Rejected')}
                                            className="w-full px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 border border-red-200 transition flex items-center justify-center gap-1"
                                        >
                                            <span>✗</span> Reject
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
         )}
       </div>
    </div>
  );
};

export default StockApproval;