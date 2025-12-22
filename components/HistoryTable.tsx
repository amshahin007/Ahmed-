import React, { useState } from 'react';
import { IssueRecord } from '../types';

interface HistoryTableProps {
  history: IssueRecord[];
}

const HistoryTable: React.FC<HistoryTableProps> = ({ history }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = history.filter(record => 
    record.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.machineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.locationId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downloadExcel = () => {
    // CSV Export implementation
    const headers = [
      "ID", 
      "Date", 
      "Location", 
      "Site Email", 
      "Sector", 
      "Division", 
      "Machine", 
      "Item Number", 
      "Item Name", 
      "Quantity", 
      "Status", 
      "Notes"
    ];
    
    const rows = filteredHistory.map(h => [
        h.id,
        h.timestamp,
        h.locationId,
        h.requesterEmail || '',
        h.sectorName || '',
        h.divisionName || '',
        h.machineName,
        h.itemId,
        h.itemName,
        h.quantity,
        h.status,
        h.notes || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `warehouse_issues_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">🔍</span>
            <input
                type="text"
                placeholder="Search history..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
        <button
            onClick={downloadExcel}
            className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-sm"
        >
            <span className="mr-2">📊</span> Download Excel
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                    <tr>
                        <th className="px-6 py-4 whitespace-nowrap">Issue ID</th>
                        <th className="px-6 py-4 whitespace-nowrap">Date</th>
                        <th className="px-6 py-4 whitespace-nowrap">Location (Site)</th>
                        <th className="px-6 py-4 whitespace-nowrap">Sector</th>
                        <th className="px-6 py-4 whitespace-nowrap">Division</th>
                        <th className="px-6 py-4 whitespace-nowrap">Machine</th>
                        <th className="px-6 py-4 whitespace-nowrap">Item Number</th>
                        <th className="px-6 py-4 whitespace-nowrap">Item Name</th>
                        <th className="px-6 py-4 whitespace-nowrap">Qty</th>
                        <th className="px-6 py-4 whitespace-nowrap">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredHistory.length > 0 ? (
                        filteredHistory.map((record) => (
                            <tr key={record.id} className="hover:bg-gray-50 transition">
                                {/* ID */}
                                <td className="px-6 py-4 font-medium text-gray-900 align-top whitespace-nowrap">
                                  {record.id}
                                </td>
                                
                                {/* Date */}
                                <td className="px-6 py-4 align-top whitespace-nowrap">
                                  <div>{new Date(record.timestamp).toLocaleDateString()}</div>
                                  <div className="text-xs text-gray-400">{new Date(record.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                </td>
                                
                                {/* Location / Site */}
                                <td className="px-6 py-4 align-top min-w-[150px]">
                                    <div className="font-medium text-gray-800">{record.locationId}</div>
                                    {record.requesterEmail && (
                                      <div className="text-xs text-blue-600 mt-1">{record.requesterEmail}</div>
                                    )}
                                </td>

                                {/* Sector */}
                                <td className="px-6 py-4 align-top min-w-[120px]">
                                    {record.sectorName || <span className="text-gray-300">-</span>}
                                </td>

                                {/* Division */}
                                <td className="px-6 py-4 align-top min-w-[120px]">
                                    {record.divisionName || <span className="text-gray-300">-</span>}
                                </td>
                                
                                {/* Machine */}
                                <td className="px-6 py-4 align-top min-w-[150px]">
                                    <div className="text-gray-900 font-medium">{record.machineName}</div>
                                    <div className="text-xs text-gray-400 font-mono mt-0.5">{record.machineId}</div>
                                </td>

                                {/* Item Number */}
                                <td className="px-6 py-4 align-top font-mono text-gray-600">
                                    {record.itemId}
                                </td>

                                {/* Item Name */}
                                <td className="px-6 py-4 align-top text-gray-900 font-medium">
                                    {record.itemName}
                                </td>
                                
                                {/* Qty */}
                                <td className="px-6 py-4 font-mono font-bold align-top">
                                  {record.quantity}
                                </td>
                                
                                {/* Status */}
                                <td className="px-6 py-4 align-top whitespace-nowrap">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium inline-block ${
                                        record.status === 'Completed' || record.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                        record.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                        record.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                        {record.status}
                                    </span>
                                    {record.notes && (
                                      <div className="text-xs text-gray-500 mt-2 italic max-w-xs">
                                        "{record.notes}"
                                      </div>
                                    )}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={10} className="px-6 py-12 text-center text-gray-400">
                                No records found matching your search.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
      <div className="text-right text-xs text-gray-400">
        Showing {filteredHistory.length} records
      </div>
    </div>
  );
};

export default HistoryTable;