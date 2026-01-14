
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
      alert("Agri Record Updated");
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
      alert("Irrigation Record Updated");
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
    
    if (activeTab === 'agri') {
        const ws = XLSX.utils.json_to_sheet(orders);
        XLSX.utils.book_append_sheet(wb, ws, "AgriOrders");
        XLSX.writeFile(wb, "AgriWorkOrders.xlsx");
    } else {
        const ws = XLSX.utils.json_to_sheet(irrigationLogs);
        XLSX.utils.book_append_sheet(wb, ws, "IrrigationLogs");
        XLSX.writeFile(wb, "IrrigationLogs.xlsx");
    }
  };

  // --- UI COMPONENTS ---
  
  const FormInput = ({ label, type = "text", value, onChange, placeholder = "", disabled = false, className = "", required = false }: any) => (
    <div className={`flex flex-col ${className}`}>
        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label} {required && <span className="text-red-500">*</span>}</label>
        <input 
            type={type} 
            value={value} 
            onChange={onChange} 
            disabled={disabled}
            placeholder={placeholder}
            className={`
                h-11 px-3 w-full rounded-md border 
                font-medium text-gray-900 shadow-sm
                transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
                disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
                placeholder:text-gray-300 text-sm
                ${disabled ? 'border-gray-200' : 'border-gray-300 bg-white hover:border-gray-400'}
            `}
        />
    </div>
  );

  const FormSelect = ({ label, value, onChange, options, disabled = false, className = "", required = false }: any) => (
    <div className={`flex flex-col ${className}`}>
        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label} {required && <span className="text-red-500">*</span>}</label>
        <div className="relative">
            <select 
                value={value} 
                onChange={onChange} 
                disabled={disabled}
                className={`
                    h-11 pl-3 pr-8 w-full rounded-md border appearance-none
                    font-medium text-gray-900 shadow-sm
                    transition-colors duration-200
                    focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
                    disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
                    text-sm bg-white
                    ${disabled ? 'border-gray-200' : 'border-gray-300 hover:border-gray-400'}
                `}
            >
                {options}
            </select>
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 text-gray-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </div>
        </div>
    </div>
  );

  const ReadOnlyField = ({ label, value, unit = "" }: any) => (
      <div className="flex flex-col bg-gray-50 p-3 rounded-lg border border-gray-200">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex justify-between">
              {label}
              <span className="text-gray-300">🔒</span>
          </label>
          <div className="text-lg font-bold text-gray-800 font-mono truncate">
              {value || 0} <span className="text-xs text-gray-500 font-sans ml-1">{unit}</span>
          </div>
      </div>
  );

  const TabButton = ({ id, label, active, onClick, count }: any) => (
      <button 
        onClick={onClick}
        className={`
            w-full flex items-center justify-between px-4 py-3 text-sm font-bold transition-all duration-200 rounded-lg mb-2
            ${active 
                ? 'bg-teal-600 text-white shadow-md shadow-teal-200' 
                : 'bg-white text-gray-600 hover:bg-gray-50 hover:pl-5 border border-transparent'}
        `}
      >
          <span>{label}</span>
          {count !== undefined && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${active ? 'bg-teal-700 text-teal-100' : 'bg-gray-100 text-gray-500'}`}>
                  {count}
              </span>
          )}
      </button>
  );

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-100px)] gap-6 font-cairo bg-gray-50/50">
        
        {/* LEFT SIDEBAR: TABS & CONTEXT */}
        <div className="w-full lg:w-64 flex flex-col gap-6 shrink-0">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Modules</h3>
                <TabButton 
                    id="agri" 
                    label="Agri Work Order" 
                    active={activeTab === 'agri'} 
                    onClick={() => setActiveTab('agri')} 
                    count={orders.length}
                />
                <TabButton 
                    id="irrigation" 
                    label="Irrigation Log" 
                    active={activeTab === 'irrigation'} 
                    onClick={() => setActiveTab('irrigation')} 
                    count={irrigationLogs.length}
                />
            </div>

            {/* Quick Stats or Help */}
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 hidden lg:block">
                <h4 className="text-blue-800 font-bold text-sm mb-2">💡 Operational Tip</h4>
                <p className="text-xs text-blue-600 leading-relaxed">
                    Ensure counters are entered sequentially. The system automatically calculates durations based on start/end values.
                </p>
            </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden h-full" dir="rtl">
            
            {/* --- TAB: AGRI WORK ORDER --- */}
            {activeTab === 'agri' && (
                <div className="flex flex-col h-full animate-fade-in-up">
                    
                    {/* FORM CARD */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col shrink-0">
                        {/* Form Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-teal-100 text-teal-600 rounded-lg">🚜</div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800">أمر تشغيل زراعي</h2>
                                    <p className="text-xs text-gray-500">Agri Work Order Entry</p>
                                </div>
                            </div>
                            <div className="text-xs text-gray-400 font-mono">
                                ID: {selectedAgriId || 'New'}
                            </div>
                        </div>

                        {/* Form Body - Scrollable */}
                        <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
                            <div className="grid grid-cols-12 gap-4 lg:gap-6">
                                
                                {/* Section 1: Operational Context */}
                                <div className="col-span-12 lg:col-span-12">
                                    <h3 className="text-xs font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">Operational Context / السياق التشغيلي</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <FormInput 
                                            label="التاريخ" 
                                            type="date" 
                                            value={agriFormData.date} 
                                            onChange={(e: any) => handleAgriChange('date', e.target.value)} 
                                            required 
                                        />
                                        <FormSelect 
                                            label="اسم الفرع"
                                            value={agriFormData.branch} 
                                            onChange={(e: any) => handleAgriChange('branch', e.target.value)}
                                            required
                                            options={<>
                                                <option value="">اختر الفرع...</option>
                                                {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                            </>}
                                        />
                                        <FormSelect 
                                            label="رقم البيفوت"
                                            value={agriFormData.pivot} 
                                            onChange={(e: any) => handleAgriChange('pivot', e.target.value)}
                                            options={<>
                                                <option value="">رقم البيفوت...</option>
                                                {pivotOptions.map(p => <option key={p} value={p}>{p}</option>)}
                                            </>}
                                        />
                                        <FormInput 
                                            label="رقم الصف" 
                                            value={agriFormData.rowNumber} 
                                            onChange={(e: any) => handleAgriChange('rowNumber', e.target.value)} 
                                        />
                                    </div>
                                </div>

                                {/* Section 2: Equipment & Crew */}
                                <div className="col-span-12 lg:col-span-8">
                                    <h3 className="text-xs font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4 mt-2">Equipment & Crew / المعدات والطاقم</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="col-span-2">
                                                <FormSelect 
                                                    label="موديل الجرار"
                                                    value={agriFormData.tractor}
                                                    onChange={(e: any) => handleAgriChange('tractor', e.target.value)}
                                                    required
                                                    options={<>
                                                        <option value="">اختر موديل الجرار...</option>
                                                        {machines.filter(m => m.category?.includes('جرار') || true).map(m => (
                                                            <option key={m.id} value={m.category || m.id}>{m.category || m.id}</option>
                                                        ))}
                                                    </>}
                                                />
                                            </div>
                                            <FormSelect 
                                                label="محلي"
                                                value={agriFormData.machineLocalNo}
                                                onChange={(e: any) => handleAgriChange('machineLocalNo', e.target.value)}
                                                options={[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="col-span-2">
                                                <FormSelect 
                                                    label="المعدة الملحقة"
                                                    value={agriFormData.attached}
                                                    onChange={(e: any) => handleAgriChange('attached', e.target.value)}
                                                    options={<>
                                                        <option value="">المعدة الملحقة...</option>
                                                        {attachedOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                                    </>}
                                                />
                                            </div>
                                            <FormSelect 
                                                label="محلي 2"
                                                value={agriFormData.attachedLocalNo}
                                                onChange={(e: any) => handleAgriChange('attachedLocalNo', e.target.value)}
                                                options={[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <FormSelect 
                                                label="اسم السائق"
                                                value={agriFormData.driver}
                                                onChange={(e: any) => handleAgriChange('driver', e.target.value)}
                                                options={<>
                                                    <option value="">اختر السائق...</option>
                                                    {driverOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                                </>}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Metrics & Counters */}
                                <div className="col-span-12 lg:col-span-4 bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                                    <h3 className="text-xs font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4 mt-2">Metrics / القياسات</h3>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <FormInput 
                                                label="بداية العداد" 
                                                type="number" 
                                                value={agriFormData.startCounter} 
                                                onChange={(e: any) => handleAgriChange('startCounter', e.target.value)} 
                                            />
                                            <FormInput 
                                                label="نهاية العداد" 
                                                type="number" 
                                                value={agriFormData.endCounter} 
                                                onChange={(e: any) => handleAgriChange('endCounter', e.target.value)} 
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <FormSelect 
                                                label="الوحدة"
                                                value={agriFormData.unitType}
                                                onChange={(e: any) => handleAgriChange('unitType', e.target.value)}
                                                options={unitTypes.map(u => <option key={u} value={u}>{u}</option>)}
                                            />
                                            <FormInput 
                                                label="ساعات العمل" 
                                                type="number" 
                                                value={agriFormData.timeSpent} 
                                                onChange={(e: any) => handleAgriChange('timeSpent', e.target.value)} 
                                            />
                                        </div>
                                        <FormInput 
                                            label="ملاحظات" 
                                            value={agriFormData.notes} 
                                            onChange={(e: any) => handleAgriChange('notes', e.target.value)} 
                                            placeholder="أي ملاحظات إضافية..."
                                        />
                                    </div>
                                </div>

                                {/* Section 4: Summary (Calculated) */}
                                <div className="col-span-12 border-t border-gray-100 pt-4 mt-2">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Calculated Output (Read Only)</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <ReadOnlyField label="الانجاز الحسابي" value={agriFormData.calculated} />
                                        <ReadOnlyField label="الإعادة / الفعلي" value={agriFormData.actualOrReturn} />
                                        <ReadOnlyField label="الادارة" value={agriFormData.department} />
                                        <ReadOnlyField label="الخدمات" value={agriFormData.services || '532'} />
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center rounded-b-xl">
                            <div className="flex gap-2">
                                <button onClick={handleResetAgri} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
                                    Reset
                                </button>
                                {selectedAgriId && (
                                    <button onClick={handleDeleteAgri} className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                                        Delete
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-3">
                                {selectedAgriId ? (
                                    <button onClick={handleUpdateAgri} className="px-6 py-2 text-sm font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 shadow-md transition-transform active:scale-95">
                                        Update Record
                                    </button>
                                ) : (
                                    <button onClick={handleCreateAgri} className="px-6 py-2 text-sm font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 shadow-md transition-transform active:scale-95">
                                        Save Record
                                    </button>
                                )}
                                <button onClick={handleExcelExport} className="p-2 text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100" title="Export Excel">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* DATA TABLE */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col">
                        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent Records ({orders.length})</span>
                        </div>
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-right text-sm border-collapse">
                                <thead className="bg-gray-50 sticky top-0 text-gray-500 text-xs font-bold uppercase tracking-wider">
                                    <tr>
                                        {["ID", "التاريخ", "الفرع", "الجرار", "المعدة", "البيفوت", "السائق", "الانجاز", "الوحدة", "الزمن"].map(h => (
                                            <th key={h} className="p-4 border-b border-gray-200 whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {orders.length === 0 ? (
                                        <tr><td colSpan={10} className="text-center p-8 text-gray-400">No records found</td></tr>
                                    ) : (
                                        orders.slice().reverse().map(o => (
                                            <tr 
                                                key={o.id} 
                                                onClick={() => { setAgriFormData(o); setSelectedAgriId(o.id); }}
                                                className={`cursor-pointer hover:bg-teal-50 transition-colors ${selectedAgriId === o.id ? 'bg-teal-50 border-l-4 border-teal-500' : ''}`}
                                            >
                                                <td className="p-4 font-mono text-gray-400">{o.id}</td>
                                                <td className="p-4">{o.date}</td>
                                                <td className="p-4 font-medium text-gray-900">{o.branch}</td>
                                                <td className="p-4">{o.tractor}</td>
                                                <td className="p-4 text-gray-500">{o.attached || '-'}</td>
                                                <td className="p-4">{o.pivot}</td>
                                                <td className="p-4 text-gray-600">{o.driver}</td>
                                                <td className="p-4 font-bold text-gray-900">{o.achievement}</td>
                                                <td className="p-4 text-xs bg-gray-50 rounded px-2">{o.unitType}</td>
                                                <td className="p-4">{o.timeSpent}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TAB: IRRIGATION LOG --- */}
            {activeTab === 'irrigation' && (
                <div className="flex flex-col h-full animate-fade-in-up">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col shrink-0">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">💧</div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800">سجل تشغيل الري</h2>
                                    <p className="text-xs text-gray-500">Irrigation Run Times Log</p>
                                </div>
                            </div>
                            <div className="text-xs text-gray-400 font-mono">
                                ID: {selectedIrrigationId || 'New'}
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="grid grid-cols-12 gap-6">
                                {/* Context */}
                                <div className="col-span-12 lg:col-span-4 space-y-4">
                                    <h3 className="text-xs font-bold text-gray-900 border-b border-gray-200 pb-2 mb-2">Location / الموقع</h3>
                                    <FormInput 
                                        label="التاريخ" 
                                        type="date" 
                                        value={irrigationFormData.date} 
                                        onChange={(e: any) => handleIrrigationChange('date', e.target.value)} 
                                    />
                                    <FormSelect 
                                        label="الموقع"
                                        value={irrigationFormData.locationName}
                                        onChange={(e: any) => handleIrrigationChange('locationName', e.target.value)}
                                        options={<>
                                            <option value="">اختر الموقع...</option>
                                            {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                        </>}
                                    />
                                    <FormSelect 
                                        label="موديل المولد"
                                        value={irrigationFormData.generatorModel}
                                        onChange={(e: any) => handleIrrigationChange('generatorModel', e.target.value)}
                                        options={<>
                                            <option value="">اختر المولد...</option>
                                            {machines.map(m => <option key={m.id} value={m.category || m.id}>{m.category || m.id}</option>)}
                                        </>}
                                    />
                                </div>

                                {/* Counters */}
                                <div className="col-span-12 lg:col-span-4 space-y-4">
                                    <h3 className="text-xs font-bold text-gray-900 border-b border-gray-200 pb-2 mb-2">Counters / العدادات</h3>
                                    <FormInput 
                                        label="بداية العداد" 
                                        type="number"
                                        value={irrigationFormData.engineStart} 
                                        onChange={(e: any) => handleIrrigationChange('engineStart', e.target.value)} 
                                    />
                                    <FormInput 
                                        label="نهاية العداد" 
                                        type="number"
                                        value={irrigationFormData.engineEnd} 
                                        onChange={(e: any) => handleIrrigationChange('engineEnd', e.target.value)} 
                                    />
                                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-center justify-between">
                                        <span className="text-sm font-bold text-blue-800">اجمالي الساعات</span>
                                        <span className="text-2xl font-bold text-blue-600 font-mono">{irrigationFormData.totalHours || 0}</span>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="col-span-12 lg:col-span-4 flex flex-col">
                                    <h3 className="text-xs font-bold text-gray-900 border-b border-gray-200 pb-2 mb-2">Notes / ملاحظات</h3>
                                    <textarea 
                                        className="w-full h-full min-h-[120px] rounded-md border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent" 
                                        placeholder="ملاحظات..." 
                                        value={irrigationFormData.notes} 
                                        onChange={e => handleIrrigationChange('notes', e.target.value)} 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center rounded-b-xl">
                            <div className="flex gap-2">
                                <button onClick={handleResetIrrigation} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">Reset</button>
                                {selectedIrrigationId && (
                                    <button onClick={handleDeleteIrrigation} className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">Delete</button>
                                )}
                            </div>
                            <div className="flex gap-3">
                                {selectedIrrigationId ? (
                                    <button onClick={handleUpdateIrrigation} className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md transition-transform active:scale-95">Update Log</button>
                                ) : (
                                    <button onClick={handleCreateIrrigation} className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md transition-transform active:scale-95">Save Log</button>
                                )}
                                <button onClick={handleExcelExport} className="p-2 text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col mt-4">
                        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Log History ({irrigationLogs.length})</span>
                        </div>
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-right text-sm border-collapse">
                                <thead className="bg-gray-50 sticky top-0 text-gray-500 text-xs font-bold uppercase tracking-wider">
                                    <tr>
                                        {["م", "التاريخ", "الموقع", "المولد", "بداية", "نهاية", "ساعات التشغيل", "ملاحظات"].map(h => (
                                            <th key={h} className="p-4 border-b border-gray-200 whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {irrigationLogs.length === 0 ? (
                                        <tr><td colSpan={8} className="text-center p-8 text-gray-400">No records found</td></tr>
                                    ) : (
                                        irrigationLogs.slice().reverse().map(log => (
                                            <tr 
                                                key={log.id} 
                                                onClick={() => { setIrrigationFormData(log); setSelectedIrrigationId(log.id); }}
                                                className={`cursor-pointer hover:bg-blue-50 transition-colors ${selectedIrrigationId === log.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                                            >
                                                <td className="p-4 font-mono text-gray-400">{log.id}</td>
                                                <td className="p-4">{log.date}</td>
                                                <td className="p-4">{log.locationName}</td>
                                                <td className="p-4 font-medium">{log.generatorModel}</td>
                                                <td className="p-4 font-mono">{log.engineStart}</td>
                                                <td className="p-4 font-mono">{log.engineEnd}</td>
                                                <td className="p-4 font-bold text-blue-700">{log.totalHours}</td>
                                                <td className="p-4 text-gray-500 max-w-xs truncate">{log.notes}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default AgriWorkOrder;
