
import React, { useState } from 'react';
import { IssueRecord, Location } from '../types';
import * as XLSX from 'xlsx';

interface HistoryTableProps {
  history: IssueRecord[];
  locations: Location[];
}

const HistoryTable: React.FC<HistoryTableProps> = ({ history, locations }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  const filteredHistory = history.filter(record => {
    const matchesSearch = 
      record.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.machineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.maintenancePlan || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.locationId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLocation = selectedLocation ? record.locationId === selectedLocation : true;

    return matchesSearch && matchesLocation;
  });

  const downloadExcel = () => {
    // XLSX Export implementation
    const headers = [
      "ID", 
      "Date", 
      "Location", 
      "Site Email", 
      "Sector", 
      "Division", 
      "Machine", 
      "Maint. Plan",
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
        h.maintenancePlan || '',
        h.itemId,
        h.itemName,
        h.quantity,
        h.status,
        h.notes || ''
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "History");
    XLSX.writeFile(wb, `warehouse_issues_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Search Bar */}
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

        {/* Location Filter Dropdown */}
        <div className="w-full md:w-64">
            <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
            >
                <option value="">All Locations</option>
                {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
            </select>
        </div>

        <button
            onClick={downloadExcel}
            className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-sm whitespace-nowrap"
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
                        <th className="px-6 py-4 whitespace-nowrap">Sector/Div</th>
                        <th className="px-6 py-4 whitespace-nowrap">Machine</th>
                        <th className="px-6 py-4 whitespace-nowrap">Item Details</th>
                        <th className="px-6 py-4 whitespace-nowrap">Qty</th>
                        <th className="px-6 py-4 whitespace-nowrap">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredHistory.length > 0 ? (
                        filteredHistory.map((record) => (
                            <tr key={record.id} className="hover:bg-gray-50 transition">
                                {/* ID */}
                                <td className="px-6 py-4 font-medium text-gray-900 align-middle whitespace-nowrap">
                                  {record.id}
                                </td>
                                
                                {/* Date */}
                                <td className="px-6 py-4 align-middle whitespace-nowrap">
                                  <div>{new Date(record.timestamp).toLocaleDateString()}</div>
                                  <div className="text-xs text-gray-400">{new Date(record.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                </td>
                                
                                {/* Location / Site */}
                                <td className="px-6 py-4 align-middle whitespace-nowrap">
                                    <div className="font-medium text-gray-800">{record.locationId}</div>
                                    {record.requesterEmail && (
                                      <div className="text-xs text-blue-600 mt-1">{record.requesterEmail}</div>
                                    )}
                                </td>

                                {/* Sector / Div */}
                                <td className="px-6 py-4 align-middle whitespace-nowrap">
                                    <div className="text-xs text-gray-500">{record.sectorName || '-'}</div>
                                    <div className="text-xs text-gray-400">{record.divisionName || '-'}</div>
                                </td>
                                
                                {/* Machine & Plan */}
                                <td className="px-6 py-4 align-middle whitespace-nowrap">
                                    <div className="text-gray-900 font-medium">{record.machineName}</div>
                                    {record.maintenancePlan && (
                                      <div className="mt-1 inline-block px-2 py-0.5 bg-orange-50 text-orange-700 text-[10px] rounded border border-orange-100 whitespace-nowrap">
                                        {record.maintenancePlan}
                                      </div>
                                    )}
                                </td>

                                {/* Item Details */}
                                <td className="px-6 py-4 align-middle whitespace-nowrap">
                                    <div className="text-gray-900 font-medium">{record.itemName}</div>
                                    <div className="text-xs text-gray-500 font-mono">{record.itemId}</div>
                                </td>
                                
                                {/* Qty */}
                                <td className="px-6 py-4 font-mono font-bold align-middle whitespace-nowrap">
                                  {record.quantity}
                                </td>
                                
                                {/* Status */}
                                <td className="px-6 py-4 align-middle whitespace-nowrap">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium inline-block whitespace-nowrap ${
                                        record.status === 'Completed' || record.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                        record.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                        record.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                        {record.status}
                                    </span>
                                    {record.notes && (
                                      <div className="text-xs text-gray-500 mt-2 italic whitespace-nowrap">
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
