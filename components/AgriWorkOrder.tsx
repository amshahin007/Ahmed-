
import React, { useState, useEffect } from 'react';
import { AgriOrderRecord, IrrigationLogRecord, Location, Machine } from '../types';
import * as XLSX from 'xlsx';

interface AgriWorkOrderProps {
  orders: AgriOrderRecord[];
  onAddOrder: (order: AgriOrderRecord) => void;
  onUpdateOrder: (order: AgriOrderRecord) => void;
  onDeleteOrders: (ids: string[]) => void;
  
  irrigationLogs: IrrigationLogRecord[];
  onAddIrrigationLog: (log: IrrigationLogRecord) => void;
  onUpdateIrrigationLog: (log: IrrigationLogRecord) => void;
  onDeleteIrrigationLogs: (ids: string[]) => void;

  locations: Location[];
  machines: Machine[];
}

const AgriWorkOrder: React.FC<AgriWorkOrderProps> = ({ 
  orders, onAddOrder, onUpdateOrder, onDeleteOrders, 
  irrigationLogs, onAddIrrigationLog, onUpdateIrrigationLog, onDeleteIrrigationLogs,
  locations, machines 
}) => {
  const [activeTab, setActiveTab] = useState<'agri' | 'irrigation'>('agri');

  // --- AGRI FORM STATE ---
  const [agriFormData, setAgriFormData] = useState<Partial<AgriOrderRecord>>({
    date: new Date().toISOString().slice(0, 10),
    unitType: 'يومية',
    timeSpent: 1,
    startCounter: 0,
    endCounter: 0,
    achievement: 1,
    actualOrReturn: 0,
    calculated: 0,
    pivot: '',
    branch: '',
    tractor: '',
    machineLocalNo: '1',
    attached: '',
    attachedLocalNo: '1',
    driver: '',
    department: 'الادارة',
    notes: ''
  });
  const [selectedAgriId, setSelectedAgriId] = useState<string | null>(null);

  // --- IRRIGATION FORM STATE ---
  const [irrigationFormData, setIrrigationFormData] = useState<Partial<IrrigationLogRecord>>({
    date: new Date().toISOString().slice(0, 10),
    locationName: '',
    generatorModel: '',
    engineStart: 0,
    engineEnd: 0,
    totalHours: 0,
    notes: ''
  });
  const [selectedIrrigationId, setSelectedIrrigationId] = useState<string | null>(null);

  // --- STATIC OPTIONS ---
  const attachedOptions = ["مقطورة_سطحة", "معدة ذاتية_باليومية", "مقطورة حصاد", "اوتومايزر_بدلة", "ماكينة فوج", "مقطورة كسح"];
  const driverOptions = ["درويش شحاته شحاته درويش", "عادل طلبه السيد الشرقاوي", "محمد فرجاني عبدالقادر فرجاني", "عبدالرازق محمد عبد السلام حسين", "سائق أهالي", "بدون_سائق"];
  const unitTypes = ["يومية", "فدان", "ساعة"];
  const pivotOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
  
  // --- CALCULATIONS ---
  useEffect(() => {
     const calc = (agriFormData.endCounter || 0) - (agriFormData.startCounter || 0);
     if (calc > 0 && agriFormData.startCounter && agriFormData.endCounter) {
         setAgriFormData(prev => ({ ...prev, calculated: calc }));
     }
  }, [agriFormData.startCounter, agriFormData.endCounter]);

  useEffect(() => {
    const total = (irrigationFormData.engineEnd || 0) - (irrigationFormData.engineStart || 0);
    if (total > 0 && irrigationFormData.engineStart && irrigationFormData.engineEnd) {
        setIrrigationFormData(prev => ({ ...prev, totalHours: parseFloat(total.toFixed(2)) }));
    }
  }, [irrigationFormData.engineStart, irrigationFormData.engineEnd]);

  // --- HANDLERS (AGRI) ---
  const handleAgriChange = (field: keyof AgriOrderRecord, value: any) => {
    setAgriFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateAgri = () => {
      if (!agriFormData.branch || !agriFormData.tractor) {
          alert("Please fill required fields (Branch, Tractor)");
          return;
      }
      const newId = orders.length > 0 ? String(Math.max(...orders.map(o => Number(o.id))) + 1) : "1250";
      const newRecord: AgriOrderRecord = {
          id: newId,
          date: agriFormData.date || new Date().toISOString().slice(0, 10),
          branch: agriFormData.branch || "",
          tractor: agriFormData.tractor || "",
          machineLocalNo: agriFormData.machineLocalNo || "",
          attached: agriFormData.attached || "",
          attachedLocalNo: agriFormData.attachedLocalNo || "",
          department: agriFormData.department || "",
          pivot: agriFormData.pivot || "",
          driver: agriFormData.driver || "",
          startCounter: Number(agriFormData.startCounter) || 0,
          endCounter: Number(agriFormData.endCounter) || 0,
          rowNumber: agriFormData.rowNumber || "",
          unitType: agriFormData.unitType || "يومية",
          achievement: Number(agriFormData.achievement) || 0,
          actualOrReturn: Number(agriFormData.actualOrReturn) || 0,
          calculated: Number(agriFormData.calculated) || 0,
          timeSpent: Number(agriFormData.timeSpent) || 0,
          notes: agriFormData.notes || "",
          sector: "قطاع شمال", 
          services: "532"
      };
      onAddOrder(newRecord);
      handleResetAgri();
  };

  const handleUpdateAgri = () => {
      if (!selectedAgriId) {
          alert("No record selected for update.");
          return;
      }
      const updatedRecord: AgriOrderRecord = {
          ...agriFormData as AgriOrderRecord,
          id: selectedAgriId
      };
      onUpdateOrder(updatedRecord);
      alert("Record Updated");
      handleResetAgri();
  };

  const handleResetAgri = () => {
      setAgriFormData({
        date: new Date().toISOString().slice(0, 10),
        unitType: 'يومية',
        timeSpent: 1,
        startCounter: 0,
        endCounter: 0,
        achievement: 1,
        actualOrReturn: 0,
        calculated: 0,
        department: 'الادارة',
        machineLocalNo: '1',
        attachedLocalNo: '1',
        pivot: '',
        branch: '',
        tractor: '',
        attached: '',
        driver: '',
        rowNumber: '',
        notes: ''
      });
      setSelectedAgriId(null);
  };

  const handleDeleteAgri = () => {
      if (selectedAgriId) {
          if (confirm("Delete this record?")) {
              onDeleteOrders([selectedAgriId]);
              handleResetAgri();
          }
      } else {
          alert("Select a record first.");
      }
  };

  // --- HANDLERS (IRRIGATION) ---
  const handleIrrigationChange = (field: keyof IrrigationLogRecord, value: any) => {
    setIrrigationFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateIrrigation = () => {
      if (!irrigationFormData.locationName || !irrigationFormData.generatorModel) {
          alert("Please fill required fields (Location, Generator)");
          return;
      }
      const newId = irrigationLogs.length > 0 ? String(Math.max(...irrigationLogs.map(l => Number(l.id))) + 1) : "5000";
      const newRecord: IrrigationLogRecord = {
          id: newId,
          date: irrigationFormData.date || new Date().toISOString().slice(0, 10),
          locationName: irrigationFormData.locationName || "",
          generatorModel: irrigationFormData.generatorModel || "",
          engineStart: Number(irrigationFormData.engineStart) || 0,
          engineEnd: Number(irrigationFormData.engineEnd) || 0,
          totalHours: Number(irrigationFormData.totalHours) || 0,
          notes: irrigationFormData.notes || ""
      };
      onAddIrrigationLog(newRecord);
      handleResetIrrigation();
  };

  const handleUpdateIrrigation = () => {
      if (!selectedIrrigationId) {
          alert("No record selected for update.");
          return;
      }
      const updatedRecord: IrrigationLogRecord = {
          ...irrigationFormData as IrrigationLogRecord,
          id: selectedIrrigationId
      };
      onUpdateIrrigationLog(updatedRecord);
      alert("Record Updated");
      handleResetIrrigation();
  };

  const handleResetIrrigation = () => {
      setIrrigationFormData({
        date: new Date().toISOString().slice(0, 10),
        locationName: '',
        generatorModel: '',
        engineStart: 0,
        engineEnd: 0,
        totalHours: 0,
        notes: ''
      });
      setSelectedIrrigationId(null);
  };

  const handleDeleteIrrigation = () => {
      if (selectedIrrigationId) {
          if (confirm("Delete this record?")) {
              onDeleteIrrigationLogs([selectedIrrigationId]);
              handleResetIrrigation();
          }
      } else {
          alert("Select a record first.");
      }
  };

  const handleExcelExport = () => {
    const wb = XLSX.utils.book_new();
    const data = activeTab === 'agri' ? orders : irrigationLogs;
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, activeTab === 'agri' ? "AgriOrders" : "IrrigationLogs");
    XLSX.writeFile(wb, `${activeTab}_Export.xlsx`);
  };

  // --- COMPACT COMPONENTS ---
  const Field = ({ label, children, colSpan = 1 }: { label: string, children: React.ReactNode, colSpan?: number }) => (
      <div className={`flex flex-col ${colSpan > 1 ? `md:col-span-${colSpan}` : ''}`}>
          <label className="text-[10px] font-bold text-gray-500 mb-1 truncate">{label}</label>
          {children}
      </div>
  );

  const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
      <input 
          {...props} 
          className={`h-9 w-full rounded border border-gray-300 px-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white ${props.disabled ? 'bg-gray-100 text-gray-500' : 'text-gray-900'} ${props.className}`} 
      />
  );
  
  const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
      <select 
          {...props} 
          className={`h-9 w-full rounded border border-gray-300 px-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white ${props.className}`} 
      />
  );

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] bg-gray-50 font-sans overflow-hidden">
        
        {/* LEFT SIDEBAR - TABS */}
        <div className="w-full lg:w-56 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
            <div className="p-4 border-b border-gray-100">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Modules</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <button 
                    onClick={() => setActiveTab('agri')}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-between ${activeTab === 'agri' ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-200 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <span>Agri Work Order</span>
                    <span className="text-[10px] bg-white border border-gray-200 px-1.5 rounded-full">{orders.length}</span>
                </button>
                <button 
                    onClick={() => setActiveTab('irrigation')}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-between ${activeTab === 'irrigation' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <span>Irrigation Log</span>
                    <span className="text-[10px] bg-white border border-gray-200 px-1.5 rounded-full">{irrigationLogs.length}</span>
                </button>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50">
                <button onClick={handleExcelExport} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-sm">
                    <span className="text-green-600">📊</span> Export Excel
                </button>
            </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col h-full overflow-hidden" dir="rtl">
            
            {/* AGRI TAB */}
            {activeTab === 'agri' && (
                <div className="flex flex-col h-full animate-fade-in-up">
                    {/* FORM HEADER & ACTIONS */}
                    <div className="bg-white px-6 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
                         <div>
                             <h2 className="text-lg font-bold text-gray-800">أمر تشغيل زراعي</h2>
                             <p className="text-[10px] text-gray-400 font-mono">ID: {selectedAgriId || 'New Record'}</p>
                         </div>
                         <div className="flex gap-2">
                             <button onClick={handleResetAgri} className="px-4 py-1.5 rounded border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-50">Reset</button>
                             {selectedAgriId ? (
                                 <>
                                     <button onClick={handleDeleteAgri} className="px-4 py-1.5 rounded bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 border border-red-200">Delete</button>
                                     <button onClick={handleUpdateAgri} className="px-5 py-1.5 rounded bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 shadow-sm">Update</button>
                                 </>
                             ) : (
                                 <button onClick={handleCreateAgri} className="px-5 py-1.5 rounded bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 shadow-sm">Save Record</button>
                             )}
                         </div>
                    </div>

                    {/* COMPACT FORM GRID */}
                    <div className="p-4 overflow-y-auto bg-gray-50/50">
                        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm max-w-6xl mx-auto">
                            
                            {/* Row 1: Key Context */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-b border-gray-100">
                                <Field label="التاريخ / Date">
                                    <Input type="date" value={agriFormData.date} onChange={e => handleAgriChange('date', e.target.value)} />
                                </Field>
                                <Field label="الفرع / Branch">
                                    <Select value={agriFormData.branch} onChange={e => handleAgriChange('branch', e.target.value)}>
                                        <option value="">Select Branch...</option>
                                        {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                    </Select>
                                </Field>
                                <Field label="رقم البيفوت / Pivot">
                                    <Select value={agriFormData.pivot} onChange={e => handleAgriChange('pivot', e.target.value)}>
                                        <option value="">Select Pivot...</option>
                                        {pivotOptions.map(p => <option key={p} value={p}>{p}</option>)}
                                    </Select>
                                </Field>
                                <Field label="رقم الصف / Row #">
                                    <Input value={agriFormData.rowNumber || ''} onChange={e => handleAgriChange('rowNumber', e.target.value)} />
                                </Field>
                            </div>

                            {/* Row 2: Equipment */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-b border-gray-100">
                                <Field label="الجرار / Tractor">
                                    <Select value={agriFormData.tractor} onChange={e => handleAgriChange('tractor', e.target.value)}>
                                        <option value="">Select Tractor...</option>
                                        {machines.filter(m => m.category?.includes('جرار') || true).map(m => (
                                           <option key={m.id} value={m.category || m.id}>{m.category || m.id}</option>
                                        ))}
                                    </Select>
                                </Field>
                                <Field label="رقم محلي / Local #">
                                    <Select value={agriFormData.machineLocalNo} onChange={e => handleAgriChange('machineLocalNo', e.target.value)}>
                                        {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                                    </Select>
                                </Field>
                                <Field label="المعدة الملحقة / Attached">
                                    <Select value={agriFormData.attached} onChange={e => handleAgriChange('attached', e.target.value)}>
                                        <option value="">Select Attached...</option>
                                        {attachedOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                    </Select>
                                </Field>
                                <Field label="رقم محلي / Local #">
                                    <Select value={agriFormData.attachedLocalNo} onChange={e => handleAgriChange('attachedLocalNo', e.target.value)}>
                                        {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                                    </Select>
                                </Field>
                            </div>

                            {/* Row 3: Counters & Metrics */}
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4 pb-4 border-b border-gray-100 bg-gray-50/50 p-3 rounded -mx-3">
                                <Field label="بداية العداد / Start">
                                    <Input type="number" value={agriFormData.startCounter} onChange={e => handleAgriChange('startCounter', e.target.value)} className="font-mono font-bold text-teal-700" />
                                </Field>
                                <Field label="نهاية العداد / End">
                                    <Input type="number" value={agriFormData.endCounter} onChange={e => handleAgriChange('endCounter', e.target.value)} className="font-mono font-bold text-teal-700" />
                                </Field>
                                <Field label="حسابي / Calc">
                                    <Input value={agriFormData.calculated} disabled className="font-mono bg-gray-200" />
                                </Field>
                                <Field label="الوحدة / Unit">
                                    <Select value={agriFormData.unitType} onChange={e => handleAgriChange('unitType', e.target.value)}>
                                        {unitTypes.map(u => <option key={u} value={u}>{u}</option>)}
                                    </Select>
                                </Field>
                                <Field label="الانجاز / Achieve">
                                    <Input type="number" value={agriFormData.achievement} onChange={e => handleAgriChange('achievement', e.target.value)} />
                                </Field>
                                <Field label="ساعة / Hours">
                                    <Input type="number" value={agriFormData.timeSpent} onChange={e => handleAgriChange('timeSpent', e.target.value)} />
                                </Field>
                            </div>

                            {/* Row 4: Personnel & Data Out */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                    <Field label="السائق / Driver" colSpan={2}>
                                        <Select value={agriFormData.driver} onChange={e => handleAgriChange('driver', e.target.value)}>
                                            <option value="">Select Driver...</option>
                                            {driverOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                        </Select>
                                    </Field>
                                    <Field label="الادارة / Dept">
                                        <Input value={agriFormData.department} disabled className="bg-gray-100" />
                                    </Field>
                                    <Field label="القطاع / Sector">
                                        <Input value={agriFormData.sector || 'قطاع شمال'} disabled className="bg-gray-100" />
                                    </Field>
                                </div>
                                <div className="md:col-span-2">
                                     <Field label="ملاحظات / Notes">
                                         <textarea 
                                            className="w-full h-[76px] rounded border border-gray-300 p-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 resize-none"
                                            value={agriFormData.notes}
                                            onChange={e => handleAgriChange('notes', e.target.value)}
                                            placeholder="..."
                                         />
                                     </Field>
                                </div>
                            </div>
                        </div>

                        {/* TABLE */}
                        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 font-bold text-xs text-gray-500 uppercase">Recent Records</div>
                            <div className="overflow-auto max-h-[300px]">
                                <table className="w-full text-right text-sm border-collapse">
                                    <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            {["ID", "Date", "Branch", "Tractor", "Local", "Attached", "Driver", "Calc", "Achieve", "Unit"].map(h => (
                                                <th key={h} className="p-3 font-bold text-gray-600 border-b whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {orders.slice().reverse().map(o => (
                                            <tr 
                                                key={o.id} 
                                                onClick={() => { setAgriFormData(o); setSelectedAgriId(o.id); }}
                                                className={`cursor-pointer hover:bg-teal-50 transition-colors ${selectedAgriId === o.id ? 'bg-teal-50 ring-1 ring-teal-200' : ''}`}
                                            >
                                                <td className="p-2 font-mono text-gray-400 text-xs">{o.id}</td>
                                                <td className="p-2 whitespace-nowrap">{o.date}</td>
                                                <td className="p-2">{o.branch}</td>
                                                <td className="p-2">{o.tractor}</td>
                                                <td className="p-2">{o.machineLocalNo}</td>
                                                <td className="p-2 text-gray-500">{o.attached}</td>
                                                <td className="p-2 truncate max-w-[100px]">{o.driver}</td>
                                                <td className="p-2 font-mono">{o.calculated}</td>
                                                <td className="p-2 font-bold text-gray-800">{o.achievement}</td>
                                                <td className="p-2 text-xs">{o.unitType}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* IRRIGATION TAB */}
            {activeTab === 'irrigation' && (
                <div className="flex flex-col h-full animate-fade-in-up">
                    <div className="bg-white px-6 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
                         <div>
                             <h2 className="text-lg font-bold text-gray-800">سجل تشغيل الري</h2>
                             <p className="text-[10px] text-gray-400 font-mono">ID: {selectedIrrigationId || 'New'}</p>
                         </div>
                         <div className="flex gap-2">
                             <button onClick={handleResetIrrigation} className="px-4 py-1.5 rounded border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-50">Reset</button>
                             {selectedIrrigationId ? (
                                 <>
                                     <button onClick={handleDeleteIrrigation} className="px-4 py-1.5 rounded bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 border border-red-200">Delete</button>
                                     <button onClick={handleUpdateIrrigation} className="px-5 py-1.5 rounded bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm">Update</button>
                                 </>
                             ) : (
                                 <button onClick={handleCreateIrrigation} className="px-5 py-1.5 rounded bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm">Save Log</button>
                             )}
                         </div>
                    </div>

                    <div className="p-4 overflow-y-auto bg-gray-50/50">
                        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm max-w-4xl mx-auto">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Col 1 */}
                                <div className="space-y-4">
                                    <Field label="التاريخ / Date">
                                        <Input type="date" value={irrigationFormData.date} onChange={e => handleIrrigationChange('date', e.target.value)} />
                                    </Field>
                                    <Field label="الموقع / Location">
                                        <Select value={irrigationFormData.locationName} onChange={e => handleIrrigationChange('locationName', e.target.value)}>
                                            <option value="">Select Location...</option>
                                            {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                        </Select>
                                    </Field>
                                    <Field label="المولد / Generator">
                                        <Select value={irrigationFormData.generatorModel} onChange={e => handleIrrigationChange('generatorModel', e.target.value)}>
                                            <option value="">Select Generator...</option>
                                            {machines.map(m => (
                                                <option key={m.id} value={m.category || m.id}>{m.category || m.id}</option>
                                            ))}
                                        </Select>
                                    </Field>
                                </div>
                                {/* Col 2 */}
                                <div className="space-y-4">
                                    <Field label="بداية العداد / Start">
                                        <Input type="number" value={irrigationFormData.engineStart} onChange={e => handleIrrigationChange('engineStart', e.target.value)} />
                                    </Field>
                                    <Field label="نهاية العداد / End">
                                        <Input type="number" value={irrigationFormData.engineEnd} onChange={e => handleIrrigationChange('engineEnd', e.target.value)} />
                                    </Field>
                                    <Field label="اجمالي الساعات / Total Hours">
                                        <Input type="number" value={irrigationFormData.totalHours} disabled className="bg-blue-50 text-blue-800 font-bold" />
                                    </Field>
                                </div>
                                {/* Col 3 */}
                                <div className="h-full">
                                    <Field label="ملاحظات / Notes" colSpan={1}>
                                        <textarea 
                                            className="w-full h-[180px] rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                                            placeholder="..."
                                            value={irrigationFormData.notes} 
                                            onChange={e => handleIrrigationChange('notes', e.target.value)} 
                                        />
                                    </Field>
                                </div>
                            </div>
                        </div>

                        {/* TABLE */}
                        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 font-bold text-xs text-gray-500 uppercase">Log History</div>
                            <div className="overflow-auto max-h-[300px]">
                                <table className="w-full text-right text-sm border-collapse">
                                    <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            {["ID", "Date", "Loc", "Gen", "Start", "End", "Hours", "Notes"].map(h => (
                                                <th key={h} className="p-3 font-bold text-gray-600 border-b whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {irrigationLogs.slice().reverse().map(log => (
                                            <tr 
                                                key={log.id} 
                                                onClick={() => { setIrrigationFormData(log); setSelectedIrrigationId(log.id); }}
                                                className={`cursor-pointer hover:bg-blue-50 transition-colors ${selectedIrrigationId === log.id ? 'bg-blue-50 ring-1 ring-blue-200' : ''}`}
                                            >
                                                <td className="p-2 font-mono text-gray-400 text-xs">{log.id}</td>
                                                <td className="p-2 whitespace-nowrap">{log.date}</td>
                                                <td className="p-2">{log.locationName}</td>
                                                <td className="p-2 text-xs truncate max-w-[100px]">{log.generatorModel}</td>
                                                <td className="p-2 font-mono">{log.engineStart}</td>
                                                <td className="p-2 font-mono">{log.engineEnd}</td>
                                                <td className="p-2 font-bold text-blue-700">{log.totalHours}</td>
                                                <td className="p-2 text-gray-400 text-xs truncate max-w-[150px]">{log.notes}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default AgriWorkOrder;
