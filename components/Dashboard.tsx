
import React, { useEffect, useState, useMemo } from 'react';
import { IssueRecord, User } from '../types';
import { generateDashboardInsights } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardProps {
  history: IssueRecord[];
  setCurrentView: (view: string) => void;
  currentUser: User;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// Navigation configuration matching Sidebar roles
const QUICK_NAV_ITEMS = [
    { 
      id: 'agri-work-order', 
      label: 'Work Orders', 
      icon: '🚜', 
      color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
      roles: ['admin', 'warehouse_manager', 'maintenance_manager', 'user'] 
    },
    { 
      id: 'issue-form', 
      label: 'Issue Requests', 
      icon: '🛠️', 
      color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
      roles: ['admin', 'user', 'maintenance_manager', 'maintenance_engineer'] 
    },
    { 
      id: 'history', 
      label: 'Inventory', 
      icon: '📋', 
      color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
      roles: ['admin', 'user', 'warehouse_manager', 'maintenance_manager', 'maintenance_engineer', 'warehouse_supervisor'] 
    },
    { 
      id: 'stock-approval', 
      label: 'Approvals', 
      icon: '✅', 
      color: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
      roles: ['admin', 'warehouse_manager', 'warehouse_supervisor'] 
    },
    { 
      id: 'ai-assistant', 
      label: 'Maintenance AI', 
      icon: '✨', 
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
      roles: ['admin', 'warehouse_manager', 'maintenance_manager'] 
    },
    { 
      id: 'master-data', 
      label: 'Master Data', 
      icon: '🗄️', 
      color: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
      roles: ['admin'] 
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: '⚙️', 
      color: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
      roles: ['admin', 'warehouse_manager', 'maintenance_manager', 'warehouse_supervisor', 'user'] 
    },
];

const Dashboard: React.FC<DashboardProps> = ({ history, setCurrentView, currentUser }) => {
  const [insights, setInsights] = useState<string>('Generating AI insights...');
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    // Only fetch insights if there's history and we haven't loaded yet
    if (history.length > 0) {
      setLoadingInsights(true);
      generateDashboardInsights(history)
        .then(setInsights)
        .finally(() => setLoadingInsights(false));
    }
  }, [history.length]);

  const metrics = useMemo(() => {
    const totalIssues = history.length;
    const itemCounts: Record<string, number> = {};
    const machineCounts: Record<string, number> = {};
    let todayCount = 0;
    const now = new Date();

    history.forEach(h => {
      itemCounts[h.itemName] = (itemCounts[h.itemName] || 0) + h.quantity;
      machineCounts[h.machineName] = (machineCounts[h.machineName] || 0) + 1;
      
      const issueDate = new Date(h.timestamp);
      if (now.getTime() - issueDate.getTime() < 24 * 60 * 60 * 1000) {
        todayCount++;
      }
    });

    const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
    const sortedMachines = Object.entries(machineCounts).sort((a, b) => b[1] - a[1]);

    return {
      totalIssues,
      topItem: sortedItems[0]?.[0] || 'N/A',
      topMachine: sortedMachines[0]?.[0] || 'N/A',
      todayCount,
      itemData: sortedItems.slice(0, 5).map(([name, val]) => ({ name, value: val })),
      machineData: sortedMachines.slice(0, 5).map(([name, val]) => ({ name, value: val }))
    };
  }, [history]);

  // Filter nav items based on user role
  const visibleNavItems = QUICK_NAV_ITEMS.filter(item => item.roles.includes(currentUser.role));

  return (
    <div className="space-y-8 animate-fade-in-up">
      
      {/* 1. Navigation Menu Section */}
      <section>
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">🚀</span> Quick Access
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {visibleNavItems.map((item) => (
                  <button
                      key={item.id}
                      onClick={() => setCurrentView(item.id)}
                      className={`
                          flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200 transform hover:-translate-y-1 hover:shadow-md
                          ${item.color}
                      `}
                  >
                      <span className="text-3xl mb-2">{item.icon}</span>
                      <span className="text-xs font-bold uppercase tracking-wide text-center">{item.label}</span>
                  </button>
              ))}
          </div>
      </section>

      {/* 2. KPI Section */}
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
             <span className="mr-2">📊</span> Operational Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
                <div>
                    <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Total Issues</p>
                    <h3 className="text-3xl font-bold text-gray-800 mt-2">{metrics.totalIssues}</h3>
                </div>
                <div className="mt-4 text-xs text-gray-400">Lifetime records</div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
                <div>
                    <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Issued Today</p>
                    <h3 className="text-3xl font-bold text-blue-600 mt-2">{metrics.todayCount}</h3>
                </div>
                <div className="mt-4 text-xs text-gray-400">Last 24 hours</div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
                <div>
                    <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Top Item</p>
                    <h3 className="text-lg font-bold text-gray-800 mt-2 truncate" title={metrics.topItem}>{metrics.topItem}</h3>
                </div>
                <div className="mt-4 text-xs text-gray-400">Highest Quantity</div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
                <div>
                    <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Top Machine</p>
                    <h3 className="text-lg font-bold text-gray-800 mt-2 truncate" title={metrics.topMachine}>{metrics.topMachine}</h3>
                </div>
                <div className="mt-4 text-xs text-gray-400">Most Frequent</div>
            </div>
        </div>
      </section>

      {/* 3. Charts & AI Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Charts */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Top 5 Items (Quantity)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.itemData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{fontSize: 11, fill: '#6B7280'}} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{fontSize: 11, fill: '#6B7280'}} />
              <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
              <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Issues by Machine</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={metrics.machineData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
              >
                {metrics.machineData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Gemini AI Insights */}
        <div className="lg:col-span-2 bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-100">
            <div className="flex items-center space-x-2 mb-4">
                <span className="text-2xl">✨</span>
                <h3 className="text-lg font-bold text-indigo-900">AI Operational Insights</h3>
            </div>
            {loadingInsights ? (
                <div className="flex items-center space-x-3 text-indigo-500 animate-pulse">
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    <span>Analyzing warehouse patterns with Gemini...</span>
                </div>
            ) : (
                <div className="prose prose-indigo max-w-none">
                     <div className="whitespace-pre-line text-indigo-800 leading-relaxed font-medium">
                        {insights}
                     </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
