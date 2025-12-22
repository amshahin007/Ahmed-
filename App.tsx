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
  DIVISIONS as INIT_DIVISIONS 
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
  
  // --- Data State with Persistence ---
  const [history, setHistory] = useState<IssueRecord[]>(() => loadFromStorage('wf_history', INITIAL_HISTORY));
  const [items, setItems] = useState<Item[]>(() => loadFromStorage('wf_items', INIT_ITEMS));
  const [machines, setMachines] = useState<Machine[]>(() => loadFromStorage('wf_machines', INIT_MACHINES));
  const [locations, setLocations] = useState<Location[]>(() => loadFromStorage('wf_locations', INIT_LOCATIONS));
  const [sectors, setSectors] = useState<Sector[]>(() => loadFromStorage('wf_sectors', INIT_SECTORS));
  const [divisions, setDivisions] = useState<Division[]>(() => loadFromStorage('wf_divisions', INIT_DIVISIONS));

  // Persistence Effects
  useEffect(() => { localStorage.setItem('wf_user', JSON.stringify(user)); }, [user]);
  useEffect(() => { localStorage.setItem('wf_history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('wf_items', JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem('wf_machines', JSON.stringify(machines)); }, [machines]);
  useEffect(() => { localStorage.setItem('wf_locations', JSON.stringify(locations)); }, [locations]);
  useEffect(() => { localStorage.setItem('wf_sectors', JSON.stringify(sectors)); }, [sectors]);
  useEffect(() => { localStorage.setItem('wf_divisions', JSON.stringify(divisions)); }, [divisions]);

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

  // If no user is logged in, show Login Screen
  if (!user) {
    return <Login onLogin={handleLogin} />;
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
          />
        );
      case 'stock-approval':
        // Protected Route
        if (user.role !== 'admin') return <Dashboard history={history} />;
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
        // Protected Route
        if (user.role !== 'admin') return <Dashboard history={history} />;
        return (
          <MasterData 
            items={items}
            machines={machines}
            locations={locations}
            sectors={sectors}
            divisions={divisions}
            onAddItem={handleAddItem}
            onAddMachine={handleAddMachine}
            onAddLocation={handleAddLocation}
            onAddSector={handleAddSector}
            onAddDivision={handleAddDivision}
            onUpdateItem={handleUpdateItem}
            onUpdateMachine={handleUpdateMachine}
            onUpdateLocation={handleUpdateLocation}
            onUpdateSector={handleUpdateSector}
            onUpdateDivision={handleUpdateDivision}
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
        />
        
        <main className="flex-1 overflow-y-auto">
          <header className="bg-white shadow-sm px-8 py-4 sticky top-0 z-10">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 capitalize">
                {currentView.replace('-', ' ')}
              </h2>
              <div className="flex items-center gap-4">
                <div className="text-sm text-right">
                    <p className="font-medium text-gray-900">Welcome, {user.name}</p>
                    <p className="text-xs text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                </div>
              </div>
            </div>
          </header>

          <div className="p-8">
            {renderContent()}
          </div>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;