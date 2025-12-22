import React, { useState } from 'react';
import { HashRouter } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import IssueForm from './components/IssueForm';
import HistoryTable from './components/HistoryTable';
import { INITIAL_HISTORY } from './constants';
import { IssueRecord } from './types';

const App: React.FC = () => {
  // Using simple state for view switching within a Single Page App feel
  // HashRouter is included but for this specific layout, direct state composition 
  // allows for smoother "tab" transitions without full re-mounts if we wanted to preserve form state.
  // However, to keep it simple and clean, we'll just swap components based on state.
  
  const [currentView, setCurrentView] = useState('dashboard');
  const [history, setHistory] = useState<IssueRecord[]>(INITIAL_HISTORY);

  const handleAddIssue = (newIssue: IssueRecord) => {
    // Add to top of list
    setHistory(prev => [newIssue, ...prev]);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard history={history} />;
      case 'issue-form':
        return <IssueForm onAddIssue={handleAddIssue} />;
      case 'history':
        return <HistoryTable history={history} />;
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
