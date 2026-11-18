import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Login() {
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const cleanStaffId = (staffId || '').trim();
      const cleanPassword = (password || '').trim();

      if (!cleanStaffId || !cleanPassword) {
        setError('Please enter both Staff ID and Password!');
        setLoading(false);
        return;
      }

      const { data: staffList, error: fetchError } = await supabase
        .from('staff')
        .select('*')
        .ilike('staff_id', cleanStaffId);

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        setError('Connection error! Please try again.');
        return;
      }

      if (!staffList || staffList.length === 0) {
        setError('Staff ID not found!');
        return;
      }

      const matchedStaff = staffList.find(s => String(s.password || '').trim() === cleanPassword);
      if (!matchedStaff) {
        setError('Invalid Password!');
        return;
      }

      sessionStorage.setItem('staffId', matchedStaff.staff_id);
      sessionStorage.setItem('staffName', matchedStaff.name);
      localStorage.setItem('staffId', matchedStaff.staff_id);
      localStorage.setItem('staffName', matchedStaff.name);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('Connection error: ' + (err.message || 'Please try again'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="bg-slate-900 p-8 rounded-3xl w-full max-w-md border border-white/10 shadow-2xl">
        <h2 className="text-3xl font-black text-white mb-2 text-center">Staff Login</h2>
        <p className="text-slate-400 text-center text-sm mb-8">Access your collection members</p>
        
        {error && <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-sm mb-4 text-center">{error}</div>}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Staff ID</label>
            <input 
              type="text" 
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-colors mt-6 uppercase tracking-widest text-sm"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
