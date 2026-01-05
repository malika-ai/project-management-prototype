import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Hexagon, ArrowRight, AlertCircle, Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const Login: React.FC = () => {
  const { login, team, isLoading } = useApp();
  const navigate = useNavigate();
  
  // Default Credentials Pre-filled
  const [email, setEmail] = useState('admin@malika.ai');
  const [password, setPassword] = useState('admin123');
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

  // Quick fill for demo
  const quickLogin = (demoEmail: string, demoPass: string) => {
      setEmail(demoEmail);
      setPassword(demoPass);
      // Auto login for better UX in demo
      if(login(demoEmail, demoPass)) {
          navigate('/');
      } else {
          setError('Demo login failed (check console/logic)');
      }
  }

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
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-indigo-200 shadow-lg mb-4">
                <Hexagon className="w-7 h-7 text-white" />
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
                {/* Visual hint for default password if fields are empty */}
                {password === '' && (
                    <p className="text-[10px] text-gray-400 mt-1 pl-1">Default: <span className="font-mono">admin123</span></p>
                )}
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

        {team.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200/60">
                <p className="text-xs text-gray-400 text-center mb-3">Available Accounts (Demo)</p>
                <div className="flex flex-wrap justify-center gap-2">
                    {team.map(m => (
                        <button 
                            key={m.id} 
                            onClick={() => quickLogin(m.email, m.password)}
                            className="text-xs bg-gray-100 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 px-3 py-1 rounded-full transition-colors"
                        >
                            {m.name}
                        </button>
                    ))}
                </div>
            </div>
        )}
      </motion.div>
    </div>
  );
};

export default Login;