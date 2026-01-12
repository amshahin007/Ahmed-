
import React, { useState, useEffect } from 'react';
import { DEFAULT_SCRIPT_URL, locateRemoteData, APP_SCRIPT_TEMPLATE } from '../services/googleSheetsService';

const Settings: React.FC = () => {
  const [scriptUrl, setScriptUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState<'neutral' | 'success' | 'error'>('neutral');
  const [copyFeedback, setCopyFeedback] = useState('');

  useEffect(() => {
    // Load existing URL or default
    const stored = localStorage.getItem('wf_script_url_v3');
    setScriptUrl(stored || DEFAULT_SCRIPT_URL);
  }, []);

  const handleSave = () => {
    localStorage.setItem('wf_script_url_v3', scriptUrl);
    setStatusType('success');
    setStatusMsg('URL Saved successfully!');
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const handleTestConnection = async () => {
    if (!scriptUrl) {
        setStatusType('error');
        setStatusMsg('Please enter a URL first.');
        return;
    }

    setLoading(true);
    setStatusMsg('Testing connection to Google...');
    setStatusType('neutral');

    try {
        const result = await locateRemoteData(scriptUrl);
        if (result && !result.error) {
            setStatusType('success');
            setStatusMsg('✅ Connection Successful! Found "WareFlow Reports" folder.');
        } else {
            setStatusType('error');
            setStatusMsg(`❌ Connection Failed: ${result?.error || 'Unknown error'}`);
        }
    } catch (e) {
        setStatusType('error');
        setStatusMsg('❌ Network Error: Could not reach the script.');
    } finally {
        setLoading(false);
    }
  };

  const copyScriptCode = () => {
    navigator.clipboard.writeText(APP_SCRIPT_TEMPLATE);
    setCopyFeedback('Code copied to clipboard!');
    setTimeout(() => setCopyFeedback(''), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-100">
            <div className="p-3 bg-gray-100 rounded-lg text-gray-600">
                <span className="text-2xl">⚙️</span>
            </div>
            <div>
                <h2 className="text-2xl font-bold text-gray-800">System Configuration</h2>
                <p className="text-gray-500 text-sm">Manage cloud connections and application settings.</p>
            </div>
        </div>

        <div className="space-y-6">
            {/* API URL Section */}
            <div className="space-y-4">
                <label className="block text-sm font-bold text-gray-700">
                    Google Apps Script Web App URL
                    <span className="ml-2 font-normal text-gray-500">(Required for Drive Backup & Sheets Sync)</span>
                </label>
                
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={scriptUrl}
                        onChange={(e) => setScriptUrl(e.target.value)}
                        placeholder="https://script.google.com/macros/s/..."
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                    />
                    <button 
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition"
                    >
                        Save
                    </button>
                </div>

                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="text-sm text-gray-600">
                        <p>Status: <span className={`font-bold ${statusType === 'success' ? 'text-green-600' : statusType === 'error' ? 'text-red-600' : 'text-gray-800'}`}>
                            {statusMsg || 'Ready'}
                        </span></p>
                    </div>
                    <button 
                        onClick={handleTestConnection}
                        disabled={loading}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition text-sm font-medium flex items-center gap-2"
                    >
                        {loading ? <span className="animate-spin">↻</span> : <span>🔍</span>}
                        Test Connection
                    </button>
                </div>
            </div>

            {/* Script Code Helper */}
            <div className="pt-6 border-t border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Backend Script Code</h3>
                <p className="text-sm text-gray-600 mb-4">
                    If you are seeing "Ensure you have updated the code" errors, copy the latest code below and redeploy your Google Apps Script.
                </p>

                <div className="relative">
                    <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto max-h-64">
                        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                            {APP_SCRIPT_TEMPLATE}
                        </pre>
                    </div>
                    <button 
                        onClick={copyScriptCode}
                        className="absolute top-2 right-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded border border-white/20 backdrop-blur-sm transition"
                    >
                        {copyFeedback || 'Copy Code'}
                    </button>
                </div>
                
                <div className="mt-4 text-sm text-gray-500 bg-blue-50 p-3 rounded border border-blue-100">
                    <strong>How to update:</strong>
                    <ol className="list-decimal list-inside mt-1 space-y-1 ml-1">
                        <li>Go to your Google Sheet extensions &gt; Apps Script.</li>
                        <li>Paste the code above into the editor (replace everything).</li>
                        <li>Click <strong>Deploy</strong> &gt; <strong>New Deployment</strong>.</li>
                        <li>Select "Web App", Execute as "Me", Access "Anyone".</li>
                        <li>Copy the <strong>New URL</strong> and paste it in the field above.</li>
                    </ol>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
