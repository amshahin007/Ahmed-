
import React, { useState } from 'react';
import { IssueRecord, Location } from '../types';
import * as XLSX from 'xlsx';
import { uploadFileToDrive, DEFAULT_SCRIPT_URL } from '../services/googleSheetsService';

interface HistoryTableProps {
  history: IssueRecord[];
  locations: Location[];
}

const HistoryTable: React.FC<HistoryTableProps> = ({ history, locations }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [uploading, setUploading] = useState(false);
  const [driveLink, setDriveLink] = useState('');

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

  const generateWorkbook = () => {
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
    return wb;
  };

  const downloadExcel = () => {
    const wb = generateWorkbook();
    XLSX.writeFile(wb, `warehouse_issues_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const saveToDrive = async () => {
      // Fallback to default if not in localStorage
      const scriptUrl = localStorage.getItem('wf_script_url') || DEFAULT_SCRIPT_URL;
      if (!scriptUrl) {
          alert("Web App URL not configured in Master Data settings.");
          return;
      }
      
      if (filteredHistory.length === 0) {
          alert("No data to save.");
          return;
      }

      setUploading(true);
      setDriveLink('');
      try {
          const wb = generateWorkbook();
          const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
          const fileName = `Full_History_Backup_${new Date().toISOString().slice(0,10)}.xlsx`;
          
          const url = await uploadFileToDrive(scriptUrl, fileName, wbOut);
          
          if (url) {
              setDriveLink(url);
              // Optional: Auto open
              // window.open(url, '_blank');
          } else {
              setDriveLink('saved');
              alert("Backup saved to 'WareFlow Reports' folder in your Drive!");
          }
      } catch (e) {
          console.error(e);
          alert("Failed to upload to Drive.");
      } finally {
          setUploading(false);
      }
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

        <div className="flex gap-2">
            <button
                onClick={downloadExcel}
                className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-sm whitespace-nowrap"
            >
                <span className="mr-2">📊</span> Excel
            </button>
            
            {driveLink && driveLink !== 'saved' ? (
               <a 
                   href={driveLink} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm whitespace-nowrap font-bold"
               >
                   <span>📂</span> Open File ↗
               </a>
            ) : (
               <button
                  onClick={saveToDrive}
                  disabled={uploading}
                  className="flex items-center justify-center px-4 py-2 bg-yellow-100 text-yellow-800 border border-yellow-200 rounded-lg hover:bg-yellow-200 transition shadow-sm whitespace-nowrap"
               >
                  {uploading ? <span className="animate-spin mr-2">↻</span> : <span className="mr-2">☁️</span>}
                  {driveLink === 'saved' ? 'Saved (Check Drive)' : 'Save to Drive'}
               </button>
            )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-auto max-h-[75vh] relative">
            <table className="w-full text-left text-sm text-gray-600 border-separate border-spacing-0">
                <thead className="bg-gray-50 text-gray-700 font-semibold">
                    <tr>
                        <th className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 py-4 whitespace-nowrap">Issue ID</th>
                        <th className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 py-4 whitespace-nowrap">Date</th>
                        <th className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 py-4 whitespace-nowrap">Location (Site)</th>
                        <th className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 py-4 whitespace-nowrap">Sector/Div</th>
                        <th className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 py-4 whitespace-nowrap">Machine</th>
                        <th className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 py-4 whitespace-nowrap">Item Details</th>
                        <th className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 py-4 whitespace-nowrap">Qty</th>
                        <th className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 py-4 whitespace-nowrap">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredHistory.length > 0 ? (
                        filteredHistory.map((record) => (
                            <tr key={record.id} className="hover:bg-gray-50 transition">
                                {/* ID */}
                                <td className="px-6 py-4 font-medium text-gray-900 align-middle whitespace-nowrap border-b border-gray-50">
                                  {record.id}
                                </td>
                                
                                {/* Date */}
                                <td className="px-6 py-4 align-middle whitespace-nowrap border-b border-gray-50">
                                  <div>{new Date(record.timestamp).toLocaleDateString()}</div>
                                  <div className="text-xs text-gray-400">{new Date(record.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                </td>
                                
                                {/* Location / Site */}
                                <td className="px-6 py-4 align-middle whitespace-nowrap border-b border-gray-50">
                                    <div className="font-medium text-gray-800">{record.locationId}</div>
                                    {record.requesterEmail && (
                                      <div className="text-xs text-blue-600 mt-1">{record.requesterEmail}</div>
                                    )}
                                </td>

                                {/* Sector / Div */}
                                <td className="px-6 py-4 align-middle whitespace-nowrap border-b border-gray-50">
                                    <div className="text-xs text-gray-500">{record.sectorName || '-'}</div>
                                    <div className="text-xs text-gray-400">{record.divisionName || '-'}</div>
                                </td>
                                
                                {/* Machine & Plan */}
                                <td className="px-6 py-4 align-middle whitespace-nowrap border-b border-gray-50">
                                    <div className="text-gray-900 font-medium">{record.machineName}</div>
                                    {record.maintenancePlan && (
                                      <div className="mt-1 inline-block px-2 py-0.5 bg-orange-50 text-orange-700 text-[10px] rounded border border-orange-100 whitespace-nowrap">
                                        {record.maintenancePlan}
                                      </div>
                                    )}
                                </td>

                                {/* Item Details */}
                                <td className="px-6 py-4 align-middle whitespace-nowrap border-b border-gray-50">
                                    <div className="text-gray-900 font-medium">{record.itemName}</div>
                                    <div className="text-xs text-gray-500 font-mono">{record.itemId}</div>
                                </td>
                                
                                {/* Qty */}
                                <td className="px-6 py-4 font-mono font-bold align-middle whitespace-nowrap border-b border-gray-50">
                                  {record.quantity}
                                </td>
                                
                                {/* Status */}
                                <td className="px-6 py-4 align-middle whitespace-nowrap border-b border-gray-50">
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
      <div className="text-right text-xs text-gray-400">
        Showing {filteredHistory.length} records
      </div>
    </div>
  );
};

export default HistoryTable;
