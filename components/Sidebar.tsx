
import React from 'react';
import { User } from '../types';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  currentUser: User;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, currentUser, onLogout, isOpen, onClose }) => {
  
  const navItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: '📊', 
      roles: ['admin', 'user', 'warehouse_manager', 'maintenance_manager', 'maintenance_engineer', 'warehouse_supervisor'] 
    },
    { 
      id: 'agri-work-order', 
      label: 'Agri Work Order', 
      icon: '🚜', 
      roles: ['admin', 'warehouse_manager', 'maintenance_manager', 'user'] 
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
      icon: '🗄️', 
      roles: ['admin'] 
    },
    { 
      id: 'ai-assistant', 
      label: 'AI Assistant', 
      icon: '✨', 
      roles: ['admin', 'warehouse_manager', 'maintenance_manager'] 
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: '⚙️', 
      roles: ['admin', 'warehouse_manager', 'maintenance_manager', 'warehouse_supervisor', 'user'] 
    },
  ];

  // Filter items based on user role
  const visibleNavItems = navItems.filter(item => 
    item.roles.includes(currentUser.role)
  );

  const handleNavClick = (viewId: string) => {
    setCurrentView(viewId);
    onClose(); // Close sidebar on mobile selection
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-30
        w-64 bg-slate-900 text-white min-h-screen flex flex-col shadow-xl
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-blue-400">WareFlow</h1>
            <p className="text-xs text-slate-400 mt-1">Inventory Management</p>
          </div>
          {/* Mobile Close Button */}
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
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
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${currentUser.role === 'admin' ? 'bg-purple-500' : 'bg-blue-500'}`}>
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
    </>
  );
};

export default Sidebar;
