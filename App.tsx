import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import IssueForm from './components/IssueForm';
import HistoryTable from './components/HistoryTable';
import StockApproval from './components/StockApproval';
import MasterData from './components/MasterData';
import AssetManagement from './components/AssetManagement';
import AgriWorkOrder from './components/AgriWorkOrder';
import MaterialForecast from './components/MaterialForecast';
import AiAssistant from './components/AiAssistant';
import Settings from './components/Settings';
import ErrorBoundary from './components/ErrorBoundary';

import { getItem, setItem } from './services/storageService';
import { fetchAllDataFromCloud, DEFAULT_SCRIPT_URL } from './services/googleSheetsService';
import { fetchAllData as fetchApiData, upsertRecord, deleteRecord } from './services/phpApiService';
import { USERS, ITEMS, MACHINES, LOCATIONS, SECTORS, DIVISIONS, MAINTENANCE_PLANS, INITIAL_HISTORY, INITIAL_BREAKDOWNS } from './constants';
import { User, Item, Machine, Location, Sector, Division, IssueRecord, MaintenancePlan, BreakdownRecord, BOMRecord, AgriOrderRecord, IrrigationLogRecord, ForecastPeriod, ForecastRecord } from './types';

const App: React.FC = () => {
  // User State
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(USERS);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Data State
  const [items, setItems] = useState<Item[]>(ITEMS);
  const [machines, setMachines] = useState<Machine[]>(MACHINES);
  const [locations, setLocations] = useState<Location[]>(LOCATIONS);
  const [sectors, setSectors] = useState<Sector[]>(SECTORS);
  const [divisions, setDivisions] = useState<Division[]>(DIVISIONS);
  const [plans, setPlans] = useState<MaintenancePlan[]>(MAINTENANCE_PLANS);
  const [history, setHistory] = useState<IssueRecord[]>(INITIAL_HISTORY);
  const [breakdowns, setBreakdowns] = useState<BreakdownRecord[]>(INITIAL_BREAKDOWNS);
  const [bomRecords, setBomRecords] = useState<BOMRecord[]>([]);
  const [agriOrders, setAgriOrders] = useState<AgriOrderRecord[]>([]);
  const [irrigationLogs, setIrrigationLogs] = useState<IrrigationLogRecord[]>([]);
  const [forecastPeriods, setForecastPeriods] = useState<ForecastPeriod[]>([]);
  const [forecastRecords, setForecastRecords] = useState<ForecastRecord[]>([]);

  // Loading State
  const [isLoading, setIsLoading] = useState(true);

  // Load Data from API or IDB on Mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Try PHP API First
        const apiData = await fetchApiData();
        
        if (apiData) {
            // If API works, use it
            if (apiData.items) setItems(apiData.items);
            if (apiData.machines) setMachines(apiData.machines);
            if (apiData.locations) setLocations(apiData.locations);
            if (apiData.sectors) setSectors(apiData.sectors);
            if (apiData.divisions) setDivisions(apiData.divisions);
            if (apiData.plans) setPlans(apiData.plans);
            if (apiData.users) setUsers(apiData.users);
            if (apiData.history) setHistory(apiData.history);
            if (apiData.breakdowns) setBreakdowns(apiData.breakdowns);
            if (apiData.bomRecords) setBomRecords(apiData.bomRecords);
            if (apiData.agriOrders) setAgriOrders(apiData.agriOrders);
            if (apiData.irrigationLogs) setIrrigationLogs(apiData.irrigationLogs);
            if (apiData.forecastPeriods) setForecastPeriods(apiData.forecastPeriods);
            if (apiData.forecastRecords) setForecastRecords(apiData.forecastRecords);
        } else {
            // Fallback to IndexedDB
            const [
              storedUser, storedUsers, storedItems, storedMachines, storedLocations, 
              storedSectors, storedDivisions, storedPlans, storedHistory, 
              storedBreakdowns, storedBom, storedAgri, storedIrrigation,
              storedPeriods, storedForecasts
            ] = await Promise.all([
              getItem<User>('user'), getItem<User[]>('users'), getItem<Item[]>('items'), 
              getItem<Machine[]>('machines'), getItem<Location[]>('locations'), getItem<Sector[]>('sectors'),
              getItem<Division[]>('divisions'), getItem<MaintenancePlan[]>('plans'), getItem<IssueRecord[]>('history'),
              getItem<BreakdownRecord[]>('breakdowns'), getItem<BOMRecord[]>('bomRecords'),
              getItem<AgriOrderRecord[]>('agriOrders'), getItem<IrrigationLogRecord[]>('irrigationLogs'),
              getItem<ForecastPeriod[]>('forecastPeriods'), getItem<ForecastRecord[]>('forecastRecords')
            ]);

            if (storedUser) setUser(storedUser);
            if (storedUsers) setUsers(storedUsers);
            if (storedItems) setItems(storedItems);
            if (storedMachines) setMachines(storedMachines);
            if (storedLocations) setLocations(storedLocations);
            if (storedSectors) setSectors(storedSectors);
            if (storedDivisions) setDivisions(storedDivisions);
            if (storedPlans) setPlans(storedPlans);
            if (storedHistory) setHistory(storedHistory);
            if (storedBreakdowns) setBreakdowns(storedBreakdowns);
            if (storedBom) setBomRecords(storedBom);
            if (storedAgri) setAgriOrders(storedAgri);
            if (storedIrrigation) setIrrigationLogs(storedIrrigation);
            if (storedPeriods) setForecastPeriods(storedPeriods);
            if (storedForecasts) setForecastRecords(storedForecasts);
        }
        
        // Always check for logged in user in local storage
        const u = await getItem<User>('user');
        if (u) setUser(u);

      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Persist Data Handlers
  const saveData = (key: string, data: any, setter: React.Dispatch<React.SetStateAction<any>>) => {
      setter(data);
      setItem(key, data);
  };

  // --- Auth Handlers ---
  const handleLogin = (u: User) => {
      saveData('user', u, setUser);
  };
  const handleLogout = () => {
      setUser(null);
      setItem('user', null);
  };

  // --- Data Modification Handlers (With API Calls) ---
  
  // Items
  const handleAddItem = (item: Item) => {
      saveData('items', [...items, item], setItems);
      upsertRecord('items', item);
  };
  const handleUpdateItem = (item: Item) => {
      saveData('items', items.map(i => i.id === item.id ? item : i), setItems);
      upsertRecord('items', item);
  };
  const handleDeleteItems = (ids: string[]) => {
      saveData('items', items.filter(i => !ids.includes(i.id)), setItems);
      ids.forEach(id => deleteRecord('items', id));
  };

  // Machines
  const handleAddMachine = (m: Machine) => {
      saveData('machines', [...machines, m], setMachines);
      upsertRecord('machines', m);
  };
  const handleUpdateMachine = (m: Machine) => {
      saveData('machines', machines.map(x => x.id === m.id ? m : x), setMachines);
      upsertRecord('machines', m);
  };
  const handleDeleteMachines = (ids: string[]) => {
      saveData('machines', machines.filter(x => !ids.includes(x.id)), setMachines);
      ids.forEach(id => deleteRecord('machines', id));
  };

  // Locations
  const handleAddLocation = (l: Location) => {
      saveData('locations', [...locations, l], setLocations);
      upsertRecord('locations', l);
  };
  const handleUpdateLocation = (l: Location) => {
      saveData('locations', locations.map(x => x.id === l.id ? l : x), setLocations);
      upsertRecord('locations', l);
  };
  const handleDeleteLocations = (ids: string[]) => {
      saveData('locations', locations.filter(x => !ids.includes(x.id)), setLocations);
      ids.forEach(id => deleteRecord('locations', id));
  };

  // Sectors
  const handleAddSector = (s: Sector) => {
      saveData('sectors', [...sectors, s], setSectors);
      upsertRecord('sectors', s);
  };
  const handleUpdateSector = (s: Sector) => {
      saveData('sectors', sectors.map(x => x.id === s.id ? s : x), setSectors);
      upsertRecord('sectors', s);
  };
  const handleDeleteSectors = (ids: string[]) => {
      saveData('sectors', sectors.filter(x => !ids.includes(x.id)), setSectors);
      ids.forEach(id => deleteRecord('sectors', id));
  };

  // Divisions
  const handleAddDivision = (d: Division) => {
      saveData('divisions', [...divisions, d], setDivisions);
      upsertRecord('divisions', d);
  };
  const handleUpdateDivision = (d: Division) => {
      saveData('divisions', divisions.map(x => x.id === d.id ? d : x), setDivisions);
      upsertRecord('divisions', d);
  };
  const handleDeleteDivisions = (ids: string[]) => {
      saveData('divisions', divisions.filter(x => !ids.includes(x.id)), setDivisions);
      ids.forEach(id => deleteRecord('divisions', id));
  };

  // Plans
  const handleAddPlan = (p: MaintenancePlan) => {
      saveData('plans', [...plans, p], setPlans);
      upsertRecord('plans', p);
  };
  const handleUpdatePlan = (p: MaintenancePlan) => {
      saveData('plans', plans.map(x => x.id === p.id ? p : x), setPlans);
      upsertRecord('plans', p);
  };
  const handleDeletePlans = (ids: string[]) => {
      saveData('plans', plans.filter(x => !ids.includes(x.id)), setPlans);
      ids.forEach(id => deleteRecord('plans', id));
  };

  // Users
  const handleAddUser = (u: User) => {
      saveData('users', [...users, u], setUsers);
      upsertRecord('users', u);
  };
  const handleUpdateUser = (u: User) => {
      saveData('users', users.map(x => x.username === u.username ? u : x), setUsers);
      upsertRecord('users', u);
  };
  const handleDeleteUsers = (names: string[]) => {
      saveData('users', users.filter(x => !names.includes(x.username)), setUsers);
      names.forEach(id => deleteRecord('users', id));
  };

  // History (Issues)
  const handleAddIssue = (issue: IssueRecord) => {
      saveData('history', [issue, ...history], setHistory);
      upsertRecord('history', issue);
      
      // Update stock logic
      const item = items.find(i => i.id === issue.itemId);
      if (item && item.stockQuantity !== undefined) {
         const newStock = Math.max(0, item.stockQuantity - issue.quantity);
         const updatedItem = { ...item, stockQuantity: newStock };
         handleUpdateItem(updatedItem);
      }
  };
  const handleUpdateIssue = (issue: IssueRecord) => {
      saveData('history', history.map(x => x.id === issue.id ? issue : x), setHistory);
      upsertRecord('history', issue);
  };

  // Breakdowns
  const handleAddBreakdown = (b: BreakdownRecord) => {
      saveData('breakdowns', [b, ...breakdowns], setBreakdowns);
      upsertRecord('breakdowns', b);
  };
  const handleUpdateBreakdown = (b: BreakdownRecord) => {
      saveData('breakdowns', breakdowns.map(x => x.id === b.id ? b : x), setBreakdowns);
      upsertRecord('breakdowns', b);
  };

  // BOM
  const handleAddBOM = (b: BOMRecord) => {
      saveData('bomRecords', [...bomRecords, b], setBomRecords);
      upsertRecord('bomRecords', b);
  };
  const handleUpdateBOM = (b: BOMRecord) => {
      saveData('bomRecords', bomRecords.map(x => x.id === b.id ? b : x), setBomRecords);
      upsertRecord('bomRecords', b);
  };
  const handleDeleteBOMs = (ids: string[]) => {
      saveData('bomRecords', bomRecords.filter(x => !ids.includes(x.id)), setBomRecords);
      ids.forEach(id => deleteRecord('bomRecords', id));
  };

  // Agri Orders
  const handleAddAgriOrder = (o: AgriOrderRecord) => {
      saveData('agriOrders', [...agriOrders, o], setAgriOrders);
      upsertRecord('agriOrders', o);
  };
  const handleUpdateAgriOrder = (o: AgriOrderRecord) => {
      saveData('agriOrders', agriOrders.map(x => x.id === o.id ? o : x), setAgriOrders);
      upsertRecord('agriOrders', o);
  };
  const handleDeleteAgriOrders = (ids: string[]) => {
      saveData('agriOrders', agriOrders.filter(x => !ids.includes(x.id)), setAgriOrders);
      ids.forEach(id => deleteRecord('agriOrders', id));
  };

  // Irrigation Logs
  const handleAddIrrigationLog = (l: IrrigationLogRecord) => {
      saveData('irrigationLogs', [...irrigationLogs, l], setIrrigationLogs);
      upsertRecord('irrigationLogs', l);
  };
  const handleUpdateIrrigationLog = (l: IrrigationLogRecord) => {
      saveData('irrigationLogs', irrigationLogs.map(x => x.id === l.id ? l : x), setIrrigationLogs);
      upsertRecord('irrigationLogs', l);
  };
  const handleDeleteIrrigationLogs = (ids: string[]) => {
      saveData('irrigationLogs', irrigationLogs.filter(x => !ids.includes(x.id)), setIrrigationLogs);
      ids.forEach(id => deleteRecord('irrigationLogs', id));
  };

  // Forecast
  const handleAddForecastPeriod = (p: ForecastPeriod) => {
      saveData('forecastPeriods', [...forecastPeriods, p], setForecastPeriods);
      upsertRecord('forecastPeriods', p);
  };
  const handleUpdateForecastPeriod = (p: ForecastPeriod) => {
      saveData('forecastPeriods', forecastPeriods.map(x => x.id === p.id ? p : x), setForecastPeriods);
      upsertRecord('forecastPeriods', p);
  };
  const handleUpdateForecastRecords = (newRecords: ForecastRecord[]) => {
      saveData('forecastRecords', newRecords, setForecastRecords);
      // Bulk update is heavy, loop for now or optimize later
      newRecords.forEach(r => upsertRecord('forecastRecords', r));
  };

  // Bulk Import Wrapper
  const handleBulkImport = (tab: string, added: any[], updated: any[]) => {
      // 1. Update State & Local Storage
      if (tab === 'items') {
         const newItems = [...items];
         added.forEach(a => { newItems.push(a); upsertRecord('items', a); });
         updated.forEach(u => { 
             const idx = newItems.findIndex(i => i.id === u.id); 
             if (idx > -1) newItems[idx] = u; 
             upsertRecord('items', u);
         });
         saveData('items', newItems, setItems);
      } else if (tab === 'machines') {
         const newMachines = [...machines];
         added.forEach(a => { newMachines.push(a); upsertRecord('machines', a); });
         updated.forEach(u => { 
             const idx = newMachines.findIndex(m => m.id === u.id); 
             if (idx > -1) newMachines[idx] = u; 
             upsertRecord('machines', u);
         });
         saveData('machines', newMachines, setMachines);
      } else if (tab === 'bom') {
         const newBom = [...bomRecords];
         added.forEach(a => { newBom.push(a); upsertRecord('bomRecords', a); });
         updated.forEach(u => { 
             const idx = newBom.findIndex(b => b.id === u.id); 
             if (idx > -1) newBom[idx] = u; 
             upsertRecord('bomRecords', u);
         });
         saveData('bomRecords', newBom, setBomRecords);
      } else if (tab === 'breakdowns') {
         const newBreakdowns = [...breakdowns];
         added.forEach(a => { newBreakdowns.push(a); upsertRecord('breakdowns', a); });
         updated.forEach(u => { 
             const idx = newBreakdowns.findIndex(b => b.id === u.id); 
             if (idx > -1) newBreakdowns[idx] = u; 
             upsertRecord('breakdowns', u);
         });
         saveData('breakdowns', newBreakdowns, setBreakdowns);
      } else if (tab === 'locations') {
         const newLocs = [...locations];
         added.forEach(a => { newLocs.push(a); upsertRecord('locations', a); });
         updated.forEach(u => { 
             const idx = newLocs.findIndex(l => l.id === u.id); 
             if (idx > -1) newLocs[idx] = u; 
             upsertRecord('locations', u);
         });
         saveData('locations', newLocs, setLocations);
      } else if (tab === 'sectors') {
         const newSecs = [...sectors];
         added.forEach(a => { newSecs.push(a); upsertRecord('sectors', a); });
         updated.forEach(u => { 
             const idx = newSecs.findIndex(s => s.id === u.id); 
             if (idx > -1) newSecs[idx] = u; 
             upsertRecord('sectors', u);
         });
         saveData('sectors', newSecs, setSectors);
      } else if (tab === 'divisions') {
         const newDivs = [...divisions];
         added.forEach(a => { newDivs.push(a); upsertRecord('divisions', a); });
         updated.forEach(u => { 
             const idx = newDivs.findIndex(d => d.id === u.id); 
             if (idx > -1) newDivs[idx] = u; 
             upsertRecord('divisions', u);
         });
         saveData('divisions', newDivs, setDivisions);
      } else if (tab === 'plans') {
         const newPlans = [...plans];
         added.forEach(a => { newPlans.push(a); upsertRecord('plans', a); });
         updated.forEach(u => { 
             const idx = newPlans.findIndex(p => p.id === u.id); 
             if (idx > -1) newPlans[idx] = u; 
             upsertRecord('plans', u);
         });
         saveData('plans', newPlans, setPlans);
      } else if (tab === 'users') {
         const newUsers = [...users];
         added.forEach(a => { newUsers.push(a); upsertRecord('users', a); });
         updated.forEach(u => { 
             const idx = newUsers.findIndex(usr => usr.username === u.username); 
             if (idx > -1) newUsers[idx] = u; 
             upsertRecord('users', u);
         });
         saveData('users', newUsers, setUsers);
      } else if (tab === 'periods') {
         const newPeriods = [...forecastPeriods];
         added.forEach(a => { newPeriods.push(a); upsertRecord('forecastPeriods', a); });
         updated.forEach(u => { 
             const idx = newPeriods.findIndex(p => p.id === u.id); 
             if (idx > -1) newPeriods[idx] = u; 
             upsertRecord('forecastPeriods', u);
         });
         saveData('forecastPeriods', newPeriods, setForecastPeriods);
      } else if (tab === 'history') {
         const newHistory = [...history];
         added.forEach(a => { newHistory.push(a); upsertRecord('history', a); });
         updated.forEach(u => { 
             const idx = newHistory.findIndex(h => h.id === u.id); 
             if (idx > -1) newHistory[idx] = u; 
             upsertRecord('history', u);
         });
         saveData('history', newHistory, setHistory);
      }
  };

  const handleRestore = async () => {
     const scriptUrl = localStorage.getItem('wf_script_url_v3') || DEFAULT_SCRIPT_URL;
     const data = await fetchAllDataFromCloud(scriptUrl);
     if (data) {
         if (data.items) { saveData('items', data.items, setItems); data.items.forEach(i => upsertRecord('items', i)); }
         if (data.machines) { saveData('machines', data.machines, setMachines); data.machines.forEach(m => upsertRecord('machines', m)); }
         if (data.history) { saveData('history', data.history, setHistory); data.history.forEach(h => upsertRecord('history', h)); }
         if (data.locations) { saveData('locations', data.locations, setLocations); data.locations.forEach(l => upsertRecord('locations', l)); }
         if (data.sectors) { saveData('sectors', data.sectors, setSectors); data.sectors.forEach(s => upsertRecord('sectors', s)); }
         if (data.divisions) { saveData('divisions', data.divisions, setDivisions); data.divisions.forEach(d => upsertRecord('divisions', d)); }
         if (data.users) { saveData('users', data.users, setUsers); data.users.forEach(u => upsertRecord('users', u)); }
         if (data.plans) { saveData('plans', data.plans, setPlans); data.plans.forEach(p => upsertRecord('plans', p)); }
         if (data.breakdowns) { saveData('breakdowns', data.breakdowns, setBreakdowns); data.breakdowns.forEach(b => upsertRecord('breakdowns', b)); }
         if (data.bom) { saveData('bomRecords', data.bom, setBomRecords); data.bom.forEach(b => upsertRecord('bomRecords', b)); }
         if (data.agri_orders) { saveData('agriOrders', data.agri_orders, setAgriOrders); data.agri_orders.forEach(o => upsertRecord('agriOrders', o)); }
         if (data.irrigation_logs) { saveData('irrigationLogs', data.irrigation_logs, setIrrigationLogs); data.irrigation_logs.forEach(l => upsertRecord('irrigationLogs', l)); }
         if (data.forecasts) { saveData('forecastRecords', data.forecasts, setForecastRecords); data.forecasts.forEach(f => upsertRecord('forecastRecords', f)); }
     }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  if (!user) {
    return <Login onLogin={handleLogin} users={users} />;
  }

  return (
    <ErrorBoundary>
        <div className="flex min-h-screen bg-gray-100 font-sans">
            <Sidebar 
                currentView={currentView} 
                setCurrentView={setCurrentView} 
                currentUser={user} 
                onLogout={handleLogout} 
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />
            
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                {/* Mobile Header */}
                <header className="bg-white shadow-sm z-20 md:hidden flex items-center justify-between p-4">
                    <button onClick={() => setIsSidebarOpen(true)} className="text-gray-600">
                         <span className="text-2xl">☰</span>
                    </button>
                    <h1 className="font-bold text-gray-800">Daltex Maintenance</h1>
                    <div className="w-8"></div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
                    {(() => {
                        switch (currentView) {
                            case 'dashboard':
                                return <Dashboard history={history} machines={machines} locations={locations} setCurrentView={setCurrentView} currentUser={user} />;
                            case 'issue-form':
                                return <IssueForm onAddIssue={handleAddIssue} items={items} machines={machines} locations={locations} sectors={sectors} divisions={divisions} maintenancePlans={plans} bomRecords={bomRecords} currentUser={user} />;
                            case 'history':
                                return <HistoryTable history={history} locations={locations} items={items} machines={machines} onBulkImport={handleBulkImport} />;
                            case 'stock-approval':
                                if (!['admin', 'warehouse_manager', 'warehouse_supervisor'].includes(user.role)) {
                                    return <Dashboard history={history} machines={machines} locations={locations} setCurrentView={setCurrentView} currentUser={user} />;
                                }
                                return <StockApproval history={history} locations={locations} onUpdateIssue={handleUpdateIssue} />;
                            case 'master-data':
                                if (user.role !== 'admin') return <Dashboard history={history} machines={machines} locations={locations} setCurrentView={setCurrentView} currentUser={user} />;
                                return <MasterData 
                                    history={history} items={items} machines={machines} locations={locations} sectors={sectors} divisions={divisions} plans={plans} users={users}
                                    onAddItem={handleAddItem} onAddMachine={handleAddMachine} onAddLocation={handleAddLocation} onAddSector={handleAddSector} onAddDivision={handleAddDivision} onAddPlan={handleAddPlan} onAddUser={handleAddUser}
                                    onUpdateItem={handleUpdateItem} onUpdateMachine={handleUpdateMachine} onUpdateLocation={handleUpdateLocation} onUpdateSector={handleUpdateSector} onUpdateDivision={handleUpdateDivision} onUpdatePlan={handleUpdatePlan} onUpdateUser={handleUpdateUser}
                                    onDeleteItems={handleDeleteItems} onDeleteMachines={handleDeleteMachines} onDeleteLocations={handleDeleteLocations} onDeleteSectors={handleDeleteSectors} onDeleteDivisions={handleDeleteDivisions} onDeletePlans={handleDeletePlans} onDeleteUsers={handleDeleteUsers}
                                    onBulkImport={handleBulkImport} onRestore={handleRestore}
                                />;
                            case 'asset-management':
                                return <AssetManagement 
                                    machines={machines} items={items} bomRecords={bomRecords} locations={locations} sectors={sectors} divisions={divisions} breakdowns={breakdowns}
                                    onAddMachine={handleAddMachine} onUpdateMachine={handleUpdateMachine} onDeleteMachines={handleDeleteMachines}
                                    onAddBreakdown={handleAddBreakdown} onUpdateBreakdown={handleUpdateBreakdown}
                                    onAddBOM={handleAddBOM} onUpdateBOM={handleUpdateBOM} onDeleteBOMs={handleDeleteBOMs}
                                    onBulkImport={handleBulkImport} setCurrentView={setCurrentView}
                                />;
                            case 'agri-work-order':
                                return <AgriWorkOrder 
                                    orders={agriOrders} onAddOrder={handleAddAgriOrder} onUpdateOrder={handleUpdateAgriOrder} onDeleteOrders={handleDeleteAgriOrders}
                                    irrigationLogs={irrigationLogs} onAddIrrigationLog={handleAddIrrigationLog} onUpdateIrrigationLog={handleUpdateIrrigationLog} onDeleteIrrigationLogs={handleDeleteIrrigationLogs}
                                    locations={locations} machines={machines}
                                />;
                            case 'material-forecast':
                                return <MaterialForecast 
                                    items={items} locations={locations} sectors={sectors} divisions={divisions} history={history} 
                                    machines={machines} bomRecords={bomRecords}
                                    forecastPeriods={forecastPeriods} onAddPeriod={handleAddForecastPeriod} onUpdatePeriod={handleUpdateForecastPeriod} 
                                    forecastRecords={forecastRecords} onUpdateForecast={handleUpdateForecastRecords} 
                                    currentUser={user}
                                    onBulkImport={handleBulkImport} 
                                />;
                            case 'ai-assistant':
                                return <AiAssistant />;
                            case 'settings':
                                return <Settings onRestore={handleRestore} />;
                            default:
                                return <Dashboard history={history} machines={machines} locations={locations} setCurrentView={setCurrentView} currentUser={user} />;
                        }
                    })()}
                </main>
            </div>
        </div>
    </ErrorBoundary>
  );
};

export default App;