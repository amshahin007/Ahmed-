import React, { useState, useMemo, useEffect } from 'react';
import { IssueRecord, Location, Item, Machine } from '../types';
import * as XLSX from 'xlsx';
import { uploadFileToDrive, DEFAULT_SCRIPT_URL, locateRemoteData } from '../services/googleSheetsService';

interface HistoryTableProps {
  history: IssueRecord[];
  locations: Location[];
  items: Item[];
  machines: Machine[];
}

type TabType = 'stock' | 'history';

const ITEMS_PER_PAGE = 50;

const HistoryTable: React.FC<HistoryTableProps> = ({ history, locations, items, machines }) => {
  const [activeTab, setActiveTab] = useState<TabType>('history'); // Default to History view now
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [uploading, setUploading] = useState(false);
  const [driveLink, setDriveLink] = useState('');
  const [locatingFolder, setLocatingFolder] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedLocation, activeTab]);

  // Filter history based on search terms
  const filteredHistory = useMemo(() => {
    return history.filter(record => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        (record.itemName || '').toLowerCase().includes(term) ||
        (record.id || '').toLowerCase().includes(term) ||
        (record.machineName || '').toLowerCase().includes(term) ||
        (record.maintenancePlan || '').toLowerCase().includes(term) ||
        (record.locationId || '').toLowerCase().includes(term) ||
        (record.itemId || '').toLowerCase().includes(term);
      
      const matchesLocation = selectedLocation ? record.locationId === selectedLocation : true;

      return matchesSearch && matchesLocation;
    });
  }, [history, searchTerm, selectedLocation]);

  // Aggregate for Stock View
  const stockData = useMemo(() => {
    const map = new Map<string, {
        itemNumber: string;
        fullName: string;
        transUm: string;
        sites: Set<string>;
        sumOfQnty: number;
    }>();

    filteredHistory.forEach(h => {
        // Find master item to get Full Name and Unit
        const masterItem = items.find(i => i.id === h.itemId);
        
        if(!map.has(h.itemId)) {
            map.set(h.itemId, {
                itemNumber: h.itemId,
                // Prioritize Master Data Full Name, then Name, then History Record Name
                fullName: masterItem?.fullName || masterItem?.name || h.itemName,
                transUm: masterItem?.unit || 'EA',
                sites: new Set(),
                sumOfQnty: 0
            });
        }
        
        const entry = map.get(h.itemId)!;
        entry.sumOfQnty += h.quantity;
        entry.sites.add(h.locationId);
    });

    // Convert Set to string for display and array for map
    return Array.from(map.values()).map(x => ({
        ...x,
        sitesDisplay: Array.from(x.sites).join(', ')
    }));
  }, [filteredHistory, items]);

  const generateWorkbook = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Detailed History (Matches requested columns)
    const histHeaders = [
      "Item Number", "Sites", "G/L Date", "Full Name", "Sum of Transaction Qty", "Trans UM", "Status", "Machine", "Maint. Plan", "ID"
    ];
    const histRows = filteredHistory.map(h => {
        const loc = locations.find(l => l.id === h.locationId);
        return [
            h.itemId, 
            loc?.name || h.locationId,
            new Date(h.timestamp).toLocaleDateString(),
            h.itemName,
            h.quantity, 
            h.unit || 'pcs',
            h.status, 
            h.machineName,
            h.maintenancePlan || '', 
            h.id
        ];
    });
    const wsHist = XLSX.utils.aoa_to_sheet([histHeaders, ...histRows]);
    XLSX.utils.book_append_sheet(wb, wsHist, "Issue Tracking");

    // Sheet 2: Stock Summary
    const stockHeaders = ["Item Number", "Full Name", "Trans UM", "Sites", "Sum of Qnty"];
    const stockRows = stockData.map(s => [
        s.itemNumber,
        s.fullName,
        s.transUm,
        s.sitesDisplay,
        s.sumOfQnty
    ]);
    const wsStock = XLSX.utils.aoa_to_sheet([stockHeaders, ...stockRows]);
    XLSX.utils.book_append_sheet(wb, wsStock, "Stock Summary");

    return wb;
  };

  const downloadExcel = () => {
    const wb = generateWorkbook();
    XLSX.writeFile(wb, `Issue_Tracking_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const saveToDrive = async () => {
      const scriptUrl = localStorage.getItem('wf_script_url_v3') || DEFAULT_SCRIPT_URL;
      if (!scriptUrl) {
          alert("Web App URL not configured in Master Data settings.");
          return;
      }
      
      setUploading(true);
      setDriveLink('');
      try {
          const wb = generateWorkbook();
          const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
          const fileName = `Issue_Tracking_Report_${new Date().toISOString().slice(0,10)}.xlsx`;
          
          const url = await uploadFileToDrive(scriptUrl, fileName, wbOut);
          
          if (url) {
              setDriveLink(url);
          } else {
              setDriveLink('saved');
              alert("Backup saved to 'WareFlow Reports' folder in your Drive! Click 'Open Folder' to view it.");
          }
      } catch (e) {
          console.error(e);
          alert("Failed to upload to Drive.");
      } finally {
          setUploading(false);
      }
  };

  const openDriveFolder = async () => {
      const scriptUrl = localStorage.getItem('wf_script_url_v3') || DEFAULT_SCRIPT_URL;
      setLocatingFolder(true);
      try {
          const result = await locateRemoteData(scriptUrl);
          if (result && result.folderUrl) {
              window.open(result.folderUrl, '_blank');
          } else {
              const msg = result?.error || "Could not locate 'WareFlow Reports' folder.";
              alert(msg + "\n\nTip: Ensure you have updated the Code in Apps Script and deployed as 'New Version'.");
          }
      } catch (e) {
          console.error(e);
          alert("Failed to connect to Google Drive.");
      } finally {
          setLocatingFolder(false);
      }
  };

  // Pagination Helper
  const getPaginatedData = (data: any[]) => {
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      return data.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  };

  const renderPagination = (totalItems: number) => {
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
      if (totalPages <= 1) return null;
      return (
          <div className="flex justify-between items-center p-3 border-t bg-gray-50 text-xs mt-auto">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1 border rounded bg-white disabled:opacity-50">Previous</button>
              <span>Page {currentPage} of {totalPages} ({totalItems} records)</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1 border rounded bg-white disabled:opacity-50">Next</button>
          </div>
      );
  };

  return (
    <div className="space-y-4 font-cairo h-full flex flex-col">
      
      {/* Top Bar: Tabs & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm shrink-0">
        
        {/* Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Tracking
            </button>
            <button 
                onClick={() => setActiveTab('stock')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'stock' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Stock Summary
            </button>
        </div>

        {/* Search & Location Filter */}
        <div className="flex flex-1 w-full md:w-auto gap-3">
            <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">🔍</span>
                <input
                    type="text"
                    placeholder="Search items, ID, location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
            >
                <option value="">All Sites</option>
                {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
            </select>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
            <button onClick={openDriveFolder} disabled={locatingFolder} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-300" title="Open Drive Folder">
                {locatingFolder ? <span className="animate-spin">↻</span> : <span>📂</span>}
            </button>
            <button onClick={downloadExcel} className="p-2 text-green-700 hover:bg-green-50 rounded-lg border border-green-200 bg-green-50" title="Export Excel">
                📊 Excel
            </button>
            {driveLink && driveLink !== 'saved' ? (
               <a href={driveLink} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-700 bg-blue-50 border border-blue-200 rounded-lg font-bold">Open ↗</a>
            ) : (
               <button onClick={saveToDrive} disabled={uploading} className="p-2 text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg" title="Save to Drive">
                  {uploading ? <span className="animate-spin">↻</span> : <span>☁️</span>}
               </button>
            )}
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col min-h-0">
         
         {/* HISTORY VIEW (Issue Tracking) - Updated Columns */}
         {activeTab === 'history' && (
            <>
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left text-xs text-gray-600 border-separate border-spacing-0 whitespace-nowrap">
                        <thead className="bg-gray-50 text-gray-700 font-semibold sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-2 border-b border-gray-200 bg-gray-50">Item Number</th>
                                <th className="px-3 py-2 border-b border-gray-200 bg-gray-50">Sites</th>
                                <th className="px-3 py-2 border-b border-gray-200 bg-gray-50">G/L Date</th>
                                <th className="px-3 py-2 border-b border-gray-200 bg-gray-50">Full Name</th>
                                <th className="px-3 py-2 border-b border-gray-200 bg-gray-50 text-right">Sum of Transaction Qty</th>
                                {/* Extra Columns useful for context */}
                                <th className="px-3 py-2 border-b border-gray-200 bg-gray-50">Machine</th>
                                <th className="px-3 py-2 border-b border-gray-200 bg-gray-50">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {getPaginatedData(filteredHistory).length > 0 ? (
                                getPaginatedData(filteredHistory).map((record) => {
                                    const locationName = locations.find(l => l.id === record.locationId)?.name || record.locationId;
                                    return (
                                    <tr key={record.id} className="hover:bg-blue-50 transition">
                                        <td className="px-3 py-2 font-mono font-bold text-gray-800 border-r border-gray-100">
                                            {record.itemId}
                                        </td>
                                        <td className="px-3 py-2 text-gray-900 border-r border-gray-100">
                                            {locationName}
                                        </td>
                                        <td className="px-3 py-2 border-r border-gray-100">
                                          {new Date(record.timestamp).toLocaleDateString()}
                                        </td>
                                        <td className="px-3 py-2 text-gray-800 border-r border-gray-100">
                                            {record.itemName}
                                        </td>
                                        <td className="px-3 py-2 font-mono font-bold text-right text-blue-700 border-r border-gray-100">
                                            {record.quantity}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600 border-r border-gray-100">
                                            {record.machineName}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                                record.status === 'Completed' || record.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                                record.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {record.status}
                                            </span>
                                        </td>
                                    </tr>
                                )})
                            ) : (
                                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No records found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {renderPagination(filteredHistory.length)}
            </>
         )}

         {/* STOCK VIEW */}
         {activeTab === 'stock' && (
             <>
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left text-xs border-separate border-spacing-0 whitespace-nowrap">
                        <thead className="bg-blue-50 text-blue-900 font-bold sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-2 border-b border-blue-100">Item Number</th>
                                <th className="px-3 py-2 border-b border-blue-100">Sites</th>
                                <th className="px-3 py-2 border-b border-blue-100">Full Name</th>
                                <th className="px-3 py-2 border-b border-blue-100 text-right">Sum of Qnty</th>
                                <th className="px-3 py-2 border-b border-blue-100 text-right">Trans UM</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {getPaginatedData(stockData).length > 0 ? (
                                getPaginatedData(stockData).map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition">
                                        <td className="px-3 py-2 font-mono font-bold text-gray-700">{row.itemNumber}</td>
                                        <td className="px-3 py-2 text-gray-600">{row.sitesDisplay}</td>
                                        <td className="px-3 py-2 text-gray-800">{row.fullName}</td>
                                        <td className="px-3 py-2 text-right font-bold text-gray-900">{row.sumOfQnty}</td>
                                        <td className="px-3 py-2 text-right text-gray-500">{row.transUm}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-400">No stock data found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {renderPagination(stockData.length)}
                {stockData.length > 0 && (
                     <div className="bg-gray-50 font-bold border-t p-2 text-xs flex justify-end">
                         <span>Total Quantity (All Pages): {stockData.reduce((acc, curr) => acc + curr.sumOfQnty, 0)}</span>
                     </div>
                )}
             </>
         )}
      </div>
    </div>
  );
};

export default HistoryTable;