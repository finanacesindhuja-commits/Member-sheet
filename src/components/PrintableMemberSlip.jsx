import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import BASE_URL from '../config';
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

  // Standard scheme lookup - weeks for each loan amount
  const SCHEME_STANDARDS = {
    10000: { weeks: 12, emi: 1100 },
    11000: { weeks: 15, emi: 1100 },
    12000: { weeks: 16, emi: 1020 },
    13000: { weeks: 18, emi: 990 },
    15000: { weeks: 22, emi: 1100 },
  };
  const loanAmount = Number(member.amount_sanctioned) || 0;
  const scheme = SCHEME_STANDARDS[loanAmount];

  // Total weeks from scheme or actual schedule count
  const totalWeeks = scheme ? scheme.weeks : (schedules.length > 0 ? schedules.length : 16);

  // Principal per week = Loan Amount ÷ Total Weeks (same for every week)
  const principalPerWeek = Math.floor(loanAmount / totalWeeks);

  // Dynamic scaling classes based on number of weeks to prevent A4 print cutoff
  const isCompact = totalWeeks > 12;
  const isSuperCompact = totalWeeks > 16;

  const containerPadding = isSuperCompact ? 'p-3' : 'p-4';
  const rowHeight = isSuperCompact ? 'h-[23px]' : isCompact ? 'h-[27px]' : 'h-8';
  const cellPadding = isSuperCompact ? 'py-[1px] px-1' : isCompact ? 'py-0.5 px-1.5' : 'py-1 px-2';
  const tableFontSize = isSuperCompact ? 'text-[9.5px]' : isCompact ? 'text-[10.5px]' : 'text-[11px]';
  const numberFontSize = isSuperCompact ? 'text-xs' : 'text-sm';
  const emiFontSize = isSuperCompact ? 'text-xs' : 'text-sm';
  
  const headerSpacing = isSuperCompact ? 'pb-1 mb-1' : 'pb-2 mb-2';
  const logoSize = isSuperCompact ? 'w-16 h-16' : 'w-20 h-20';
  const infoGridMargin = isSuperCompact ? '-mt-5' : '-mt-4';
  const infoGridPadding = isSuperCompact ? 'p-2 mb-1' : 'p-3 mb-2';
  const infoGridGapY = isSuperCompact ? 'gap-y-1.5' : 'gap-y-3';
  const infoGridFontSize = isSuperCompact ? 'text-[10px]' : 'text-[11px]';
  const titleMargin = isSuperCompact ? 'mb-1.5' : 'mb-3';
  const footerMargin = isSuperCompact ? 'mt-0.5 pt-0.5' : 'mt-1 pt-1';
  const photoHeight = isSuperCompact ? 'w-24 h-28' : 'w-28 h-32';
  const qrCodeSize = isSuperCompact ? 130 : isCompact ? 145 : 160;

  return (
    <div className={`${containerPadding} w-[210mm] mx-auto bg-white text-black font-sans box-border relative ${isPreview ? 'shadow-2xl border border-gray-300' : 'print-only h-[296mm] overflow-hidden'}`}>

      {/* Header */}
      <div className={`flex items-center justify-center relative ${headerSpacing} min-h-[70px]`}>
        {/* Logo - Left aligned, vertically centered */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2">
          <img src={logo} alt="Logo" className={`${logoSize} object-contain`} />
        </div>

        <div className="text-center px-20">
          <h1 className={`${isSuperCompact ? 'text-2xl' : 'text-3xl'} font-black uppercase tracking-[0.2em] text-black`}>Sindhuja Finance</h1>
          <p className={`${isSuperCompact ? 'text-[8.5px]' : 'text-[10px]'} font-bold text-gray-700 uppercase leading-relaxed max-w-[600px] mx-auto mt-0.5`}>
            NO-1/23,MAYILADUTHURAI ROAD, SENTHAMANGALAM,THIRUVARUR, 610001
          </p>
        </div>
      </div>

      {/* Member Info Grid */}
      <div className={`border-2 border-black bg-gray-50/30 rounded-sm ${infoGridPadding} ${infoGridMargin}`}>
        <div className="flex justify-between items-start gap-8">
          <div className={`flex-1 grid grid-cols-3 gap-x-6 ${infoGridGapY} ${infoGridFontSize}`}>
            <div className="border-b border-gray-100 pb-1">
              <span className="font-bold block text-gray-800 uppercase text-[9px]">Member Name</span>
              <span className="font-black text-base">{member.member_name}</span>
            </div>
            <div className="border-b border-gray-100 pb-1">
              <span className="font-bold block text-gray-800 uppercase text-[9px]">Loan Amount</span>
              <span className="font-black text-base">₹{Number(member.amount_sanctioned).toLocaleString()}</span>
            </div>
            <div className="border-b border-gray-100 pb-1">
              <span className="font-bold block text-gray-800 uppercase text-[9px]">Center Name</span>
              <span className="font-bold uppercase text-blue-800">{centerName || 'N/A'}</span>
            </div>

            <div className="border-b border-gray-100 pb-1">
              <span className="font-bold block text-gray-800 uppercase text-[9px]">Member Mobile</span>
              <span className="font-bold">{member.mobile_no || 'N/A'}</span>
            </div>
            <div className="border-b border-gray-100 pb-1">
              <span className="font-bold block text-gray-800 uppercase text-[9px]">Nominee Mobile</span>
              <span className="font-bold">{member.nominee_mobile || 'N/A'}</span>
            </div>
            <div className="border-b border-gray-100 pb-1">
              <span className="font-bold block text-gray-800 uppercase text-[9px]">Disbursement Date</span>
              <span className="font-bold">{member.credited_at ? new Date(member.credited_at).toLocaleDateString('en-GB') : 'N/A'}</span>
            </div>

            <div className="border-b border-gray-100 pb-1">
              <span className="font-bold block text-gray-800 uppercase text-[9px]">Collection Day</span>
              <span className="font-bold uppercase text-blue-600">{collectionDay}</span>
            </div>
            <div className="border-b border-gray-100 pb-1">
              <span className="font-bold block text-gray-800 uppercase text-[9px]">Collection Time</span>
              <div className="w-28 h-6 border border-black mt-1 rounded-sm bg-white"></div>
            </div>
            <div className="border-b border-gray-100 pb-1">
              <span className="font-bold block text-gray-800 uppercase text-[9px]">Member ID</span>
              <span className="font-black text-base text-red-600">{member.member_no || member.id}</span>
            </div>
          </div>

          {/* Photo Box & Signature */}
          <div className="flex flex-col items-center shrink-0">
            <div className={`${photoHeight} border-2 border-black flex items-center justify-center bg-white overflow-hidden shadow-inner`}>
              {member.member_photo_url ? (
                <img src={member.member_photo_url} alt="Member" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] text-gray-600 font-bold uppercase p-2 text-center leading-tight">Photo</span>
              )}
            </div>
            <div className="mt-2 flex flex-col items-center">
              <div className="border-b border-black w-28 mb-1"></div>
              <p className="text-[8px] font-black uppercase tracking-tighter">Member Signature</p>
            </div>
          </div>
        </div>
      </div>

      <h3 className={`text-sm font-black text-black border-b-2 border-black inline-block uppercase tracking-widest ${titleMargin}`}>Collection Schedule</h3>

      {/* Collection Table */}
      <table className={`w-full border-collapse border-2 border-black ${tableFontSize}`}>
        <thead>
          <tr className="bg-gray-50">
            <th className={`border-2 border-black text-center w-10 uppercase ${cellPadding}`}>No</th>
            <th className={`border-2 border-black text-left w-24 uppercase ${cellPadding}`}>Date</th>
            <th className={`border-2 border-black text-right w-20 uppercase font-black ${cellPadding}`}>Principal</th>
            <th className={`border-2 border-black text-right w-20 uppercase font-black ${cellPadding}`}>Interest</th>
            <th className={`border-2 border-black text-right w-24 uppercase font-black ${cellPadding}`}>Total EMI</th>
            <th className={`border-2 border-black text-center w-20 uppercase ${cellPadding}`}>Sign</th>
            <th className={`border-2 border-black text-center uppercase ${cellPadding}`}>Remark</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((sch, index) => {
            const isSchedule = sch && sch.scheduled_date;

            // Step 1: EMI = directly from database
            const emiAmount = isSchedule && sch.amount ? Number(sch.amount) : null;

            // Step 2: Principal = Loan Amount ÷ Total Weeks (same every week)
            const principal = emiAmount ? principalPerWeek : null;

            // Step 3: Interest = EMI − Principal
            const interest = emiAmount ? (emiAmount - principalPerWeek) : null;

            return (
              <tr key={index} className={rowHeight}>
                <td className={`border-2 border-black text-center font-black ${numberFontSize} ${cellPadding}`}>
                  {isSchedule ? (sch.week_number ?? index + 1) : index + 1}
                </td>
                <td className={`border-2 border-black font-mono font-bold ${cellPadding}`}>
                  {isSchedule ? new Date(sch.scheduled_date).toLocaleDateString('en-GB') : ''}
                </td>
                <td className={`border-2 border-black text-right font-bold text-black ${cellPadding}`}>
                  {principal ? `₹${principal.toLocaleString()}` : ''}
                </td>
                <td className={`border-2 border-black text-right font-bold text-black ${cellPadding}`}>
                  {interest !== null ? (interest > 0 ? `₹${interest.toLocaleString()}` : '—') : ''}
                </td>
                <td className={`border-2 border-black text-right font-black ${emiFontSize} ${cellPadding}`}>
                  {emiAmount ? `₹${emiAmount.toLocaleString()}` : ''}
                </td>
                <td className={`border-2 border-black ${cellPadding}`}></td>
                <td className={`border-2 border-black ${cellPadding}`}></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Footer / Terms */}
      <div className={`flex justify-between items-end gap-4 text-[8px] ${footerMargin}`}>
        <div className="flex-1">
          <p className="font-black uppercase mb-0.5">General Instructions:</p>
          <ul className="list-disc ml-4 space-y-0.5">
            <li>உறுப்பினர்கள் ஒவ்வொரு கட்டணத்திற்கும் இந்த பாஸ்புக்கில் பணியாளர்களிடம் கையொப்பம் பெற வேண்டும்.</li>
            <li>இந்த புத்தகத்தில் பதிவு செய்யாமல் செய்யப்பட்ட கட்டணங்களுக்கு Sindhuja Finance பொறுப்பாக இருக்காது.</li>
            <li>இந்த பாஸ்புக்கை எதிர்கால பயன்பாட்டிற்காக பாதுகாப்பாக வைத்திருக்கவும்.</li>
            <li>கடன் வாங்கியவர் மட்டுமே கடன் தொகையை பயன்படுத்த வேண்டும்</li>
            <li>எந்த சூழ்நிலையிலும் யாருக்கும் லஞ்சமோ, அன்பளிப்போ வழங்குதல் கூடாது</li>
          </ul>
        </div>

        {/* QR Code - Positioned between Instructions and Signature */}
        <div className="flex flex-col items-center shrink-0 mx-2">
          <div className="border-2 border-black p-1 bg-white shadow-sm">
            <QRCodeSVG
              value={`${BASE_URL}/verify/${encodeURIComponent(member.member_no || member.id)}`}
              size={qrCodeSize}
              level="L"
              includeMargin={true}
            />
          </div>
          <p className="text-[7px] font-black mt-0.5 uppercase">Scan for Details</p>
        </div>

        <div className="flex-1 text-right flex flex-col justify-end pt-4 relative">
          <p className="font-black italic mb-2">Verified & Authorized by</p>
          <div className="flex justify-end items-center relative">
            {/* Company Seal - Positioned behind */}
            <div className="absolute right-4 bottom-0 opacity-20 pointer-events-none">
              <div className="w-24 h-24 border-4 border-double border-gray-400 rounded-full flex items-center justify-center text-[10px] text-gray-600 font-bold uppercase text-center p-4 transform -rotate-12">
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
