import React, { useEffect, useState, useMemo } from 'react';
import { IssueRecord } from '../types';
import { generateDashboardInsights } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardProps {
  history: IssueRecord[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const Dashboard: React.FC<DashboardProps> = ({ history }) => {
  const [insights, setInsights] = useState<string>('Generating AI insights...');
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    // Only fetch insights if there's history and we haven't loaded yet (or history changes significantly - simplified here)
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

  return (
    <div className="space-y-6">
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-medium">Total Issues</p>
            <h3 className="text-3xl font-bold text-gray-800 mt-2">{metrics.totalIssues}</h3>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-medium">Issued Today</p>
            <h3 className="text-3xl font-bold text-blue-600 mt-2">{metrics.todayCount}</h3>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-medium">Top Item</p>
            <h3 className="text-lg font-bold text-gray-800 mt-2 truncate">{metrics.topItem}</h3>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-medium">Most Used Machine</p>
            <h3 className="text-lg font-bold text-gray-800 mt-2 truncate">{metrics.topMachine}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Charts */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 5 Items (Quantity)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.itemData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{fontSize: 12}} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Issues by Machine</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={metrics.machineData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
              >
                {metrics.machineData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36}/>
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
                     <div className="whitespace-pre-line text-indigo-800 leading-relaxed">
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
