import React, { useState } from 'react';
import { Item, Machine, Location } from '../types';

interface MasterDataProps {
  items: Item[];
  machines: Machine[];
  locations: Location[];
  onAddItem: (item: Item) => void;
  onAddMachine: (machine: Machine) => void;
  onAddLocation: (location: Location) => void;
  onUpdateItem: (item: Item) => void;
  onUpdateMachine: (machine: Machine) => void;
  onUpdateLocation: (location: Location) => void;
}

const MasterData: React.FC<MasterDataProps> = ({ 
  items, machines, locations, 
  onAddItem, onAddMachine, onAddLocation,
  onUpdateItem, onUpdateMachine, onUpdateLocation
}) => {
  const [activeTab, setActiveTab] = useState<'items' | 'machines' | 'locations'>('items');
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Generic form state
  const [formData, setFormData] = useState<any>({});

  const handleAddNew = () => {
    setFormData({});
    setIsEditing(false);
    setShowForm(true);
  };

  const handleEdit = (record: any) => {
    setFormData({ ...record });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (activeTab === 'items') {
      const payload: Item = {
        id: formData.id || `ITM-${Date.now().toString().slice(-4)}`,
        name: formData.name,
        category: formData.category || 'General',
        unit: formData.unit || 'pcs'
      };
      if (isEditing) onUpdateItem(payload);
      else onAddItem(payload);

    } else if (activeTab === 'machines') {
      const payload: Machine = {
        id: formData.id || `M-${Date.now().toString().slice(-4)}`,
        name: formData.name,
        model: formData.model
      };
      if (isEditing) onUpdateMachine(payload);
      else onAddMachine(payload);

    } else {
      const payload: Location = {
        id: formData.id || `WH-${Date.now().toString().slice(-4)}`,
        name: formData.name
      };
      if (isEditing) onUpdateLocation(payload);
      else onAddLocation(payload);
    }

    setShowForm(false);
    setFormData({});
    setIsEditing(false);
  };

  const renderForm = () => {
    if (!showForm) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md animate-fade-in-up">
          <h3 className="text-xl font-bold mb-4 capitalize">
            {isEditing ? 'Edit' : 'Add New'} {activeTab.slice(0, -1)}
          </h3>
          <form onSubmit={handleSave} className="space-y-4">
            
            <div>
              <label className="block text-sm font-medium text-gray-700">ID</label>
              <input 
                className={`w-full border rounded p-2 ${isEditing ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                placeholder="Auto-generated if empty"
                value={formData.id || ''}
                onChange={e => setFormData({...formData, id: e.target.value})}
                readOnly={isEditing}
              />
              {isEditing && <p className="text-xs text-gray-400 mt-1">ID cannot be changed</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input 
                required
                className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                value={formData.name || ''}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            {activeTab === 'items' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <input 
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.category || ''}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Unit</label>
                  <input 
                    className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.unit || ''}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                  />
                </div>
              </>
            )}

            {activeTab === 'machines' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Model</label>
                <input 
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={formData.model || ''}
                  onChange={e => setFormData({...formData, model: e.target.value})}
                />
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button 
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition shadow-sm"
              >
                {isEditing ? 'Update' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    let headers: string[] = [];
    let data: any[] = [];

    if (activeTab === 'items') {
      headers = ['ID', 'Name', 'Category', 'Unit', 'Actions'];
      data = items;
    } else if (activeTab === 'machines') {
      headers = ['ID', 'Name', 'Model', 'Actions'];
      data = machines;
    } else {
      headers = ['ID', 'Name', 'Actions'];
      data = locations;
    }

    return (
      <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {headers.map(h => <th key={h} className="px-6 py-3 font-semibold text-gray-700">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row: any) => (
              <tr key={row.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-3 font-medium text-gray-900">{row.id}</td>
                <td className="px-6 py-3">{row.name}</td>
                {activeTab === 'items' && (
                  <>
                    <td className="px-6 py-3 text-gray-500">{row.category}</td>
                    <td className="px-6 py-3 text-gray-500">{row.unit}</td>
                  </>
                )}
                {activeTab === 'machines' && (
                  <td className="px-6 py-3 text-gray-500">{row.model}</td>
                )}
                <td className="px-6 py-3">
                   <button 
                     onClick={() => handleEdit(row)}
                     className="text-blue-600 hover:text-blue-900 font-medium hover:underline"
                   >
                     Edit
                   </button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="px-6 py-8 text-center text-gray-400">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex space-x-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          {(['items', 'machines', 'locations'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${
                activeTab === tab 
                  ? 'bg-blue-100 text-blue-700 shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition"
        >
          <span className="mr-2 text-xl">+</span> Add New
        </button>
      </div>

      {renderTable()}
      {renderForm()}
    </div>
  );
};

export default MasterData;