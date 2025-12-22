import React, { useState } from 'react';
import { HashRouter } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import IssueForm from './components/IssueForm';
import HistoryTable from './components/HistoryTable';
import MasterData from './components/MasterData';
import { INITIAL_HISTORY, ITEMS as INIT_ITEMS, MACHINES as INIT_MACHINES, LOCATIONS as INIT_LOCATIONS } from './constants';
import { IssueRecord, Item, Machine, Location } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  
  // App State
  const [history, setHistory] = useState<IssueRecord[]>(INITIAL_HISTORY);
  const [items, setItems] = useState<Item[]>(INIT_ITEMS);
  const [machines, setMachines] = useState<Machine[]>(INIT_MACHINES);
  const [locations, setLocations] = useState<Location[]>(INIT_LOCATIONS);

  const handleAddIssue = (newIssue: IssueRecord) => {
    setHistory(prev => [newIssue, ...prev]);
  };

  // Master Data Handlers
  const handleAddItem = (item: Item) => setItems(prev => [...prev, item]);
  const handleAddMachine = (machine: Machine) => setMachines(prev => [...prev, machine]);
  const handleAddLocation = (location: Location) => setLocations(prev => [...prev, location]);

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
          />
        );
      case 'history':
        return <HistoryTable history={history} />;
      case 'master-data':
        return (
          <MasterData 
            items={items}
            machines={machines}
            locations={locations}
            onAddItem={handleAddItem}
            onAddMachine={handleAddMachine}
            onAddLocation={handleAddLocation}
          />
        );
      default:
        return <Dashboard history={history} />;
    }
  };

  return (
    <HashRouter>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
        
        <main className="flex-1 overflow-y-auto">
          <header className="bg-white shadow-sm px-8 py-4 sticky top-0 z-10">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 capitalize">
                {currentView.replace('-', ' ')}
              </h2>
              <div className="text-sm text-gray-500">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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