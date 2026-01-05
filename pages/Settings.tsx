import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Moon, Sun, Monitor, LayoutTemplate, Clock, AlertCircle } from 'lucide-react';
import { WORKFLOW_SEQUENCE } from '../constants';

const Settings: React.FC = () => {
  const { settings, updateSettings } = useApp();

  const handleDeadlineChange = (taskTitle: string, days: number) => {
      const newDeadlines = {
          ...settings.workflowDeadlines,
          [taskTitle]: days
      };
      updateSettings({ workflowDeadlines: newDeadlines });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
        <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
            <p className="text-gray-500 dark:text-gray-400">Customize your workspace appearance and workflows.</p>
        </div>

        <GlassCard className="p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <Monitor className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" /> Display Settings
            </h3>
            
            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl transition-colors">
                    <div className="flex items-center">
                        <div className="p-2 bg-white dark:bg-slate-700 rounded-lg mr-4 shadow-sm">
                            {settings.theme === 'light' ? <Sun className="w-5 h-5 text-orange-500" /> : <Moon className="w-5 h-5 text-indigo-400" />}
                        </div>
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">Theme Preference</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Choose between light and dark mode</p>
                        </div>
                    </div>
                    <select 
                        value={settings.theme}
                        onChange={(e) => updateSettings({ theme: e.target.value as 'light' | 'dark' })}
                        className="p-2 rounded-lg border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-white focus:ring-indigo-500"
                    >
                        <option value="light">Light Mode</option>
                        <option value="dark">Dark Mode</option>
                    </select>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl transition-colors">
                    <div className="flex items-center">
                        <div className="p-2 bg-white dark:bg-slate-700 rounded-lg mr-4 shadow-sm">
                            <LayoutTemplate className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">Compact View</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Reduce spacing in task lists for higher density</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={settings.compactView} onChange={(e) => updateSettings({ compactView: e.target.checked })} />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-900 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </div>
        </GlassCard>

        <GlassCard className="p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" /> Workflow Standards
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg flex items-start border border-yellow-100 dark:border-yellow-800">
                <AlertCircle className="w-4 h-4 mr-2 text-yellow-600 flex-shrink-0 mt-0.5" />
                These settings control when a task's priority automatically escalates. Tasks exceeding 70% of the allocated days become High priority, and 100% become Urgent.
            </p>
            
            <div className="space-y-3">
                {WORKFLOW_SEQUENCE.map((stage) => {
                    const currentDays = settings.workflowDeadlines?.[stage.taskTitle] ?? stage.daysToComplete;
                    return (
                        <div key={stage.taskTitle} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
                            <div className="flex items-center">
                                <div className={`w-2 h-8 rounded-full mr-3 ${stage.priority === 'Urgent' ? 'bg-red-400' : stage.priority === 'High' ? 'bg-orange-400' : 'bg-blue-400'}`}></div>
                                <div>
                                    <p className="font-medium text-sm text-gray-900 dark:text-white">{stage.taskTitle}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{stage.division} Department</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="30" 
                                    className="w-16 p-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-center text-sm font-bold"
                                    value={currentDays}
                                    onChange={(e) => handleDeadlineChange(stage.taskTitle, parseInt(e.target.value))}
                                />
                                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">days</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </GlassCard>
    </div>
  );
};

export default Settings;