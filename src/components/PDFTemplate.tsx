import React from 'react';
import { WorkMonth } from '../types';
import { DollarSign } from 'lucide-react';
import { cn } from '../lib/utils';

interface PDFTemplateProps {
  data: WorkMonth;
  innerRef: React.RefObject<HTMLDivElement>;
}

export const PDFTemplate: React.FC<PDFTemplateProps> = ({ data, innerRef }) => {
  const daysInMonth = 31; // Template always shows 31 rows

  return (
    <div style={{ position: 'fixed', left: '-2000mm', top: 0, zIndex: -100 }}>
      <div 
        ref={innerRef} 
        className="pdf-container flex flex-col font-serif"
        style={{ color: '#000', backgroundColor: '#fff', position: 'relative' }}
      >
        {/* Full Page Background Image */}
        <div className="absolute inset-0 z-0 opacity-15 pointer-events-none overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?auto=format&fit=crop&w=1200&q=80" 
            className="w-full h-full object-cover"
            alt="background"
            referrerPolicy="no-referrer"
          />
        </div>
        
        {/* CSS-based Watermark for better reliability */}
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div 
            className="text-8xl font-bold rotate-[-45deg] whitespace-nowrap select-none"
            style={{ color: '#1e3a8a', opacity: 0.1 }}
          >
            QUIMERAS NAVEGANTES
          </div>
        </div>

        <div className="relative z-10 w-full">
          <h1 className="text-center text-3xl font-black mb-6 tracking-widest uppercase" style={{ textDecoration: 'underline', textDecorationColor: '#000', textDecorationThickness: '2px', textUnderlineOffset: '8px' }}>
            PROYECTOS GSI, S.L
          </h1>

          <div className="mb-0" style={{ border: '1px solid #000' }}>
            <div className="grid grid-cols-12" style={{ borderBottom: '1px solid #000' }}>
              <div className="col-span-8 p-2 flex items-center h-10" style={{ borderRight: '1px solid #000' }}>
                <span className="font-bold mr-2 text-xl">Nombre:</span>
                <span className="text-xl">{data.name}</span>
              </div>
              <div className="col-span-4 p-2 flex items-center h-10">
                <span className="font-bold mr-2 text-xl">Cargo:</span>
                <span className="text-xl">{data.role}</span>
              </div>
            </div>
            <div className="grid grid-cols-12">
              <div className="col-span-6 p-2 flex items-center h-10" style={{ borderRight: '1px solid #000' }}>
                <span className="font-bold mr-2 text-xl">Mês:</span>
                <span className="text-xl">{data.month.toString().padStart(2, '0')}</span>
              </div>
              <div className="col-span-6 p-2 flex items-center h-10">
                <span className="font-bold mr-2 text-xl">Año:</span>
                <span className="text-xl">{data.year}</span>
              </div>
            </div>
          </div>

          <table className="pdf-table w-full">
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th className="w-[8%] text-center py-1" style={{ border: '1px solid #000' }}>DIA</th>
                <th className="w-[12%] text-center py-1" style={{ border: '1px solid #000' }}>HORAS</th>
                <th className="text-center py-1" style={{ border: '1px solid #000' }}>OBRA</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const entry = data.days.find(d => d.day === dayNum);
                const isOff = entry?.isOffDay;
                
                return (
                  <tr key={dayNum} className={cn("h-8", isOff && "bg-slate-100")}>
                    <td className="text-center font-bold text-sm" style={{ border: '1px solid #000' }}>{dayNum.toString().padStart(2, '0')}</td>
                    <td className="text-center text-sm" style={{ border: '1px solid #000', color: isOff ? '#94a3b8' : '#000' }}>{entry?.hours || ''}</td>
                    <td className="text-sm px-2" style={{ border: '1px solid #000', color: isOff ? '#94a3b8' : '#000', fontStyle: isOff ? 'italic' : 'normal' }}>{entry?.project || ''}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }}>
                <td className="text-center py-1" style={{ border: '1px solid #000' }}>TOTAL</td>
                <td className="text-center py-1" style={{ border: '1px solid #000' }}>{data.totalHours}h</td>
                <td colSpan={1} className="px-4 py-1" style={{ border: '1px solid #000' }}>
                  <div className="flex items-center justify-end gap-1" style={{ color: '#059669' }}>
                    <DollarSign size={16} />
                    <span>VALOR A RECEBER: {data.totalEarnings.toFixed(2)}€</span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>

          {data.signature && (
            <div className="mt-8 flex flex-col items-end">
              <div className="w-48 text-center" style={{ borderBottom: '1px solid #000' }}>
                <img src={data.signature} alt="Assinatura" className="h-16 mx-auto object-contain" />
              </div>
              <p className="w-48 text-center text-xs font-bold mt-1 uppercase">Assinatura do Colaborador</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
