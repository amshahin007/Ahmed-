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
    // Simple CSV Export implementation
    const headers = ["ID", "Date", "Location", "Item ID", "Item Name", "Quantity", "Machine", "Status"];
    const rows = filteredHistory.map(h => [
        h.id,
        h.timestamp,
        h.locationId,
        h.itemId,
        h.itemName,
        h.quantity,
        h.machineName,
        h.status
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
                        <th className="px-6 py-4">Issue ID</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Item</th>
                        <th className="px-6 py-4">Qty</th>
                        <th className="px-6 py-4">Location</th>
                        <th className="px-6 py-4">Machine</th>
                        <th className="px-6 py-4">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredHistory.length > 0 ? (
                        filteredHistory.map((record) => (
                            <tr key={record.id} className="hover:bg-gray-50 transition">
                                <td className="px-6 py-4 font-medium text-gray-900">{record.id}</td>
                                <td className="px-6 py-4">{new Date(record.timestamp).toLocaleDateString()}</td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-gray-900 font-medium">{record.itemName}</span>
                                        <span className="text-xs text-gray-400">{record.itemId}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-mono">{record.quantity}</td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">{record.locationId}</span>
                                </td>
                                <td className="px-6 py-4 truncate max-w-[150px]">{record.machineName}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        record.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                        record.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-blue-100 text-blue-700'
                                    }`}>
                                        {record.status}
                                    </span>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
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
