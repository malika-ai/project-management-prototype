import React from 'react';
import { NavLink, Outlet, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { 
  LayoutDashboard, 
  Users, 
  CheckSquare, 
  MonitorPlay, 
  Settings,
  UserPlus,
  LogOut,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Kanban,
  Activity
} from 'lucide-react';
import { motion } from 'framer-motion';

const SidebarItem = ({ to, icon: Icon, label, collapsed }: { to: string, icon: any, label: string, collapsed: boolean }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <NavLink to={to} className="block mb-2" title={label}>
      <div className={`
        flex items-center px-4 py-3 rounded-xl transition-all duration-200 group
        ${isActive 
          ? 'bg-white dark:bg-slate-800 shadow-sm text-gray-900 dark:text-white font-medium' 
          : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-white'}
        ${collapsed ? 'justify-center px-2' : ''}
      `}>
        <Icon className={`w-5 h-5 ${collapsed ? '' : 'mr-3'} ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400'}`} />
        {!collapsed && <span className="text-sm">{label}</span>}
      </div>
    </NavLink>
  );
};

const Layout: React.FC = () => {
  const { currentUser, logout, settings, updateSettings } = useApp();
  const navigate = useNavigate();

  if (!currentUser) {
      return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
      logout();
      navigate('/login');
  }

  const toggleSidebar = () => {
      updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed });
  }

  // Role Based Access Control Helper
  const isManagement = ['Manager', 'Leader'].includes(currentUser.role);
  const isSales = currentUser.role === 'Sales';

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F5F7] dark:bg-slate-950 transition-colors duration-300">
      {/* Sidebar */}
      <motion.aside 
        animate={{ width: settings.sidebarCollapsed ? 80 : 256 }}
        className="flex flex-col h-full border-r border-gray-200/50 dark:border-slate-800/50 bg-[#F5F5F7]/50 dark:bg-slate-950/50 backdrop-blur-sm p-4 relative z-20"
      >
         <button 
            onClick={toggleSidebar}
            className="absolute -right-3 top-9 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full p-1 shadow-sm text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors z-10"
         >
             {settings.sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
         </button>

        <div className={`flex items-center mb-10 px-2 ${settings.sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 filter drop-shadow-sm">
            <img 
                src="https://files.cekat.ai/logo_malika_icon__md8rHz-removebg-preview_WbNddo.png" 
                alt="Malika AI" 
                className="w-full h-full object-contain"
            />
          </div>
          {!settings.sidebarCollapsed && <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight ml-3">Malika AI</span>}
        </div>

        <nav className="flex-1">
          {!settings.sidebarCollapsed && <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 px-4">Menu</div>}
          
          {/* Activity: All Roles */}
          <SidebarItem to="/activity" icon={Activity} label="Activity" collapsed={settings.sidebarCollapsed} />

          {/* Dashboard: All Roles */}
          <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" collapsed={settings.sidebarCollapsed} />
          
          {/* Clients: All Roles */}
          <SidebarItem to="/clients" icon={Users} label="Clients" collapsed={settings.sidebarCollapsed} />
          
          {/* Pipeline: Manager & Leader Only */}
          {isManagement && (
            <SidebarItem to="/pipeline" icon={Kanban} label="Pipeline" collapsed={settings.sidebarCollapsed} />
          )}
          
          {/* Projects: All Roles */}
          <SidebarItem to="/projects" icon={FolderOpen} label="Projects" collapsed={settings.sidebarCollapsed} />
          
          {/* Tasks: All Roles EXCEPT Sales */}
          {!isSales && (
            <SidebarItem to="/tasks" icon={CheckSquare} label="Tasks" collapsed={settings.sidebarCollapsed} />
          )}
          
          {/* Monitor: All Roles */}
          <SidebarItem to="/monitor" icon={MonitorPlay} label="Monitor" collapsed={settings.sidebarCollapsed} />
          
          {/* Team: Manager & Leader Only */}
          {isManagement && (
            <SidebarItem to="/team" icon={UserPlus} label="Team" collapsed={settings.sidebarCollapsed} />
          )}
        </nav>

        <div className="mt-auto">
          <div className="mb-4">
              <div className={`flex items-center p-2 bg-white/60 dark:bg-slate-800/60 rounded-xl border border-white/50 dark:border-white/5 ${settings.sidebarCollapsed ? 'justify-center' : ''}`}>
                  <img src={currentUser.avatar} alt="Profile" className="w-8 h-8 rounded-full flex-shrink-0" />
                  {!settings.sidebarCollapsed && (
                      <div className="overflow-hidden ml-3">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{currentUser.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{currentUser.role}</p>
                      </div>
                  )}
              </div>
          </div>
          <SidebarItem to="/settings" icon={Settings} label="Settings" collapsed={settings.sidebarCollapsed} />
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center px-4 py-3 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all ${settings.sidebarCollapsed ? 'justify-center' : ''}`}
            title="Logout"
          >
              <LogOut className={`w-5 h-5 ${settings.sidebarCollapsed ? '' : 'mr-3'}`} />
              {!settings.sidebarCollapsed && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative">
        <div className="p-8 max-w-7xl mx-auto min-h-full">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <Outlet />
            </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Layout;