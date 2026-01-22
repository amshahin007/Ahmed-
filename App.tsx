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

  // Load Data from IDB on Mount
  useEffect(() => {
    const loadData = async () => {
      try {
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
      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Persist Data Handlers (Generic wrapper)
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

  // --- Data Modification Handlers ---
  
  // Items
  const handleAddItem = (item: Item) => saveData('items', [...items, item], setItems);
  const handleUpdateItem = (item: Item) => saveData('items', items.map(i => i.id === item.id ? item : i), setItems);
  const handleDeleteItems = (ids: string[]) => saveData('items', items.filter(i => !ids.includes(i.id)), setItems);

  // Machines
  const handleAddMachine = (m: Machine) => saveData('machines', [...machines, m], setMachines);
  const handleUpdateMachine = (m: Machine) => saveData('machines', machines.map(x => x.id === m.id ? m : x), setMachines);
  const handleDeleteMachines = (ids: string[]) => saveData('machines', machines.filter(x => !ids.includes(x.id)), setMachines);

  // Locations
  const handleAddLocation = (l: Location) => saveData('locations', [...locations, l], setLocations);
  const handleUpdateLocation = (l: Location) => saveData('locations', locations.map(x => x.id === l.id ? l : x), setLocations);
  const handleDeleteLocations = (ids: string[]) => saveData('locations', locations.filter(x => !ids.includes(x.id)), setLocations);

  // Sectors
  const handleAddSector = (s: Sector) => saveData('sectors', [...sectors, s], setSectors);
  const handleUpdateSector = (s: Sector) => saveData('sectors', sectors.map(x => x.id === s.id ? s : x), setSectors);
  const handleDeleteSectors = (ids: string[]) => saveData('sectors', sectors.filter(x => !ids.includes(x.id)), setSectors);

  // Divisions
  const handleAddDivision = (d: Division) => saveData('divisions', [...divisions, d], setDivisions);
  const handleUpdateDivision = (d: Division) => saveData('divisions', divisions.map(x => x.id === d.id ? d : x), setDivisions);
  const handleDeleteDivisions = (ids: string[]) => saveData('divisions', divisions.filter(x => !ids.includes(x.id)), setDivisions);

  // Plans
  const handleAddPlan = (p: MaintenancePlan) => saveData('plans', [...plans, p], setPlans);
  const handleUpdatePlan = (p: MaintenancePlan) => saveData('plans', plans.map(x => x.id === p.id ? p : x), setPlans);
  const handleDeletePlans = (ids: string[]) => saveData('plans', plans.filter(x => !ids.includes(x.id)), setPlans);

  // Users
  const handleAddUser = (u: User) => saveData('users', [...users, u], setUsers);
  const handleUpdateUser = (u: User) => saveData('users', users.map(x => x.username === u.username ? u : x), setUsers);
  const handleDeleteUsers = (names: string[]) => saveData('users', users.filter(x => !names.includes(x.username)), setUsers);

  // History (Issues)
  const handleAddIssue = (issue: IssueRecord) => {
      saveData('history', [issue, ...history], setHistory);
      // Update stock logic could go here
      const item = items.find(i => i.id === issue.itemId);
      if (item && item.stockQuantity !== undefined) {
         const newStock = Math.max(0, item.stockQuantity - issue.quantity);
         handleUpdateItem({ ...item, stockQuantity: newStock });
      }
  };
  const handleUpdateIssue = (issue: IssueRecord) => saveData('history', history.map(x => x.id === issue.id ? issue : x), setHistory);

  // Breakdowns
  const handleAddBreakdown = (b: BreakdownRecord) => saveData('breakdowns', [b, ...breakdowns], setBreakdowns);
  const handleUpdateBreakdown = (b: BreakdownRecord) => saveData('breakdowns', breakdowns.map(x => x.id === b.id ? b : x), setBreakdowns);

  // BOM
  const handleAddBOM = (b: BOMRecord) => saveData('bomRecords', [...bomRecords, b], setBomRecords);
  const handleUpdateBOM = (b: BOMRecord) => saveData('bomRecords', bomRecords.map(x => x.id === b.id ? b : x), setBomRecords);
  const handleDeleteBOMs = (ids: string[]) => saveData('bomRecords', bomRecords.filter(x => !ids.includes(x.id)), setBomRecords);

  // Agri Orders
  const handleAddAgriOrder = (o: AgriOrderRecord) => saveData('agriOrders', [...agriOrders, o], setAgriOrders);
  const handleUpdateAgriOrder = (o: AgriOrderRecord) => saveData('agriOrders', agriOrders.map(x => x.id === o.id ? o : x), setAgriOrders);
  const handleDeleteAgriOrders = (ids: string[]) => saveData('agriOrders', agriOrders.filter(x => !ids.includes(x.id)), setAgriOrders);

  // Irrigation Logs
  const handleAddIrrigationLog = (l: IrrigationLogRecord) => saveData('irrigationLogs', [...irrigationLogs, l], setIrrigationLogs);
  const handleUpdateIrrigationLog = (l: IrrigationLogRecord) => saveData('irrigationLogs', irrigationLogs.map(x => x.id === l.id ? l : x), setIrrigationLogs);
  const handleDeleteIrrigationLogs = (ids: string[]) => saveData('irrigationLogs', irrigationLogs.filter(x => !ids.includes(x.id)), setIrrigationLogs);

  // Forecast
  const handleAddForecastPeriod = (p: ForecastPeriod) => saveData('forecastPeriods', [...forecastPeriods, p], setForecastPeriods);
  const handleUpdateForecastPeriod = (p: ForecastPeriod) => saveData('forecastPeriods', forecastPeriods.map(x => x.id === p.id ? p : x), setForecastPeriods);
  const handleUpdateForecastRecords = (newRecords: ForecastRecord[]) => {
      saveData('forecastRecords', newRecords, setForecastRecords);
  };

  // Bulk Import
  const handleBulkImport = (tab: string, added: any[], updated: any[]) => {
      if (tab === 'items') {
         const newItems = [...items];
         added.forEach(a => newItems.push(a));
         updated.forEach(u => { const idx = newItems.findIndex(i => i.id === u.id); if (idx > -1) newItems[idx] = u; });
         saveData('items', newItems, setItems);
      } else if (tab === 'machines') {
         const newMachines = [...machines];
         added.forEach(a => newMachines.push(a));
         updated.forEach(u => { const idx = newMachines.findIndex(m => m.id === u.id); if (idx > -1) newMachines[idx] = u; });
         saveData('machines', newMachines, setMachines);
      } else if (tab === 'bom') {
         const newBom = [...bomRecords];
         added.forEach(a => newBom.push(a));
         updated.forEach(u => { const idx = newBom.findIndex(b => b.id === u.id); if (idx > -1) newBom[idx] = u; });
         saveData('bomRecords', newBom, setBomRecords);
      } else if (tab === 'breakdowns') {
         const newBreakdowns = [...breakdowns];
         added.forEach(a => newBreakdowns.push(a));
         updated.forEach(u => { const idx = newBreakdowns.findIndex(b => b.id === u.id); if (idx > -1) newBreakdowns[idx] = u; });
         saveData('breakdowns', newBreakdowns, setBreakdowns);
      } else if (tab === 'locations') {
         const newLocs = [...locations];
         added.forEach(a => newLocs.push(a));
         updated.forEach(u => { const idx = newLocs.findIndex(l => l.id === u.id); if (idx > -1) newLocs[idx] = u; });
         saveData('locations', newLocs, setLocations);
      } else if (tab === 'sectors') {
         const newSecs = [...sectors];
         added.forEach(a => newSecs.push(a));
         updated.forEach(u => { const idx = newSecs.findIndex(s => s.id === u.id); if (idx > -1) newSecs[idx] = u; });
         saveData('sectors', newSecs, setSectors);
      } else if (tab === 'divisions') {
         const newDivs = [...divisions];
         added.forEach(a => newDivs.push(a));
         updated.forEach(u => { const idx = newDivs.findIndex(d => d.id === u.id); if (idx > -1) newDivs[idx] = u; });
         saveData('divisions', newDivs, setDivisions);
      } else if (tab === 'plans') {
         const newPlans = [...plans];
         added.forEach(a => newPlans.push(a));
         updated.forEach(u => { const idx = newPlans.findIndex(p => p.id === u.id); if (idx > -1) newPlans[idx] = u; });
         saveData('plans', newPlans, setPlans);
      } else if (tab === 'users') {
         const newUsers = [...users];
         added.forEach(a => newUsers.push(a));
         updated.forEach(u => { const idx = newUsers.findIndex(usr => usr.username === u.username); if (idx > -1) newUsers[idx] = u; });
         saveData('users', newUsers, setUsers);
      }
  };

  const handleRestore = async () => {
     const scriptUrl = localStorage.getItem('wf_script_url_v3') || DEFAULT_SCRIPT_URL;
     const data = await fetchAllDataFromCloud(scriptUrl);
     if (data) {
         if (data.items) saveData('items', data.items, setItems);
         if (data.machines) saveData('machines', data.machines, setMachines);
         if (data.history) saveData('history', data.history, setHistory);
         if (data.locations) saveData('locations', data.locations, setLocations);
         if (data.sectors) saveData('sectors', data.sectors, setSectors);
         if (data.divisions) saveData('divisions', data.divisions, setDivisions);
         if (data.users) saveData('users', data.users, setUsers);
         if (data.plans) saveData('plans', data.plans, setPlans);
         if (data.breakdowns) saveData('breakdowns', data.breakdowns, setBreakdowns);
         if (data.bom) saveData('bomRecords', data.bom, setBomRecords);
         if (data.agri_orders) saveData('agriOrders', data.agri_orders, setAgriOrders);
         if (data.irrigation_logs) saveData('irrigationLogs', data.irrigation_logs, setIrrigationLogs);
         if (data.forecasts) saveData('forecastRecords', data.forecasts, setForecastRecords);
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
                                return <HistoryTable history={history} locations={locations} items={items} machines={machines} />;
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