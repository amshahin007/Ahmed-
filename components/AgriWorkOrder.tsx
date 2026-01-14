
import React, { useState, useEffect, useRef } from 'react';
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

  // --- DRAG & DROP STATE ---
  const [rowOrder, setRowOrder] = useState<string[]>(() => {
      const saved = localStorage.getItem('wf_agri_row_order');
      return saved ? JSON.parse(saved) : ['row1', 'row2', 'row3', 'row4', 'row5', 'notes'];
  });
  
  const [btnOrder, setBtnOrder] = useState<string[]>(() => {
      const saved = localStorage.getItem('wf_agri_btn_order');
      return saved ? JSON.parse(saved) : ['add', 'restore', 'edit', 'delete', 'excel'];
  });

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragType, setDragType] = useState<'row' | 'btn' | null>(null);

  // Derived/Static Lists
  const attachedOptions = ["مقطورة_سطحة", "معدة ذاتية_باليومية", "مقطورة حصاد", "اوتومايزر_بدلة", "ماكينة فوج", "مقطورة كسح"];
  const driverOptions = ["درويش شحاته شحاته درويش", "عادل طلبه السيد الشرقاوي", "محمد فرجاني عبدالقادر فرجاني", "عبدالرازق محمد عبد السلام حسين", "سائق أهالي", "بدون_سائق"];
  const departments = ["الادارة", "الصوب", "العنب", "الموالح"];
  const unitTypes = ["يومية", "فدان", "ساعة"];
  
  useEffect(() => {
     // Example auto-calc
     const calc = (formData.endCounter || 0) - (formData.startCounter || 0);
     if (calc > 0 && formData.startCounter && formData.endCounter) {
         setFormData(prev => ({ ...prev, calculated: calc }));
     }
  }, [formData.startCounter, formData.endCounter]);

  // Persist Layout Changes
  useEffect(() => { localStorage.setItem('wf_agri_row_order', JSON.stringify(rowOrder)); }, [rowOrder]);
  useEffect(() => { localStorage.setItem('wf_agri_btn_order', JSON.stringify(btnOrder)); }, [btnOrder]);


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
          alert("No record selected. Click a row in the table first.");
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
          alert("Select a record first.");
      }
  };

  const handleExcelExport = () => {
    const ws = XLSX.utils.json_to_sheet(orders);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AgriOrders");
    XLSX.writeFile(wb, "AgriWorkOrders.xlsx");
  };

  // --- DRAG HANDLERS ---
  const handleDragStart = (e: React.DragEvent, position: number, type: 'row' | 'btn') => {
      dragItem.current = position;
      setDragType(type);
      e.dataTransfer.effectAllowed = "move";
      // Slightly fade the element being dragged
      (e.target as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnter = (e: React.DragEvent, position: number) => {
      dragOverItem.current = position;
  };

  const handleDragEnd = (e: React.DragEvent) => {
      (e.target as HTMLElement).style.opacity = '1';
      
      if (dragItem.current === null || dragOverItem.current === null) return;
      
      if (dragType === 'row') {
          const newOrder = [...rowOrder];
          const draggedItemContent = newOrder[dragItem.current];
          newOrder.splice(dragItem.current, 1);
          newOrder.splice(dragOverItem.current, 0, draggedItemContent);
          setRowOrder(newOrder);
      } else if (dragType === 'btn') {
          const newOrder = [...btnOrder];
          const draggedItemContent = newOrder[dragItem.current];
          newOrder.splice(dragItem.current, 1);
          newOrder.splice(dragOverItem.current, 0, draggedItemContent);
          setBtnOrder(newOrder);
      }

      dragItem.current = null;
      dragOverItem.current = null;
      setDragType(null);
  };

  // Styles
  const labelClass = "block text-xs font-bold text-teal-800 bg-teal-50 px-2 py-1 border border-teal-200 rounded-t-sm mb-0 text-center";
  const inputClass = "w-full px-2 py-1 text-sm border-x border-b border-teal-200 rounded-b-sm focus:ring-1 focus:ring-teal-500 outline-none font-bold text-center text-gray-700 bg-white h-9";
  const wrapperClass = "flex flex-col";
  
  // Row Renderers
  const renderRow1 = () => (
    <div className="grid grid-cols-6 gap-2 mb-2">
        <div className={wrapperClass}>
            <label className={labelClass}>نهاية العداد</label>
            <input type="number" className={inputClass} value={formData.endCounter} onChange={e => handleChange('endCounter', e.target.value)} />
        </div>
        
        <div className="col-span-2 flex items-center justify-center">
            <div className="border border-gray-400 px-4 py-1 bg-gray-50 text-xl font-bold w-full text-center">{formData.date}</div>
            <span className="bg-teal-700 text-white px-3 py-1 ml-0 font-bold h-9 flex items-center">التاريخ</span>
        </div>

        <div className="col-span-2">
            <div className="flex w-full">
                <span className="bg-teal-700 text-white px-2 py-1 text-xs flex items-center w-20 justify-center h-9">اسم الفرع</span>
                <select className="flex-1 border p-1 font-bold text-sm h-9" value={formData.branch} onChange={e => handleChange('branch', e.target.value)}>
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
  );

  const renderRow2 = () => (
    <div className="grid grid-cols-6 gap-2 mb-2">
        <div className={wrapperClass}>
            <label className={labelClass}>رقم الصف</label>
            <input type="text" className={inputClass} value={formData.rowNumber || ''} onChange={e => handleChange('rowNumber', e.target.value)} />
        </div>
        
        <div className="flex items-center gap-1 justify-center">
            <span className="text-xs font-bold text-gray-500">ساعة</span>
            <input type="number" className="w-16 border p-1 text-center font-bold h-9" value={formData.timeSpent} onChange={e => handleChange('timeSpent', e.target.value)} />
        </div>
        
        <div className="flex items-center">
            <select className="flex-1 border p-1 text-center font-bold h-9" value={formData.machineLocalNo} onChange={e => handleChange('machineLocalNo', e.target.value)}>
                {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <div className="w-16 flex items-center justify-center bg-teal-700 text-white text-xs font-bold h-9">محلي رقم</div>
        </div>

        <div className="col-span-2">
            <div className="flex w-full h-9">
                <select className="flex-1 border p-1 font-bold text-sm" value={formData.tractor} onChange={e => handleChange('tractor', e.target.value)}>
                    <option value="">اختر موديل الجرار...</option>
                    {machines.filter(m => m.category?.includes('جرار') || true).map(m => (
                        <option key={m.id} value={m.category || m.id}>{m.category || m.id}</option>
                    ))}
                </select>
                <span className="bg-teal-700 text-white px-2 py-1 text-xs flex items-center w-24 justify-center"> موديل الجرار</span>
            </div>
        </div>
    </div>
  );

  const renderRow3 = () => (
    <div className="grid grid-cols-6 gap-2 mb-2">
        <div className={wrapperClass}>
            <label className="block text-xs font-bold text-pink-800 bg-pink-100 px-2 py-1 border border-pink-200 text-center">عدد النسخ</label>
            <input type="number" className="w-full px-2 py-1 text-sm border-x border-b border-pink-200 text-center bg-pink-50 h-9" />
        </div>

        <div className="flex items-center gap-1 col-span-2 justify-end">
            <div className="flex items-center w-full justify-end">
                <select className="w-16 border p-1 text-center font-bold h-9" value={formData.attachedLocalNo} onChange={e => handleChange('attachedLocalNo', e.target.value)}>
                    {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <div className="w-16 flex items-center justify-center bg-teal-700 text-white text-xs font-bold h-9">محلي رقم</div>
            </div>
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
  );

  const renderRow4 = () => (
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
                <input type="text" className="flex-1 text-center font-bold w-full min-w-0" value={formData.pivot} onChange={e => handleChange('pivot', e.target.value)} />
                <span className="bg-teal-700 text-white text-xs flex items-center justify-center px-1 shrink-0">رقم البيفوت</span>
            </div>
        </div>
    </div>
  );

  const renderRow5 = () => (
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
  );

  const renderNotes = () => (
    <div className="grid grid-cols-6 gap-2">
        <div className="col-span-5">
            <input type="text" className="w-full border-2 border-purple-200 p-2 h-10" placeholder="الملاحظات" value={formData.notes} onChange={e => handleChange('notes', e.target.value)} />
        </div>
        <div className="col-span-1 bg-teal-700 text-white flex items-center justify-center font-bold rounded-sm h-10">
            الملاحظات
        </div>
    </div>
  );

  const rowMap: Record<string, () => React.ReactElement> = {
      'row1': renderRow1,
      'row2': renderRow2,
      'row3': renderRow3,
      'row4': renderRow4,
      'row5': renderRow5,
      'notes': renderNotes
  };

  const renderButton = (btnId: string) => {
      switch(btnId) {
          case 'add': return (
            <button onClick={handleCreate} className="flex flex-col items-center text-green-700 hover:text-green-900 px-4 group transition-transform hover:scale-105">
                <div className="w-10 h-10 rounded-full border-2 border-green-600 flex items-center justify-center mb-1 group-hover:bg-green-50">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5v0m0-3v3m0 0h3m-3 0H9" /></svg>
                </div>
                <span className="text-sm font-bold">إضافة</span>
            </button>
          );
          case 'restore': return (
            <button onClick={handleReset} className="flex flex-col items-center text-green-700 hover:text-green-900 px-4 group transition-transform hover:scale-105">
                <div className="w-10 h-10 rounded-full border-2 border-green-600 flex items-center justify-center mb-1 group-hover:bg-green-50">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </div>
                <span className="text-sm font-bold">استرجاع</span>
            </button>
          );
          case 'edit': return (
            <button onClick={handleUpdate} className="flex flex-col items-center text-green-700 hover:text-green-900 px-4 group transition-transform hover:scale-105">
                <div className="w-10 h-10 rounded-full border-2 border-green-600 flex items-center justify-center mb-1 group-hover:bg-green-50">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <span className="text-sm font-bold">تعديل</span>
            </button>
          );
          case 'delete': return (
            <button onClick={handleDelete} className="flex flex-col items-center text-green-700 hover:text-green-900 px-4 group transition-transform hover:scale-105">
                <div className="w-10 h-10 rounded-full border-2 border-green-600 flex items-center justify-center mb-1 group-hover:bg-green-50">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </div>
                <span className="text-sm font-bold">حذف</span>
            </button>
          );
          case 'excel': return (
            <button onClick={handleExcelExport} className="flex flex-col items-center text-green-700 hover:text-green-900 px-4 group transition-transform hover:scale-105">
                <div className="w-10 h-10 rounded-full border-2 border-green-600 flex items-center justify-center mb-1 group-hover:bg-green-50">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <span className="text-sm font-bold">اكسل</span>
            </button>
          );
      }
  };

  return (
    <div className="p-4 space-y-4 bg-gray-100 min-h-screen font-sans" dir="rtl">
        {/* Top Section: Form & Info */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            
            {/* Enter Details (Takes up 3/4) */}
            <div className="lg:col-span-3 bg-white p-4 border-2 border-teal-600 rounded-md relative shadow-md">
                <span className="absolute -top-3 right-4 bg-white px-2 text-sm font-bold text-gray-600 z-10">Enter Detailes</span>
                
                {/* Draggable Form Rows */}
                <div className="space-y-1 mt-2">
                    {rowOrder.map((rowId, index) => (
                        <div 
                            key={rowId}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index, 'row')}
                            onDragEnter={(e) => handleDragEnter(e, index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            className="cursor-move hover:bg-gray-50 p-1 border border-transparent hover:border-dashed hover:border-gray-300 rounded transition"
                            title="Drag to reorder row"
                        >
                            {rowMap[rowId]()}
                        </div>
                    ))}
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

        {/* Draggable Action Buttons */}
        <div className="flex justify-center gap-6 py-4 border-t border-b bg-white rounded-lg shadow-sm overflow-x-auto">
            {btnOrder.map((btnId, index) => (
                <div
                    key={btnId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index, 'btn')}
                    onDragEnter={(e) => handleDragEnter(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className="cursor-move active:cursor-grabbing"
                    title="Drag to reorder button"
                >
                    {renderButton(btnId)}
                </div>
            ))}
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
