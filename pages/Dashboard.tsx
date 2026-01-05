import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Clock, Users, Activity, CheckCircle2, CalendarDays, TrendingUp } from 'lucide-react';
import { formatTime } from '../utils/formatTime';

const Dashboard: React.FC = () => {
  const { clients, tasks, team } = useApp();
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7days' | '30days'>('all');

  const filterByDate = (dateString: string) => {
      if (dateRange === 'all') return true;
      const date = new Date(dateString);
      const now = new Date();
      
      if (dateRange === 'today') {
          return date.toDateString() === now.toDateString();
      }

      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      if (dateRange === '7days') return diffDays <= 7;
      if (dateRange === '30days') return diffDays <= 30;
      return true;
  }

  // Filter Data
  const filteredClients = clients.filter(c => filterByDate(c.joinedDate));
  
  const totalClients = filteredClients.length;
  const activeClients = filteredClients.filter(c => c.status === 'Active').length;
  const totalTime = filteredClients.reduce((acc, curr) => acc + curr.totalTimeSpent, 0);
  const completedTasks = tasks.filter(t => t.isCompleted).length; 

  const statusData = filteredClients.reduce((acc, client) => {
    const existing = acc.find(item => item.name === client.status);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: client.status, value: 1 });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  // Prepare Client Time Distribution Data (Top 10)
  const clientTimeData = filteredClients
    .map(client => ({
        name: client.businessName,
        seconds: client.totalTimeSpent,
        hours: parseFloat((client.totalTimeSpent / 3600).toFixed(1)), // For chart height
        formatted: formatTime(client.totalTimeSpent) // For tooltip
    }))
    .sort((a, b) => b.seconds - a.seconds) // Sort highest time first
    .slice(0, 10); // Take top 10

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'];

  const teamPerformanceData = team.map(member => {
      // Find tasks where this member is assigned
      const memberTasks = tasks.filter(t => t.assignees.includes(member.id));
      
      // Calculate total time (Simplified: Sum of task time they are assigned to)
      const timeSpent = memberTasks.reduce((acc, t) => acc + t.timeSpent, 0);
      
      return {
          name: member.name.split(' ')[0],
          seconds: timeSpent,
          formatted: formatTime(timeSpent)
      }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 mt-1">Agency overview and performance metrics.</p>
        </div>
        <div className="flex items-center space-x-2 bg-white rounded-xl p-1 border border-gray-200 shadow-sm">
            <CalendarDays className="w-4 h-4 text-gray-400 ml-2" />
            <select 
                className="bg-transparent border-none text-sm font-medium text-gray-900 focus:ring-0 cursor-pointer py-2 pr-8 pl-2"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
            >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="30days">Last 30 Days</option>
                <option value="7days">Last 7 Days</option>
            </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard className="p-6 flex items-center space-x-4">
          <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Clients</p>
            <h3 className="text-2xl font-bold text-gray-900">{totalClients}</h3>
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex items-center space-x-4">
          <div className="p-3 bg-green-100 rounded-xl text-green-600">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Active Clients</p>
            <h3 className="text-2xl font-bold text-gray-900">{activeClients}</h3>
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex items-center space-x-4">
          <div className="p-3 bg-orange-100 rounded-xl text-orange-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Tracked Time</p>
            <h3 className="text-2xl font-bold text-gray-900">{formatTime(totalTime)}</h3>
          </div>
        </GlassCard>

         <GlassCard className="p-6 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Tasks Completed</p>
            <h3 className="text-2xl font-bold text-gray-900">{completedTasks}</h3>
          </div>
        </GlassCard>
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Row 1: Team & Status */}
        <GlassCard className="p-6 flex flex-col lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Team Involvement</h3>
           <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamPerformanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} tickFormatter={(val) => `${(val / 3600).toFixed(1)}h`} />
                <Tooltip 
                    cursor={{fill: '#F3F4F6'}} 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                    formatter={(value: any, name: any, props: any) => [props.payload.formatted, 'Time Spent']}
                />
                <Bar dataKey="seconds" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Client Status</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {statusData.slice(0, 4).map((entry, index) => (
              <div key={index} className="flex items-center space-x-2 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                <span className="text-gray-600">{entry.name}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Row 2: Client Time Investment (Horizontal Bar) */}
        <GlassCard className="p-6 flex flex-col lg:col-span-3">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Client Time Investment</h3>
                    <p className="text-sm text-gray-500">Resource allocation breakdown by client project (Top 10)</p>
                </div>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <TrendingUp className="w-5 h-5" />
                </div>
            </div>
            
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        layout="vertical"
                        data={clientTimeData}
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                        <XAxis type="number" hide />
                        <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={150}
                            axisLine={false} 
                            tickLine={false}
                            tick={{fill: '#4B5563', fontSize: 13, fontWeight: 500}}
                        />
                        <Tooltip
                            cursor={{fill: '#F3F4F6'}} 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                            formatter={(value: any, name: any, props: any) => [props.payload.formatted, 'Total Time']}
                        />
                        <Bar dataKey="hours" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={24} label={{ position: 'right', fill: '#6B7280', fontSize: 12, formatter: (val: any) => `${val}h` }} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default Dashboard;