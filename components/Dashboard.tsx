
import React, { useEffect, useState, useMemo } from 'react';
import { IssueRecord, User, Machine, Location } from '../types';
import { generateDashboardInsights } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import SearchableSelect from './SearchableSelect';

interface DashboardProps {
  history: IssueRecord[];
  machines: Machine[];
  locations: Location[];
  setCurrentView: (view: string) => void;
  currentUser: User;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const STATUS_COLORS = {
  'Working': '#10B981', // Green
  'Not Working': '#EF4444', // Red
  'Outside Maintenance': '#F59E0B' // Amber
};

// Navigation configuration matching Sidebar roles
const QUICK_NAV_ITEMS = [
    { 
      id: 'asset-management', 
      label: 'Asset Management', 
      icon: '🏗️', 
      color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
      roles: ['admin', 'maintenance_manager', 'maintenance_engineer'] 
    },
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

const Dashboard: React.FC<DashboardProps> = ({ history, machines, locations, setCurrentView, currentUser }) => {
  const [insights, setInsights] = useState<string>('Generating AI insights...');
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedMachineName, setSelectedMachineName] = useState<string>('');

  useEffect(() => {
    // Only fetch insights if there's history and we haven't loaded yet
    if (history.length > 0) {
      setLoadingInsights(true);
      generateDashboardInsights(history)
        .then(setInsights)
        .finally(() => setLoadingInsights(false));
    }
  }, [history.length]);

  // Reset machine selection when location changes to avoid invalid combinations
  useEffect(() => {
    setSelectedMachineName('');
  }, [selectedLocationId]);

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

  // 1. Filter machines by Location first (to populate Machine dropdown options)
  const machinesInLocation = useMemo(() => {
    if (!selectedLocationId) return machines;
    return machines.filter(m => {
        const locName = locations.find(l => l.id === selectedLocationId)?.name;
        return m.locationId === selectedLocationId || m.locationId === locName;
    });
  }, [machines, selectedLocationId, locations]);

  // 2. Get unique machine names for the dropdown based on location filter
  const availableMachineOptions = useMemo(() => {
    const names = new Set(machinesInLocation.map(m => m.category).filter(Boolean));
    return Array.from(names).sort().map(name => ({
        id: name as string,
        label: name as string
    }));
  }, [machinesInLocation]);

  // 3. Final Machine Status Calculation (filtered by Location AND Machine Name)
  const machineStats = useMemo(() => {
    // Apply Machine Name filter on top of the Location filter
    const finalFilteredMachines = selectedMachineName 
        ? machinesInLocation.filter(m => m.category === selectedMachineName)
        : machinesInLocation;

    // Helper for robust status checking (case-insensitive)
    const getStatus = (s?: string) => {
        if (!s) return 'Unknown';
        const lower = s.toLowerCase();
        if (lower.includes('not working')) return 'Not Working';
        if (lower.includes('working')) return 'Working';
        if (lower.includes('maintenance')) return 'Outside Maintenance';
        return 'Unknown';
    };

    let working = 0;
    let notWorking = 0;
    let maintenance = 0;

    finalFilteredMachines.forEach(m => {
        const s = getStatus(m.status);
        if (s === 'Working') working++;
        else if (s === 'Not Working') notWorking++;
        else if (s === 'Outside Maintenance') maintenance++;
    });

    const total = finalFilteredMachines.length;

    const chartData = [
        { name: 'Working', value: working, color: STATUS_COLORS['Working'] },
        { name: 'Not Working', value: notWorking, color: STATUS_COLORS['Not Working'] },
        { name: 'Maintenance', value: maintenance, color: STATUS_COLORS['Outside Maintenance'] }
    ].filter(d => d.value > 0);

    return { total, working, notWorking, maintenance, chartData };
  }, [machinesInLocation, selectedMachineName]);

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
      
      {/* 3. Machine Status Analysis Section */}
      <section>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
               <h2 className="text-xl font-bold text-gray-800 flex items-center">
                   <span className="mr-2">🏗️</span> Machines Analysis
               </h2>
               <div className="w-full md:w-auto flex flex-col md:flex-row gap-2">
                   <div className="w-full md:w-56">
                       <label className="block text-xs font-bold text-gray-600 mb-1">Filter by Location</label>
                       <select 
                            className="w-full h-9 pl-3 pr-8 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                            value={selectedLocationId}
                            onChange={(e) => setSelectedLocationId(e.target.value)}
                       >
                           <option value="">All Locations</option>
                           {locations.map(loc => (
                               <option key={loc.id} value={loc.id}>{loc.name}</option>
                           ))}
                       </select>
                   </div>
                   <div className="w-full md:w-56">
                       <SearchableSelect 
                            label="Filter by Machine"
                            options={availableMachineOptions}
                            value={selectedMachineName}
                            onChange={setSelectedMachineName}
                            placeholder="All Machines"
                            compact={true}
                            disabled={machineStats.total === 0 && !selectedMachineName}
                       />
                   </div>
               </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
               <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                    
                    {/* Summary Cards */}
                    <div className="p-6 flex flex-col gap-6 justify-center">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <span className="text-gray-600 font-medium text-sm">Total Assets</span>
                            <span className="text-xl font-bold text-gray-900">{machineStats.total}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                            <span className="text-green-800 font-medium text-sm">Working</span>
                            <span className="text-xl font-bold text-green-700">{machineStats.working}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                            <span className="text-red-800 font-medium text-sm">Not Working</span>
                            <span className="text-xl font-bold text-red-700">{machineStats.notWorking}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                            <span className="text-amber-800 font-medium text-sm">Maintenance</span>
                            <span className="text-xl font-bold text-amber-700">{machineStats.maintenance}</span>
                        </div>
                    </div>

                    {/* Chart Area */}
                    <div className="col-span-1 lg:col-span-3 p-6 min-h-[300px] flex flex-col">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Status Distribution</h3>
                        {machineStats.total > 0 ? (
                            machineStats.chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={machineStats.chartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={80}
                                            outerRadius={110}
                                            paddingAngle={machineStats.chartData.length > 1 ? 5 : 0}
                                            dataKey="value"
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {machineStats.chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                                    <p className="font-medium">Machines found: {machineStats.total}</p>
                                    <p className="text-xs mt-1 text-gray-500">But no valid statuses (Working/Not Working) detected.</p>
                                </div>
                            )
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                                No machines found for current filters.
                            </div>
                        )}
                    </div>
               </div>
          </div>
      </section>

      {/* 4. Charts & AI Section */}
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
