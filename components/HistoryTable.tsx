import React, { useState, useMemo, useEffect, useRef } from 'react';
import { IssueRecord, Location, Item, Machine } from '../types';
import * as XLSX from 'xlsx';
import { uploadFileToDrive, DEFAULT_SCRIPT_URL, locateRemoteData } from '../services/googleSheetsService';

interface HistoryTableProps {
  history: IssueRecord[];
  locations: Location[];
  items: Item[];
  machines: Machine[];
  onBulkImport: (tab: string, added: any[], updated: any[]) => void;
}

type TabType = 'requests' | 'tracking' | 'stock';

const ITEMS_PER_PAGE = 50;

const HistoryTable: React.FC<HistoryTableProps> = ({ history, locations, items, machines, onBulkImport }) => {
  const [activeTab, setActiveTab] = useState<TabType>('requests'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [uploading, setUploading] = useState(false);
  const [driveLink, setDriveLink] = useState('');
  const [locatingFolder, setLocatingFolder] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedLocation, activeTab]);

  // 1. Filtered History (Issue Requests)
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

  // 2. Filtered Stock (Current Inventory)
  const filteredStock = useMemo(() => {
      const term = searchTerm.toLowerCase();
      return items.filter(item => 
          (item.name || '').toLowerCase().includes(term) ||
          (item.id || '').toLowerCase().includes(term) ||
          (item.category || '').toLowerCase().includes(term) ||
          (item.partNumber || '').toLowerCase().includes(term) ||
          (item.modelNo || '').toLowerCase().includes(term)
      );
  }, [items, searchTerm]);

  // 3. Aggregate for Inventory Tracking (Consumption/Usage)
  const trackingData = useMemo(() => {
    const map = new Map<string, {
        itemNumber: string;
        fullName: string;
        transUm: string;
        sites: Set<string>;
        sumOfQnty: number;
        currentStock: number;
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
                sumOfQnty: 0,
                currentStock: masterItem?.stockQuantity || 0
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

  // --- EXPORT LOGIC PER TAB ---
  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    let filename = '';

    if (activeTab === 'requests') {
        const headers = ["ID", "Date", "Location", "Item ID", "Item Name", "Qty", "Unit", "Machine", "Status", "Maint. Plan"];
        const rows = filteredHistory.map(h => [
            h.id, 
            new Date(h.timestamp).toLocaleDateString(), 
            h.locationId, 
            h.itemId, 
            h.itemName, 
            h.quantity, 
            h.unit || 'pcs', 
            h.machineName, 
            h.status, 
            h.maintenancePlan || ''
        ]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        XLSX.utils.book_append_sheet(wb, ws, "Issue Requests");
        filename = `Issue_Requests_${new Date().toISOString().slice(0,10)}.xlsx`;
    } else if (activeTab === 'stock') {
        const headers = ["Item Number", "Description", "Category", "Part No", "Model No", "Unit", "Current Stock"];
        const rows = filteredStock.map(i => [
            i.id, i.name, i.category, i.partNumber || '', i.modelNo || '', i.unit, i.stockQuantity || 0
        ]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        XLSX.utils.book_append_sheet(wb, ws, "Current Stock");
        filename = `Current_Stock_${new Date().toISOString().slice(0,10)}.xlsx`;
    } else if (activeTab === 'tracking') {
        const headers = ["Item Number", "Full Name", "Trans UM", "Sites", "Sum of Transaction Qty", "Current Stock"];
        const rows = trackingData.map(s => [
            s.itemNumber, s.fullName, s.transUm, s.sitesDisplay, s.sumOfQnty, s.currentStock
        ]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        XLSX.utils.book_append_sheet(wb, ws, "Tracking");
        filename = `Inventory_Tracking_${new Date().toISOString().slice(0,10)}.xlsx`;
    }

    XLSX.writeFile(wb, filename);
  };

  // --- IMPORT LOGIC PER TAB ---
  const handleImportClick = () => {
      if (activeTab === 'tracking') {
          alert("Import is not available for Tracking view. Please import data into 'Issue Requests' or 'Current Stock'.");
          return;
      }
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          const bstr = evt.target?.result;
          try {
              const wb = XLSX.read(bstr, { type: 'binary' });
              const ws = wb.Sheets[wb.SheetNames[0]];
              const data = XLSX.utils.sheet_to_json(ws) as any[];

              if (data.length === 0) { alert("File is empty."); return; }

              const toAdd: any[] = [];
              const toUpdate: any[] = [];

              if (activeTab === 'requests') {
                  // Import History
                  data.forEach(row => {
                      // Normalize keys
                      const normRow: any = {};
                      Object.keys(row).forEach(k => normRow[k.toLowerCase().replace(/[\s-_.]/g, '')] = row[k]);
                      
                      const id = String(normRow['id'] || `IMP-${Date.now()}-${Math.random().toString(36).substr(2,5)}`);
                      const itemId = String(normRow['itemid'] || normRow['itemnumber'] || normRow['itemcode'] || '');
                      const qty = Number(normRow['qty'] || normRow['quantity'] || 0);
                      
                      if (itemId && qty) {
                          const existing = history.find(h => h.id === id);
                          const record: any = {
                              id,
                              timestamp: normRow['date'] ? new Date(normRow['date']).toISOString() : new Date().toISOString(),
                              locationId: String(normRow['location'] || normRow['locationid'] || 'Unknown'),
                              itemId: itemId,
                              itemName: String(normRow['itemname'] || normRow['name'] || items.find(i => i.id === itemId)?.name || 'Unknown Item'),
                              quantity: qty,
                              unit: String(normRow['unit'] || 'pcs'),
                              machineName: String(normRow['machine'] || normRow['machinename'] || 'Unknown'),
                              machineId: String(normRow['machineid'] || 'Unknown'),
                              status: String(normRow['status'] || 'Completed'),
                              maintenancePlan: String(normRow['plan'] || normRow['maintplan'] || '')
                          };
                          
                          if (existing) toUpdate.push(record);
                          else toAdd.push(record);
                      }
                  });
                  onBulkImport('history', toAdd, toUpdate);
                  alert(`Imported ${toAdd.length} new requests, updated ${toUpdate.length}.`);

              } else if (activeTab === 'stock') {
                  // Import Items (Update Stock)
                  data.forEach(row => {
                      const normRow: any = {};
                      Object.keys(row).forEach(k => normRow[k.toLowerCase().replace(/[\s-_.]/g, '')] = row[k]);
                      
                      const id = String(normRow['id'] || normRow['itemnumber'] || normRow['itemcode'] || '');
                      if (id) {
                          const existing = items.find(i => i.id === id);
                          if (existing) {
                              const updatedItem = { ...existing };
                              if (normRow['stockqty'] !== undefined) updatedItem.stockQuantity = Number(normRow['stockqty']);
                              if (normRow['name'] || normRow['description']) updatedItem.name = String(normRow['name'] || normRow['description']);
                              toUpdate.push(updatedItem);
                          } else {
                              toAdd.push({
                                  id: id,
                                  name: String(normRow['name'] || normRow['description'] || 'New Item'),
                                  stockQuantity: Number(normRow['stockqty'] || 0),
                                  unit: String(normRow['unit'] || 'pcs'),
                                  category: String(normRow['category'] || 'General')
                              });
                          }
                      }
                  });
                  onBulkImport('items', toAdd, toUpdate);
                  alert(`Imported ${toAdd.length} new items, updated ${toUpdate.length}.`);
              }

          } catch (err) {
              console.error(err);
              alert("Failed to process file.");
          }
      };
      reader.readAsBinaryString(file);
      e.target.value = '';
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
        <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto">
            <button 
                onClick={() => setActiveTab('requests')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'requests' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Issue Requests
            </button>
            <button 
                onClick={() => setActiveTab('stock')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'stock' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Current Stock
            </button>
            <button 
                onClick={() => setActiveTab('tracking')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'tracking' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Inventory Tracking
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
            {activeTab !== 'stock' && (
                <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 max-w-[150px]"
                >
                    <option value="">All Sites</option>
                    {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                </select>
            )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
            <button onClick={handleExport} className="px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-bold hover:bg-green-100 flex items-center gap-2">
                <span>📊</span> Export Excel
            </button>
            {activeTab !== 'tracking' && (
                <>
                    <button onClick={handleImportClick} className="px-3 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-sm font-bold hover:bg-orange-100 flex items-center gap-2">
                        <span>📂</span> Import Excel
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.csv" onChange={handleFileChange} />
                </>
            )}
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col min-h-0">
         
         {/* TAB 1: ISSUE REQUESTS VIEW (History Log) */}
         {activeTab === 'requests' && (
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
                                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No requests found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {renderPagination(filteredHistory.length)}
            </>
         )}

         {/* TAB 2: CURRENT STOCK VIEW (New) */}
         {activeTab === 'stock' && (
             <>
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left text-xs border-separate border-spacing-0 whitespace-nowrap">
                        <thead className="bg-green-50 text-green-900 font-bold sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-2 border-b border-green-100">Item Number</th>
                                <th className="px-3 py-2 border-b border-green-100">Description</th>
                                <th className="px-3 py-2 border-b border-green-100">Category</th>
                                <th className="px-3 py-2 border-b border-green-100">Part No / Model</th>
                                <th className="px-3 py-2 border-b border-green-100 text-right">Current Stock</th>
                                <th className="px-3 py-2 border-b border-green-100 text-center">Unit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {getPaginatedData(filteredStock).length > 0 ? (
                                getPaginatedData(filteredStock).map((item) => (
                                    <tr key={item.id} className="hover:bg-green-50 transition">
                                        <td className="px-3 py-2 font-mono font-bold text-gray-700 border-r border-gray-50">{item.id}</td>
                                        <td className="px-3 py-2 text-gray-800 border-r border-gray-50">{item.name}</td>
                                        <td className="px-3 py-2 text-gray-600 border-r border-gray-50">{item.category}</td>
                                        <td className="px-3 py-2 text-gray-500 border-r border-gray-50">
                                            {item.partNumber && <span>PN: {item.partNumber}</span>}
                                            {item.partNumber && item.modelNo && <span className="mx-1">|</span>}
                                            {item.modelNo && <span>Model: {item.modelNo}</span>}
                                        </td>
                                        <td className="px-3 py-2 text-right font-bold text-green-700 bg-green-50/30 border-r border-gray-50">
                                            {item.stockQuantity || 0}
                                        </td>
                                        <td className="px-3 py-2 text-center text-gray-500">{item.unit}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400">No items found matching filter.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {renderPagination(filteredStock.length)}
             </>
         )}

         {/* TAB 3: INVENTORY TRACKING VIEW (Aggregated Usage) */}
         {activeTab === 'tracking' && (
             <>
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left text-xs border-separate border-spacing-0 whitespace-nowrap">
                        <thead className="bg-orange-50 text-orange-900 font-bold sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-2 border-b border-orange-100">Item Number</th>
                                <th className="px-3 py-2 border-b border-orange-100">Sites</th>
                                <th className="px-3 py-2 border-b border-orange-100">Full Name</th>
                                <th className="px-3 py-2 border-b border-orange-100 text-right">Sum of Transaction Qty</th>
                                <th className="px-3 py-2 border-b border-orange-100 text-right">Current Stock</th>
                                <th className="px-3 py-2 border-b border-orange-100 text-right">Trans UM</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {getPaginatedData(trackingData).length > 0 ? (
                                getPaginatedData(trackingData).map((row, idx) => (
                                    <tr key={idx} className="hover:bg-orange-50 transition">
                                        <td className="px-3 py-2 font-mono font-bold text-gray-700">{row.itemNumber}</td>
                                        <td className="px-3 py-2 text-gray-600">{row.sitesDisplay}</td>
                                        <td className="px-3 py-2 text-gray-800">{row.fullName}</td>
                                        <td className="px-3 py-2 text-right font-bold text-gray-900">{row.sumOfQnty}</td>
                                        <td className="px-3 py-2 text-right font-mono text-gray-600">{row.currentStock}</td>
                                        <td className="px-3 py-2 text-right text-gray-500">{row.transUm}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400">No tracking data found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {renderPagination(trackingData.length)}
                {trackingData.length > 0 && (
                     <div className="bg-gray-50 font-bold border-t p-2 text-xs flex justify-end">
                         <span>Total Quantity (All Pages): {trackingData.reduce((acc, curr) => acc + curr.sumOfQnty, 0)}</span>
                     </div>
                )}
             </>
         )}
      </div>
    </div>
  );
};

export default HistoryTable;