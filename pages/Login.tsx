import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, AlertCircle, Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const Login: React.FC = () => {
  const { login, team, isLoading } = useApp();
  const navigate = useNavigate();
  
  // Default Credentials Empty
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, password)) {
      navigate('/');
    } else {
      setError('Invalid email or password.');
    }
  };

  if (isLoading) {
      return (
          <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center"
              >
                  <div className="w-16 h-16 bg-white/50 backdrop-blur-xl rounded-2xl flex items-center justify-center shadow-lg mb-4 border border-white/60">
                     <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Connecting to Agency DB...</h2>
                  <p className="text-sm text-gray-500 mt-1">Synchronizing team and project data.</p>
              </motion.div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl p-8 w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 flex items-center justify-center mb-4 filter drop-shadow-xl">
                 <img 
                    src="https://files.cekat.ai/logo_malika_icon__md8rHz-removebg-preview_WbNddo.png" 
                    alt="Malika AI Logo" 
                    className="w-full h-full object-contain"
                />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome to Malika AI</h1>
            <p className="text-gray-500 text-sm mt-1">Sign in to your agency workspace</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
            {team.length === 0 && (
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-start gap-3 mb-2">
                    <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-700">
                        <p className="font-bold">First Time Setup:</p>
                        <p>Database is empty. Login with these credentials to initialize Admin.</p>
                        <p className="mt-1 font-mono text-[10px] bg-blue-100/50 p-1 rounded inline-block">admin@malika.ai / admin123</p>
                    </div>
                </div>
            )}

            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Work Email</label>
                <input 
                    type="email" 
                    required 
                    placeholder="you@malika.ai"
                    className="w-full rounded-xl border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 p-3 text-gray-900 placeholder-gray-400"
                    value={email}
                    onChange={e => {
                        setEmail(e.target.value);
                        setError('');
                    }}
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Password</label>
                <div className="relative">
                    <input 
                        type={showPassword ? "text" : "password"}
                        required 
                        placeholder="••••••••"
                        className="w-full rounded-xl border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 p-3 text-gray-900 placeholder-gray-400 pr-10"
                        value={password}
                        onChange={e => {
                            setPassword(e.target.value);
                            setError('');
                        }}
                    />
                    <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 focus:outline-none"
                    >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
            </div>
            
            {error && (
                <div className="flex items-center text-red-500 text-sm bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    {error}
                </div>
            )}

            <button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl font-medium shadow-lg shadow-indigo-200 transition-all flex justify-center items-center"
            >
                Enter Workspace <ArrowRight className="w-4 h-4 ml-2" />
            </button>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;