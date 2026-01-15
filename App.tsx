
import React, { useState, useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import IssueForm from './components/IssueForm';
import HistoryTable from './components/HistoryTable';
import MasterData from './components/MasterData';
import StockApproval from './components/StockApproval';
import AiAssistant from './components/AiAssistant';
import Settings from './components/Settings';
import AgriWorkOrder from './components/AgriWorkOrder';
import AssetManagement from './components/AssetManagement'; // Imported Asset Management
import Login from './components/Login';
import ErrorBoundary from './components/ErrorBoundary';
import * as storageService from './services/storageService';
import { 
  INITIAL_HISTORY, 
  ITEMS as INIT_ITEMS, 
  MACHINES as INIT_MACHINES, 
  LOCATIONS as INIT_LOCATIONS,
  SECTORS as INIT_SECTORS,
  DIVISIONS as INIT_DIVISIONS,
  USERS as INIT_USERS,
  MAINTENANCE_PLANS as INIT_PLANS,
  INITIAL_BREAKDOWNS // Imported initial breakdowns
} from './constants';
import { IssueRecord, Item, Machine, Location, Sector, Division, User, MaintenancePlan, AgriOrderRecord, BreakdownRecord, IrrigationLogRecord, BOMRecord } from './types';

// Helper to load small configs from LocalStorage safely (kept for non-data prefs)
const loadConfig = <T,>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    return fallback;
  }
};

