import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Moon, Sun, Monitor, LayoutTemplate } from 'lucide-react';

const Settings: React.FC = () => {
  const { settings, updateSettings } = useApp();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
        <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-500">Customize your workspace appearance.</p>
        </div>

        <GlassCard className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Monitor className="w-5 h-5 mr-2" /> Display Settings
            </h3>
            
            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center">
                        <div className="p-2 bg-white rounded-lg mr-4">
                            {settings.theme === 'light' ? <Sun className="w-5 h-5 text-orange-500" /> : <Moon className="w-5 h-5 text-indigo-500" />}
                        </div>
                        <div>
                            <p className="font-medium text-gray-900">Theme Preference</p>
                            <p className="text-xs text-gray-500">Choose between light and dark mode</p>
                        </div>
                    </div>
                    <select 
                        value={settings.theme}
                        onChange={(e) => updateSettings({ theme: e.target.value as 'light' | 'dark' })}
                        className="p-2 rounded-lg border-gray-200 text-sm text-gray-900"
                        disabled // Disabled for this demo as CSS is hardcoded for Light
                    >
                        <option value="light">Light Mode</option>
                        <option value="dark">Dark Mode (Coming Soon)</option>
                    </select>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center">
                        <div className="p-2 bg-white rounded-lg mr-4">
                            <LayoutTemplate className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-900">Compact View</p>
                            <p className="text-xs text-gray-500">Reduce spacing in task lists</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={settings.compactView} onChange={(e) => updateSettings({ compactView: e.target.checked })} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </div>
        </GlassCard>
    </div>
  );
};

export default Settings;