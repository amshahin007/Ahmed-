
import React, { useState, useEffect, useRef, useMemo } from 'react';
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

// Helper Types for Layout
type FieldBlock = {
  id: string;
  colSpan: string; // Tailwind class, e.g., 'col-span-1'
  render: () => React.ReactNode;
};

const AgriWorkOrder: React.FC<AgriWorkOrderProps> = ({ orders, onAddOrder, onUpdateOrder, onDeleteOrders, locations, machines }) => {
  // --- Form State ---
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
  // Layout is an array of rows, where each row is an array of Field IDs
  const DEFAULT_LAYOUT = [
    ['endCounter', 'date', 'branch', 'startCounter'],
    ['rowNumber', 'timeSpent', 'machineLocal', 'tractor'],
    ['copyCount', 'attachedLocal', 'attached'],
    ['unitType', 'achievement', 'calcLabel', 'department', 'pivot'],
    ['zero', 'actualReturn', 'actualLabel', 'driver'],
    ['notes', 'notesLabel']
  ];

  const [layout, setLayout] = useState<string[][]>(() => {
      try {
          const saved = localStorage.getItem('wf_agri_form_layout');
          return saved ? JSON.parse(saved) : DEFAULT_LAYOUT;
      } catch (e) { return DEFAULT_LAYOUT; }
  });
  
  const [btnOrder, setBtnOrder] = useState<string[]>(() => {
      const saved = localStorage.getItem('wf_agri_btn_order');
      return saved ? JSON.parse(saved) : ['add', 'restore', 'edit', 'delete', 'excel'];
  });

  // Drag Refs
  const dragItem = useRef<{ type: 'field' | 'btn', row?: number, col?: number, index?: number } | null>(null);
  const dragOverItem = useRef<{ type: 'field' | 'btn', row?: number, col?: number, index?: number } | null>(null);

  // Derived Data
  const attachedOptions = ["مقطورة_سطحة", "معدة ذاتية_باليومية", "مقطورة حصاد", "اوتومايزر_بدلة", "ماكينة فوج", "مقطورة كسح"];
  const driverOptions = ["درويش شحاته شحاته درويش", "عادل طلبه السيد الشرقاوي", "محمد فرجاني عبدالقادر فرجاني", "عبدالرازق محمد عبد السلام حسين", "سائق أهالي", "بدون_سائق"];
  const departments = ["الادارة", "الصوب", "العنب", "الموالح"];
  const unitTypes = ["يومية", "فدان", "ساعة"];
  
  // Auto Calc
  useEffect(() => {
     const calc = (formData.endCounter || 0) - (formData.startCounter || 0);
     if (calc > 0 && formData.startCounter && formData.endCounter) {
         setFormData(prev => ({ ...prev, calculated: calc }));
     }
  }, [formData.startCounter, formData.endCounter]);

  // Persist Layout
  useEffect(() => { localStorage.setItem('wf_agri_form_layout', JSON.stringify(layout)); }, [layout]);
  useEffect(() => { localStorage.setItem('wf_agri_btn_order', JSON.stringify(btnOrder)); }, [btnOrder]);

  const handleChange = (field: keyof AgriOrderRecord, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // --- Field Block Definitions ---
  // Reusable Styles
  const labelClass = "block text-xs font-bold text-teal-800 bg-teal-50 px-2 py-1 border border-teal-200 rounded-t-sm mb-0 text-center";
  const inputClass = "w-full px-2 py-1 text-sm border-x border-b border-teal-200 rounded-b-sm focus:ring-1 focus:ring-teal-500 outline-none font-bold text-center text-gray-700 bg-white h-9";
  const wrapperClass = "flex flex-col h-full justify-end";
  const tealLabel = "bg-teal-700 text-white px-2 py-1 text-xs flex items-center justify-center font-bold h-9";

  const fieldRegistry: Record<string, FieldBlock> = useMemo(() => ({
    'endCounter': {
        id: 'endCounter',
        colSpan: 'col-span-1',
        render: () => (
            <div className={wrapperClass}>
                <label className={labelClass}>نهاية العداد</label>
                <input type="number" className={inputClass} value={formData.endCounter} onChange={e => handleChange('endCounter', e.target.value)} />
            </div>
        )
    },
    'date': {
        id: 'date',
        colSpan: 'col-span-2',
        render: () => (
            <div className="flex items-end h-full">
                <div className="border border-gray-400 px-4 py-1 bg-gray-50 text-xl font-bold w-full text-center h-9 flex items-center justify-center">{formData.date}</div>
                <span className={`${tealLabel} w-24 shrink-0`}>التاريخ</span>
            </div>
        )
    },
    'branch': {
        id: 'branch',
        colSpan: 'col-span-2',
        render: () => (
            <div className="flex items-end h-full">
                <span className={`${tealLabel} w-20`}>اسم الفرع</span>
                <select className="flex-1 border p-1 font-bold text-sm h-9" value={formData.branch} onChange={e => handleChange('branch', e.target.value)}>
                    <option value="">اختر الفرع...</option>
                    {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
            </div>
        )
    },
    'startCounter': {
        id: 'startCounter',
        colSpan: 'col-span-1',
        render: () => (
            <div className={wrapperClass}>
                <label className={labelClass}>بداية العداد</label>
                <input type="number" className={inputClass} value={formData.startCounter} onChange={e => handleChange('startCounter', e.target.value)} />
            </div>
        )
    },
    'rowNumber': {
        id: 'rowNumber',
        colSpan: 'col-span-1',
        render: () => (
            <div className={wrapperClass}>
                <label className={labelClass}>رقم الصف</label>
                <input type="text" className={inputClass} value={formData.rowNumber || ''} onChange={e => handleChange('rowNumber', e.target.value)} />
            </div>
        )
    },
    'timeSpent': {
        id: 'timeSpent',
        colSpan: 'col-span-1',
        render: () => (
            <div className="flex items-center gap-1 justify-center h-full pt-4">
                <span className="text-xs font-bold text-gray-500">ساعة</span>
                <input type="number" className="w-16 border p-1 text-center font-bold h-9" value={formData.timeSpent} onChange={e => handleChange('timeSpent', e.target.value)} />
            </div>
        )
    },
    'machineLocal': {
        id: 'machineLocal',
        colSpan: 'col-span-1',
        render: () => (
            <div className="flex items-center h-full pt-4 justify-end">
                <select className="w-16 border p-1 text-center font-bold h-9" value={formData.machineLocalNo} onChange={e => handleChange('machineLocalNo', e.target.value)}>
                    {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <div className={`${tealLabel} w-16`}>محلي رقم</div>
            </div>
        )
    },
    'tractor': {
        id: 'tractor',
        colSpan: 'col-span-3', // Wider
        render: () => (
            <div className="flex items-end h-full">
                <select className="flex-1 border p-1 font-bold text-sm h-9" value={formData.tractor} onChange={e => handleChange('tractor', e.target.value)}>
                    <option value="">اختر موديل الجرار...</option>
                    {machines.filter(m => m.category?.includes('جرار') || true).map(m => (
                        <option key={m.id} value={m.category || m.id}>{m.category || m.id}</option>
                    ))}
                </select>
                <span className={`${tealLabel} w-24`}>موديل الجرار</span>
            </div>
        )
    },
    'copyCount': {
        id: 'copyCount',
        colSpan: 'col-span-1',
        render: () => (
            <div className={wrapperClass}>
                <label className="block text-xs font-bold text-pink-800 bg-pink-100 px-2 py-1 border border-pink-200 text-center">عدد النسخ</label>
                <input type="number" className="w-full px-2 py-1 text-sm border-x border-b border-pink-200 text-center bg-pink-50 h-9" />
            </div>
        )
    },
    'attachedLocal': {
        id: 'attachedLocal',
        colSpan: 'col-span-2',
        render: () => (
            <div className="flex items-end h-full justify-end">
                <div className="flex items-center">
                    <select className="w-16 border p-1 text-center font-bold h-9" value={formData.attachedLocalNo} onChange={e => handleChange('attachedLocalNo', e.target.value)}>
                        {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <div className={`${tealLabel} w-16`}>محلي رقم</div>
                </div>
            </div>
        )
    },
    'attached': {
        id: 'attached',
        colSpan: 'col-span-3',
        render: () => (
            <div className="flex items-end h-full">
                <select className="flex-1 border p-1 font-bold text-sm h-9" value={formData.attached} onChange={e => handleChange('attached', e.target.value)}>
                    <option value="">المعدة الملحقة...</option>
                    {attachedOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <span className={`${tealLabel} w-24`}>المعدة الملحقة</span>
            </div>
        )
    },
    'unitType': {
        id: 'unitType',
        colSpan: 'col-span-1',
        render: () => (
             <div className="flex items-end h-full">
                <select className="w-full border-2 border-yellow-200 bg-yellow-50 p-1 text-center font-bold text-blue-800 h-9" value={formData.unitType} onChange={e => handleChange('unitType', e.target.value)}>
                    {unitTypes.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
            </div>
        )
    },
    'achievement': {
        id: 'achievement',
        colSpan: 'col-span-1',
        render: () => (
             <div className="flex items-end h-full">
                <input type="number" className="w-full border p-1 text-center font-bold h-9" value={formData.achievement} onChange={e => handleChange('achievement', e.target.value)} />
            </div>
        )
    },
    'calcLabel': {
        id: 'calcLabel',
        colSpan: 'col-span-1',
        render: () => (
            <div className="flex items-end h-full">
                 <div className={`${tealLabel} w-full`}>الإنجاز الحسابي</div>
            </div>
        )
    },
    'department': {
        id: 'department',
        colSpan: 'col-span-2',
        render: () => (
            <div className="flex items-end h-full">
                <select className="flex-1 border p-1 font-bold text-sm h-9" value={formData.department} onChange={e => handleChange('department', e.target.value)}>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <span className={`${tealLabel} w-24`}>الادارة</span>
            </div>
        )
    },
    'pivot': {
        id: 'pivot',
        colSpan: 'col-span-1',
        render: () => (
            <div className="flex items-end h-full">
                <div className="flex w-full h-9 border border-gray-300">
                    <input type="text" className="flex-1 text-center font-bold w-full min-w-0" value={formData.pivot} onChange={e => handleChange('pivot', e.target.value)} />
                    <span className="bg-teal-700 text-white text-xs flex items-center justify-center px-1 shrink-0">رقم البيفوت</span>
                </div>
            </div>
        )
    },
    'zero': {
        id: 'zero',
        colSpan: 'col-span-1',
        render: () => (
            <div className="flex items-end h-full">
                <input type="number" className="w-full border bg-yellow-50 p-1 text-center font-bold h-9" value={0} disabled />
            </div>
        )
    },
    'actualReturn': {
        id: 'actualReturn',
        colSpan: 'col-span-1',
        render: () => (
            <div className="flex items-end h-full">
                <input type="number" className="w-full border p-1 text-center font-bold h-9" value={formData.actualOrReturn} onChange={e => handleChange('actualOrReturn', e.target.value)} />
            </div>
        )
    },
    'actualLabel': {
        id: 'actualLabel',
        colSpan: 'col-span-1',
        render: () => (
             <div className="flex items-end h-full">
                 <div className={`${tealLabel} w-full leading-3 text-center`}>الإعادة أو الفعلي</div>
             </div>
        )
    },
    'driver': {
        id: 'driver',
        colSpan: 'col-span-3',
        render: () => (
            <div className="flex items-end h-full">
                <select className="flex-1 border p-1 font-bold text-sm h-9" value={formData.driver} onChange={e => handleChange('driver', e.target.value)}>
                    <option value="">اختر السائق...</option>
                    {driverOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <span className={`${tealLabel} w-24`}>اسم السائق</span>
            </div>
        )
    },
    'notes': {
        id: 'notes',
        colSpan: 'col-span-5',
        render: () => (
             <div className="flex items-end h-full">
                <input type="text" className="w-full border-2 border-purple-200 p-2 h-10" placeholder="الملاحظات" value={formData.notes} onChange={e => handleChange('notes', e.target.value)} />
             </div>
        )
    },
    'notesLabel': {
        id: 'notesLabel',
        colSpan: 'col-span-1',
        render: () => (
            <div className="flex items-end h-full">
                <div className="bg-teal-700 text-white flex items-center justify-center font-bold rounded-sm h-10 w-full">
                    الملاحظات
                </div>
            </div>
        )
    }

  }), [formData, locations, machines]);

  // --- CRUD Operations ---
  const getRecordFromForm = (id: string): AgriOrderRecord => {
      return {
          id: id,
          ...formData as AgriOrderRecord,
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
      onAddOrder(getRecordFromForm(newId));
      handleReset();
  };

  const handleUpdateRecord = () => {
      if (!selectedId) {
          alert("No record selected.");
          return;
      }
      onUpdateOrder(getRecordFromForm(selectedId));
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
      if (selectedId && confirm("Delete this record?")) {
          onDeleteOrders([selectedId]);
          handleReset();
      }
  };

  const handleExcelExport = () => {
    const ws = XLSX.utils.json_to_sheet(orders);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AgriOrders");
    XLSX.writeFile(wb, "AgriWorkOrders.xlsx");
  };

  // --- DRAG LOGIC ---
  const handleDragStart = (e: React.DragEvent, type: 'field' | 'btn', rowIndex?: number, colIndex?: number, index?: number) => {
      dragItem.current = { type, row: rowIndex, col: colIndex, index };
      e.dataTransfer.effectAllowed = "move";
      (e.target as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnter = (e: React.DragEvent, type: 'field' | 'btn', rowIndex?: number, colIndex?: number, index?: number) => {
      dragOverItem.current = { type, row: rowIndex, col: colIndex, index };
  };

  const handleDragEnd = (e: React.DragEvent) => {
      (e.target as HTMLElement).style.opacity = '1';
      const source = dragItem.current;
      const target = dragOverItem.current;

      if (!source || !target || source.type !== target.type) {
          dragItem.current = null;
          dragOverItem.current = null;
          return;
      }

      if (source.type === 'field' && source.row !== undefined && source.col !== undefined && target.row !== undefined && target.col !== undefined) {
          // Deep clone layout
          const newLayout = layout.map(row => [...row]);
          
          // Remove from source
          const item = newLayout[source.row][source.col];
          newLayout[source.row].splice(source.col, 1);
          
          // Insert into target
          // Fix index shift if dragging within same row
          let targetIndex = target.col;
          if (source.row === target.row && source.col < target.col) {
              // If moving from left to right in same row, the removal shifted indices
              // targetIndex represents the visual position we hovered over, but the array is now shorter
              // Usually just inserting at target.col works if we haven't mutated yet, but we did.
              // Actually, simply splicing works if we account for shift, but easier logic:
          }
          newLayout[target.row].splice(target.col, 0, item);
          
          // Clean empty rows if desired, or keep them? Let's keep empty rows so users can drag back into them
          
          setLayout(newLayout);
      } else if (source.type === 'btn' && source.index !== undefined && target.index !== undefined) {
          const newOrder = [...btnOrder];
          const item = newOrder[source.index];
          newOrder.splice(source.index, 1);
          newOrder.splice(target.index, 0, item);
          setBtnOrder(newOrder);
      }

      dragItem.current = null;
      dragOverItem.current = null;
  };

  const renderButton = (btnId: string) => {
      const btnClass = "flex flex-col items-center text-green-700 hover:text-green-900 px-4 group transition-transform hover:scale-105";
      const iconContainer = "w-10 h-10 rounded-full border-2 border-green-600 flex items-center justify-center mb-1 group-hover:bg-green-50";
      
      switch(btnId) {
          case 'add': return (
            <button onClick={handleCreate} className={btnClass}>
                <div className={iconContainer}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                </div>
                <span className="text-sm font-bold">إضافة</span>
            </button>
          );
          case 'restore': return (
            <button onClick={handleReset} className={btnClass}>
                <div className={iconContainer}>
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </div>
                <span className="text-sm font-bold">استرجاع</span>
            </button>
          );
          case 'edit': return (
            <button onClick={handleUpdateRecord} className={btnClass}>
                <div className={iconContainer}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <span className="text-sm font-bold">تعديل</span>
            </button>
          );
          case 'delete': return (
            <button onClick={handleDelete} className={btnClass}>
                <div className={iconContainer}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </div>
                <span className="text-sm font-bold">حذف</span>
            </button>
          );
          case 'excel': return (
            <button onClick={handleExcelExport} className={btnClass}>
                <div className={iconContainer}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <span className="text-sm font-bold">اكسل</span>
            </button>
          );
      }
  };

  return (
    <div className="p-4 space-y-4 bg-gray-100 min-h-screen font-sans" dir="rtl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            
            {/* Form Area */}
            <div className="lg:col-span-3 bg-white p-4 border-2 border-teal-600 rounded-md relative shadow-md">
                <span className="absolute -top-3 right-4 bg-white px-2 text-sm font-bold text-gray-600 z-10">Enter Detailes</span>
                
                <div className="space-y-3 mt-4">
                    {layout.map((rowFields, rIndex) => (
                        <div 
                            key={rIndex} 
                            className="grid grid-cols-6 gap-2 p-1 min-h-[50px] border border-transparent hover:border-dashed hover:border-gray-300 transition-colors rounded"
                        >
                            {rowFields.map((fieldId, cIndex) => {
                                const field = fieldRegistry[fieldId];
                                if (!field) return null;
                                return (
                                    <div 
                                        key={fieldId}
                                        className={`${field.colSpan} cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-blue-100 rounded transition relative group`}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, 'field', rIndex, cIndex)}
                                        onDragEnter={(e) => handleDragEnter(e, 'field', rIndex, cIndex)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => e.preventDefault()}
                                    >
                                        <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 cursor-move text-gray-300">⋮</div>
                                        {field.render()}
                                    </div>
                                );
                            })}
                            {/* Drop zone placeholder for empty rows */}
                            {rowFields.length === 0 && (
                                <div 
                                    className="col-span-6 h-full flex items-center justify-center text-gray-300 text-xs italic border-2 border-dashed border-gray-100 rounded"
                                    onDragEnter={(e) => handleDragEnter(e, 'field', rIndex, 0)}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    Empty Row (Drop Here)
                                </div>
                            )}
                        </div>
                    ))}
                    
                    <div className="text-center">
                        <button 
                            onClick={() => setLayout([...layout, []])}
                            className="text-xs text-gray-400 hover:text-blue-600 hover:underline"
                        >
                            + Add New Row
                        </button>
                    </div>
                </div>
            </div>

            {/* Static Data Out Panel */}
            <div className="lg:col-span-1 bg-white p-2 border border-gray-300 rounded-md relative shadow-sm h-fit">
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
                 </div>
            </div>
        </div>

        {/* Draggable Buttons */}
        <div className="flex justify-center gap-6 py-4 border-t border-b bg-white rounded-lg shadow-sm overflow-x-auto">
            {btnOrder.map((btnId, index) => (
                <div
                    key={btnId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'btn', undefined, undefined, index)}
                    onDragEnter={(e) => handleDragEnter(e, 'btn', undefined, undefined, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className="cursor-move"
                >
                    {renderButton(btnId)}
                </div>
            ))}
        </div>

        {/* Grid */}
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
