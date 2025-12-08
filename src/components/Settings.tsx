import React, { useState, useRef } from 'react';
import { useStore } from '../context/Store';
import { exportToHtml } from '../services/mockBrowser';
import { Language, AppSettings, SyncConfig } from '../types';
import { Download, Upload, Palette, Globe, Key, Wifi, WifiOff, CheckCircle, Database, Server, Cpu, Image, CloudUpload, PlayCircle, RefreshCw, Layers } from 'lucide-react';

export const SettingsPanel: React.FC = () => {
  const { settings, updateSettings, bookmarks, stageImportJson, stageImportHtml, testWebDavConnection, saveToWebDav, testAiSettings, t } = useStore();
  const [activeTab, setActiveTab] = useState<'general' | 'sync' | 'backup'>('general');
  const [webDavStatus, setWebDavStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [webDavMsg, setWebDavMsg] = useState('');
  
  const [aiStatus, setAiStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [aiMsg, setAiMsg] = useState('');

  // Hidden file inputs
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const htmlInputRef = useRef<HTMLInputElement>(null);

  const handleExportHtml = () => {
    const html = exportToHtml(bookmarks);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookmarks_${new Date().toISOString().slice(0,10)}.html`;
    a.click();
  };

  const handleExportJson = () => {
    const data = {
        bookmarks,
        settings,
        version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai_bookmarks_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) stageImportJson(ev.target.result as string);
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleHtmlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) stageImportHtml(ev.target.result as string);
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateSettings({ customBackground: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTestConnection = async () => {
      setWebDavStatus('testing');
      setWebDavMsg(t('Testing...'));
      const { success, message } = await testWebDavConnection();
      setWebDavStatus(success ? 'success' : 'failed');
      setWebDavMsg(message);
  };
  
  const handleManualSync = async () => {
      setWebDavStatus('testing');
      setWebDavMsg("Syncing...");
      const { success, message } = await saveToWebDav();
      setWebDavStatus(success ? 'success' : 'failed');
      setWebDavMsg(message);
  };

  const handleTestAi = async () => {
    if (settings.aiProvider === 'gemini') {
        setAiStatus('failed');
        setAiMsg("Gemini provider is not configured in this build. Please switch to Custom AI.");
        return;
    }
    
    if (!settings.customApiKey || !settings.aiBaseUrl || !settings.aiModel) {
        setAiStatus('failed');
        setAiMsg("Please configure Custom API Key, Base URL and Model first.");
        return;
    }
    
    setAiStatus('testing');
    setAiMsg("Testing...");
    const { success, message } = await testAiSettings();
    setAiStatus(success ? 'success' : 'failed');
    setAiMsg(message);
};

  const generateIcon = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#4f46e5'; 
        ctx.beginPath();
        ctx.roundRect(0, 0, 128, 128, 24);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 64px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AI', 64, 64);
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'icon.png';
        a.click();
    }
  };

  const handleProviderSwitch = (provider: 'gemini' | 'custom') => {
      const updates: Partial<AppSettings> = { aiProvider: provider };
      if (provider === 'custom') {
          if (!settings.aiBaseUrl) updates.aiBaseUrl = 'https://api.openai.com/v1';
          if (!settings.aiModel || settings.aiModel.includes('gemini')) updates.aiModel = 'gpt-3.5-turbo';
      } else {
          if (!settings.aiModel || !settings.aiModel.includes('gemini')) updates.aiModel = 'gemini-2.5-flash';
      }
      updateSettings(updates);
  };

  const handleSyncSettingChange = (updates: Partial<SyncConfig>) => {
      updateSettings({ webDavSync: { ...settings.webDavSync, ...updates } });
  };

  const schemes: { id: SyncConfig['interval']; label: string }[] = [
      { id: 'on_change', label: t('Real-time') },
      { id: 'on_open', label: t('Startup') },
      { id: 'hourly', label: t('Hourly') },
      { id: 'daily', label: t('Daily') },
  ];
  
  const strategies: { id: SyncConfig['strategy']; label: string }[] = [
      { id: 'merge', label: t('Merge (Recommended)') },
      { id: 'local_to_remote', label: t('Overwrite Remote') },
      { id: 'remote_to_local', label: t('Overwrite Local') }
  ];

  return (
    <div className="flex-1 bg-white/90 dark:bg-gray-900/90 p-6 overflow-y-auto">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">{t('Settings')}</h2>

      <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        <button onClick={() => setActiveTab('general')} className={`pb-2 px-1 whitespace-nowrap text-sm ${activeTab === 'general' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}>{t('General')}</button>
        <button onClick={() => setActiveTab('sync')} className={`pb-2 px-1 whitespace-nowrap text-sm ${activeTab === 'sync' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}>{t('Sync & WebDAV')}</button>
        <button onClick={() => setActiveTab('backup')} className={`pb-2 px-1 whitespace-nowrap text-sm ${activeTab === 'backup' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}>{t('Backup & Restore')}</button>
      </div>

      {activeTab === 'general' && (
        <div className="space-y-6 max-w-xl animate-fade-in">
          {/* Language Selection */}
          <div className="p-4 border rounded-lg dark:border-gray-700">
             <h3 className="font-semibold mb-4 flex items-center text-sm"><Globe size={16} className="mr-2"/> {t('Language')}</h3>
             <div className="grid grid-cols-2 gap-2">
               {[
                 { code: Language.ZH_CN, label: '简体中文' },
                 { code: Language.ZH_TW, label: '繁體中文' },
                 { code: Language.EN, label: 'English' },
                 { code: Language.JA, label: '日本語' }
               ].map(lang => (
                 <button 
                   key={lang.code}
                   onClick={() => updateSettings({ language: lang.code })}
                   className={`p-2 rounded border text-xs ${settings.language === lang.code ? 'bg-primary text-white border-primary' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300'}`}
                 >
                   {lang.label}
                 </button>
               ))}
             </div>
          </div>

          {/* Appearance */}
          <div className="p-4 border rounded-lg dark:border-gray-700">
             <h3 className="font-semibold mb-4 flex items-center text-sm"><Palette size={16} className="mr-2"/> {t('Appearance')}</h3>
             <div className="grid grid-cols-3 gap-2 mb-4">
               {['light', 'dark', 'system'].map(theme => (
                 <button 
                   key={theme}
                   onClick={() => updateSettings({ theme: theme as any })}
                   className={`p-1.5 rounded border capitalize text-xs ${settings.theme === theme ? 'bg-primary text-white border-primary' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300'}`}
                 >
                   {t(theme.charAt(0).toUpperCase() + theme.slice(1))}
                 </button>
               ))}
             </div>
             <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('Custom Background Image')}</label>
                <div className="flex items-center space-x-2">
                   <input type="file" accept="image/*" onChange={handleBackgroundUpload} className="text-xs text-gray-500 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                   {settings.customBackground && (
                     <button onClick={() => updateSettings({ customBackground: undefined })} className="text-red-500 text-xs hover:underline">{t('Cancel')}</button>
                   )}
                </div>
             </div>
          </div>
          
           {/* Icon */}
           <div className="p-4 border rounded-lg dark:border-gray-700">
             <h3 className="font-semibold mb-2 flex items-center text-sm"><Image size={16} className="mr-2"/> {t('Extension Icon')}</h3>
             <button onClick={generateIcon} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-primary rounded hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center text-xs">
                 <Download size={14} className="mr-2" />
                 {t('Download Extension Icon')}
             </button>
           </div>

          {/* AI Key */}
          <div className="p-4 border rounded-lg dark:border-gray-700">
             <h3 className="font-semibold mb-4 flex items-center text-sm"><Key size={16} className="mr-2"/> {t('AI Configuration')}</h3>
             
             <div className="mb-4">
                <div className="flex space-x-4 text-sm">
                  <label className="flex items-center cursor-pointer">
                    <input type="radio" checked={settings.aiProvider === 'gemini'} onChange={() => handleProviderSwitch('gemini')} className="mr-2" />
                    Gemini
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input type="radio" checked={settings.aiProvider === 'custom'} onChange={() => handleProviderSwitch('custom')} className="mr-2" />
                    Custom API
                  </label>
                </div>
             </div>

             <div className="space-y-3 bg-gray-50 dark:bg-gray-800 p-3 rounded">
                 {settings.aiProvider === 'custom' && (
                    <>
                       <div>
                          <label className="block text-xs text-gray-500 mb-1">{t('Custom API Key')}</label>
                          <input type="password" value={settings.customApiKey || ''} onChange={(e) => updateSettings({ customApiKey: e.target.value })} className="w-full p-2 rounded border dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs" />
                       </div>
                       <div>
                          <label className="block text-xs text-gray-500 mb-1">Base URL</label>
                          <input type="text" value={settings.aiBaseUrl || ''} onChange={(e) => updateSettings({ aiBaseUrl: e.target.value })} className="w-full p-2 rounded border dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-xs" />
                       </div>
                    </>
                 )}
                 {settings.aiProvider === 'gemini' && (
                     <div>
                        <label className="block text-xs text-gray-500 mb-1">Base URL (Optional Proxy)</label>
                        <input type="text" value={settings.aiBaseUrl || ''} onChange={(e) => updateSettings({ aiBaseUrl: e.target.value })} className="w-full p-2 rounded border dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-xs" />
                     </div>
                 )}
                 <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('Model Name')}</label>
                    <input type="text" value={settings.aiModel || ''} onChange={(e) => updateSettings({ aiModel: e.target.value })} className="w-full p-2 rounded border dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-xs" />
                 </div>

                 {/* Bug 3 Fix: Test Button */}
                 <div className="pt-2">
                     <button 
                        onClick={handleTestAi} 
                        disabled={aiStatus === 'testing'}
                        className="flex items-center px-3 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50"
                     >
                        {aiStatus === 'testing' ? <Wifi size={14} className="animate-spin mr-2"/> : <PlayCircle size={14} className="mr-2"/>}
                        {t('Test AI')}
                     </button>
                     {aiMsg && <div className={`text-xs mt-2 ${aiStatus === 'success' ? 'text-green-500' : 'text-red-500'}`}>{aiStatus === 'success' ? t('AI Test Passed') : t('AI Test Failed') + aiMsg}</div>}
                 </div>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'sync' && (
        <div className="space-y-6 max-w-xl animate-fade-in">
          <div className="p-4 border rounded-lg dark:border-gray-700">
             <h3 className="font-semibold mb-4 flex items-center text-sm"><Database size={16} className="mr-2"/> {t('WebDAV Configuration')}</h3>
             <div className="space-y-3 text-sm">
               <div className="flex items-center">
                 <input type="checkbox" id="webdav-enable" checked={settings.webDav.enabled} onChange={(e) => updateSettings({ webDav: { ...settings.webDav, enabled: e.target.checked } })} className="mr-2"/>
                 <label htmlFor="webdav-enable">{t('Enable WebDAV Sync')}</label>
               </div>
               <input type="text" placeholder={t('Server URL')} value={settings.webDav.url} onChange={(e) => updateSettings({ webDav: { ...settings.webDav, url: e.target.value } })} className="w-full p-2 rounded border dark:bg-gray-800 dark:border-gray-600 dark:text-white"/>
               <input type="text" placeholder={t('Username')} value={settings.webDav.username} onChange={(e) => updateSettings({ webDav: { ...settings.webDav, username: e.target.value } })} className="w-full p-2 rounded border dark:bg-gray-800 dark:border-gray-600 dark:text-white"/>
               <input type="password" placeholder={t('Password')} value={settings.webDav.password} onChange={(e) => updateSettings({ webDav: { ...settings.webDav, password: e.target.value } })} className="w-full p-2 rounded border dark:bg-gray-800 dark:border-gray-600 dark:text-white"/>
               
               <div className="flex flex-col space-y-2 pt-2">
                   <div className="flex items-center space-x-3">
                       <button onClick={handleTestConnection} disabled={webDavStatus === 'testing' || !settings.webDav.url} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-300 flex items-center disabled:opacity-50 text-xs">
                         <Wifi size={14} className="mr-2"/> {t('Test Connection')}
                       </button>
                       {/* Manual Sync Button */}
                       <button onClick={handleManualSync} disabled={webDavStatus === 'testing' || !settings.webDav.enabled} className="px-3 py-1.5 bg-primary text-white rounded hover:bg-primary/80 flex items-center disabled:opacity-50 text-xs">
                         <CloudUpload size={14} className="mr-2"/> {t('Sync Now')}
                       </button>
                   </div>
                   {webDavMsg && <span className={`text-xs ${webDavStatus === 'success' ? 'text-green-500' : 'text-red-500'}`}>{webDavMsg}</span>}
               </div>
             </div>
          </div>

          {/* Auto Sync Settings */}
          <div className="p-4 border rounded-lg dark:border-gray-700">
              <h3 className="font-semibold mb-4 flex items-center text-sm"><RefreshCw size={16} className="mr-2"/> {t('Auto Sync Settings')}</h3>
              
              <div className="flex items-center mb-4 text-sm">
                  <input type="checkbox" id="autosync-enable" checked={settings.webDavSync.autoSync} onChange={(e) => handleSyncSettingChange({ autoSync: e.target.checked })} className="mr-2"/>
                  <label htmlFor="autosync-enable">{t('Enable Auto Sync')}</label>
              </div>

              {settings.webDavSync.autoSync && (
                  <div className="space-y-4 animate-fade-in text-sm">
                      <div>
                          <label className="block text-xs font-medium text-gray-500 mb-2">{t('Sync Frequency')}</label>
                          <div className="grid grid-cols-2 gap-2">
                              {schemes.map(scheme => (
                                  <button
                                      key={scheme.id}
                                      onClick={() => handleSyncSettingChange({ interval: scheme.id })}
                                      className={`p-2 rounded border text-xs flex items-center justify-center transition-colors ${
                                          settings.webDavSync.interval === scheme.id 
                                          ? 'bg-primary text-white border-primary shadow-sm' 
                                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                      }`}
                                  >
                                      {scheme.label}
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div>
                           <label className="block text-xs font-medium text-gray-500 mb-2">{t('Sync Strategy')}</label>
                           <div className="flex flex-col space-y-2">
                               {strategies.map(strat => (
                                   <button
                                       key={strat.id}
                                       onClick={() => handleSyncSettingChange({ strategy: strat.id })}
                                       className={`p-2 rounded border text-xs flex items-center text-left transition-colors ${
                                           settings.webDavSync.strategy === strat.id
                                           ? 'bg-primary/10 border-primary text-primary'
                                           : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                       }`}
                                   >
                                       <Layers size={14} className="mr-2" />
                                       {strat.label}
                                   </button>
                               ))}
                           </div>
                      </div>

                      <div className="pt-2 border-t dark:border-gray-700 text-xs text-gray-500">
                          {t('Last Sync')}: {settings.webDavSync.lastSyncTime ? new Date(settings.webDavSync.lastSyncTime).toLocaleString() : t('Never')}
                      </div>
                  </div>
              )}
          </div>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="space-y-6 max-w-xl animate-fade-in">
           <input type="file" ref={jsonInputRef} accept=".json" onChange={handleJsonUpload} className="hidden" />
           <input type="file" ref={htmlInputRef} accept=".html" onChange={handleHtmlUpload} className="hidden" />

           <div className="p-4 border rounded-lg dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
             <h3 className="font-semibold mb-2 text-sm">{t('Full Backup (JSON)')}</h3>
             <div className="flex space-x-3">
               <button onClick={handleExportJson} className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs">
                 <Download size={14} className="mr-2"/> {t('Export Data')}
               </button>
               <button onClick={() => jsonInputRef.current?.click()} className="flex items-center px-3 py-1.5 bg-white border border-blue-600 text-blue-600 rounded hover:bg-blue-50 dark:bg-gray-800 dark:text-blue-400 text-xs">
                 <Upload size={14} className="mr-2"/> {t('Import Data')}
               </button>
             </div>
           </div>

           <div className="p-4 border rounded-lg dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
             <h3 className="font-semibold mb-2 text-sm">{t('Browser Compatible (HTML)')}</h3>
             <div className="flex space-x-3">
               <button onClick={handleExportHtml} className="flex items-center px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs">
                 <Download size={14} className="mr-2"/> {t('Export HTML')}
               </button>
               <button onClick={() => htmlInputRef.current?.click()} className="flex items-center px-3 py-1.5 bg-white border border-green-600 text-green-600 rounded hover:bg-green-50 dark:bg-gray-800 dark:text-green-400 text-xs">
                 <Upload size={14} className="mr-2"/> {t('Import HTML')}
               </button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};