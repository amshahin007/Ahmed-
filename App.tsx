import React, { useState, useEffect, useRef } from 'react';
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
import AssetManagement from './components/AssetManagement'; 
import Login from './components/Login';
import ErrorBoundary from './components/ErrorBoundary';
import * as storageService from './services/storageService';
import * as phpService from './services/phpApiService'; // Import PHP Service
import { backupTabToSheet, DEFAULT_SCRIPT_URL } from './services/googleSheetsService';
import { 
  INITIAL_HISTORY, 
  ITEMS as INIT_ITEMS, 
  MACHINES as INIT_MACHINES, 
  LOCATIONS as INIT_LOCATIONS,
  SECTORS as INIT_SECTORS,
  DIVISIONS as INIT_DIVISIONS,
  USERS as INIT_USERS,
  MAINTENANCE_PLANS as INIT_PLANS,
  INITIAL_BREAKDOWNS 
} from './constants';
import { IssueRecord, Item, Machine, Location, Sector, Division, User, MaintenancePlan, AgriOrderRecord, BreakdownRecord, IrrigationLogRecord, BOMRecord } from './types';

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
  const [dataSource, setDataSource] = useState<'php' | 'local'>('local'); // Track source

  const [user, setUser] = useState<User | null>(() => loadConfig('wf_user', null));
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [history, setHistory] = useState<IssueRecord[]>(INITIAL_HISTORY);
  const [items, setItems] = useState<Item[]>(INIT_ITEMS);
  const [machines, setMachines] = useState<Machine[]>(INIT_MACHINES);
  const [locations, setLocations] = useState<Location[]>(INIT_LOCATIONS);
  const [sectors, setSectors] = useState<Sector[]>(INIT_SECTORS);
  const [divisions, setDivisions] = useState<Division[]>(INIT_DIVISIONS);
  const [plans, setPlans] = useState<MaintenancePlan[]>(INIT_PLANS);
  const [usersList, setUsersList] = useState<User[]>(INIT_USERS);
  const [agriOrders, setAgriOrders] = useState<AgriOrderRecord[]>([]);
  const [breakdowns, setBreakdowns] = useState<BreakdownRecord[]>(INITIAL_BREAKDOWNS); 
  const [irrigationLogs, setIrrigationLogs] = useState<IrrigationLogRecord[]>([]);
  const [bomRecords, setBomRecords] = useState<BOMRecord[]>([]);

  // Ref to hold state for auto-backup without re-rendering intervals
  const stateRef = useRef({
    items: [] as Item[], 
    machines: [] as Machine[], 
    locations: [] as Location[], 
    sectors: [] as Sector[], 
    divisions: [] as Division[], 
    plans: [] as MaintenancePlan[], 
    users: [] as User[], 
    breakdowns: [] as BreakdownRecord[], 
    boms: [] as BOMRecord[]
  });

  // --- Load Data Strategy: Try PHP -> Fallback to IndexedDB ---
  useEffect(() => {
    const initData = async () => {
      try {
        console.log("Attempting to connect to PHP Backend...");
        const phpData = await phpService.fetchAllData();
        
        if (phpData && Array.isArray(phpData.items)) {
            // SUCCESS: Loaded from PHP
            console.log("Connected to PHP/MySQL successfully.");
            setDataSource('php');
            
            if (phpData.items) setItems(phpData.items);
            if (phpData.machines) setMachines(phpData.machines);
            if (phpData.locations) setLocations(phpData.locations);
            if (phpData.sectors) setSectors(phpData.sectors);
            if (phpData.divisions) setDivisions(phpData.divisions);
            if (phpData.plans) setPlans(phpData.plans);
            if (phpData.issues) setHistory(phpData.issues);
            
            // Load local-only data (Agri/BOM not yet in PHP in this version)
            const [loadedAgri, loadedBreakdowns, loadedIrrigation, loadedBoms] = await Promise.all([
                 storageService.getItem<AgriOrderRecord[]>('wf_agri_orders'),
                 storageService.getItem<BreakdownRecord[]>('wf_breakdowns'),
                 storageService.getItem<IrrigationLogRecord[]>('wf_irrigation_logs'),
                 storageService.getItem<BOMRecord[]>('wf_boms'),
            ]);
            if (loadedAgri) setAgriOrders(loadedAgri);
            if (loadedBreakdowns) setBreakdowns(loadedBreakdowns);
            if (loadedIrrigation) setIrrigationLogs(loadedIrrigation);
            if (loadedBoms) setBomRecords(loadedBoms);

        } else {
            throw new Error("PHP Data empty or failed");
        }

      } catch (err) {
        console.warn("PHP Connection Failed. Falling back to Local Storage (IndexedDB).", err);
        setDataSource('local');
        
        // FALLBACK: Load from IndexedDB
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
        if (loadedItems) setItems(loadedItems);
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
      } finally {
        setIsDataLoaded(true);
      }
    };
    initData();
  }, []);

  // --- Persistence Effects (Only if using Local Source or Specific Tables) ---
  useEffect(() => { 
      // Always save to local DB as backup/cache
      if (isDataLoaded) storageService.setItem('wf_history', history); 
  }, [history, isDataLoaded]);

  useEffect(() => { if (isDataLoaded) storageService.setItem('wf_items', items); }, [items, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) storageService.setItem('wf_machines', machines); }, [machines, isDataLoaded]);
  
  // Update Refs for Auto Backup whenever data changes
  useEffect(() => {
    stateRef.current = {
        items, machines, locations, sectors, divisions, plans, 
        users: usersList, breakdowns, boms: bomRecords
    };
  }, [items, machines, locations, sectors, divisions, plans, usersList, breakdowns, bomRecords]);

  // --- AUTOMATIC BACKUP LOGIC ---
  useEffect(() => {
    const backupInterval = setInterval(async () => {
        const freq = localStorage.getItem('wf_backup_frequency') || 'hourly';
        if (freq === 'disabled') return;

        const lastRunStr = localStorage.getItem('wf_last_backup_timestamp');
        const lastRun = lastRunStr ? parseInt(lastRunStr, 10) : 0;
        const now = Date.now();
        let intervalMs = 3600000; // Default hourly (1hr)

        if (freq === '30min') intervalMs = 30 * 60 * 1000;
        else if (freq === 'hourly') intervalMs = 60 * 60 * 1000;
        else if (freq === 'daily') intervalMs = 24 * 60 * 60 * 1000;
        else if (freq === 'weekly') intervalMs = 7 * 24 * 60 * 60 * 1000;

        if (now - lastRun > intervalMs) {
            console.log(`[AutoBackup] Triggering ${freq} backup...`);
            const scriptUrl = localStorage.getItem('wf_script_url_v3') || DEFAULT_SCRIPT_URL;
            
            if (!scriptUrl) {
                console.warn("[AutoBackup] Skipped: No Script URL configured.");
                return;
            }

            // Simple data preparation helper to avoid code duplication from MasterData/AssetManagement
            const prepareData = (key: string) => {
                const s = stateRef.current;
                let data: any[] = [];
                let headers: string[] = [];
                let keys: string[] = [];

                if (key === 'items') {
                    data = s.items; 
                    headers = ['Item Number', 'Stock Qty', 'Description', 'Category', 'Unit', 'Brand', 'Model No', 'Part No'];
                    keys = ['id', 'stockQuantity', 'name', 'category', 'unit', 'brand', 'modelNo', 'partNumber'];
                } else if (key === 'machines') {
                    data = s.machines;
                    headers = ['ID', 'Machine Name', 'Local No', 'Status', 'Brand', 'Model No', 'Location'];
                    keys = ['id', 'category', 'machineLocalNo', 'status', 'brand', 'modelNo', 'locationId'];
                } else if (key === 'breakdowns') {
                    data = s.breakdowns;
                    headers = ['ID', 'Machine', 'Location', 'Start Time', 'Status', 'Failure Type'];
                    keys = ['id', 'machineName', 'locationId', 'startTime', 'status', 'failureType'];
                } else if (key === 'bom') {
                    data = s.boms;
                    headers = ['ID', 'Machine', 'Model No', 'Item ID', 'Qty'];
                    keys = ['id', 'machineCategory', 'modelNo', 'itemId', 'quantity'];
                }
                
                if (data.length === 0) return null;
                const rows = data.map(item => keys.map(k => {
                    const val = (item as any)[k];
                    return (val === undefined || val === null) ? "" : String(val);
                }));
                return [headers, ...rows];
            };

            const tabsToSync = ['items', 'machines', 'breakdowns', 'bom'];
            
            for (const tab of tabsToSync) {
                try {
                    const rows = prepareData(tab);
                    if (rows) {
                        await backupTabToSheet(scriptUrl, tab, rows);
                        console.log(`[AutoBackup] ${tab} synced.`);
                    }
                    // Slight delay to prevent rate limits
                    await new Promise(r => setTimeout(r, 500));
                } catch (e) {
                    console.error(`[AutoBackup] Failed for ${tab}`, e);
                }
            }
            
            localStorage.setItem('wf_last_backup_timestamp', now.toString());
            console.log("[AutoBackup] Complete.");
        }
    }, 60 * 1000); // Check every minute

    return () => clearInterval(backupInterval);
  }, []);

  // Auth Handlers
  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('wf_user');
  };

  // --- DATA HANDLERS ---

  const handleAddIssue = async (newIssue: IssueRecord) => {
    // 1. Optimistic Update (Show immediately)
    setHistory(prev => [newIssue, ...prev]);
    
    // 2. Update Stock Locally
    setItems(prev => prev.map(i => i.id === newIssue.itemId 
        ? { ...i, stockQuantity: Math.max(0, (i.stockQuantity || 0) - newIssue.quantity) } 
        : i
    ));

    // 3. Send to PHP (if connected)
    if (dataSource === 'php') {
        try {
            await phpService.saveIssueToPhp(newIssue);
        } catch (e) {
            console.error("Failed to save issue to PHP backend", e);
            alert("Warning: Saved locally, but failed to sync with Server.");
        }
    }
  };

  const handleUpdateIssue = (updatedIssue: IssueRecord) => {
    // Existing logic for approval flow
    const oldIssue = history.find(h => h.id === updatedIssue.id);
    setHistory(prev => prev.map(issue => issue.id === updatedIssue.id ? updatedIssue : issue));
  };

  const handleAddItem = async (item: Item) => {
      setItems(prev => [...prev, item]);
      if (dataSource === 'php') {
          await phpService.addItemToPhp(item);
      }
  };

  // ... (Rest of handlers remain largely the same, mapped to state setters) ...
  const handleAddMachine = (machine: Machine) => setMachines(prev => [...prev, machine]);
  const handleAddLocation = (location: Location) => setLocations(prev => [...prev, location]);
  const handleAddSector = (sector: Sector) => setSectors(prev => [...prev, sector]);
  const handleAddDivision = (division: Division) => setDivisions(prev => [...prev, division]);
  const handleAddPlan = (plan: MaintenancePlan) => setPlans(prev => [...prev, plan]);
  const handleAddUser = (newUser: User) => setUsersList(prev => [...prev, newUser]);
  
  const handleAddAgriOrder = (order: AgriOrderRecord) => setAgriOrders(prev => [...prev, order]);
  const handleUpdateAgriOrder = (order: AgriOrderRecord) => setAgriOrders(prev => prev.map(o => o.id === order.id ? order : o));
  const handleDeleteAgriOrders = (ids: string[]) => setAgriOrders(prev => prev.filter(o => !ids.includes(o.id)));

  const handleAddIrrigationLog = (log: IrrigationLogRecord) => setIrrigationLogs(prev => [...prev, log]);
  const handleUpdateIrrigationLog = (log: IrrigationLogRecord) => setIrrigationLogs(prev => prev.map(l => l.id === log.id ? log : l));
  const handleDeleteIrrigationLogs = (ids: string[]) => setIrrigationLogs(prev => prev.filter(l => !ids.includes(l.id)));

  const handleAddBreakdown = (bd: BreakdownRecord) => setBreakdowns(prev => [bd, ...prev]);
  const handleUpdateBreakdown = (bd: BreakdownRecord) => setBreakdowns(prev => prev.map(b => b.id === bd.id ? bd : b));

  const handleAddBOM = (bom: BOMRecord) => setBomRecords(prev => [...prev, bom]);
  const handleUpdateBOM = (bom: BOMRecord) => setBomRecords(prev => prev.map(b => b.id === bom.id ? bom : b));
  const handleDeleteBOMs = (ids: string[]) => setBomRecords(prev => prev.filter(b => !ids.includes(b.id)));

  const handleUpdateItem = (updatedItem: Item) => setItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
  const handleUpdateMachine = (updatedMachine: Machine) => setMachines(prev => prev.map(machine => machine.id === updatedMachine.id ? updatedMachine : machine));
  const handleUpdateLocation = (updatedLocation: Location) => setLocations(prev => prev.map(location => location.id === updatedLocation.id ? updatedLocation : location));
  const handleUpdateSector = (updatedSector: Sector) => setSectors(prev => prev.map(sector => sector.id === updatedSector.id ? updatedSector : sector));
  const handleUpdateDivision = (updatedDivision: Division) => setDivisions(prev => prev.map(div => div.id === updatedDivision.id ? updatedDivision : div));
  const handleUpdatePlan = (updatedPlan: MaintenancePlan) => setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
  const handleUpdateUser = (updatedUser: User) => setUsersList(prev => prev.map(u => u.username === updatedUser.username ? updatedUser : u));
  
  const handleDeleteItems = (ids: string[]) => setItems(prev => prev.filter(item => !ids.includes(item.id)));
  const handleDeleteMachines = (ids: string[]) => setMachines(prev => prev.filter(m => !ids.includes(m.id)));
  const handleDeleteLocations = (ids: string[]) => setLocations(prev => prev.filter(l => !ids.includes(l.id)));
  const handleDeleteSectors = (ids: string[]) => setSectors(prev => prev.filter(s => !ids.includes(s.id)));
  const handleDeleteDivisions = (ids: string[]) => setDivisions(prev => prev.filter(d => !ids.includes(d.id)));
  const handleDeletePlans = (ids: string[]) => setPlans(prev => prev.filter(p => !ids.includes(p.id)));
  const handleDeleteUsers = (usernames: string[]) => setUsersList(prev => prev.filter(u => !usernames.includes(u.username)));

  const handleBulkImport = (tab: string, added: any[], updated: any[]) => {
      // (Bulk Import logic remains same as previous implementation)
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
        case 'history': updateIdBasedState(setHistory); break;
        case 'breakdowns': updateIdBasedState(setBreakdowns); break;
        case 'bom': updateIdBasedState(setBomRecords); break;
        case 'users': 
            setUsersList(prev => {
                const updateMap = new Map(updated.map((u: any) => [u.username, u]));
                const nextState = prev.map(u => updateMap.has(u.username) ? updateMap.get(u.username)! : u);
                return [...nextState, ...added];
            });
            break;
    }
  };

  if (!isDataLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 flex-col">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-gray-700">Connecting to WareFlow Backend...</h2>
        <p className="text-gray-500 text-sm mt-2">Checking MySQL Connection</p>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} users={usersList} />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard history={history} machines={machines} locations={locations} setCurrentView={setCurrentView} currentUser={user} />;
      case 'agri-work-order':
        return <AgriWorkOrder orders={agriOrders} onAddOrder={handleAddAgriOrder} onUpdateOrder={handleUpdateAgriOrder} onDeleteOrders={handleDeleteAgriOrders} irrigationLogs={irrigationLogs} onAddIrrigationLog={handleAddIrrigationLog} onUpdateIrrigationLog={handleUpdateIrrigationLog} onDeleteIrrigationLogs={handleDeleteIrrigationLogs} locations={locations} machines={machines} />;
      case 'asset-management':
        return <AssetManagement machines={machines} items={items} bomRecords={bomRecords} locations={locations} sectors={sectors} divisions={divisions} breakdowns={breakdowns} onAddMachine={handleAddMachine} onUpdateMachine={handleUpdateMachine} onDeleteMachines={handleDeleteMachines} onAddBreakdown={handleAddBreakdown} onUpdateBreakdown={handleUpdateBreakdown} onAddBOM={handleAddBOM} onUpdateBOM={handleUpdateBOM} onDeleteBOMs={handleDeleteBOMs} onBulkImport={handleBulkImport} setCurrentView={setCurrentView} />;
      case 'issue-form':
        return <IssueForm onAddIssue={handleAddIssue} items={items} machines={machines} locations={locations} sectors={sectors} divisions={divisions} maintenancePlans={plans} bomRecords={bomRecords} currentUser={user} />;
      case 'stock-approval':
        if (!['admin', 'warehouse_manager', 'warehouse_supervisor'].includes(user.role)) return <Dashboard history={history} machines={machines} locations={locations} setCurrentView={setCurrentView} currentUser={user} />;
        return <StockApproval history={history} locations={locations} onUpdateIssue={handleUpdateIssue} />;
      case 'history':
        return <HistoryTable history={history} locations={locations} items={items} machines={machines} />;
      case 'master-data':
        if (user.role !== 'admin') return <Dashboard history={history} machines={machines} locations={locations} setCurrentView={setCurrentView} currentUser={user} />;
        return <MasterData history={history} items={items} machines={machines} locations={locations} sectors={sectors} divisions={divisions} plans={plans} users={usersList} onAddItem={handleAddItem} onAddMachine={handleAddMachine} onAddLocation={handleAddLocation} onAddSector={handleAddSector} onAddDivision={handleAddDivision} onAddPlan={handleAddPlan} onAddUser={handleAddUser} onUpdateItem={handleUpdateItem} onUpdateMachine={handleUpdateMachine} onUpdateLocation={handleUpdateLocation} onUpdateSector={handleUpdateSector} onUpdateDivision={handleUpdateDivision} onUpdatePlan={handleUpdatePlan} onUpdateUser={handleUpdateUser} onDeleteItems={handleDeleteItems} onDeleteMachines={handleDeleteMachines} onDeleteLocations={handleDeleteLocations} onDeleteSectors={handleDeleteSectors} onDeleteDivisions={handleDeleteDivisions} onDeletePlans={handleDeletePlans} onDeleteUsers={handleDeleteUsers} onBulkImport={handleBulkImport} />;
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
        <Sidebar currentView={currentView} setCurrentView={setCurrentView} currentUser={user} onLogout={handleLogout} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto flex flex-col h-screen relative">
          <header className="bg-white shadow-sm px-4 md:px-8 py-4 sticky top-0 z-10 flex-shrink-0">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-gray-500 hover:text-blue-600 focus:outline-none"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
                   <h2 className="text-xl font-bold text-gray-800 capitalize truncate max-w-[150px] md:max-w-none">{currentView.replace('-', ' ')}</h2>
                   {dataSource === 'php' && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200 font-bold">● SQL Connected</span>}
                   {dataSource === 'local' && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200 font-bold">● Offline Mode</span>}
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-sm text-right hidden sm:block">
                        <p className="font-medium text-gray-900">Welcome, {user.name}</p>
                    </div>
                </div>
             </div>
          </header>
          <div className="p-4 md:p-8 flex-1 overflow-y-auto">
            <ErrorBoundary>{renderContent()}</ErrorBoundary>
          </div>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;