
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

  // Derived/Static Lists (Mocking what's in the screenshot dropdowns)
  const attachedOptions = ["مقطورة_سطحة", "معدة ذاتية_باليومية", "مقطورة حصاد", "اوتومايزر_بدلة", "ماكينة فوج", "مقطورة كسح"];
  const driverOptions = ["درويش شحاته شحاته درويش", "عادل طلبه السيد الشرقاوي", "محمد فرجاني عبدالقادر فرجاني", "عبدالرازق محمد عبد السلام حسين", "سائق أهالي", "بدون_سائق"];
  const departments = ["الادارة", "الصوب", "العنب", "الموالح"];
  const unitTypes = ["يومية", "فدان", "ساعة"];
  
  // Calculate Diff/Time logic if needed (Basic implementation)
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

  const handleSubmit = () => {
      if (!formData.branch || !formData.tractor) {
          alert("Please fill required fields (Branch, Tractor)");
          return;
      }
      
      const newRecord: AgriOrderRecord = {
          id: selectedId || (orders.length > 0 ? String(Math.max(...orders.map(o => Number(o.id))) + 1) : "1250"),
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
          sector: "قطاع شمال", // Default/Mock for Data Out
          services: "532" // Default/Mock for Data Out
      };

      if (selectedId) {
          onUpdateOrder(newRecord);
          alert("Updated successfully");
      } else {
          onAddOrder(newRecord);
      }
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
        attachedLocalNo: '1'
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

  // Helper for input classes to match the dense style
  const labelClass = "block text-xs font-bold text-teal-800 bg-teal-50 px-2 py-1 border border-teal-200 rounded-t-sm mb-0 text-center";
  const inputClass = "w-full px-2 py-1 text-sm border-x border-b border-teal-200 rounded-b-sm focus:ring-1 focus:ring-teal-500 outline-none font-bold text-center text-gray-700 bg-white h-9";
  const wrapperClass = "flex flex-col";

  return (
    <div className="p-4 space-y-4 bg-gray-100 min-h-screen font-sans" dir="rtl">
        {/* Top Section: Form & Info */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            
            {/* Enter Details (Takes up 3/4) */}
            <div className="lg:col-span-3 bg-white p-4 border-2 border-teal-600 rounded-md relative shadow-md">
                <span className="absolute -top-3 right-4 bg-white px-2 text-sm font-bold text-gray-600">Enter Detailes</span>
                
                <div className="grid grid-cols-6 gap-2 mb-2">
                    {/* Row 1: Counters */}
                    <div className={wrapperClass}>
                        <label className={labelClass}>نهاية العداد</label>
                        <input type="number" className={inputClass} value={formData.endCounter} onChange={e => handleChange('endCounter', e.target.value)} />
                    </div>
                    
                    <div className="col-span-2 flex items-center justify-center">
                        <div className="border border-gray-400 px-4 py-1 bg-gray-50 text-xl font-bold">{formData.date}</div>
                        <span className="bg-teal-700 text-white px-3 py-1 ml-0 font-bold">التاريخ</span>
                    </div>

                    <div className="col-span-2">
                        {/* Empty spacer or Branch Select */}
                        <div className="flex w-full">
                           <span className="bg-teal-700 text-white px-2 py-1 text-xs flex items-center w-20 justify-center">اسم الفرع</span>
                           <select className="flex-1 border p-1 font-bold text-sm" value={formData.branch} onChange={e => handleChange('branch', e.target.value)}>
                               <option value="">اختر الفرع...</option>
                               {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                           </select>
                        </div>
                    </div>
                    <div className={wrapperClass}>
                       <label className={labelClass}>بداية العداد</label>
                       <input type="number" className={inputClass} value={formData.startCounter} onChange={e => handleChange('startCounter', e.target.value)} />
                    </div>
                </div>

                <div className="grid grid-cols-6 gap-2 mb-2">
                    {/* Row 2 */}
                     <div className={wrapperClass}>
                        <label className={labelClass}>رقم الصف</label>
                        <input type="text" className={inputClass} value={formData.rowNumber || ''} onChange={e => handleChange('rowNumber', e.target.value)} />
                    </div>
                    
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-gray-500">ساعة</span>
                        <input type="number" className="w-12 border p-1 text-center font-bold" value={formData.timeSpent} onChange={e => handleChange('timeSpent', e.target.value)} />
                    </div>
                    
                    <div className="w-16">
                        <select className="w-full border p-1 text-center font-bold h-9" value={formData.machineLocalNo} onChange={e => handleChange('machineLocalNo', e.target.value)}>
                            {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                     <div className="w-16 flex items-center justify-center bg-teal-700 text-white text-xs font-bold h-9">محلي رقم</div>

                     <div className="col-span-2">
                         <div className="flex w-full h-9">
                           <select className="flex-1 border p-1 font-bold text-sm" value={formData.tractor} onChange={e => handleChange('tractor', e.target.value)}>
                               <option value="">اختر موديل الجرار...</option>
                               {machines.filter(m => m.category?.includes('جرار') || true).map(m => (
                                   <option key={m.id} value={m.category || m.id}>{m.category || m.id}</option>
                               ))}
                           </select>
                           <span className="bg-teal-700 text-white px-2 py-1 text-xs flex items-center w-24 justify-center">موديل الجرار</span>
                        </div>
                     </div>
                </div>

                <div className="grid grid-cols-6 gap-2 mb-2">
                     {/* Row 3 */}
                    <div className={wrapperClass}>
                        <label className="block text-xs font-bold text-pink-800 bg-pink-100 px-2 py-1 border border-pink-200 text-center">عدد النسخ</label>
                        <input type="number" className="w-full px-2 py-1 text-sm border-x border-b border-pink-200 text-center bg-pink-50 h-9" />
                    </div>

                    <div className="flex items-center gap-1 col-span-2 justify-end">
                         <div className="w-16">
                            <select className="w-full border p-1 text-center font-bold h-9" value={formData.attachedLocalNo} onChange={e => handleChange('attachedLocalNo', e.target.value)}>
                                {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                         </div>
                         <div className="w-16 flex items-center justify-center bg-teal-700 text-white text-xs font-bold h-9">محلي رقم</div>
                    </div>

                    <div className="col-span-2">
                         <div className="flex w-full h-9">
                           <select className="flex-1 border p-1 font-bold text-sm" value={formData.attached} onChange={e => handleChange('attached', e.target.value)}>
                               <option value="">المعدة الملحقة...</option>
                               {attachedOptions.map(o => <option key={o} value={o}>{o}</option>)}
                           </select>
                           <span className="bg-teal-700 text-white px-2 py-1 text-xs flex items-center w-24 justify-center">المعدة الملحقة</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-6 gap-2 mb-2 items-center">
                    <div className="col-span-1">
                        <select className="w-full border-2 border-yellow-200 bg-yellow-50 p-1 text-center font-bold text-blue-800 h-9" value={formData.unitType} onChange={e => handleChange('unitType', e.target.value)}>
                            {unitTypes.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                    <div className="col-span-1">
                        <input type="number" className="w-full border p-1 text-center font-bold h-9" value={formData.achievement} onChange={e => handleChange('achievement', e.target.value)} />
                    </div>
                    <div className="col-span-1 bg-teal-700 text-white text-xs font-bold h-9 flex items-center justify-center">الإنجاز الحسابي</div>
                    
                    <div className="col-span-2">
                        <div className="flex w-full h-9">
                           <select className="flex-1 border p-1 font-bold text-sm" value={formData.department} onChange={e => handleChange('department', e.target.value)}>
                               {departments.map(d => <option key={d} value={d}>{d}</option>)}
                           </select>
                           <span className="bg-teal-700 text-white px-2 py-1 text-xs flex items-center w-24 justify-center">الادارة</span>
                        </div>
                    </div>

                    <div className="col-span-1">
                        <div className="flex w-full h-9 border border-gray-300">
                             <input type="text" className="flex-1 text-center font-bold" value={formData.pivot} onChange={e => handleChange('pivot', e.target.value)} />
                             <span className="bg-teal-700 text-white text-xs flex items-center justify-center px-1">رقم البيفوت</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-6 gap-2 mb-2 items-center">
                    <div className="col-span-1">
                        <input type="number" className="w-full border bg-yellow-50 p-1 text-center font-bold h-9" value={0} disabled />
                    </div>
                    <div className="col-span-1">
                         <input type="number" className="w-full border p-1 text-center font-bold h-9" value={formData.actualOrReturn} onChange={e => handleChange('actualOrReturn', e.target.value)} />
                    </div>
                     <div className="col-span-1 bg-teal-700 text-white text-xs font-bold h-9 flex items-center justify-center text-center leading-3">الإعادة أو الفعلي</div>

                     <div className="col-span-2">
                        <div className="flex w-full h-9">
                           <select className="flex-1 border p-1 font-bold text-sm" value={formData.driver} onChange={e => handleChange('driver', e.target.value)}>
                               <option value="">اختر السائق...</option>
                               {driverOptions.map(d => <option key={d} value={d}>{d}</option>)}
                           </select>
                           <span className="bg-teal-700 text-white px-2 py-1 text-xs flex items-center w-24 justify-center">اسم السائق</span>
                        </div>
                    </div>
                </div>

                 <div className="grid grid-cols-6 gap-2">
                    <div className="col-span-5">
                        <input type="text" className="w-full border-2 border-purple-200 p-2 h-10" placeholder="الملاحظات" value={formData.notes} onChange={e => handleChange('notes', e.target.value)} />
                    </div>
                     <div className="col-span-1 bg-teal-700 text-white flex items-center justify-center font-bold rounded-sm">
                         الملاحظات
                     </div>
                 </div>

            </div>

            {/* Data Out (Takes up 1/4) */}
            <div className="lg:col-span-1 bg-white p-2 border border-gray-300 rounded-md relative shadow-sm">
                 <span className="absolute -top-3 right-4 bg-white px-2 text-sm font-bold text-gray-600">Data Out</span>
                 
                 <div className="space-y-2 mt-2">
                     <div className="border border-red-200 bg-red-50 p-2">
                         <div className="text-teal-700 font-bold mb-1">الخدمات</div>
                         <div className="bg-white border p-1 font-mono">{formData.services || '532'}</div>
                     </div>
                     <div className="border border-red-200 bg-red-50 p-2">
                         <div className="text-teal-700 font-bold mb-1">الادارة</div>
                         <div className="bg-white border p-1">{formData.department}</div>
                     </div>
                     <div className="grid grid-cols-1 gap-1">
                         <div className="bg-white border p-1 font-bold text-teal-700 text-center">{formData.sector || 'قطاع شمال'}</div>
                         <div className="bg-gray-100 border p-1 h-6"></div>
                         <div className="bg-gray-100 border p-1 h-6"></div>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-1 text-center text-xs font-bold">
                          <div className="bg-white border p-1">0</div>
                          <div className="bg-gray-200 p-1">مساحة البيفوت</div>
                          
                          <div className="bg-white border p-1">34.5</div>
                          <div className="bg-gray-200 p-1">المساحة المنفذة</div>

                          <div className="bg-white border p-1">0</div>
                          <div className="bg-gray-200 p-1">070 HP</div>

                          <div className="bg-white border p-1 ltr">23/12/2024</div>
                          <div className="bg-white border p-1 ltr">136</div>
                     </div>

                     <div className="space-y-1">
                         <div className="bg-green-100 border border-green-300 text-green-800 text-center font-bold text-xs p-1">ROCK</div>
                         <div className="bg-green-100 border border-green-300 text-green-800 text-center font-bold text-xs p-1">mech-tra-flt</div>
                         <div className="bg-green-100 border border-green-300 text-green-800 text-center font-bold text-xs p-1">mech-flt-loc-0000-09</div>
                         <div className="bg-green-100 border border-green-300 text-green-800 text-center font-bold text-xs p-1">ROCK</div>
                     </div>
                 </div>
            </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 py-2 border-t border-b bg-white">
            <button onClick={handleExcelExport} className="flex flex-col items-center text-green-700 hover:text-green-900 px-4">
                <span className="text-2xl">📊</span>
                <span className="text-sm font-bold">اكسل</span>
            </button>
            <button onClick={handleDelete} className="flex flex-col items-center text-green-700 hover:text-green-900 px-4">
                <span className="text-2xl">🗑️</span>
                <span className="text-sm font-bold">حذف</span>
            </button>
            <button onClick={handleSubmit} className="flex flex-col items-center text-green-700 hover:text-green-900 px-4">
                <span className="text-2xl">📝</span>
                <span className="text-sm font-bold">تعديل</span>
            </button>
            <button onClick={handleReset} className="flex flex-col items-center text-green-700 hover:text-green-900 px-4">
                <span className="text-2xl">🔄</span>
                <span className="text-sm font-bold">استرجاع</span>
            </button>
            <button onClick={handleSubmit} className="flex flex-col items-center text-green-700 hover:text-green-900 px-4">
                <span className="text-2xl">💾</span>
                <span className="text-sm font-bold">إضافة</span>
            </button>
        </div>

        {/* Database Grid */}
        <div className="bg-white border border-gray-300 rounded-md relative shadow-md overflow-hidden">
            <span className="absolute top-0 left-0 bg-white px-2 text-sm font-bold text-gray-600 border-b border-r z-10">Database</span>
            <div className="overflow-x-auto h-64 mt-6">
                <table className="w-full text-right text-sm border-collapse">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            {["م", "التاريخ", "الفرع", "موديل الجرار", "محلي", "المعدة الملحقة", "محلي2", "البيفوت", "اسم السائق", "حسابي", "الاعادة", "الانجاز", "الوحدة", "الزمن"].map(h => (
                                <th key={h} className="border p-2 font-bold whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {orders.length === 0 ? (
                            <tr><td colSpan={14} className="text-center p-4">No records found</td></tr>
                        ) : (
                            orders.map(o => (
                                <tr 
                                    key={o.id} 
                                    onClick={() => handleEdit(o)}
                                    className={`cursor-pointer hover:bg-yellow-50 ${selectedId === o.id ? 'bg-blue-100 text-blue-900 font-bold' : ''}`}
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
