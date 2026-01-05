import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { ClientStatus } from '../types';
import { CLIENT_STATUSES, STATUS_COLORS, PACKAGES } from '../constants';
import { Plus, X, Phone, Mail, FileText, Search, Filter, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Clients: React.FC = () => {
  const { clients, addClient, updateClientStatus } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    package: '',
    description: '',
    email: '',
    whatsapp: '',
    businessField: '',
    status: ClientStatus.Onboarding
  });

  // New States for lists
  const [requirements, setRequirements] = useState<string[]>([]);
  const [tempReq, setTempReq] = useState('');
  const [addons, setAddons] = useState<string[]>([]);
  const [tempAddon, setTempAddon] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addClient(formData, requirements, addons);
    setIsModalOpen(false);
    // Reset Form
    setFormData({
      name: '',
      businessName: '',
      package: '',
      description: '',
      email: '',
      whatsapp: '',
      businessField: '',
      status: ClientStatus.Onboarding
    });
    setRequirements([]);
    setAddons([]);
  };

  const addRequirement = () => {
      if(tempReq.trim()) {
          setRequirements([...requirements, tempReq.trim()]);
          setTempReq('');
      }
  }

  const removeRequirement = (index: number) => {
      setRequirements(requirements.filter((_, i) => i !== index));
  }

  const addAddon = () => {
      if(tempAddon.trim()) {
          setAddons([...addons, tempAddon.trim()]);
          setTempAddon('');
      }
  }

  const removeAddon = (index: number) => {
      setAddons(addons.filter((_, i) => i !== index));
  }

  const filteredClients = clients.filter(client => {
      const term = searchTerm.toLowerCase();
      return (
          (client.businessName || '').toLowerCase().includes(term) ||
          (client.name || '').toLowerCase().includes(term) ||
          (client.businessField || '').toLowerCase().includes(term) ||
          (client.package || '').toLowerCase().includes(term) ||
          (client.email || '').toLowerCase().includes(term)
      );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
           <p className="text-gray-500">Manage client relationships and workflows.</p>
        </div>
        <div className="flex items-center space-x-3 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Search clients..." 
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-200 transition-all flex items-center whitespace-nowrap"
            >
                <Plus className="w-5 h-5 mr-2" />
                Add Client
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map(client => (
          <GlassCard key={client.id} className="p-6 relative group flex flex-col h-full" hoverEffect>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{client.businessName}</h3>
                <p className="text-sm text-gray-500">{client.name}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[client.status] || 'bg-gray-100 text-gray-600'}`}>
                {client.status}
              </span>
            </div>

            <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[40px] flex-grow">{client.description}</p>
            
            <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-600">{client.package}</span>
                <span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-600">{client.businessField}</span>
            </div>

            <div className="flex items-center space-x-3 text-gray-400 mb-4">
                <a href={`mailto:${client.email}`} className="hover:text-indigo-600 transition-colors"><Mail className="w-4 h-4" /></a>
                <a href={`https://wa.me/${String(client.whatsapp || '').replace('+', '')}`} className="hover:text-green-600 transition-colors" target="_blank" rel="noopener noreferrer"><Phone className="w-4 h-4" /></a>
            </div>

            <div className="mt-auto pt-4 border-t border-gray-100">
               <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Progress Status</label>
               <select 
                value={client.status}
                onChange={(e) => updateClientStatus(client.id, e.target.value as ClientStatus)}
                className="w-full bg-gray-50 border-none rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 py-2 cursor-pointer"
               >
                 {CLIENT_STATUSES.map(status => (
                   <option key={status} value={status}>{status}</option>
                 ))}
               </select>
            </div>
          </GlassCard>
        ))}
        {filteredClients.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-400">
                <Filter className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No clients found matching your search.</p>
            </div>
        )}
      </div>

      {/* Add Client Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h2 className="text-xl font-bold text-gray-900">New Client Onboarding</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                    <input required type="text" className="w-full rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 p-3 text-gray-900 placeholder-gray-500" 
                      value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                    <input required type="text" className="w-full rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 p-3 text-gray-900 placeholder-gray-500" 
                      value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Package</label>
                        <select required className="w-full rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 p-3 text-gray-900"
                            value={formData.package} onChange={e => setFormData({...formData, package: e.target.value})}>
                            <option value="">Select Package</option>
                            {PACKAGES.map(pkg => (
                                <option key={pkg} value={pkg}>{pkg}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Business Field</label>
                        <input required type="text" className="w-full rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 p-3 text-gray-900 placeholder-gray-500" 
                        value={formData.businessField} onChange={e => setFormData({...formData, businessField: e.target.value})} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input required type="email" className="w-full rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 p-3 text-gray-900 placeholder-gray-500" 
                      value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                    <input required type="text" className="w-full rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 p-3 text-gray-900 placeholder-gray-500" 
                      value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} />
                  </div>
                </div>

                {/* Requirements (Subtasks) */}
                <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Client Requirements (Will be added as subtasks to 'Training #1')</label>
                     <div className="flex gap-2 mb-2">
                         <input 
                            type="text" 
                            className="flex-1 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 p-3 text-gray-900 placeholder-gray-500"
                            placeholder="Add requirement..."
                            value={tempReq}
                            onChange={e => setTempReq(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRequirement())}
                         />
                         <button type="button" onClick={addRequirement} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 rounded-xl font-medium">Add</button>
                     </div>
                     <div className="space-y-2 max-h-32 overflow-y-auto">
                         {requirements.map((req, idx) => (
                             <div key={idx} className="flex justify-between items-center bg-blue-50 p-2 rounded-lg text-sm text-blue-700 border border-blue-100">
                                 <span>{req}</span>
                                 <button type="button" onClick={() => removeRequirement(idx)} className="text-blue-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                             </div>
                         ))}
                     </div>
                </div>

                {/* Add Ons (Separate Tasks) */}
                <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Add Ons (Will be created as separate tasks)</label>
                     <div className="flex gap-2 mb-2">
                         <input 
                            type="text" 
                            className="flex-1 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 p-3 text-gray-900 placeholder-gray-500"
                            placeholder="Add Add-on..."
                            value={tempAddon}
                            onChange={e => setTempAddon(e.target.value)}
                             onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAddon())}
                         />
                         <button type="button" onClick={addAddon} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 rounded-xl font-medium">Add</button>
                     </div>
                     <div className="space-y-2 max-h-32 overflow-y-auto">
                         {addons.map((addon, idx) => (
                             <div key={idx} className="flex justify-between items-center bg-purple-50 p-2 rounded-lg text-sm text-purple-700 border border-purple-100">
                                 <span>{addon}</span>
                                 <button type="button" onClick={() => removeAddon(idx)} className="text-purple-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                             </div>
                         ))}
                     </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description / Notes</label>
                    <textarea className="w-full rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 p-3 h-24 text-gray-900 placeholder-gray-500" 
                      value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>

                <div className="pt-4 flex justify-end">
                    <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl hover:bg-indigo-700 transition-all">
                        Create Client Profile
                    </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Clients;