const App: React.FC = () => {
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // --- Auth State ---
  const [user, setUser] = useState<User | null>(() => loadConfig('wf_user', null));

  // --- View State ---
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // --- Data State ---
  const [history, setHistory] = useState<IssueRecord[]>(INITIAL_HISTORY);
  const [items, setItems] = useState<Item[]>(INIT_ITEMS);
  const [machines, setMachines] = useState<Machine[]>(INIT_MACHINES);
  const [locations, setLocations] = useState<Location[]>(INIT_LOCATIONS);
  const [sectors, setSectors] = useState<Sector[]>(INIT_SECTORS);
  const [divisions, setDivisions] = useState<Division[]>(INIT_DIVISIONS);
  const [plans, setPlans] = useState<MaintenancePlan[]>(INIT_PLANS);
  const [usersList, setUsersList] = useState<User[]>(INIT_USERS);
  const [agriOrders, setAgriOrders] = useState<AgriOrderRecord[]>([]);
  const [breakdowns, setBreakdowns] = useState<BreakdownRecord[]>(INITIAL_BREAKDOWNS); // Breakdown State
  const [irrigationLogs, setIrrigationLogs] = useState<IrrigationLogRecord[]>([]);
  const [bomRecords, setBomRecords] = useState<BOMRecord[]>([]);

  // --- Load Data from IndexedDB on Mount ---
  useEffect(() => {
    const loadAllData = async () => {
      try {
        const [
          loadedHistory, loadedItems, loadedMachines, loadedLocations, 
          loadedSectors, loadedDivisions, loadedPlans, loadedUsers, loadedAgri, loadedBreakdowns, loadedIrrigation, loadedBoms
        ] = await Promise.all([
          storageService.getItem<IssueRecord[]>('wf_history'),
          storageService.getItem<Item[]>('wf_items'),
          storageService.getItem<Machine[]>('wf_machines'),
          storageService.getItem<Location[]>('wf_locations'),
          storageService.getItem<Sector[]>('wf_sectors'),
          storageService.getItem<Division[]>('wf_divisions'),
          storageService.getItem<MaintenancePlan[]>('wf_plans'),
          storageService.getItem<User[]>('wf_users'),
          storageService.getItem<AgriOrderRecord[]>('wf_agri_orders'),
          storageService.getItem<BreakdownRecord[]>('wf_breakdowns'),
          storageService.getItem<IrrigationLogRecord[]>('wf_irrigation_logs'),
          storageService.getItem<BOMRecord[]>('wf_boms'),
        ]);

        if (loadedHistory) setHistory(loadedHistory);
        
        // Items Loading with Migration for Stock Quantity
        if (loadedItems) {
            const migratedItems = loadedItems.map(loadedItem => {
                if (loadedItem.stockQuantity === undefined) {
                    const initItem = INIT_ITEMS.find(i => i.id === loadedItem.id);
                    return { ...loadedItem, stockQuantity: initItem?.stockQuantity ?? 0 };
                }
                return loadedItem;
            });
            setItems(migratedItems);
        } else {
            setItems(INIT_ITEMS);
        }

        if (loadedMachines) setMachines(loadedMachines);
        if (loadedLocations) setLocations(loadedLocations);
        if (loadedSectors) setSectors(loadedSectors);
        if (loadedDivisions) setDivisions(loadedDivisions);
        if (loadedPlans) setPlans(loadedPlans);
        if (loadedUsers) setUsersList(loadedUsers);
        if (loadedAgri) setAgriOrders(loadedAgri);
        if (loadedBreakdowns) setBreakdowns(loadedBreakdowns);
        if (loadedIrrigation) setIrrigationLogs(loadedIrrigation);
        if (loadedBoms) setBomRecords(loadedBoms);

      } catch (err) {
        console.error("Failed to load data from database:", err);
      } finally {
        setIsDataLoaded(true);
      }
    };
    loadAllData();
  }, []);

  // --- Persistence Effects (Save on Change) ---
  useEffect(() => { if (isDataLoaded) storageService.setItem('wf_history', history); }, [history, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) storageService.setItem('wf_items', items); }, [items, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) storageService.setItem('wf_machines', machines); }, [machines, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) storageService.setItem('wf_locations', locations); }, [locations, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) storageService.setItem('wf_sectors', sectors); }, [sectors, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) storageService.setItem('wf_divisions', divisions); }, [divisions, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) storageService.setItem('wf_plans', plans); }, [plans, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) storageService.setItem('wf_users', usersList); }, [usersList, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) storageService.setItem('wf_agri_orders', agriOrders); }, [agriOrders, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) storageService.setItem('wf_breakdowns', breakdowns); }, [breakdowns, isDataLoaded]); 
  useEffect(() => { if (isDataLoaded) storageService.setItem('wf_irrigation_logs', irrigationLogs); }, [irrigationLogs, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) storageService.setItem('wf_boms', bomRecords); }, [bomRecords, isDataLoaded]);
  
  useEffect(() => { localStorage.setItem('wf_user', JSON.stringify(user)); }, [user]);


  // Auth Handlers
  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('wf_user');
  };

  // Data Handlers
  const handleAddIssue = (newIssue: IssueRecord) => {
    setHistory(prev => [newIssue, ...prev]);
  };

  const handleUpdateIssue = (updatedIssue: IssueRecord) => {
    const oldIssue = history.find(h => h.id === updatedIssue.id);
    if (oldIssue && oldIssue.status !== 'Approved' && updatedIssue.status === 'Approved') {
        setItems(prevItems => prevItems.map(item => {
            if (item.id === updatedIssue.itemId) {
                const currentStock = item.stockQuantity || 0;
                const newStock = Math.max(0, currentStock - updatedIssue.quantity);
                return { ...item, stockQuantity: newStock };
            }
            return item;
        }));
    }
    setHistory(prev => prev.map(issue => issue.id === updatedIssue.id ? updatedIssue : issue));
  };

  // Single Item Handlers
  const handleAddItem = (item: Item) => setItems(prev => [...prev, item]);
  const handleAddMachine = (machine: Machine) => setMachines(prev => [...prev, machine]);
  const handleAddLocation = (location: Location) => setLocations(prev => [...prev, location]);
  const handleAddSector = (sector: Sector) => setSectors(prev => [...prev, sector]);
  const handleAddDivision = (division: Division) => setDivisions(prev => [...prev, division]);
  const handleAddPlan = (plan: MaintenancePlan) => setPlans(prev => [...prev, plan]);
  const handleAddUser = (newUser: User) => setUsersList(prev => [...prev, newUser]);
  
  // Agri Orders Handlers
  const handleAddAgriOrder = (order: AgriOrderRecord) => setAgriOrders(prev => [...prev, order]);
  const handleUpdateAgriOrder = (order: AgriOrderRecord) => setAgriOrders(prev => prev.map(o => o.id === order.id ? order : o));
  const handleDeleteAgriOrders = (ids: string[]) => setAgriOrders(prev => prev.filter(o => !ids.includes(o.id)));

  // Irrigation Logs Handlers
  const handleAddIrrigationLog = (log: IrrigationLogRecord) => setIrrigationLogs(prev => [...prev, log]);
  const handleUpdateIrrigationLog = (log: IrrigationLogRecord) => setIrrigationLogs(prev => prev.map(l => l.id === log.id ? log : l));
  const handleDeleteIrrigationLogs = (ids: string[]) => setIrrigationLogs(prev => prev.filter(l => !ids.includes(l.id)));

  // Breakdown Handlers
  const handleAddBreakdown = (bd: BreakdownRecord) => setBreakdowns(prev => [bd, ...prev]);
  const handleUpdateBreakdown = (bd: BreakdownRecord) => setBreakdowns(prev => prev.map(b => b.id === bd.id ? bd : b));

  // BOM Handlers
  const handleAddBOM = (bom: BOMRecord) => setBomRecords(prev => [...prev, bom]);
  const handleUpdateBOM = (bom: BOMRecord) => setBomRecords(prev => prev.map(b => b.id === bom.id ? bom : b));
  const handleDeleteBOMs = (ids: string[]) => setBomRecords(prev => prev.filter(b => !ids.includes(b.id)));


  const handleUpdateItem = (updatedItem: Item) => {
    setItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
  };
  const handleUpdateMachine = (updatedMachine: Machine) => {
    setMachines(prev => prev.map(machine => machine.id === updatedMachine.id ? updatedMachine : machine));
  };
  const handleUpdateLocation = (updatedLocation: Location) => {
    setLocations(prev => prev.map(location => location.id === updatedLocation.id ? updatedLocation : location));
  };
  const handleUpdateSector = (updatedSector: Sector) => {
    setSectors(prev => prev.map(sector => sector.id === updatedSector.id ? updatedSector : sector));
  };
  const handleUpdateDivision = (updatedDivision: Division) => {
    setDivisions(prev => prev.map(div => div.id === updatedDivision.id ? updatedDivision : div));
  };
  const handleUpdatePlan = (updatedPlan: MaintenancePlan) => {
    setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
  };
  const handleUpdateUser = (updatedUser: User) => {
    setUsersList(prev => prev.map(u => u.username === updatedUser.username ? updatedUser : u));
  };
  
  // Bulk Delete Handlers
  const handleDeleteItems = (ids: string[]) => {
    setItems(prev => prev.filter(item => !ids.includes(item.id)));
  };
  const handleDeleteMachines = (ids: string[]) => {
    setMachines(prev => prev.filter(m => !ids.includes(m.id)));
  };
  const handleDeleteLocations = (ids: string[]) => {
    setLocations(prev => prev.filter(l => !ids.includes(l.id)));
  };
  const handleDeleteSectors = (ids: string[]) => {
    setSectors(prev => prev.filter(s => !ids.includes(s.id)));
  };
  const handleDeleteDivisions = (ids: string[]) => {
    setDivisions(prev => prev.filter(d => !ids.includes(d.id)));
  };
  const handleDeletePlans = (ids: string[]) => {
    setPlans(prev => prev.filter(p => !ids.includes(p.id)));
  };
  const handleDeleteUsers = (usernames: string[]) => {
    setUsersList(prev => prev.filter(u => !usernames.includes(u.username)));
  };


  // --- Bulk Import Handler (Performance Optimized) ---
  const handleBulkImport = (tab: string, added: any[], updated: any[]) => {
    const updateIdBasedState = (setter: React.Dispatch<React.SetStateAction<any[]>>) => {
        setter(prev => {
            const updateMap = new Map(updated.map(u => [u.id, u]));
            const nextState = prev.map(item => updateMap.has(item.id) ? updateMap.get(item.id) : item);
            return [...nextState, ...added];
        });
    };

    switch(tab) {
        case 'items': updateIdBasedState(setItems); break;
        case 'machines': updateIdBasedState(setMachines); break;
        case 'locations': updateIdBasedState(setLocations); break;
        case 'sectors': updateIdBasedState(setSectors); break;
        case 'divisions': updateIdBasedState(setDivisions); break;
        case 'plans': updateIdBasedState(setPlans); break;
        case 'history': updateIdBasedState(setHistory); break; // Added History Import Support
        case 'breakdowns': updateIdBasedState(setBreakdowns); break; // Added Breakdowns
        case 'bom': updateIdBasedState(setBomRecords); break; // Added BOMs
        case 'users': 
            setUsersList(prev => {
                const updateMap = new Map(updated.map((u: any) => [u.username, u]));
                const nextState = prev.map(u => updateMap.has(u.username) ? updateMap.get(u.username)! : u);
                return [...nextState, ...added];
            });
            break;
    }
  };

  // Loading Screen
  if (!isDataLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 flex-col">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-gray-700">Loading WareFlow Data...</h2>
        <p className="text-gray-500 text-sm mt-2">Initializing Database</p>
      </div>
    );
  }

  // If no user is logged in, show Login Screen
  if (!user) {
    return <Login onLogin={handleLogin} users={usersList} />;
  }

  // Router Logic based on View
  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard 
            history={history} 
            machines={machines} 
            locations={locations} 
            setCurrentView={setCurrentView} 
            currentUser={user} 
          />
        );
      case 'agri-work-order':
        return (
          <AgriWorkOrder 
            orders={agriOrders}
            onAddOrder={handleAddAgriOrder}
            onUpdateOrder={handleUpdateAgriOrder}
            onDeleteOrders={handleDeleteAgriOrders}
            irrigationLogs={irrigationLogs}
            onAddIrrigationLog={handleAddIrrigationLog}
            onUpdateIrrigationLog={handleUpdateIrrigationLog}
            onDeleteIrrigationLogs={handleDeleteIrrigationLogs}
            locations={locations}
            machines={machines}
          />
        );
      case 'asset-management':
        return (
          <AssetManagement
            machines={machines}
            items={items}
            bomRecords={bomRecords}
            locations={locations}
            sectors={sectors}
            divisions={divisions}
            breakdowns={breakdowns}
            onAddMachine={handleAddMachine}
            onUpdateMachine={handleUpdateMachine}
            onDeleteMachines={handleDeleteMachines}
            onAddBreakdown={handleAddBreakdown}
            onUpdateBreakdown={handleUpdateBreakdown}
            onAddBOM={handleAddBOM}
            onUpdateBOM={handleUpdateBOM}
            onDeleteBOMs={handleDeleteBOMs}
            onBulkImport={handleBulkImport}
            setCurrentView={setCurrentView}
          />
        );
      case 'issue-form':
        return (
          <IssueForm 
            onAddIssue={handleAddIssue} 
            items={items}
            machines={machines}
            locations={locations}
            sectors={sectors}
            divisions={divisions}
            maintenancePlans={plans}
            bomRecords={bomRecords}
            currentUser={user}
          />
        );
      case 'stock-approval':
        if (!['admin', 'warehouse_manager', 'warehouse_supervisor'].includes(user.role)) return <Dashboard history={history} machines={machines} locations={locations} setCurrentView={setCurrentView} currentUser={user} />;
        return (
          <StockApproval 
            history={history} 
            locations={locations}
            onUpdateIssue={handleUpdateIssue} 
          />
        );
      case 'history':
        return <HistoryTable history={history} locations={locations} items={items} machines={machines} />;
      case 'master-data':
        if (user.role !== 'admin') return <Dashboard history={history} machines={machines} locations={locations} setCurrentView={setCurrentView} currentUser={user} />;
        return (
          <MasterData 
            history={history}
            items={items}
            machines={machines}
            locations={locations}
            sectors={sectors}
            divisions={divisions}
            plans={plans}
            users={usersList}
            onAddItem={handleAddItem}
            onAddMachine={handleAddMachine}
            onAddLocation={handleAddLocation}
            onAddSector={handleAddSector}
            onAddDivision={handleAddDivision}
            onAddPlan={handleAddPlan}
            onAddUser={handleAddUser}
            onUpdateItem={handleUpdateItem}
            onUpdateMachine={handleUpdateMachine}
            onUpdateLocation={handleUpdateLocation}
            onUpdateSector={handleUpdateSector}
            onUpdateDivision={handleUpdateDivision}
            onUpdatePlan={handleUpdatePlan}
            onUpdateUser={handleUpdateUser}
            onDeleteItems={handleDeleteItems}
            onDeleteMachines={handleDeleteMachines}
            onDeleteLocations={handleDeleteLocations}
            onDeleteSectors={handleDeleteSectors}
            onDeleteDivisions={handleDeleteDivisions}
            onDeletePlans={handleDeletePlans}
            onDeleteUsers={handleDeleteUsers}
            onBulkImport={handleBulkImport}
          />
        );
      case 'ai-assistant':
        return <AiAssistant />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard history={history} machines={machines} locations={locations} setCurrentView={setCurrentView} currentUser={user} />;
    }
  };

  return (
    <HashRouter>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar 
            currentView={currentView} 
            setCurrentView={setCurrentView} 
            currentUser={user}
            onLogout={handleLogout}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
        />
        
        <main className="flex-1 overflow-y-auto flex flex-col h-screen relative">
          <header className="bg-white shadow-sm px-4 md:px-8 py-4 sticky top-0 z-10 flex-shrink-0">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="md:hidden text-gray-500 hover:text-blue-600 focus:outline-none"
                >
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                   </svg>
                </button>
                <h2 className="text-xl font-bold text-gray-800 capitalize truncate max-w-[150px] md:max-w-none">
                  {currentView.replace('-', ' ')}
                </h2>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-sm text-right hidden sm:block">
                    <p className="font-medium text-gray-900">Welcome, {user.name}</p>
                    <p className="text-xs text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                </div>
                <div className="sm:hidden w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                    {user.username.substring(0,2).toUpperCase()}
                </div>
              </div>
            </div>
          </header>

          <div className="p-4 md:p-8 flex-1 overflow-y-auto">
            <ErrorBoundary>
              {renderContent()}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
