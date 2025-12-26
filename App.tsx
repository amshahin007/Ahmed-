import React, { useState, useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import IssueForm from './components/IssueForm';
import HistoryTable from './components/HistoryTable';
import MasterData from './components/MasterData';
import StockApproval from './components/StockApproval';
import Login from './components/Login';
import { 
  INITIAL_HISTORY, 
  ITEMS as INIT_ITEMS, 
  MACHINES as INIT_MACHINES, 
  LOCATIONS as INIT_LOCATIONS,
  SECTORS as INIT_SECTORS,
  DIVISIONS as INIT_DIVISIONS,
  USERS as INIT_USERS
} from './constants';
import { IssueRecord, Item, Machine, Location, Sector, Division, User } from './types';

// Helper to load from LocalStorage safely
const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.error(`Error loading ${key} from storage:`, error);
    return fallback;
  }
};

const App: React.FC = () => {
  // --- Auth State ---
  const [user, setUser] = useState<User | null>(() => loadFromStorage('wf_user', null));

  // --- View State ---
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // --- Data State with Persistence ---
  const [history, setHistory] = useState<IssueRecord[]>(() => loadFromStorage('wf_history', INITIAL_HISTORY));
  const [items, setItems] = useState<Item[]>(() => loadFromStorage('wf_items', INIT_ITEMS));
  const [machines, setMachines] = useState<Machine[]>(() => loadFromStorage('wf_machines', INIT_MACHINES));
  const [locations, setLocations] = useState<Location[]>(() => loadFromStorage('wf_locations', INIT_LOCATIONS));
  const [sectors, setSectors] = useState<Sector[]>(() => loadFromStorage('wf_sectors', INIT_SECTORS));
  const [divisions, setDivisions] = useState<Division[]>(() => loadFromStorage('wf_divisions', INIT_DIVISIONS));
  const [usersList, setUsersList] = useState<User[]>(() => loadFromStorage('wf_users', INIT_USERS));

  // Persistence Effects
  useEffect(() => { localStorage.setItem('wf_user', JSON.stringify(user)); }, [user]);
  useEffect(() => { localStorage.setItem('wf_history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('wf_items', JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem('wf_machines', JSON.stringify(machines)); }, [machines]);
  useEffect(() => { localStorage.setItem('wf_locations', JSON.stringify(locations)); }, [locations]);
  useEffect(() => { localStorage.setItem('wf_sectors', JSON.stringify(sectors)); }, [sectors]);
  useEffect(() => { localStorage.setItem('wf_divisions', JSON.stringify(divisions)); }, [divisions]);
  useEffect(() => { localStorage.setItem('wf_users', JSON.stringify(usersList)); }, [usersList]);

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
    setHistory(prev => prev.map(issue => issue.id === updatedIssue.id ? updatedIssue : issue));
  };

  const handleAddItem = (item: Item) => setItems(prev => [...prev, item]);
  const handleAddMachine = (machine: Machine) => setMachines(prev => [...prev, machine]);
  const handleAddLocation = (location: Location) => setLocations(prev => [...prev, location]);
  const handleAddSector = (sector: Sector) => setSectors(prev => [...prev, sector]);
  const handleAddDivision = (division: Division) => setDivisions(prev => [...prev, division]);
  
  const handleAddUser = (newUser: User) => setUsersList(prev => [...prev, newUser]);
  
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
  const handleUpdateUser = (updatedUser: User) => {
    setUsersList(prev => prev.map(u => u.username === updatedUser.username ? updatedUser : u));
  };
  
  const handleDeleteItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  // If no user is logged in, show Login Screen
  if (!user) {
    return <Login onLogin={handleLogin} users={usersList} />;
  }

  // Router Logic based on View
  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard history={history} />;
      case 'issue-form':
        return (
          <IssueForm 
            onAddIssue={handleAddIssue} 
            items={items}
            machines={machines}
            locations={locations}
            sectors={sectors}
            divisions={divisions}
            currentUser={user}
          />
        );
      case 'stock-approval':
        // Protected Route: Admin, Warehouse Manager, Warehouse Supervisor
        if (!['admin', 'warehouse_manager', 'warehouse_supervisor'].includes(user.role)) return <Dashboard history={history} />;
        return (
          <StockApproval 
            history={history} 
            locations={locations}
            onUpdateIssue={handleUpdateIssue} 
          />
        );
      case 'history':
        return <HistoryTable history={history} locations={locations} />;
      case 'master-data':
        // Protected Route: Admin only
        if (user.role !== 'admin') return <Dashboard history={history} />;
        return (
          <MasterData 
            history={history}
            items={items}
            machines={machines}
            locations={locations}
            sectors={sectors}
            divisions={divisions}
            users={usersList}
            onAddItem={handleAddItem}
            onAddMachine={handleAddMachine}
            onAddLocation={handleAddLocation}
            onAddSector={handleAddSector}
            onAddDivision={handleAddDivision}
            onAddUser={handleAddUser}
            onUpdateItem={handleUpdateItem}
            onUpdateMachine={handleUpdateMachine}
            onUpdateLocation={handleUpdateLocation}
            onUpdateSector={handleUpdateSector}
            onUpdateDivision={handleUpdateDivision}
            onUpdateUser={handleUpdateUser}
            onDeleteItem={handleDeleteItem}
          />
        );
      default:
        return <Dashboard history={history} />;
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
                {/* Mobile User Icon */}
                <div className="sm:hidden w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                    {user.username.substring(0,2).toUpperCase()}
                </div>
              </div>
            </div>
          </header>

          <div className="p-4 md:p-8 flex-1 overflow-y-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;