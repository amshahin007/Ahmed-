import React, { useState, useEffect, useRef } from 'react';
import { DEFAULT_SCRIPT_URL, locateRemoteData, APP_SCRIPT_TEMPLATE } from '../services/googleSheetsService';

interface SettingsProps {
    onBackup?: () => Promise<void>;
    onRestore?: () => Promise<void>;
}

const Settings: React.FC<SettingsProps> = ({ onBackup, onRestore }) => {
  const [scriptUrl, setScriptUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [backupFreq, setBackupFreq] = useState('hourly');
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState<'neutral' | 'success' | 'error'>('neutral');
  const [copyFeedback, setCopyFeedback] = useState('');
  
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load existing URL or default
    const storedScript = localStorage.getItem('wf_script_url_v3');
    const storedLogo = localStorage.getItem('wf_logo_url');
    const storedFreq = localStorage.getItem('wf_backup_frequency');
    
    setScriptUrl(storedScript || DEFAULT_SCRIPT_URL);
    setLogoUrl(storedLogo || '');
    setBackupFreq(storedFreq || 'hourly');
  }, []);

  const handleSave = () => {
    // Basic validation
    if (!scriptUrl) {
         setStatusType('error');
         setStatusMsg('Please enter a Web App URL.');
         return;
    }

    // Save Logic
    localStorage.setItem('wf_script_url_v3', scriptUrl);
    localStorage.setItem('wf_backup_frequency', backupFreq);
    
    // Logic for logo is handled by state updating directly, but we ensure it's saved here just in case
    if (logoUrl) {
        localStorage.setItem('wf_logo_url', logoUrl);
    } else {
        localStorage.removeItem('wf_logo_url');
    }

    setStatusType('success');
    setStatusMsg('Settings Saved Successfully!');
    
    // Force reload to apply logo changes globally
    setTimeout(() => {
        setStatusMsg('');
        window.location.reload(); 
    }, 1500);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Limit size to ~500KB to prevent LocalStorage quota exceeded errors
      if (file.size > 500 * 1024) {
          alert("File is too large. Please upload an image smaller than 500KB.");
          return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
          const base64String = reader.result as string;
          setLogoUrl(base64String);
      };
      reader.readAsDataURL(file);
  };

  const handleResetLogo = () => {
      setLogoUrl('');
      if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const validateUrl = (url: string) => {
    if (!url) {
        setStatusType('error');
        setStatusMsg('Please enter a URL first.');
        return false;
    }
    if (!url.includes('script.google.com')) {
        setStatusType('error');
        setStatusMsg('❌ Invalid Domain. Must be "script.google.com".');
        return false;
    }
    if (!url.endsWith('/exec')) {
        setStatusType('error');
        setStatusMsg('❌ Invalid Ending. URL must end with "/exec". (Did you copy the Editor link?)');
        return false;
    }
    return true;
  };

  const handleTestConnection = async () => {
    if (!validateUrl(scriptUrl)) return;

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
            setStatusMsg(`❌ Script Error: ${result?.error || 'Unknown error'}`);
        }
    } catch (e: any) {
        setStatusType('error');
        if (e.message === 'Failed to fetch') {
            setStatusMsg('❌ Connection Blocked. Check Deploy Settings: "Who has access" MUST be "Anyone".');
        } else {
            setStatusMsg(`❌ Network Error: ${e.message}`);
        }
    } finally {
        setLoading(false);
    }
  };

  const handleManualBackup = async () => {
      if (!onBackup) return;
      if (!confirm("Are you sure you want to overwrite the cloud backup with the current system data?")) return;
      setBackupLoading(true);
      try {
          await onBackup();
          alert("Backup Complete!");
      } catch (e) {
          alert("Backup Failed. See console.");
      } finally {
          setBackupLoading(false);
      }
  };

  const handleManualRestore = async () => {
      if (!onRestore) return;
      if (!confirm("⚠️ DANGER: This will OVERWRITE all local data (Items, History, Machines, etc.) with data from the cloud.\n\nAre you sure?")) return;
      setRestoreLoading(true);
      try {
          await onRestore();
          alert("Restore Complete! Page will reload.");
          window.location.reload();
      } catch (e: any) {
          alert(`Restore Failed: ${e.message}\n\nPlease check script permissions.`);
      } finally {
          setRestoreLoading(false);
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
                <p className="text-gray-500 text-sm">Manage cloud connections and application branding.</p>
            </div>
        </div>

        <div className="space-y-6">
            
            {/* Branding Section */}
            <div className="space-y-4 pb-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-800">Company Logo</h3>
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    
                    {/* Preview Area */}
                    <div className="w-32 h-32 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 relative group">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                        ) : (
                            <span className="text-gray-400 text-xs text-center px-2">Default Logo</span>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex-1 space-y-3">
                        <label className="block text-sm font-bold text-gray-700">
                            Upload New Logo
                        </label>
                        <input 
                            ref={logoInputRef}
                            type="file" 
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-blue-50 file:text-blue-700
                                hover:file:bg-blue-100
                            "
                        />
                        <p className="text-xs text-gray-500">
                            Supported formats: PNG, JPG, GIF. Max size: 500KB.
                        </p>
                        
                        {logoUrl && (
                            <button 
                                onClick={handleResetLogo}
                                className="text-sm text-red-600 hover:text-red-800 font-medium underline"
                            >
                                Remove Custom Logo (Reset to Default)
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* API URL Section */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-800">Cloud Connection</h3>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                        Google Apps Script Web App URL
                        <span className="ml-2 font-normal text-gray-500">(Required for Drive Backup & Sheets Sync)</span>
                    </label>
                    
                    <div className="flex flex-col gap-2">
                        <input 
                            type="text" 
                            value={scriptUrl}
                            onChange={(e) => setScriptUrl(e.target.value)}
                            placeholder="https://script.google.com/macros/s/.../exec"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Automatic Backup Settings */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                            Automatic Backup Frequency
                        </label>
                        <select
                            value={backupFreq}
                            onChange={(e) => setBackupFreq(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                        >
                            <option value="disabled">Disabled</option>
                            <option value="30min">Every 30 Minutes</option>
                            <option value="hourly">Hourly (Default)</option>
                            <option value="daily">Daily (Every 24 Hours)</option>
                            <option value="weekly">Weekly (Every 7 Days)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            Data is saved to the configured Google Sheet.
                        </p>
                    </div>

                    {/* Manual Actions */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                            Manual Actions
                        </label>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleManualBackup}
                                disabled={backupLoading}
                                className="flex-1 py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 font-bold text-sm flex items-center justify-center gap-2"
                            >
                                {backupLoading ? <span className="animate-spin">↻</span> : <span>☁️</span>}
                                Backup All
                            </button>
                            <button 
                                onClick={handleManualRestore}
                                disabled={restoreLoading}
                                className="flex-1 py-3 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 font-bold text-sm flex items-center justify-center gap-2"
                            >
                                {restoreLoading ? <span className="animate-spin">↻</span> : <span>📥</span>}
                                Restore All
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Manual Backup overwrites cloud. Restore overwrites local.
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="text-sm text-gray-600 flex-1 mr-4">
                        <p>Status: <span className={`font-bold ${statusType === 'success' ? 'text-green-600' : statusType === 'error' ? 'text-red-600' : 'text-gray-800'}`}>
                            {statusMsg || 'Ready to Save'}
                        </span></p>
                        {statusMsg.includes('Connection Blocked') && (
                            <p className="text-xs text-red-500 mt-1">
                                💡 Fix: Go to Script &gt; Deploy &gt; Manage Deployments &gt; Edit &gt; Set <strong>Who has access</strong> to <strong>Anyone</strong>.
                            </p>
                        )}
                        {statusMsg.includes('Saved Successfully') && (
                            <p className="text-xs text-green-600 mt-1">
                                Application will reload shortly to apply changes...
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleTestConnection}
                            disabled={loading}
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition text-sm font-medium flex items-center gap-2 whitespace-nowrap"
                        >
                            {loading ? <span className="animate-spin">↻</span> : <span>🔍</span>}
                            Test
                        </button>
                        <button 
                            onClick={handleSave}
                            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-sm"
                        >
                            Save Settings
                        </button>
                    </div>
                </div>
            </div>

            {/* Script Code Helper */}
            <div className="pt-6 border-t border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Backend Script Code</h3>
                <p className="text-sm text-gray-600 mb-4">
                    If you are seeing "Script is outdated" or "Restore Failed", you must update your script below.
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
                    <strong>Deployment Steps (Must follow exactly):</strong>
                    <ol className="list-decimal list-inside mt-1 space-y-1 ml-1">
                        <li>Go to your Google Sheet &gt; Extensions &gt; Apps Script.</li>
                        <li>Paste the code above into the editor (replace everything).</li>
                        <li>Click <strong>Deploy</strong> (blue button) &gt; <strong>New Deployment</strong>.</li>
                        <li>Click the ⚙️ icon &gt; select <strong>Web App</strong>.</li>
                        <li>Set <strong>Execute as: Me</strong>.</li>
                        <li>Set <strong>Who has access: Anyone</strong> (Critical!).</li>
                        <li>Click <strong>Deploy</strong>, copy the URL ending in <code>/exec</code>, and paste it above.</li>
                    </ol>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;