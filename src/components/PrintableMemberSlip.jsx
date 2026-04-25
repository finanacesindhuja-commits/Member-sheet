import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import logo from '../assets/logo.jpg';

export default function PrintableMemberSlip({ member, centerName, isPreview = false, schedules = [] }) {
  if (!member) return null;

  // Use actual schedules, fallback to empty array if none
  const rows = schedules.length > 0 ? schedules : Array.from({ length: 16 });

  // Get collection day from database or calculate from first schedule
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const collectionDay = schedules.length > 0
    ? (schedules[0].scheduled_day || days[new Date(schedules[0].scheduled_date).getDay()])
    : 'N/A';

  return (
    <div className={`p-6 w-[210mm] h-[296mm] mx-auto bg-white text-black font-sans box-border relative overflow-hidden ${isPreview ? 'shadow-2xl border border-gray-300' : 'print-only'}`}>

      {/* Header */}
      <div className="flex flex-col items-center pb-2 mb-2 text-center relative min-h-[100px] justify-center">
        {/* Logo - Top Left */}
        <div className="absolute top-0 left-0">
          <img src={logo} alt="Logo" className="w-24 h-24 object-contain -mt-6" />
        </div>

        <h1 className="text-3xl font-black uppercase tracking-widest text-black">Sindhuja Finance </h1>
        <p className="text-[9px] font-bold text-gray-600 uppercase leading-tight max-w-[600px]">
          247, MAYILADUTHURAI MAIN ROAD, E.B.Colony, Senthamangalam, Keelakavathugudi, Thiruvarur, Tamil Nadu 610001
        </p>


        {/* QR Code - Top Right */}
        <div className="absolute top-0 right-0 flex flex-col items-center">
          <div className="border border-black p-1 bg-white shadow-sm">
            <QRCodeSVG value={member.member_no || member.id.toString()} size={50} />
          </div>
          <span className="text-[9px] font-black mt-1 uppercase text-black tracking-tighter">ID: {member.member_no || member.id}</span>
        </div>
      </div>

      {/* Member Info Grid */}
      <div className="border-2 border-black p-4 mb-4 bg-gray-50/30 rounded-sm -mt-6">
        <div className="flex justify-between items-start gap-8">
          <div className="flex-1 grid grid-cols-3 gap-x-6 gap-y-3 text-[11px]">
            <div className="border-b border-gray-100 pb-1">
              <span className="font-bold block text-gray-500 uppercase text-[9px]">Member Name</span>
              <span className="font-black text-base">{member.member_name}</span>
            </div>
            <div className="border-b border-gray-100 pb-1">
              <span className="font-bold block text-gray-500 uppercase text-[9px]">Loan Amount</span>
              <span className="font-black text-base">₹{Number(member.amount_sanctioned).toLocaleString()}</span>
            </div>
            <div className="border-b border-gray-100 pb-1">
              <span className="font-bold block text-gray-500 uppercase text-[9px]">Center Name</span>
              <span className="font-bold uppercase text-blue-800">{centerName || 'N/A'}</span>
            </div>

            <div className="border-b border-gray-100 pb-1">
              <span className="font-bold block text-gray-500 uppercase text-[9px]">Member Mobile</span>
              <span className="font-bold">{member.mobile_no || 'N/A'}</span>
            </div>
            <div className="border-b border-gray-100 pb-1">
              <span className="font-bold block text-gray-500 uppercase text-[9px]">Nominee Mobile</span>
              <span className="font-bold">{member.nominee_mobile || 'N/A'}</span>
            </div>
            <div className="border-b border-gray-100 pb-1">
              <span className="font-bold block text-gray-500 uppercase text-[9px]">Disbursement Date</span>
              <span className="font-bold">{member.credited_at ? new Date(member.credited_at).toLocaleDateString('en-GB') : 'N/A'}</span>
            </div>

            <div className="border-b border-gray-100 pb-1">
              <span className="font-bold block text-gray-500 uppercase text-[9px]">Collection Day</span>
              <span className="font-bold uppercase text-blue-600">{collectionDay}</span>
            </div>
            <div className="border-b border-gray-100 pb-1">
              <span className="font-bold block text-gray-500 uppercase text-[9px]">Collection Time</span>
              <div className="w-40 h-8 border border-black mt-1 rounded-sm bg-white shadow-sm"></div>
            </div>
          </div>

          {/* Photo Box & Signature */}
          <div className="flex flex-col items-center shrink-0">
            <div className="w-28 h-32 border-2 border-dotted border-black flex items-center justify-center bg-white overflow-hidden shadow-inner">
              {member.member_photo_url ? (
                <img src={member.member_photo_url} alt="Member" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] text-gray-400 font-bold uppercase p-2 text-center leading-tight">Photo</span>
              )}
            </div>
            <div className="mt-2 flex flex-col items-center">
              <div className="border-b border-black w-28 mb-1"></div>
              <p className="text-[8px] font-black uppercase tracking-tighter">Member Signature</p>
            </div>
          </div>
        </div>
      </div>

      <h3 className="text-sm font-black text-black border-b-2 border-black inline-block mb-3 uppercase tracking-widest">Collection Schedule</h3>

      {/* Collection Table */}
      <table className="w-full border-collapse border-2 border-black text-[11px]">
        <thead>
          <tr className="bg-gray-50">
            <th className="border-2 border-black px-1 py-2 text-center w-10 uppercase">No</th>
            <th className="border-2 border-black px-2 py-2 text-left w-24 uppercase">Date</th>
            <th className="border-2 border-black px-2 py-2 text-right w-20 uppercase font-black">Principal</th>
            <th className="border-2 border-black px-2 py-2 text-right w-20 uppercase font-black">Interest</th>
            <th className="border-2 border-black px-2 py-2 text-right w-24 uppercase font-black">Total EMI</th>
            <th className="border-2 border-black px-1 py-2 text-center w-20 uppercase">Sign</th>
            <th className="border-2 border-black px-2 py-2 text-center uppercase">Remark</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((sch, index) => {
            const isSchedule = sch && sch.scheduled_date;
            const principal = isSchedule && schedules.length > 0 ? Math.round(member.amount_sanctioned / schedules.length) : null;
            const interest = isSchedule && schedules.length > 0 ? Math.round(sch.amount - principal) : null;

            return (
              <tr key={index} className="h-8">
                <td className="border-2 border-black px-1 py-1 text-center font-black">
                  {isSchedule ? sch.week_number : index + 1}
                </td>
                <td className="border-2 border-black px-2 py-1 font-mono font-bold">
                  {isSchedule ? new Date(sch.scheduled_date).toLocaleDateString('en-GB') : ''}
                </td>
                <td className="border-2 border-black px-2 py-1 text-right font-bold text-gray-500">
                  {principal ? `₹${principal.toLocaleString()}` : ''}
                </td>
                <td className="border-2 border-black px-2 py-1 text-right font-bold text-gray-500">
                  {interest ? `₹${interest.toLocaleString()}` : ''}
                </td>
                <td className="border-2 border-black px-2 py-1 text-right font-black text-sm">
                  {isSchedule ? `₹${Number(sch.amount).toLocaleString()}` : ''}
                </td>
                <td className="border-2 border-black px-1 py-1"></td>
                <td className="border-2 border-black px-2 py-1"></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Footer / Terms */}
      <div className="mt-2 pt-2 grid grid-cols-2 gap-8 text-[9px]">
        <div>
          <p className="font-black uppercase mb-1">General Instructions:</p>
          <ul className="list-disc ml-4 space-y-1">
            <li>உறுப்பினர்கள் ஒவ்வொரு கட்டணத்திற்கும் இந்த பாஸ்புக்கில் பணியாளர்களிடம் கையொப்பம் பெற வேண்டும்.</li>
            <li>இந்த புத்தகத்தில் பதிவு செய்யாமல் செய்யப்பட்ட கட்டணங்களுக்கு Sindhuja Finance பொறுப்பாக இருக்காது.</li>
            <li>இந்த பாஸ்புக்கை எதிர்கால பயன்பாட்டிற்காக பாதுகாப்பாக வைத்திருக்கவும்.</li>
            <li>கடன் வாங்கியவர் மட்டுமே கடன் தொகையை பயன்படுத்த வேண்டும்</li>
            <li>எந்த சூழ்நிலையிலும் யாருக்கும் லஞ்சமோ, அன்பளிப்போ வழங்குதல் கூடாது</li>
          </ul>
        </div>
        <div className="text-right flex flex-col justify-end pt-4 relative">
          <p className="font-black italic mb-2">Verified & Authorized by</p>
          <div className="flex justify-end items-center relative">
            {/* Company Seal - Positioned behind */}
            <div className="absolute right-4 bottom-0 opacity-20 pointer-events-none">
              <div className="w-24 h-24 border-4 border-double border-gray-400 rounded-full flex items-center justify-center text-[10px] text-gray-400 font-bold uppercase text-center p-4 transform -rotate-12">
                Company Seal
              </div>
            </div>

            <div className="flex flex-col items-end z-10">
              <div className="border-b border-black w-48 mb-1"></div>
              <p className="text-[10px] font-black uppercase tracking-wider">Sindhuja Finance Management</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
