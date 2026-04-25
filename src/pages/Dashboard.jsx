import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPrint, FaSignOutAlt, FaUsers } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import PrintableMemberSlip from '../components/PrintableMemberSlip';

export default function Dashboard() {
  const [centers, setCenters] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [memberToPrint, setMemberToPrint] = useState(null);
  const [memberSchedules, setMemberSchedules] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  const staffId = localStorage.getItem('staffId');
  const staffName = localStorage.getItem('staffName');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCenters();
  }, []);

  const fetchCenters = async () => {
    try {
      const { data: staffCenters, error } = await supabase
        .from('centers')
        .select('*')
        .ilike('staff_id', staffId)
        .order('name', { ascending: true });
        
      if (error) throw error;
      const fetchedCenters = staffCenters || [];
      setCenters(fetchedCenters);
      
      // Automatically fetch all members for all centers
      if (fetchedCenters.length > 0) {
        fetchAllMembers(fetchedCenters);
      }
    } catch (err) {
      console.error('Error fetching centers:', err);
    }
  };

  const fetchAllMembers = async (centerList) => {
    if (!centerList || centerList.length === 0) return;
    setLoading(true);
    try {
      const centerIds = centerList.map(c => c.id);
      const { data: membersData, error: memError } = await supabase
        .from('loans')
        .select('member_name, id, member_id, amount_sanctioned, credited_at, loan_app_id, member_photo_url, mobile_no, nominee_mobile, center_id, members(member_no)')
        .in('center_id', centerIds)
        .eq('status', 'DISBURSED');

      if (memError) throw memError;

      const formattedMembers = (membersData || []).map(m => ({
        ...m,
        member_no: m.members?.member_no || null,
        loan_app_id: m.loan_app_id || null
      }));
      
      setMembers(formattedMembers);
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (loanId) => {
    if (!window.confirm('Are you sure you want to delete this member loan? This action cannot be undone.')) return;
    
    try {
      const { error } = await supabase
        .from('loans')
        .delete()
        .eq('id', loanId);
        
      if (error) throw error;
      
      // Update local state
      setMembers(prev => prev.filter(m => m.id !== loanId));
      alert('Member loan deleted successfully.');
    } catch (err) {
      console.error('Error deleting member:', err);
      alert('Failed to delete member.');
    }
  };

  const handlePreview = async (member) => {
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase
        .from('collection_schedules')
        .select('scheduled_date, amount, week_number, scheduled_day')
        .eq('member_id', member.member_id)
        .order('scheduled_date', { ascending: true });
        
      if (error) throw error;
      setMemberSchedules(data || []);
      setMemberToPrint(member);
      setShowPreview(true);
    } catch (err) {
      console.error(err);
      alert('Failed to load schedules for this member.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const executePrint = () => {
    window.print();
  };

  const closePreview = () => {
    setShowPreview(false);
    setMemberToPrint(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('staffId');
    localStorage.removeItem('staffName');
    navigate('/login');
  };

  const centerName = centers.find(c => c.id === memberToPrint?.center_id)?.name || '';

  return (
    <>
      <div className="no-print min-h-screen bg-slate-950 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center bg-slate-900 border border-white/10 rounded-3xl p-6 mb-8">
            <div>
              <h1 className="text-2xl font-black text-white">Welcome, {staffName}</h1>
              <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mt-1">Staff ID: {staffId}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 transition-colors">
              <FaSignOutAlt size={24} />
            </button>
          </div>



          {/* Members List Grouped by Center */}
          {loading ? (
             <div className="text-center text-white py-10">Loading all members...</div>
          ) : centers.length > 0 ? (
            <div className="space-y-8">
              {centers.map(center => {
                const centerMembers = members.filter(m => m.center_id === center.id);
                if (centerMembers.length === 0) return null;

                return (
                  <div key={center.id} className="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-white/10 bg-slate-800/50 flex justify-between items-center">
                      <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                        <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
                        {center.name} Center
                      </h2>
                      <span className="bg-blue-500/10 text-blue-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-blue-500/20">
                        {centerMembers.length} Members
                      </span>
                    </div>
                    <div className="divide-y divide-white/10">
                      {centerMembers.map(member => (
                        <div key={member.id} className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between hover:bg-white/5 transition-colors gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
                               {member.member_photo_url ? (
                                 <img src={member.member_photo_url} alt="" className="w-full h-full object-cover" />
                               ) : <FaUsers className="text-slate-500" size={24} />}
                            </div>
                            <div>
                              <h3 className="font-black text-white text-lg uppercase tracking-tight">{member.member_name}</h3>
                              <p className="text-slate-400 text-xs font-mono mt-1 font-bold">ID: {member.member_no || member.id}</p>
                            </div>
                          </div>
                          <div className="flex gap-3 w-full md:w-auto">
                            <button 
                              onClick={() => handlePreview(member)}
                              disabled={previewLoading}
                              className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                            >
                              <FaPrint size={14} /> Preview
                            </button>
                            <button 
                              onClick={() => handleDeleteMember(member.id)}
                              className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95"
                              title="Delete Member"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {members.length === 0 && (
                <div className="p-12 text-center text-slate-500 font-bold italic bg-slate-900 rounded-3xl border border-white/10">
                  No members found in any of your centers.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Preview Modal - Visible on Screen */}
      {showPreview && memberToPrint && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-5xl flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-800/50 rounded-t-3xl sticky top-0 z-10">
              <h2 className="text-xl font-black text-white uppercase tracking-widest">Document Preview</h2>
              <div className="flex gap-4">
                <button 
                  onClick={closePreview}
                  className="px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                >
                  Cancel
                </button>
                <button 
                  onClick={executePrint}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                  <FaPrint size={14} /> Print Now
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto bg-slate-950 flex justify-center custom-scrollbar">
              {/* Scale down slightly on smaller screens to fit */}
              <div className="transform origin-top scale-[0.6] sm:scale-75 md:scale-90 lg:scale-100 pb-20">
                <PrintableMemberSlip member={memberToPrint} centerName={centerName} isPreview={true} schedules={memberSchedules} />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Actual Printable Area - Hidden on screen, visible on print */}
      {memberToPrint && <PrintableMemberSlip member={memberToPrint} centerName={centerName} schedules={memberSchedules} />}
    </>
  );
}
