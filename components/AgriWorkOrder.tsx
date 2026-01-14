
import React, { useState, useEffect } from 'react';
import { AgriOrderRecord, Location, Machine } from '../types';
import * as XLSX from 'xlsx';

interface AgriWorkOrderProps {
  orders: AgriOrderRecord[];
  onAddOrder: (order: AgriOrderRecord) => void;
  onUpdateOrder: (order: AgriOrderRecord) => void;
  onDeleteOrders: (ids: string[]) => void;
  locations: Location[];
  machines: Machine[];
}

const AgriWorkOrder: React.FC<AgriWorkOrderProps> = ({ orders, onAddOrder, onUpdateOrder, onDeleteOrders, locations, machines }) => {
  // Form State
  const [formData, setFormData] = useState<Partial<AgriOrderRecord>>({
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

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Derived/Static Lists
  const attachedOptions = ["مقطورة_سطحة", "معدة ذاتية_باليومية", "مقطورة حصاد", "اوتومايزر_بدلة", "ماكينة فوج", "مقطورة كسح"];
  const driverOptions = ["درويش شحاته شحاته درويش", "عادل طلبه السيد الشرقاوي", "محمد فرجاني عبدالقادر فرجاني", "عبدالرازق محمد عبد السلام حسين", "سائق أهالي", "بدون_سائق"];
  const departments = ["الادارة", "الصوب", "العنب", "الموالح"];
  const unitTypes = ["يومية", "فدان", "ساعة"];
  const pivotOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
  
  useEffect(() => {
     // Example auto-calc
     const calc = (formData.endCounter || 0) - (formData.startCounter || 0);
     if (calc > 0 && formData.startCounter && formData.endCounter) {
         setFormData(prev => ({ ...prev, calculated: calc }));
     }
  }, [formData.startCounter, formData.endCounter]);

  const handleChange = (field: keyof AgriOrderRecord, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getRecordFromForm = (id: string): AgriOrderRecord => {
      return {
          id: id,
          date: formData.date || new Date().toISOString().slice(0, 10),
          branch: formData.branch || "",
          tractor: formData.tractor || "",
          machineLocalNo: formData.machineLocalNo || "",
          attached: formData.attached || "",
          attachedLocalNo: formData.attachedLocalNo || "",
          department: formData.department || "",
          pivot: formData.pivot || "",
          driver: formData.driver || "",
          startCounter: Number(formData.startCounter) || 0,
          endCounter: Number(formData.endCounter) || 0,
          rowNumber: formData.rowNumber || "",
          unitType: formData.unitType || "يومية",
          achievement: Number(formData.achievement) || 0,
          actualOrReturn: Number(formData.actualOrReturn) || 0,
          calculated: Number(formData.calculated) || 0,
          timeSpent: Number(formData.timeSpent) || 0,
          notes: formData.notes || "",
          sector: "قطاع شمال", 
          services: "532"
      };
  };

  const handleCreate = () => {
      if (!formData.branch || !formData.tractor) {
          alert("Please fill required fields (Branch, Tractor)");
          return;
      }
      const newId = orders.length > 0 ? String(Math.max(...orders.map(o => Number(o.id))) + 1) : "1250";
      const newRecord = getRecordFromForm(newId);
      onAddOrder(newRecord);
      handleReset();
  };

  const handleUpdate = () => {
      if (!selectedId) {
          alert("No record selected for update. Click a row in the table first.");
          return;
      }
      const updatedRecord = getRecordFromForm(selectedId);
      onUpdateOrder(updatedRecord);
      alert("Record Updated");
      handleReset();
  };

  const handleReset = () => {
      setFormData({
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
      setSelectedId(null);
  };

  const handleEdit = (record: AgriOrderRecord) => {
      setFormData(record);
      setSelectedId(record.id);
  };

  const handleDelete = () => {
      if (selectedId) {
          if (confirm("Delete this record?")) {
              onDeleteOrders([selectedId]);
              handleReset();
          }
      } else {
          alert("Select a record from the table first to delete.");
      }
  };

  const handleExcelExport = () => {
    const ws = XLSX.utils.json_to_sheet(orders);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AgriOrders");
    XLSX.writeFile(wb, "AgriWorkOrders.xlsx");
  };

  // --- STYLES ---
  // Teal Label: Fixed width, green bg, white text
  const labelStyle = "bg-[#00695c] text-white font-bold text-sm flex items-center justify-center px-1 h-8 whitespace-nowrap min-w-[110px] border border-[#004d40] rounded-sm shadow-sm";
  // Input: White bg, border
  const inputStyle = "border border-gray-400 px-2 h-8 text-right font-bold w-full text-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500 rounded-sm";
  // Row container
  const rowStyle = "flex items-center gap-2 mb-2";

  return (
    <div className="p-4 bg-gray-100 min-h-screen font-sans" dir="rtl">
        
        {/* Main Form Container */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
           
           {/* LEFT SIDE: Counters (Vertical Stack) */}
           <div className="w-full lg:w-48 flex flex-col gap-3 pt-6 lg:pt-8">
               <div className="flex items-center gap-1">
                   <input type="number" className={inputStyle} value={formData.endCounter} onChange={e => handleChange('endCounter', e.target.value)} />
                   <div className={labelStyle}>نهاية العداد</div>
               </div>
               <div className="flex items-center gap-1">
                   <input type="number" className={inputStyle} value={formData.startCounter} onChange={e => handleChange('startCounter', e.target.value)} />
                   <div className={labelStyle}>بداية العداد</div>
               </div>
               <div className="flex items-center gap-1">
                   <input type="text" className={inputStyle} value={formData.rowNumber || ''} onChange={e => handleChange('rowNumber', e.target.value)} />
                   <div className={labelStyle}>رقم الصف</div>
               </div>
               <div className="flex items-center gap-1">
                   <input type="number" className={`${inputStyle} bg-pink-200 border-pink-300`} />
                   <div className={labelStyle}>عدد النسخ</div>
               </div>
           </div>

           {/* CENTER/RIGHT: Main Details */}
           <div className="flex-1 w-full bg-gray-50 p-2 rounded border border-gray-300 relative mt-4 lg:mt-0">
               <span className="absolute -top-3 left-3 bg-gray-100 px-2 text-sm font-bold text-gray-700 border border-gray-300 rounded">Enter Detailes</span>
               
               <div className="flex flex-col lg:flex-row gap-4 pt-3">
                   {/* Column 2 (Left visually in RTL, Right in LTR) */}
                   <div className="flex-1">
                       {/* Date */}
                       <div className={rowStyle}>
                            <div className={`${inputStyle} bg-white flex items-center justify-center`}>{formData.date}</div>
                            <div className={labelStyle}>التاريخ</div>
                       </div>
                       
                       {/* Time & Machine Local */}
                       <div className={rowStyle}>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-gray-600">ساعة</span>
                                <input className={`${inputStyle} w-20`} value={formData.timeSpent} onChange={e => handleChange('timeSpent', e.target.value)} />
                            </div>
                            <div className="flex-1 flex justify-end gap-1">
                                 <select className={`${inputStyle} w-24`} value={formData.machineLocalNo} onChange={e => handleChange('machineLocalNo', e.target.value)}>
                                     {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                                 </select>
                                 <div className={labelStyle}>محلي رقم</div>
                            </div>
                       </div>

                       {/* Attached Local */}
                       <div className={rowStyle}>
                            <div className="flex-1 flex justify-end gap-1">
                                 <select className={`${inputStyle} w-24`} value={formData.attachedLocalNo} onChange={e => handleChange('attachedLocalNo', e.target.value)}>
                                     {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                                 </select>
                                 <div className={labelStyle}>محلي رقم</div>
                            </div>
                       </div>

                       {/* Achievement / Unit */}
                       <div className={rowStyle}>
                            <div className="flex-1 flex gap-1">
                                 <select className={`${inputStyle} bg-yellow-50 w-24 text-center`} value={formData.unitType} onChange={e => handleChange('unitType', e.target.value)}>
                                     {unitTypes.map(u => <option key={u} value={u}>{u}</option>)}
                                 </select>
                                 <input className={inputStyle} value={formData.achievement} onChange={e => handleChange('achievement', e.target.value)} />
                                 <div className={labelStyle}>الإنجاز الحسابي</div>
                            </div>
                       </div>

                       {/* Actual / Return */}
                       <div className={rowStyle}>
                            <div className="flex-1 flex gap-1">
                                 <input className={`${inputStyle} bg-yellow-50 w-24`} disabled value={0} />
                                 <input className={inputStyle} value={formData.actualOrReturn} onChange={e => handleChange('actualOrReturn', e.target.value)} />
                                 <div className={labelStyle}>الإعادة أو الفعلي</div>
                            </div>
                       </div>
                   </div>

                   {/* Column 1 (Right visually in RTL) */}
                   <div className="flex-1">
                       {/* Branch */}
                       <div className={rowStyle}>
                           <select className={inputStyle} value={formData.branch} onChange={e => handleChange('branch', e.target.value)}>
                               <option value="">اختر الفرع...</option>
                               {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                           </select>
                           <div className={labelStyle}>اسم الفرع</div>
                       </div>

                       {/* Tractor */}
                       <div className={rowStyle}>
                           <select className={inputStyle} value={formData.tractor} onChange={e => handleChange('tractor', e.target.value)}>
                               <option value="">اختر موديل الجرار...</option>
                               {machines.filter(m => m.category?.includes('جرار') || true).map(m => (
                                   <option key={m.id} value={m.category || m.id}>{m.category || m.id}</option>
                               ))}
                           </select>
                           <div className={labelStyle}>موديل الجرار</div>
                       </div>

                       {/* Attached */}
                       <div className={rowStyle}>
                           <select className={inputStyle} value={formData.attached} onChange={e => handleChange('attached', e.target.value)}>
                               <option value="">المعدة الملحقة...</option>
                               {attachedOptions.map(o => <option key={o} value={o}>{o}</option>)}
                           </select>
                           <div className={labelStyle}>المعدة الملحقة</div>
                       </div>

                       {/* Pivot */}
                       <div className={rowStyle}>
                           <select className={inputStyle} value={formData.pivot} onChange={e => handleChange('pivot', e.target.value)}>
                               <option value="">رقم البيفوت...</option>
                               {pivotOptions.map(p => <option key={p} value={p}>{p}</option>)}
                           </select>
                           <div className={labelStyle}>رقم البيفوت</div>
                       </div>

                       {/* Driver */}
                       <div className={rowStyle}>
                           <select className={inputStyle} value={formData.driver} onChange={e => handleChange('driver', e.target.value)}>
                               <option value="">اختر السائق...</option>
                               {driverOptions.map(d => <option key={d} value={d}>{d}</option>)}
                           </select>
                           <div className={labelStyle}>اسم السائق</div>
                       </div>
                   </div>
               </div>

               {/* Bottom Notes Row */}
               <div className="flex gap-1 mt-2">
                    <input className={`${inputStyle} border-purple-300`} placeholder="الملاحظات" value={formData.notes} onChange={e => handleChange('notes', e.target.value)} />
                    <div className={labelStyle}>الملاحظات</div>
               </div>
           </div>

           {/* Data Out (Optional Sidebar) */}
           <div className="w-full lg:w-48 bg-white p-2 border border-gray-300 rounded shadow-sm">
                <div className="text-center font-bold text-gray-600 mb-2 border-b pb-1">Data Out</div>
                <div className="space-y-2 text-sm">
                     <div className="flex justify-between border-b border-gray-100 pb-1">
                         <span className="text-gray-500">الخدمات</span>
                         <span className="font-bold">{formData.services || '532'}</span>
                     </div>
                     <div className="flex justify-between border-b border-gray-100 pb-1">
                         <span className="text-gray-500">الادارة</span>
                         <span className="font-bold">{formData.department}</span>
                     </div>
                     <div className="flex justify-between border-b border-gray-100 pb-1">
                         <span className="text-gray-500">القطاع</span>
                         <span className="font-bold">{formData.sector || 'قطاع شمال'}</span>
                     </div>
                     <div className="bg-gray-100 p-2 text-center text-xs font-mono text-gray-500">
                         System Status: Ready
                     </div>
                </div>
           </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mt-6 py-4 border-t border-b bg-white rounded shadow-sm">
            <button onClick={handleCreate} className="flex flex-col items-center text-green-700 hover:text-green-900 group">
                <div className="w-10 h-10 rounded-full border-2 border-green-600 flex items-center justify-center mb-1 group-hover:bg-green-50">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                </div>
                <span className="text-sm font-bold">إضافة</span>
            </button>
            <button onClick={handleReset} className="flex flex-col items-center text-green-700 hover:text-green-900 group">
                <div className="w-10 h-10 rounded-full border-2 border-green-600 flex items-center justify-center mb-1 group-hover:bg-green-50">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </div>
                <span className="text-sm font-bold">استرجاع</span>
            </button>
            <button onClick={handleUpdate} className="flex flex-col items-center text-green-700 hover:text-green-900 group">
                <div className="w-10 h-10 rounded-full border-2 border-green-600 flex items-center justify-center mb-1 group-hover:bg-green-50">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <span className="text-sm font-bold">تعديل</span>
            </button>
            <button onClick={handleDelete} className="flex flex-col items-center text-green-700 hover:text-green-900 group">
                <div className="w-10 h-10 rounded-full border-2 border-green-600 flex items-center justify-center mb-1 group-hover:bg-green-50">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </div>
                <span className="text-sm font-bold">حذف</span>
            </button>
            <button onClick={handleExcelExport} className="flex flex-col items-center text-green-700 hover:text-green-900 group">
                <div className="w-10 h-10 rounded-full border-2 border-green-600 flex items-center justify-center mb-1 group-hover:bg-green-50">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <span className="text-sm font-bold">اكسل</span>
            </button>
        </div>

        {/* Database Grid */}
        <div className="bg-white border border-gray-300 rounded relative shadow-sm mt-4 overflow-hidden">
            <div className="bg-gray-100 px-3 py-2 border-b font-bold text-gray-700 flex justify-between items-center">
                <span>Database</span>
                <span className="text-xs text-gray-400 font-normal">{orders.length} Records</span>
            </div>
            <div className="overflow-x-auto h-64">
                <table className="w-full text-right text-sm border-collapse">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            {["م", "التاريخ", "الفرع", "موديل الجرار", "محلي", "المعدة الملحقة", "محلي2", "البيفوت", "اسم السائق", "حسابي", "الاعادة", "الانجاز", "الوحدة", "الزمن"].map(h => (
                                <th key={h} className="border p-2 font-bold whitespace-nowrap text-gray-700">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {orders.length === 0 ? (
                            <tr><td colSpan={14} className="text-center p-4 text-gray-400">No records found</td></tr>
                        ) : (
                            orders.map(o => (
                                <tr 
                                    key={o.id} 
                                    onClick={() => handleEdit(o)}
                                    className={`cursor-pointer hover:bg-yellow-50 transition-colors ${selectedId === o.id ? 'bg-blue-100 text-blue-900 font-bold' : ''}`}
                                >
                                    <td className="border p-1">{o.id}</td>
                                    <td className="border p-1">{o.date}</td>
                                    <td className="border p-1">{o.branch}</td>
                                    <td className="border p-1">{o.tractor}</td>
                                    <td className="border p-1">{o.machineLocalNo}</td>
                                    <td className="border p-1">{o.attached}</td>
                                    <td className="border p-1">{o.attachedLocalNo}</td>
                                    <td className="border p-1">{o.pivot}</td>
                                    <td className="border p-1">{o.driver}</td>
                                    <td className="border p-1">{o.calculated}</td>
                                    <td className="border p-1">{o.actualOrReturn}</td>
                                    <td className="border p-1">{o.achievement}</td>
                                    <td className="border p-1">{o.unitType}</td>
                                    <td className="border p-1">{o.timeSpent}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default AgriWorkOrder;
