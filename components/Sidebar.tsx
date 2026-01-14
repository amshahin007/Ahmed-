
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

// Arabic Navigation Items matching the requested photo style
const DEFAULT_NAV_ITEMS = [
    { 
      id: 'dashboard', 
      label: 'الصفحة الرئيسية', // Home Page
      icon: '🏠', 
      roles: ['admin', 'user', 'warehouse_manager', 'maintenance_manager', 'maintenance_engineer', 'warehouse_supervisor'] 
    },
    { 
      id: 'agri-work-order', 
      label: 'اوامر الشغل', // Work Orders
      icon: '🚜', 
      roles: ['admin', 'warehouse_manager', 'maintenance_manager', 'user'] 
    },
    { 
      id: 'issue-form', 
      label: 'طلبات الصرف', // Issue Requests
      icon: '🛠️', 
      roles: ['admin', 'user', 'maintenance_manager', 'maintenance_engineer'] 
    },
    { 
      id: 'history', 
      label: 'جرد المعدات', // Equipment Inventory
      icon: '📋', 
      roles: ['admin', 'user', 'warehouse_manager', 'maintenance_manager', 'maintenance_engineer', 'warehouse_supervisor'] 
    },
    { 
      id: 'stock-approval', 
      label: 'مراجعة اوامر الشغل', // Review Work Orders (Approvals)
      icon: '✅', 
      roles: ['admin', 'warehouse_manager', 'warehouse_supervisor'] 
    },
    { 
      id: 'ai-assistant', 
      label: 'متابعة الصيانة', // Maintenance Follow-up (AI)
      icon: '✨', 
      roles: ['admin', 'warehouse_manager', 'maintenance_manager'] 
    },
    { 
      id: 'master-data', 
      label: 'البيانات الأساسية', // Master Data
      icon: '🗄️', 
      roles: ['admin'] 
    },
    { 
      id: 'settings', 
      label: 'الزيادات', // Increases/More (Settings)
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

  const [logoUrl, setLogoUrl] = useState(() => {
      const custom = localStorage.getItem('wf_logo_url');
      return custom || "https://logo.clearbit.com/daltexcorp.com";
  });

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const visibleNavItems = navItems.filter(item => 
    item.roles.includes(currentUser.role)
  );

  const handleNavClick = (viewId: string) => {
    setCurrentView(viewId);
    onClose(); 
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
        w-72 bg-[#00695c] text-white min-h-screen flex flex-col shadow-2xl font-cairo
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header Section */}
        <div className="pt-8 pb-6 flex flex-col items-center text-center px-4 border-b border-yellow-400/30">
             <div className="bg-white p-2 rounded-xl shadow-lg mb-4 w-28 h-28 flex items-center justify-center overflow-hidden">
                 <img 
                    src={logoUrl} 
                    alt="Daltex Logo" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                        const target = e.currentTarget;
                        target.onerror = null; 
                        target.src = "https://ui-avatars.com/api/?name=Daltex&background=0D8ABC&color=fff&size=128&font-size=0.4";
                    }}
                 />
             </div>
             <h1 className="text-3xl font-bold text-[#FFD700] tracking-wide mb-1 drop-shadow-sm">DALTEX</h1>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 w-full mt-2 overflow-y-auto">
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
                  w-full flex items-center justify-between px-6 py-4
                  border-b border-yellow-400/30 transition-all duration-200 group
                  ${isActive 
                    ? 'bg-[#00C853] text-white shadow-md font-bold' 
                    : 'text-white hover:bg-[#004d40] hover:pr-8'}
                  ${isDragging ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}
                `}
              >
                {/* RTL Layout: Text on Right, Icon/Count on Left */}
                <div className="flex flex-row-reverse items-center gap-4 w-full">
                    <span className="text-xl w-8 text-center">{item.icon}</span>
                    <span className="text-lg tracking-wide text-right flex-1">{item.label}</span>
                    
                    {/* Visual counts matching screenshot (Yellow Numbers) */}
                    {item.id === 'agri-work-order' && <span className="text-[#FFD700] font-bold text-lg drop-shadow-sm">1274</span>}
                    {item.id === 'issue-form' && <span className="text-[#FFD700] font-bold text-lg drop-shadow-sm">228</span>}
                    {item.id === 'history' && <span className="text-[#FFD700] font-bold text-lg drop-shadow-sm">815</span>}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer Account Section - Yellow Bar */}
        <div className="p-4 bg-yellow-400 text-[#00695c]">
          <div className="flex items-center space-x-3 mb-3 flex-row-reverse">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shrink-0 border-2 border-[#00695c] bg-white text-[#00695c]`}>
              {currentUser.username.substring(0,2).toUpperCase()}
            </div>
            <div className="overflow-hidden text-right pr-3">
              <p className="text-base font-extrabold truncate">{currentUser.name}</p>
              <p className="text-xs font-semibold capitalize">{currentUser.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button 
              onClick={onLogout}
              className="w-full py-2 border-2 border-[#00695c] rounded-md text-sm text-[#00695c] hover:bg-[#00695c] hover:text-white font-bold transition uppercase tracking-wider"
          >
              Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
