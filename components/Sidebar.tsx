import React from 'react';
import { User, UserRole } from '../types';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  currentUser: User;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, currentUser, onLogout }) => {
  
  const navItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: '📊', 
      roles: ['admin', 'user', 'warehouse_manager', 'maintenance_manager', 'maintenance_engineer', 'warehouse_supervisor'] 
    },
    { 
      id: 'issue-form', 
      label: 'New Issue', 
      icon: '📝', 
      roles: ['admin', 'user', 'maintenance_manager', 'maintenance_engineer'] 
    },
    { 
      id: 'history', 
      label: 'History & Reports', 
      icon: '📋', 
      roles: ['admin', 'user', 'warehouse_manager', 'maintenance_manager', 'maintenance_engineer', 'warehouse_supervisor'] 
    },
    { 
      id: 'stock-approval', 
      label: 'Stock Approval', 
      icon: '✅', 
      roles: ['admin', 'warehouse_manager', 'warehouse_supervisor'] 
    },
    { 
      id: 'master-data', 
      label: 'Master Data', 
      icon: '⚙️', 
      roles: ['admin'] 
    },
  ];

  // Filter items based on user role
  const visibleNavItems = navItems.filter(item => 
    item.roles.includes(currentUser.role)
  );

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col shadow-xl">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold tracking-tight text-blue-400">WareFlow</h1>
        <p className="text-xs text-slate-400 mt-1">Inventory Management</p>
      </div>
      
      <nav className="flex-1 py-6 px-3 space-y-2">
        {visibleNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
              currentView === item.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center space-x-3 mb-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${currentUser.role === 'admin' ? 'bg-purple-500' : 'bg-blue-500'}`}>
            {currentUser.username.substring(0,2).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate">{currentUser.name}</p>
            <p className="text-xs text-slate-400 capitalize">{currentUser.role.replace('_', ' ')}</p>
          </div>
        </div>
        <button 
            onClick={onLogout}
            className="w-full py-2 border border-slate-600 rounded-md text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition"
        >
            Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;