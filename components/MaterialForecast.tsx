
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Item, Location, Sector, Division, ForecastPeriod, ForecastRecord, IssueRecord, User } from '../types';
import SearchableSelect from './SearchableSelect';
import * as XLSX from 'xlsx';

interface MaterialForecastProps {
  items: Item[];
  locations: Location[];
  sectors: Sector[];
  divisions: Division[];
  history: IssueRecord[];
  
  forecastPeriods: ForecastPeriod[];
  onAddPeriod: (period: ForecastPeriod) => void;
  onUpdatePeriod: (period: ForecastPeriod) => void;
  
  forecastRecords: ForecastRecord[];
  onUpdateForecast: (records: ForecastRecord[]) => void;
  
  currentUser: User;
}

type Tab = 'entry' | 'hub' | 'analytics' | 'admin';

const ITEMS_PER_PAGE = 50;

const MaterialForecast: React.FC<MaterialForecastProps> = ({
  items, locations, sectors, divisions, history,
  forecastPeriods, onAddPeriod, onUpdatePeriod,
  forecastRecords, onUpdateForecast, currentUser
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('entry');
  
  // -- ENTRY FORM STATE --
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // -- ENTRY FORM: REFERENCE HISTORY STATE --
  const [refStartDate, setRefStartDate] = useState('');
  const [refEndDate, setRefEndDate] = useState('');

  // Temp state for editing quantities in the grid
  const [editBuffer, setEditBuffer] = useState<Record<string, number>>({});
  const [entryPage, setEntryPage] = useState(1);

  // -- HUB / ANALYTICS FILTERS --
  const [hubPeriod, setHubPeriod] = useState('');
  const [hubLocation, setHubLocation] = useState('');
  const [hubSector, setHubSector] = useState('');
  const [hubDivision, setHubDivision] = useState('');
  const [hubSearch, setHubSearch] = useState('');
  const [hubPage, setHubPage] = useState(1);
  
  // -- NEW: Custom Date Range for Actuals (Analytics Tab) --
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // -- ADMIN STATE --
  const [newPeriod, setNewPeriod] = useState<Partial<ForecastPeriod>>({ status: 'Open' });

  // -- REFS --
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const periodFileInputRef = useRef<HTMLInputElement>(null); // New ref for period import

  // Reset pagination when filters change
  useEffect(() => { setEntryPage(1); }, [selectedLocation, selectedSector, selectedDivision, selectedPeriodId, searchTerm]);
  useEffect(() => { setHubPage(1); }, [hubPeriod, hubLocation, hubSector, hubDivision, hubSearch, activeTab, customStartDate, customEndDate]);

  // -- HELPERS --
  const currentPeriod = forecastPeriods.find(p => p.id === selectedPeriodId);
  const isPeriodClosed = currentPeriod?.status === 'Closed';
  const canEdit = currentUser.role === 'admin' || (!isPeriodClosed && !!selectedPeriodId);

  // Filtered Divisions based on Sector (Entry)
  const filteredDivisions = useMemo(() => {
      return divisions.filter(d => d.sectorId === selectedSector);
  }, [divisions, selectedSector]);

  // Filtered Divisions based on Hub Sector
  const hubFilteredDivisions = useMemo(() => {
      return divisions.filter(d => d.sectorId === hubSector);
  }, [divisions, hubSector]);

  // Filtered Forecast Records for Entry View (Specific to current Period)
  const entryRecords = useMemo(() => {
      if (!selectedLocation || !selectedSector || !selectedDivision || !selectedPeriodId) return [];
      return forecastRecords.filter(r => 
          r.locationId === selectedLocation && 
          r.sectorId === selectedSector && 
          r.divisionId === selectedDivision &&
          r.periodId === selectedPeriodId
      );
  }, [forecastRecords, selectedLocation, selectedSector, selectedDivision, selectedPeriodId]);

  // -- CALCULATE REFERENCE HISTORY (Optimized Lookup) --
  const referenceHistoryMap = useMemo(() => {
      if (!refStartDate || !refEndDate || !selectedLocation) return new Map<string, number>();

      const start = new Date(refStartDate).getTime();
      const end = new Date(refEndDate).getTime() + (24 * 60 * 60 * 1000) - 1; // End of day

      const map = new Map<string, number>();

      // Filter history for the selected location and date range
      history.forEach(h => {
          if (h.locationId !== selectedLocation) return;
          const t = new Date(h.timestamp).getTime();
          if (t >= start && t <= end) {
              const current = map.get(h.itemId) || 0;
              map.set(h.itemId, current + h.quantity);
          }
      });
      return map;
  }, [history, selectedLocation, refStartDate, refEndDate]);

  // Items List for Entry (Merged with existing forecasts and Reference Data)
  const itemsForEntry = useMemo(() => {
      return items.filter(i => 
          ((i.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
           (i.id || '').toLowerCase().includes(searchTerm.toLowerCase()))
      ).map(item => {
          const existing = entryRecords.find(r => r.itemId === item.id);
          const refQty = referenceHistoryMap.get(item.id) || 0;
          return {
              ...item,
              forecastQty: editBuffer[item.id] ?? existing?.quantity ?? 0,
              referenceQty: refQty
          };
      });
  }, [items, searchTerm, entryRecords, editBuffer, referenceHistoryMap]);

  const paginatedEntryItems = useMemo(() => {
      const start = (entryPage - 1) * ITEMS_PER_PAGE;
      return itemsForEntry.slice(start, start + ITEMS_PER_PAGE);
  }, [itemsForEntry, entryPage]);

  // -- HANDLERS --

  const handleQtyChange = (itemId: string, val: string) => {
      const num = parseInt(val) || 0;
      setEditBuffer(prev => ({ ...prev, [itemId]: num }));
  };

  const handleSaveForecast = () => {
      if (!selectedLocation || !selectedSector || !selectedDivision || !selectedPeriodId) {
          alert("Please select Location, Sector, Division, and Period.");
          return;
      }
      
      const newRecords: ForecastRecord[] = [];
      const timestamp = new Date().toISOString();

      // Get IDs from buffer
      Object.keys(editBuffer).forEach(itemId => {
          const qty = editBuffer[itemId];
          if (qty >= 0) {
              const id = `${selectedLocation}-${selectedDivision}-${itemId}-${selectedPeriodId}`;
              newRecords.push({
                  id,
                  locationId: selectedLocation,
                  sectorId: selectedSector,
                  divisionId: selectedDivision,
                  periodId: selectedPeriodId,
                  itemId,
                  quantity: qty,
                  lastUpdated: timestamp,
                  updatedBy: currentUser.username
              });
          }
      });

      // Let's create a map of ALL items for this specific view context
      const existingMap = new Map(entryRecords.map(r => [r.itemId, r]));
      
      Object.keys(editBuffer).forEach(itemId => {
          const qty = editBuffer[itemId];
          const id = `${selectedLocation}-${selectedDivision}-${itemId}-${selectedPeriodId}`;
          if (qty > 0) {
              existingMap.set(itemId, {
                  id,
                  locationId: selectedLocation,
                  sectorId: selectedSector,
                  divisionId: selectedDivision,
                  periodId: selectedPeriodId,
                  itemId,
                  quantity: qty,
                  lastUpdated: timestamp,
                  updatedBy: currentUser.username
              });
          } else {
              // If 0, remove it
              existingMap.delete(itemId);
          }
      });

      const updatedSubset = Array.from(existingMap.values());
      
      // Remove OLD records for this context from master list
      const otherRecords = forecastRecords.filter(r => 
          !(r.locationId === selectedLocation && 
            r.divisionId === selectedDivision &&
            r.periodId === selectedPeriodId)
      );

      onUpdateForecast([...otherRecords, ...updatedSubset]);
      setEditBuffer({});
      alert("Forecast Saved Successfully!");
  };

  const handleAddPeriod = () => {
      if (!newPeriod.id || !newPeriod.name || !newPeriod.startDate || !newPeriod.endDate) {
          alert("Fill all period fields");
          return;
      }
      onAddPeriod(newPeriod as ForecastPeriod);
      setNewPeriod({ status: 'Open' });
  };

  // --- ENTRY TEMPLATE & IMPORT ---
  const handleDownloadTemplate = () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
          ["Item Code", "Quantity", "Item Name (Ref Only)"], 
          ["ITM-001", 100, "Ball Bearing"], 
          ["ITM-002", 50, "Hydraulic Fluid"]
      ]);
      XLSX.utils.book_append_sheet(wb, ws, "Forecast_Template");
      XLSX.writeFile(wb, "Forecast_Entry_Template.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!canEdit) {
          alert("Period is closed or not selected. Cannot upload.");
          return;
      }
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          const bstr = evt.target?.result;
          try {
              const wb = XLSX.read(bstr, { type: 'binary' });
              const wsname = wb.SheetNames[0];
              const ws = wb.Sheets[wsname];
              const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

              if (data.length < 2) { 
                  alert("File appears empty."); 
                  return; 
              }

              const headers = data[0].map(h => String(h).toLowerCase().trim());
              const idIdx = headers.findIndex(h => h.includes('item') || h.includes('code'));
              const qtyIdx = headers.findIndex(h => h.includes('qty') || h.includes('quantity'));

              if (idIdx === -1 || qtyIdx === -1) {
                  alert("Could not find 'Item Code' or 'Quantity' columns.");
                  return;
              }

              const newBuffer = { ...editBuffer };
              let count = 0;
              let missing = 0;

              for (let i = 1; i < data.length; i++) {
                  const row = data[i];
                  if (!row || row.length === 0) continue;
                  
                  const rawId = row[idIdx];
                  const rawQty = row[qtyIdx];

                  if (rawId !== undefined && rawQty !== undefined) {
                      const id = String(rawId).trim();
                      const qty = Number(rawQty);
                      
                      if (items.some(it => it.id === id)) {
                          if (qty >= 0) {
                              newBuffer[id] = qty;
                              count++;
                          }
                      } else {
                          missing++;
                      }
                  }
              }
              
              setEditBuffer(newBuffer);
              alert(`Import Successful!\nUpdated ${count} items.\n${missing > 0 ? `Skipped ${missing} items not found in Master Data.` : ''}`);

          } catch (err) {
              console.error(err);
              alert("Failed to parse Excel file.");
          }
      };
      reader.readAsBinaryString(file);
      e.target.value = ''; // Reset
  };

  // --- HUB BULK TEMPLATE & IMPORT ---
  const handleBulkTemplate = () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
          ["Period ID", "Location ID", "Sector ID", "Division ID", "Item Code", "Quantity"], 
          ["2025-P1", "WH-001", "SEC-001", "DIV-001", "ITM-001", 100], 
          ["2025-P1", "WH-001", "SEC-001", "DIV-001", "ITM-002", 50]
      ]);
      XLSX.utils.book_append_sheet(wb, ws, "Bulk_Forecast");
      XLSX.writeFile(wb, "Bulk_Forecast_Upload_Template.xlsx");
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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

              const newRecords: ForecastRecord[] = [];
              const timestamp = new Date().toISOString();
              let count = 0;
              let errors = 0;

              data.forEach(row => {
                  // Normalize keys to allow case-insensitivity
                  const normRow: any = {};
                  Object.keys(row).forEach(k => normRow[k.toLowerCase().replace(/[\s-_]/g, '')] = row[k]);

                  const pId = String(normRow['periodid'] || normRow['period'] || '').trim();
                  const lId = String(normRow['locationid'] || normRow['location'] || '').trim();
                  const sId = String(normRow['sectorid'] || normRow['sector'] || '').trim();
                  const dId = String(normRow['divisionid'] || normRow['division'] || '').trim();
                  const iId = String(normRow['itemcode'] || normRow['itemid'] || '').trim();
                  const qty = Number(normRow['quantity'] || normRow['qty'] || 0);

                  if (pId && lId && sId && dId && iId && qty >= 0) {
                      // Verify existence
                      const itemExists = items.some(i => i.id === iId);
                      const locExists = locations.some(l => l.id === lId);
                      
                      if (itemExists && locExists) {
                          newRecords.push({
                              id: `${lId}-${dId}-${iId}-${pId}`,
                              periodId: pId,
                              locationId: lId,
                              sectorId: sId,
                              divisionId: dId,
                              itemId: iId,
                              quantity: qty,
                              lastUpdated: timestamp,
                              updatedBy: currentUser.username
                          });
                          count++;
                      } else {
                          errors++;
                      }
                  } else {
                      errors++;
                  }
              });

              if (count > 0) {
                  onUpdateForecast(newRecords); // This merges in App.tsx
                  alert(`Bulk Import Successful!\nImported/Updated: ${count} records.\nSkipped/Invalid: ${errors}`);
              } else {
                  alert("No valid records found. Check IDs and try again.");
              }

          } catch (err) {
              console.error(err);
              alert("Failed to process file.");
          }
      };
      reader.readAsBinaryString(file);
      e.target.value = '';
  };

  // --- PERIOD IMPORT / EXPORT HANDLERS ---
  const handlePeriodTemplate = () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
          ["Period ID", "Period Name", "Start Date (YYYY-MM-DD)", "End Date (YYYY-MM-DD)", "Status"], 
          ["2025-P2", "P2 2025 (Feb-May)", "2025-02-01", "2025-05-31", "Open"],
          ["2025-P3", "P3 2025 (Jun-Sep)", "2025-06-01", "2025-09-30", "Closed"]
      ]);
      XLSX.utils.book_append_sheet(wb, ws, "Periods");
      XLSX.writeFile(wb, "Period_Management_Template.xlsx");
  };

  const handlePeriodExport = () => {
      const wb = XLSX.utils.book_new();
      const rows = forecastPeriods.map(p => ({
          "Period ID": p.id,
          "Period Name": p.name,
          "Start Date": p.startDate,
          "End Date": p.endDate,
          "Status": p.status
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Periods");
      XLSX.writeFile(wb, "Forecast_Periods.xlsx");
  };

  const handlePeriodImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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

              let added = 0;
              let updated = 0;

              data.forEach(row => {
                  // Normalize keys
                  const normRow: any = {};
                  Object.keys(row).forEach(k => normRow[k.toLowerCase().replace(/[\s-_]/g, '')] = row[k]);

                  const id = String(normRow['periodid'] || normRow['id'] || '').trim();
                  const name = String(normRow['periodname'] || normRow['name'] || '').trim();
                  const start = String(normRow['startdate'] || normRow['start'] || '').trim();
                  const end = String(normRow['enddate'] || normRow['end'] || '').trim();
                  let status: 'Open' | 'Closed' = 'Open';
                  
                  const rawStatus = String(normRow['status'] || '').toLowerCase();
                  if (rawStatus === 'closed') status = 'Closed';

                  if (id && name && start && end) {
                      const newPeriod: ForecastPeriod = { id, name, startDate: start, endDate: end, status };
                      const exists = forecastPeriods.find(p => p.id === id);
                      
                      if (exists) {
                          onUpdatePeriod(newPeriod);
                          updated++;
                      } else {
                          onAddPeriod(newPeriod);
                          added++;
                      }
                  }
              });

              alert(`Period Import Complete.\nAdded: ${added}\nUpdated: ${updated}`);

          } catch (err) {
              console.error(err);
              alert("Failed to parse file.");
          }
      };
      reader.readAsBinaryString(file);
      e.target.value = '';
  };

  // -- ANALYTICS CALCULATION (Optimized) --
  const analyticsData = useMemo(() => {
      // 1. Filter raw records based on Hub Context Filters
      const contextRecords = forecastRecords.filter(r => {
          if (hubLocation && r.locationId !== hubLocation) return false;
          if (hubSector && r.sectorId !== hubSector) return false;
          if (hubDivision && r.divisionId !== hubDivision) return false;
          return true;
      });

      // 2. Pre-process history into a lookup map for faster access
      // Key: `${locationId}|${itemId}` -> Array of Issues
      const historyLookup = new Map<string, IssueRecord[]>();
      history.forEach(h => {
          // Optimization: Only index relevant history if possible, but location check is fast enough here
          if (hubLocation && h.locationId !== hubLocation) return;
          
          const key = `${h.locationId}|${h.itemId}`;
          if (!historyLookup.has(key)) historyLookup.set(key, []);
          historyLookup.get(key)!.push(h);
      });

      // 3. Calculate Global Totals per Item/Location
      const globalTotals = new Map<string, number>();
      contextRecords.forEach(r => {
          const key = `${r.locationId}|${r.itemId}`;
          globalTotals.set(key, (globalTotals.get(key) || 0) + r.quantity);
      });

      // 4. Group by Location/Item/Period
      const aggregation = new Map<string, {
          key: string;
          locationId: string;
          periodId: string;
          itemId: string;
          forecastQty: number;
      }>();

      contextRecords.forEach(r => {
          const key = `${r.locationId}|${r.itemId}|${r.periodId}`;
          const current = aggregation.get(key) || { key, locationId: r.locationId, periodId: r.periodId, itemId: r.itemId, forecastQty: 0 };
          current.forecastQty += r.quantity;
          aggregation.set(key, current);
      });

      // 5. Finalize Rows with History Lookup
      const results = Array.from(aggregation.values()).map(row => {
          const period = forecastPeriods.find(p => p.id === row.periodId);
          let issuedQty = 0;
          
          if (period) {
              let start = new Date(period.startDate).getTime();
              let end = new Date(period.endDate).getTime();
              
              // NEW: Override with custom dates if provided
              if (customStartDate && customEndDate) {
                  start = new Date(customStartDate).getTime();
                  end = new Date(customEndDate).getTime();
                  // Ensure end date covers the full day
                  end += (24 * 60 * 60 * 1000) - 1; 
              }

              // FAST LOOKUP
              const issues = historyLookup.get(`${row.locationId}|${row.itemId}`) || [];
              
              // Filter mostly by time now, since location/item match is guaranteed by lookup key
              issuedQty = issues.reduce((sum, h) => {
                  const t = new Date(h.timestamp).getTime();
                  if (t >= start && t <= end) return sum + h.quantity;
                  return sum;
              }, 0);
          }

          const variance = row.forecastQty - issuedQty;
          let status = 'Exact Issue';
          
          const now = Date.now();
          const isPeriodEnded = period ? now > new Date(period.endDate).getTime() : false;

          if (issuedQty === 0 && isPeriodEnded) status = 'No Issue';
          else if (issuedQty > row.forecastQty) status = 'Over-Issue';
          else if (issuedQty < row.forecastQty) status = 'Under-Issue';
          
          const itemDef = items.find(i => i.id === row.itemId);
          const grandTotal = globalTotals.get(`${row.locationId}|${row.itemId}`) || 0;

          return {
              ...row,
              itemName: itemDef?.name || 'Unknown',
              itemUnit: itemDef?.unit || '',
              issuedQty,
              variance,
              status,
              grandTotal
          };
      });

      return results;
  }, [forecastRecords, history, forecastPeriods, items, hubLocation, hubSector, hubDivision, customStartDate, customEndDate]);

  const filteredAnalytics = useMemo(() => {
      return analyticsData.filter(row => {
          if (hubPeriod && row.periodId !== hubPeriod) return false;
          if (hubSearch) {
              const search = hubSearch.toLowerCase();
              return (
                  row.itemId.toLowerCase().includes(search) || 
                  row.itemName.toLowerCase().includes(search)
              );
          }
          return true;
      });
  }, [analyticsData, hubPeriod, hubSearch]);

  const paginatedHubRows = useMemo(() => {
      const start = (hubPage - 1) * ITEMS_PER_PAGE;
      return filteredAnalytics.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAnalytics, hubPage]);

  const exportAnalytics = () => {
      const ws = XLSX.utils.json_to_sheet(filteredAnalytics);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Forecast_Variance");
      XLSX.writeFile(wb, "Forecast_Variance_Analysis.xlsx");
  };

  const renderPaginationControls = (totalItems: number, page: number, setPage: (p: number) => void) => {
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
      if (totalPages <= 1) return null;
      return (
          <div className="flex justify-between items-center p-3 border-t bg-gray-50 text-xs mt-auto sticky bottom-0">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded bg-white disabled:opacity-50 hover:bg-gray-100">Previous</button>
              <span>Page {page} of {totalPages} ({totalItems} records)</span>
              <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded bg-white disabled:opacity-50 hover:bg-gray-100">Next</button>
          </div>
      );
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in-up font-cairo">
        {/* Header Tabs */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center shrink-0">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span>🔮</span> Material Forecasting
            </h2>
            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg overflow-x-auto">
                <button onClick={() => setActiveTab('entry')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'entry' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Entry Form</button>
                <button onClick={() => setActiveTab('hub')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'hub' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Aggregation Hub</button>
                <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'analytics' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Variance Analysis</button>
                {currentUser.role === 'admin' && (
                    <button onClick={() => setActiveTab('admin')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'admin' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Period Settings</button>
                )}
            </div>
        </div>

        {/* --- VIEW: ENTRY FORM --- */}
        {activeTab === 'entry' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden min-h-0">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 shrink-0">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">1. Location</label>
                        <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="w-full border rounded p-2 text-sm">
                            <option value="">Select Location</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">2. Sector</label>
                        <select value={selectedSector} onChange={(e) => {setSelectedSector(e.target.value); setSelectedDivision('');}} className="w-full border rounded p-2 text-sm">
                            <option value="">Select Sector</option>
                            {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">3. Division</label>
                        <select value={selectedDivision} onChange={(e) => setSelectedDivision(e.target.value)} disabled={!selectedSector} className="w-full border rounded p-2 text-sm">
                            <option value="">Select Division</option>
                            {filteredDivisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">4. Forecast Period</label>
                        <select value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)} className="w-full border rounded p-2 text-sm font-bold text-blue-700">
                            <option value="">Select Slot</option>
                            {forecastPeriods.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Reference History Section (NEW) */}
                <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded shrink-0">
                    <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Reference Data (Actual Usage)</label>
                    <div className="flex flex-wrap items-center gap-2">
                        <input 
                            type="date" 
                            value={refStartDate} 
                            onChange={(e) => setRefStartDate(e.target.value)} 
                            className="border rounded px-2 py-1 text-sm text-gray-700"
                            title="Reference Start Date"
                        />
                        <span className="text-gray-400">→</span>
                        <input 
                            type="date" 
                            value={refEndDate} 
                            onChange={(e) => setRefEndDate(e.target.value)} 
                            className="border rounded px-2 py-1 text-sm text-gray-700"
                            title="Reference End Date"
                        />
                        <span className="text-xs text-gray-500 ml-2 italic">Select date range to see past consumption.</span>
                        {(refStartDate || refEndDate) && (
                            <button 
                                onClick={() => {setRefStartDate(''); setRefEndDate('');}}
                                className="text-xs text-red-600 hover:underline font-bold ml-auto"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Status Banner */}
                {selectedPeriodId && (
                    <div className={`p-2 mb-4 rounded text-center text-sm font-bold shrink-0 ${isPeriodClosed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {isPeriodClosed ? '🔒 PERIOD CLOSED - Read Only' : '🔓 PERIOD OPEN - Editing Enabled'}
                    </div>
                )}

                {/* Items Grid Actions */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-4 shrink-0">
                    <div className="w-full md:flex-1">
                        <input type="text" placeholder="Search Item Code or Name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleDownloadTemplate} className="px-3 py-2 bg-gray-100 text-gray-700 rounded text-xs font-bold hover:bg-gray-200 border border-gray-300 flex items-center gap-1">
                            <span>⬇️</span> Template
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} disabled={!canEdit} className={`px-3 py-2 bg-green-50 text-green-700 rounded text-xs font-bold hover:bg-green-100 border border-green-200 flex items-center gap-1 ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <span>📂</span> Upload Excel
                        </button>
                        <input type="file" ref={fileInputRef} hidden accept=".xlsx,.xls,.csv" onChange={handleImportExcel} />
                    </div>
                </div>
                
                <div className="flex-1 overflow-auto border rounded relative">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 text-gray-700 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3 border-b">Item Code</th>
                                <th className="p-3 border-b">Item Name</th>
                                <th className="p-3 border-b">Part No</th>
                                <th className="p-3 border-b">Unit</th>
                                <th className={`p-3 border-b text-center ${refStartDate && refEndDate ? 'bg-yellow-50 text-yellow-800' : 'text-gray-400'}`}>Actual Usage (Ref)</th>
                                <th className="p-3 border-b text-center bg-blue-50">Forecast Qty</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(!selectedLocation || !selectedDivision || !selectedPeriodId) ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Select all hierarchy fields above to load items.</td></tr>
                            ) : paginatedEntryItems.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400">No items match search.</td></tr>
                            ) : (
                                paginatedEntryItems.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50 border-b border-gray-100">
                                        <td className="p-3 font-mono text-gray-600">{item.id}</td>
                                        <td className="p-3 font-medium text-gray-800">{item.name}</td>
                                        <td className="p-3 text-gray-500">{item.partNumber || '-'}</td>
                                        <td className="p-3 text-gray-500">{item.unit}</td>
                                        <td className={`p-3 text-center font-bold border-l border-r ${refStartDate && refEndDate ? 'bg-yellow-50 text-gray-700' : 'text-gray-300'}`}>
                                            {item.referenceQty}
                                        </td>
                                        <td className="p-2 text-center bg-blue-50/30">
                                            <input 
                                                type="number" 
                                                min="0"
                                                disabled={!canEdit}
                                                value={item.forecastQty}
                                                onChange={(e) => handleQtyChange(item.id, e.target.value)}
                                                className="w-24 p-1 border border-blue-200 rounded text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {renderPaginationControls(itemsForEntry.length, entryPage, setEntryPage)}

                {/* Footer Save */}
                <div className="pt-4 border-t mt-4 flex justify-end shrink-0">
                    <button 
                        onClick={handleSaveForecast} 
                        disabled={!canEdit || Object.keys(editBuffer).length === 0}
                        className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        )}

        {/* --- VIEW: HUB & ANALYTICS (Merged visual style) --- */}
        {(activeTab === 'hub' || activeTab === 'analytics') && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden min-h-0">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-4 gap-4 shrink-0">
                    <div className="flex-1 w-full">
                        <h3 className="font-bold text-gray-700 mb-3">
                            {activeTab === 'hub' ? 'Aggregated Demand (Hub)' : 'Forecast vs. Actuals'}
                        </h3>
                        {/* Filters for Hub/Analytics */}
                        <div className="flex flex-wrap gap-2 items-center">
                            <select value={hubPeriod} onChange={(e) => setHubPeriod(e.target.value)} className="border rounded p-2 text-sm bg-gray-50 w-32">
                                <option value="">All Periods</option>
                                {forecastPeriods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <select value={hubLocation} onChange={(e) => setHubLocation(e.target.value)} className="border rounded p-2 text-sm bg-gray-50 w-36">
                                <option value="">All Locations</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                            <select value={hubSector} onChange={(e) => {setHubSector(e.target.value); setHubDivision('');}} className="border rounded p-2 text-sm bg-gray-50 w-36">
                                <option value="">All Sectors</option>
                                {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <select value={hubDivision} onChange={(e) => setHubDivision(e.target.value)} disabled={!hubSector} className="border rounded p-2 text-sm bg-gray-50 w-36">
                                <option value="">All Divisions</option>
                                {hubFilteredDivisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <input 
                                type="text" 
                                placeholder="Filter items..." 
                                value={hubSearch} 
                                onChange={(e) => setHubSearch(e.target.value)} 
                                className="border rounded p-2 text-sm w-40"
                            />
                        </div>
                        {/* NEW: Date Range Override for Analytics */}
                        {activeTab === 'analytics' && (
                            <div className="mt-3 flex items-center gap-2 bg-yellow-50 p-2 rounded border border-yellow-200 w-fit">
                                <span className="text-xs font-bold text-yellow-800 uppercase">Override Actuals Date Range:</span>
                                <input 
                                    type="date" 
                                    value={customStartDate} 
                                    onChange={(e) => setCustomStartDate(e.target.value)} 
                                    className="border rounded px-2 py-1 text-xs"
                                    title="Start Date"
                                />
                                <span className="text-gray-400">→</span>
                                <input 
                                    type="date" 
                                    value={customEndDate} 
                                    onChange={(e) => setCustomEndDate(e.target.value)} 
                                    className="border rounded px-2 py-1 text-xs"
                                    title="End Date"
                                />
                                {(customStartDate || customEndDate) && (
                                    <button 
                                        onClick={() => {setCustomStartDate(''); setCustomEndDate('');}}
                                        className="text-xs text-red-600 font-bold hover:underline ml-2"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleBulkTemplate} className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-sm font-bold hover:bg-blue-100 whitespace-nowrap" title="Download Bulk Template">
                            ⬇️ Template
                        </button>
                        <button onClick={() => bulkInputRef.current?.click()} className="px-3 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded text-sm font-bold hover:bg-orange-100 whitespace-nowrap">
                            📂 Upload Data
                        </button>
                        <input type="file" ref={bulkInputRef} hidden accept=".xlsx,.xls,.csv" onChange={handleBulkImport} />
                        <button onClick={exportAnalytics} className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-sm font-bold hover:bg-green-100 whitespace-nowrap">
                            Export Excel
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-auto border rounded relative">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-100 text-gray-700 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3 border-b">Period</th>
                                <th className="p-3 border-b">Location</th>
                                <th className="p-3 border-b">Item Code</th>
                                <th className="p-3 border-b">Description</th>
                                <th className="p-3 border-b text-right">Period Forecast</th>
                                <th className="p-3 border-b text-right bg-gray-50 border-l border-gray-200">Total All Periods</th>
                                {activeTab === 'analytics' && (
                                    <>
                                        <th className={`p-3 border-b text-right ${customStartDate && customEndDate ? 'bg-yellow-100 text-yellow-900 border-yellow-200' : ''}`}>
                                            Issued Qty {customStartDate && customEndDate ? '(Custom Range)' : ''}
                                        </th>
                                        <th className="p-3 border-b text-right">Variance</th>
                                        <th className="p-3 border-b text-center">Status</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedHubRows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 border-b border-gray-100">
                                    <td className="p-3">{row.periodId}</td>
                                    <td className="p-3">{locations.find(l => l.id === row.locationId)?.name || row.locationId}</td>
                                    <td className="p-3 font-mono">{row.itemId}</td>
                                    <td className="p-3">{row.itemName}</td>
                                    <td className="p-3 text-right font-bold text-blue-700">{row.forecastQty}</td>
                                    <td className="p-3 text-right font-bold text-gray-600 bg-gray-50 border-l border-gray-200">{row.grandTotal}</td>
                                    {activeTab === 'analytics' && (
                                        <>
                                            <td className={`p-3 text-right font-bold ${customStartDate && customEndDate ? 'bg-yellow-50 text-yellow-800' : 'text-blue-700'}`}>
                                                {row.issuedQty}
                                            </td>
                                            <td className={`p-3 text-right font-bold ${row.variance < 0 ? 'text-red-600' : 'text-green-600'}`}>{row.variance}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold 
                                                    ${row.status === 'Over-Issue' ? 'bg-red-100 text-red-800' : 
                                                      row.status === 'Under-Issue' ? 'bg-yellow-100 text-yellow-800' :
                                                      row.status === 'No Issue' ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-800'}`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                            {filteredAnalytics.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-gray-400">No data found matching filters.</td></tr>}
                        </tbody>
                    </table>
                </div>
                {renderPaginationControls(filteredAnalytics.length, hubPage, setHubPage)}
            </div>
        )}

        {/* --- VIEW: ADMIN --- */}
        {activeTab === 'admin' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden min-h-0">
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h3 className="font-bold text-gray-700">Period Management</h3>
                    <div className="flex gap-2">
                        <button onClick={handlePeriodTemplate} className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-sm font-bold hover:bg-blue-100 whitespace-nowrap" title="Download Period Template">
                            ⬇️ Template
                        </button>
                        <button onClick={() => periodFileInputRef.current?.click()} className="px-3 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded text-sm font-bold hover:bg-orange-100 whitespace-nowrap">
                            📂 Upload Excel
                        </button>
                        <input type="file" ref={periodFileInputRef} hidden accept=".xlsx,.xls,.csv" onChange={handlePeriodImport} />
                        <button onClick={handlePeriodExport} className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-sm font-bold hover:bg-green-100 whitespace-nowrap">
                            📊 Export Excel
                        </button>
                    </div>
                </div>
                
                {/* Create Period */}
                <div className="grid grid-cols-5 gap-3 mb-6 bg-gray-50 p-4 rounded border shrink-0">
                    <input className="border p-2 rounded text-sm" placeholder="ID (e.g. 2025-P1)" value={newPeriod.id || ''} onChange={e => setNewPeriod({...newPeriod, id: e.target.value})} />
                    <input className="border p-2 rounded text-sm" placeholder="Name (e.g. Oct-Jan)" value={newPeriod.name || ''} onChange={e => setNewPeriod({...newPeriod, name: e.target.value})} />
                    <input type="date" className="border p-2 rounded text-sm" value={newPeriod.startDate || ''} onChange={e => setNewPeriod({...newPeriod, startDate: e.target.value})} />
                    <input type="date" className="border p-2 rounded text-sm" value={newPeriod.endDate || ''} onChange={e => setNewPeriod({...newPeriod, endDate: e.target.value})} />
                    <button onClick={handleAddPeriod} className="bg-green-600 text-white rounded font-bold text-sm">Add Period</button>
                </div>

                {/* List Periods */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-3">ID</th>
                                <th className="p-3">Name</th>
                                <th className="p-3">Start Date</th>
                                <th className="p-3">End Date</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {forecastPeriods.map(p => (
                                <tr key={p.id} className="border-b">
                                    <td className="p-3 font-mono">{p.id}</td>
                                    <td className="p-3">{p.name}</td>
                                    <td className="p-3">
                                        <input 
                                            type="date" 
                                            value={p.startDate} 
                                            onChange={(e) => onUpdatePeriod({...p, startDate: e.target.value})} 
                                            className="border rounded p-1 text-xs"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <input 
                                            type="date" 
                                            value={p.endDate} 
                                            onChange={(e) => onUpdatePeriod({...p, endDate: e.target.value})} 
                                            className="border rounded p-1 text-xs"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs ${p.status === 'Open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{p.status}</span>
                                    </td>
                                    <td className="p-3">
                                        <button 
                                            onClick={() => onUpdatePeriod({...p, status: p.status === 'Open' ? 'Closed' : 'Open'})}
                                            className="text-blue-600 hover:underline text-xs font-bold"
                                        >
                                            {p.status === 'Open' ? 'Close Period' : 'Re-open'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
  );
};

export default MaterialForecast;
