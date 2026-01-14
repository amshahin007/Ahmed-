
import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  currentUser: User;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_NAV_ITEMS = [
    { 
      id: 'dashboard', 
      label: 'Home Page', 
      icon: '🏠', 
      roles: ['admin', 'user', 'warehouse_manager', 'maintenance_manager', 'maintenance_engineer', 'warehouse_supervisor'] 
    },
    { 
      id: 'agri-work-order', 
      label: 'Work Orders', 
      icon: '🚜', 
      roles: ['admin', 'warehouse_manager', 'maintenance_manager', 'user'] 
    },
    { 
      id: 'issue-form', 
      label: 'Issue Requests', 
      icon: '🛠️', 
      roles: ['admin', 'user', 'maintenance_manager', 'maintenance_engineer'] 
    },
    { 
      id: 'history', 
      label: 'Inventory', 
      icon: '📋', 
      roles: ['admin', 'user', 'warehouse_manager', 'maintenance_manager', 'maintenance_engineer', 'warehouse_supervisor'] 
    },
    { 
      id: 'stock-approval', 
      label: 'Approvals', 
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
      label: 'AI Insights', 
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

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, currentUser, onLogout, isOpen, onClose }) => {
  const [navItems, setNavItems] = useState(() => {
      try {
          const savedOrder = localStorage.getItem('wf_sidebar_order');
          if (savedOrder) {
              const ids = JSON.parse(savedOrder) as string[];
              // Reconstruct order based on saved IDs, appending new items at the end
              const ordered = [...DEFAULT_NAV_ITEMS].sort((a, b) => {
                  let indexA = ids.indexOf(a.id);
                  let indexB = ids.indexOf(b.id);
                  if (indexA === -1) indexA = 999;
                  if (indexB === -1) indexB = 999;
                  return indexA - indexB;
              });
              return ordered;
          }
      } catch (e) { console.error(e); }
      return DEFAULT_NAV_ITEMS;
  });

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Filter items based on user role
  const visibleNavItems = navItems.filter(item => 
    item.roles.includes(currentUser.role)
  );

  const handleNavClick = (viewId: string) => {
    setCurrentView(viewId);
    onClose(); // Close sidebar on mobile selection
  };

  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>, position: number) => {
      dragItem.current = position;
      setIsDragging(true);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setDragImage(e.currentTarget, 20, 20);
      setTimeout(() => {
          e.currentTarget.classList.add('opacity-50');
      }, 0);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLButtonElement>, position: number) => {
      dragOverItem.current = position;
  };

  const handleDragEnd = (e: React.DragEvent<HTMLButtonElement>) => {
      e.currentTarget.classList.remove('opacity-50');
      setIsDragging(false);

      if (dragItem.current === null || dragOverItem.current === null) {
          dragItem.current = null;
          dragOverItem.current = null;
          return;
      }

      const draggedObj = visibleNavItems[dragItem.current];
      const targetObj = visibleNavItems[dragOverItem.current];

      if (draggedObj.id === targetObj.id) return;

      const allItemsCopy = [...navItems];
      const fromIndex = allItemsCopy.findIndex(i => i.id === draggedObj.id);
      const toIndex = allItemsCopy.findIndex(i => i.id === targetObj.id);

      allItemsCopy.splice(fromIndex, 1);
      allItemsCopy.splice(toIndex, 0, draggedObj);

      setNavItems(allItemsCopy);
      localStorage.setItem('wf_sidebar_order', JSON.stringify(allItemsCopy.map(i => i.id)));
      
      dragItem.current = null;
      dragOverItem.current = null;
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); 
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
        w-72 bg-[#00695c] text-white min-h-screen flex flex-col shadow-2xl font-sans
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header Section matching screenshot */}
        <div className="pt-8 pb-6 flex flex-col items-center text-center px-4 border-b-2 border-yellow-400/50">
             <div className="bg-white p-2 rounded-xl shadow-lg mb-4 w-28 h-28 flex items-center justify-center overflow-hidden">
                 <img 
                    src="https://logo.clearbit.com/daltex.com" 
                    alt="Daltex Logo" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                        const target = e.currentTarget;
                        target.onerror = null; // Prevent infinite loop
                        // Fallback to the direct image URL if Clearbit fails
                        target.src = "https://daltex.com/wp-content/uploads/2020/09/Daltex-Logo.png";
                    }}
                 />
             </div>
             <h1 className="text-4xl font-serif font-bold text-[#FFD700] tracking-wide mb-1 drop-shadow-sm">DALTEX</h1>
             <p className="text-[10px] text-white uppercase tracking-wider font-medium mb-1">Daltex For Agricultural Development</p>
             <p className="text-sm font-bold text-[#FFD700] font-serif">Since 1964</p>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 w-full mt-4 overflow-y-auto px-4 space-y-2">
          {visibleNavItems.map((item, index) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onClick={() => handleNavClick(item.id)}
                className={`
                  w-full flex items-center justify-between px-4 py-3 
                  border-b border-yellow-400/30 transition-all duration-200 group
                  ${isActive 
                    ? 'bg-[#00C853] text-white shadow-lg font-bold transform scale-105 rounded border-none' 
                    : 'text-white hover:bg-[#004d40] hover:pl-6 rounded hover:bg-opacity-50'}
                  ${isDragging ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}
                `}
              >
                <div className="flex items-center gap-4">
                    <span className="text-2xl drop-shadow-md">{item.icon}</span>
                    <span className="text-lg tracking-wide">{item.label}</span>
                </div>
                {/* Visual counts to match screenshot theme */}
                {item.id === 'agri-work-order' && <span className="text-[#FFD700] font-bold text-sm drop-shadow-sm">1274</span>}
                {item.id === 'issue-form' && <span className="text-[#FFD700] font-bold text-sm drop-shadow-sm">228</span>}
                {item.id === 'history' && <span className="text-[#FFD700] font-bold text-sm drop-shadow-sm">815</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t-2 border-yellow-400/50 bg-[#004d40]/40">
          <div className="flex items-center space-x-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0 border-2 border-[#FFD700] text-[#00695c] bg-white`}>
              {currentUser.username.substring(0,2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
              <p className="text-xs text-yellow-300 capitalize">{currentUser.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button 
              onClick={onLogout}
              className="w-full py-2 border border-yellow-400/50 rounded-md text-xs text-yellow-100 hover:bg-yellow-400 hover:text-[#00695c] font-bold transition uppercase tracking-wider"
          >
              Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
