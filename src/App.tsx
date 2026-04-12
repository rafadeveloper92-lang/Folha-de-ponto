import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  User, 
  Clock, 
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Save,
  MoreVertical,
  Settings,
  History,
  DollarSign,
  X,
  PenTool,
  Upload,
  Database,
  MessageCircle,
  Share2,
  Sun,
  Moon,
  LayoutDashboard,
  LineChart,
  MapPin,
  FileText,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { WorkMonth, WorkDay } from './types';
import { cn } from './lib/utils';
import { PDFTemplate } from './components/PDFTemplate';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import SignatureCanvas from 'react-signature-canvas';
import { db } from './lib/db';

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Oficial' | 'Ajudante' | ''>('');
  const [entries, setEntries] = useState<Record<string, Partial<WorkDay>>>({});
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [signature, setSignature] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [history, setHistory] = useState<{ month: string, hours: number, days: number }[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [defaultProject, setDefaultProject] = useState('');
  const [mainTab, setMainTab] = useState<'painel' | 'analises' | 'projeto' | 'relatorios'>('painel');
  const [monthlyHourGoal, setMonthlyHourGoal] = useState(160);
  
  const pdfRef = useRef<HTMLDivElement>(null);
  const sigPad = useRef<SignatureCanvas>(null);
  const isInitialMount = useRef(true);
  const isChangingMonth = useRef(false);

  const monthKey = format(currentDate, 'MM_yyyy');

  // PWA Install Logic
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Load profile and entries from Dexie
  useEffect(() => {
    const loadData = async () => {
      // Load Profile
      const profile = await db.profile.get('current');
      if (profile) {
        setName(profile.name);
        setRole(profile.role as any);
        setHourlyRate(profile.hourlyRate);
        setSignature(profile.signature || null);
        if (profile.theme) setTheme(profile.theme);
        if (profile.defaultProject) setDefaultProject(profile.defaultProject);
        if (profile.monthlyHourGoal != null && profile.monthlyHourGoal > 0) {
          setMonthlyHourGoal(profile.monthlyHourGoal);
        }
      }

      // Load Entries for current month
      const savedEntries = await db.entries.where('monthKey').equals(monthKey).toArray();
      const entriesMap: Record<string, Partial<WorkDay>> = {};
      savedEntries.forEach(entry => {
        entriesMap[entry.day] = {
          day: entry.day,
          project: entry.project,
          description: entry.description,
          hours: entry.hours,
          marked: entry.marked
        };
      });
      setEntries(entriesMap);
      
      isInitialMount.current = false;
    };
    loadData();
  }, [monthKey]);

  // Load history
  useEffect(() => {
    const loadHistory = async () => {
      const allEntries = await db.entries.toArray();
      const historyMap: Record<string, { hours: number, days: Set<number> }> = {};
      
      allEntries.forEach(entry => {
        if (!historyMap[entry.monthKey]) {
          historyMap[entry.monthKey] = { hours: 0, days: new Set() };
        }
        const match = entry.hours.match(/\d+/);
        historyMap[entry.monthKey].hours += match ? parseInt(match[0]) : 0;
        historyMap[entry.monthKey].days.add(entry.day);
      });

      const historyData = Object.entries(historyMap).map(([monthKey, data]) => ({
        month: monthKey.replace('_', '/'),
        hours: data.hours,
        days: data.days.size
      })).sort((a, b) => {
        const [mA, yA] = a.month.split('/').map(Number);
        const [mB, yB] = b.month.split('/').map(Number);
        return yB !== yA ? yB - yA : mB - mA;
      });
      setHistory(historyData);
    };
    loadHistory();
  }, [entries]);

  // Save Profile to Dexie
  useEffect(() => {
    if (isInitialMount.current) return;
    db.profile.put({
      id: 'current',
      name,
      role,
      hourlyRate,
      signature: signature || '',
      theme,
      defaultProject,
      monthlyHourGoal,
    });
  }, [name, role, hourlyRate, signature, theme, defaultProject, monthlyHourGoal]);

  // Save Entries to Dexie
  useEffect(() => {
    if (isInitialMount.current) return;
    
    const saveEntries = async () => {
      // Clear current month entries first to avoid duplicates or stale data
      await db.entries.where('monthKey').equals(monthKey).delete();
      
      const entriesToSave = Object.entries(entries).map(([day, data]) => ({
        monthKey,
        day: parseInt(day),
        project: data.project || '',
        description: data.description || '',
        hours: data.hours || '',
        marked: data.marked || false
      }));
      
      if (entriesToSave.length > 0) {
        await db.entries.bulkAdd(entriesToSave);
      }
    };
    
    saveEntries();
  }, [entries, monthKey]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const hourOptions = Array.from({ length: 11 }, (_, i) => `${i + 5} horas`);

  const handleInputChange = (day: number, field: keyof WorkDay, value: string) => {
    if (entries[day]?.marked) return;
    setEntries(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        day,
        [field]: value
      }
    }));
  };

  const handleMarkDay = (day: number) => {
    if (!entries[day]?.hours || !entries[day]?.project) {
      // Optional: show a toast or alert
      return;
    }
    setEntries(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        day,
        marked: true
      }
    }));
    
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
    audio.play().catch(e => console.log('Audio play failed', e));
    setSavingDay(day);
    setTimeout(() => setSavingDay(null), 1000);
  };

  const handleMarkOffDay = (day: number) => {
    setEntries(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        day,
        hours: '0 horas',
        project: 'FOLGA / FERIADO',
        marked: true,
        isOffDay: true
      }
    }));
    
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
    audio.play().catch(e => console.log('Audio play failed', e));
    setSavingDay(day);
    setTimeout(() => setSavingDay(null), 1000);
  };

  const handleResetDay = (day: number) => {
    if (confirm('Deseja desmarcar este dia?')) {
      setEntries(prev => {
        const newEntries = { ...prev };
        delete newEntries[day];
        return newEntries;
      });
      db.entries.where({ day, monthKey }).delete();
    }
  };

  const applyDefaultProject = () => {
    if (!defaultProject) return;
    setEntries(prev => {
      const newEntries = { ...prev };
      days.forEach(day => {
        const dayNum = day.getDate();
        if (newEntries[dayNum]?.marked) return;
        
        if (!newEntries[dayNum]) {
          newEntries[dayNum] = { day: dayNum, project: defaultProject, description: '', hours: '' };
        } else if (!newEntries[dayNum].project) {
          newEntries[dayNum].project = defaultProject;
        }
      });
      return newEntries;
    });
  };

  const markWeekendsAsOff = () => {
    setEntries(prev => {
      const newEntries = { ...prev };
      days.forEach(day => {
        const dayNum = day.getDate();
        const dayOfWeek = getDay(day); // 0 = Sunday, 6 = Saturday
        
        if ((dayOfWeek === 0 || dayOfWeek === 6) && !newEntries[dayNum]?.marked) {
          newEntries[dayNum] = {
            ...newEntries[dayNum],
            day: dayNum,
            hours: '0 horas',
            project: 'FOLGA / FERIADO',
            marked: true,
            isOffDay: true
          };
        }
      });
      return newEntries;
    });
    
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
    audio.play().catch(e => console.log('Audio play failed', e));
  };

  const shareToWhatsApp = async () => {
    if (!pdfRef.current) return;
    setIsExporting(true);
    
    try {
      window.scrollTo(0, 0);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      const pdfBlob = pdf.output('blob');
      const fileName = `GSI_Ponto_${name || 'Funcionario'}_${format(currentDate, 'MM_yyyy')}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Meu Ponto GSI',
          text: `Aqui está o meu ponto da GSI referente a ${format(currentDate, 'MMMM yyyy', { locale: ptBR })}.`,
        });
      } else {
        // Fallback: Just open WhatsApp with a message
        const message = encodeURIComponent(`Olá, estou enviando meu ponto da GSI referente a ${format(currentDate, 'MMMM yyyy', { locale: ptBR })}. Acabei de baixar o PDF.`);
        window.open(`https://wa.me/?text=${message}`, '_blank');
        // Also trigger download as fallback
        pdf.save(fileName);
      }
    } catch (error) {
      console.error('Error sharing PDF:', error);
      alert('Houve um erro ao compartilhar. O PDF será baixado em vez disso.');
      exportPDF();
    } finally {
      setIsExporting(false);
    }
  };

  const exportPDF = async () => {
    if (!pdfRef.current) return;
    setIsExporting(true);
    
    try {
      window.scrollTo(0, 0);
      // Small delay to ensure template is rendered and scroll finished
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        logging: true,
        allowTaint: true,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`GSI_Ponto_${name || 'Funcionario'}_${format(currentDate, 'MM_yyyy')}.pdf`);
      console.log('PDF generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Houve um erro ao gerar o PDF. Por favor, tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearSignature = () => {
    if (sigPad.current) {
      sigPad.current.clear();
    }
  };

  const trimCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const l = pixels.data.length;
    const bound = {
      top: canvas.height,
      left: canvas.width,
      right: 0,
      bottom: 0
    };
    
    for (let i = 0; i < l; i += 4) {
      if (pixels.data[i + 3] !== 0) {
        const x = (i / 4) % canvas.width;
        const y = Math.floor((i / 4) / canvas.width);
        
        if (x < bound.left) bound.left = x;
        if (x > bound.right) bound.right = x;
        if (y < bound.top) bound.top = y;
        if (y > bound.bottom) bound.bottom = y;
      }
    }
    
    const trimHeight = bound.bottom - bound.top + 1;
    const trimWidth = bound.right - bound.left + 1;
    
    if (trimWidth <= 0 || trimHeight <= 0) return canvas;
    
    const trimmed = ctx.getImageData(bound.left, bound.top, trimWidth, trimHeight);
    const copy = document.createElement('canvas');
    copy.width = trimWidth;
    copy.height = trimHeight;
    const copyCtx = copy.getContext('2d');
    if (!copyCtx) return canvas;
    copyCtx.putImageData(trimmed, 0, 0);
    
    return copy;
  };

  const handleSaveSignature = () => {
    if (sigPad.current) {
      if (sigPad.current.isEmpty()) {
        alert('Por favor, desenhe sua assinatura primeiro.');
        return;
      }
      const canvas = sigPad.current.getCanvas();
      const trimmedCanvas = trimCanvas(canvas);
      const dataUrl = trimmedCanvas.toDataURL('image/png');
      setSignature(dataUrl);
      setIsSignatureOpen(false);
    }
  };

  const handleBackupData = async () => {
    const profile = await db.profile.get('current');
    const entries = await db.entries.toArray();
    
    const backupData = {
      profile,
      entries
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gsi_backup_${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestoreData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (confirm('Isso irá substituir todos os seus dados atuais. Deseja continuar?')) {
          await db.profile.clear();
          await db.entries.clear();
          
          if (data.profile) {
            await db.profile.put(data.profile);
          }
          if (data.entries && Array.isArray(data.entries)) {
            await db.entries.bulkAdd(data.entries);
          }
          
          window.location.reload();
        }
      } catch (err) {
        alert('Arquivo de backup inválido.');
      }
    };
    reader.readAsText(file);
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const totalHours = (Object.values(entries) as Partial<WorkDay>[]).reduce((acc: number, curr) => {
    if (curr.hours) {
      const match = curr.hours.match(/\d+/);
      return acc + (match ? parseInt(match[0]) : 0);
    }
    return acc;
  }, 0);

  const totalEarnings = totalHours * hourlyRate;

  const hourGoal = monthlyHourGoal > 0 ? monthlyHourGoal : 160;
  const progressToGoal = Math.min(totalHours / hourGoal, 1);
  const profileInitials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?';
  const profileQrPayload = JSON.stringify({
    app: 'GSI Tracker',
    nome: name || '—',
    cargo: role || '—',
    mes: format(currentDate, 'MM/yyyy'),
  });
  const profileQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(profileQrPayload)}`;

  const workMonthData: WorkMonth = {
    name,
    role,
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
    days: (Object.values(entries) as Partial<WorkDay>[]).filter((e): e is WorkDay => e.day !== undefined),
    signature: signature || undefined,
    totalHours,
    totalEarnings
  };

  const copyPrevious = (dayNum: number) => {
    if (entries[dayNum]?.marked) return;
    const prevDay = dayNum - 1;
    if (entries[prevDay]) {
      setEntries(prev => ({
        ...prev,
        [dayNum]: {
          ...prev[dayNum],
          day: dayNum,
          project: entries[prevDay].project || prev[dayNum]?.project,
          description: entries[prevDay].description || prev[dayNum]?.description,
          hours: entries[prevDay].hours || prev[dayNum]?.hours,
        }
      }));
    }
  };

  const isDark = theme === 'dark';
  const pageBg = isDark ? 'bg-[#0d1117]' : 'bg-white';
  const cardBg = isDark ? 'bg-[#161b22]' : 'bg-white';
  const cardBorder = isDark ? 'border-white/[0.08]' : 'border-slate-200';
  const accentBlue = '#2166ff';
  const accentGreen = '#2ea043';

  return (
    <div className={cn(
      'min-h-screen transition-colors duration-300 pb-24 sm:pb-20',
      isDark ? `${pageBg} text-white` : 'bg-white text-slate-900',
    )}>
      {/* PWA Install Banner */}
      <AnimatePresence>
        {showInstallBanner && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className={cn(
              "fixed top-0 left-0 right-0 z-[100] p-4 shadow-2xl flex items-center justify-between",
              theme === 'dark' ? "bg-[#D4AF37]" : "bg-[#2563EB]"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 bg-white rounded-lg flex items-center justify-center font-black",
                theme === 'dark' ? "text-[#D4AF37]" : "text-[#2563EB]"
              )}>G</div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest">Instalar GSI Tracker</p>
                <p className="text-[10px] opacity-80">Tenha o app direto no seu celular!</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowInstallBanner(false)}
                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 rounded-lg"
              >
                Agora não
              </button>
              <button 
                onClick={handleInstallClick}
                className={cn(
                  "px-4 py-2 bg-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg active:scale-95 transition-all",
                  theme === 'dark' ? "text-[#D4AF37]" : "text-[#2563EB]"
                )}
              >
                Instalar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header
        className={cn(
          'backdrop-blur-md border-b sticky top-0 z-30 shadow-lg',
          isDark ? 'bg-[#0d1117]/95 border-white/[0.06]' : 'bg-white/90 border-slate-200',
        )}
      >
        <div className="max-w-5xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-lg shrink-0',
                isDark ? 'bg-[#D4AF37] shadow-[#D4AF37]/40' : 'bg-[#2563EB] shadow-[#2563EB]/50',
              )}
            >
              G
            </div>
            <h1
              className={cn(
                'font-black text-lg sm:text-xl tracking-tighter hidden sm:block',
                isDark ? 'text-white' : 'text-slate-900',
              )}
            >
              GSI TRACKER
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={cn(
                'p-2 rounded-full transition-all active:scale-90',
                isDark
                  ? 'bg-white/10 text-amber-300 hover:bg-white/15'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300',
              )}
              title={isDark ? 'Modo claro' : 'Modo escuro'}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button
              type="button"
              onClick={shareToWhatsApp}
              disabled={isExporting}
              className={cn(
                'flex items-center justify-center w-10 h-10 sm:w-auto sm:h-10 sm:px-4 rounded-full font-bold transition-all active:scale-95 disabled:opacity-50',
                'bg-[#25D366] hover:bg-[#128C7E] text-white shadow-[0_0_12px_rgba(37,211,102,0.35)]',
              )}
              title="WhatsApp"
            >
              {isExporting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Share2 size={18} className="sm:hidden" />
                  <span className="hidden sm:flex items-center gap-2">
                    <MessageCircle size={18} />
                    WHATSAPP
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={exportPDF}
              disabled={isExporting}
              className={cn(
                'flex items-center justify-center w-10 h-10 sm:w-auto sm:h-10 sm:px-5 rounded-full font-bold transition-all active:scale-95 disabled:opacity-50 text-white shadow-lg',
                isDark
                  ? 'bg-[#D4AF37] hover:bg-[#c9a432] shadow-[#D4AF37]/25'
                  : 'bg-[#2563EB] hover:bg-[#1d4ed8] shadow-[#2563EB]/30',
              )}
              title="PDF"
            >
              {isExporting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Download size={18} className="sm:hidden" />
                  <span className="hidden sm:flex items-center gap-2">
                    <Download size={18} />
                    PDF
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className={cn(
                'p-2 rounded-full transition-colors',
                isDark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-slate-100 text-slate-400',
              )}
            >
              <MoreVertical size={22} />
            </button>
          </div>
        </div>

        {/* Abas estilo app Android */}
        <div
          className={cn(
            'max-w-5xl mx-auto px-3 sm:px-4 pb-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
            isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100',
          )}
        >
          <nav className="flex gap-2 min-w-max py-1" aria-label="Navegação principal">
            {(
              [
                { id: 'painel' as const, label: 'PAINEL', Icon: LayoutDashboard },
                { id: 'analises' as const, label: 'ANÁLISES', Icon: LineChart },
                { id: 'projeto' as const, label: 'PROJETO', Icon: MapPin },
                { id: 'relatorios' as const, label: 'RELATÓRIOS', Icon: FileText },
              ] as const
            ).map(({ id, label, Icon }) => {
              const active = mainTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMainTab(id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all shrink-0',
                    active
                      ? isDark
                        ? 'text-white shadow-md'
                        : 'text-white shadow-md'
                      : isDark
                        ? 'bg-[#161b22] text-slate-400 hover:text-slate-200 border border-white/[0.06]'
                        : 'bg-slate-100 text-slate-500 hover:text-slate-700 border border-slate-200',
                  )}
                  style={
                    active
                      ? {
                          backgroundColor: accentBlue,
                          boxShadow: `0 4px 14px ${accentBlue}55`,
                        }
                      : undefined
                  }
                >
                  <Icon size={16} strokeWidth={2.25} />
                  {label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 sm:py-8">
        {/* ——— PAINEL (dashboard estilo Android) ——— */}
        {mainTab === 'painel' && (
          <div className="space-y-4 mb-8">
            <section
              className={cn(
                'rounded-2xl p-5 sm:p-6 border shadow-xl',
                cardBg,
                cardBorder,
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className={cn(
                    'w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-lg sm:text-xl font-black border-2 shrink-0',
                    isDark
                      ? 'bg-[#21262d] border-[#30363d] text-white'
                      : 'bg-slate-100 border-slate-200 text-slate-800',
                  )}
                >
                  {profileInitials}
                </div>
                <div className="shrink-0 rounded-xl overflow-hidden border border-white/10 bg-white p-1">
                  <img
                    src={profileQrUrl}
                    alt="QR do perfil"
                    width={72}
                    height={72}
                    className="w-[72px] h-[72px] sm:w-20 sm:h-20"
                  />
                </div>
              </div>
              <h2
                className={cn(
                  'mt-4 text-base sm:text-lg font-black uppercase tracking-tight leading-snug',
                  isDark ? 'text-white' : 'text-slate-900',
                )}
              >
                {name.trim() || 'NOME DO COLABORADOR'}
              </h2>
              <div className="mt-3 inline-flex">
                <span
                  className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white"
                  style={{ backgroundColor: accentBlue }}
                >
                  {role || 'CARGO'}
                </span>
              </div>
            </section>

            <section
              className={cn(
                'rounded-2xl p-5 sm:p-6 border shadow-xl',
                cardBg,
                cardBorder,
              )}
            >
              <p
                className={cn(
                  'text-[10px] font-black uppercase tracking-[0.2em] mb-4',
                  isDark ? 'text-slate-500' : 'text-slate-400',
                )}
              >
                TOTAL DE HORAS (MÊS)
              </p>
              <div className="flex flex-col items-center">
                <div className="relative w-44 h-44 sm:w-52 sm:h-52">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {(() => {
                      const r = 38;
                      const c = 2 * Math.PI * r;
                      const g = progressToGoal * c;
                      const b = Math.max(0, (1 - progressToGoal) * c);
                      return (
                        <>
                          <circle
                            cx="50"
                            cy="50"
                            r={r}
                            fill="none"
                            stroke={isDark ? '#21262d' : '#e2e8f0'}
                            strokeWidth="10"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r={r}
                            fill="none"
                            stroke={accentGreen}
                            strokeWidth="10"
                            strokeDasharray={`${g} ${c}`}
                            strokeLinecap="round"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r={r}
                            fill="none"
                            stroke={accentBlue}
                            strokeWidth="10"
                            strokeDasharray={`${b} ${c}`}
                            strokeDashoffset={-g}
                            strokeLinecap="round"
                          />
                        </>
                      );
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span
                      className={cn(
                        'text-2xl sm:text-3xl font-black tabular-nums',
                        isDark ? 'text-white' : 'text-slate-900',
                      )}
                    >
                      {totalHours}h
                    </span>
                  </div>
                </div>
                <p
                  className={cn(
                    'mt-2 text-xs font-bold uppercase tracking-widest',
                    isDark ? 'text-slate-500' : 'text-slate-400',
                  )}
                >
                  {totalHours}H / META {hourGoal}H
                </p>
              </div>
            </section>

            <section
              className={cn(
                'rounded-2xl p-5 sm:p-6 border shadow-xl',
                cardBg,
                cardBorder,
              )}
            >
              <p
                className={cn(
                  'text-[10px] font-black uppercase tracking-[0.2em] mb-2',
                  isDark ? 'text-slate-500' : 'text-slate-400',
                )}
              >
                VALOR ESTIMADO
              </p>
              <p
                className="text-3xl sm:text-4xl font-black tabular-nums"
                style={{ color: accentGreen }}
              >
                €{totalEarnings.toFixed(2)}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {[0.45, 0.72, 0.55, 0.9].map((w, i) => (
                  <div
                    key={i}
                    className={cn('h-2 rounded-full overflow-hidden', isDark ? 'bg-[#21262d]' : 'bg-slate-100')}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${w * 100}%`,
                        backgroundColor: accentBlue,
                        opacity: 0.55 + i * 0.1,
                      }}
                    />
                  </div>
                ))}
              </div>
            </section>

            <p
              className={cn(
                'text-center text-[10px] uppercase tracking-widest font-bold px-2',
                isDark ? 'text-slate-500' : 'text-slate-400',
              )}
            >
              Ajuste valor/hora e meta em ⋮ → Configurações. Marcações em PROJETO.
            </p>
          </div>
        )}

        {/* ——— ANÁLISES ——— */}
        {mainTab === 'analises' && (
          <section
            className={cn(
              'rounded-2xl p-6 border shadow-xl mb-8',
              cardBg,
              cardBorder,
            )}
          >
            <h2
              className={cn(
                'text-sm font-black uppercase tracking-widest mb-6',
                isDark ? 'text-white' : 'text-slate-900',
              )}
            >
              Resumo por mês
            </h2>
            {history.length === 0 ? (
              <p className={cn('text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
                Ainda não há dados salvos. Registre dias na aba PROJETO.
              </p>
            ) : (
              <div className="space-y-4">
                {history.slice(0, 8).map((item) => {
                  const maxH = Math.max(...history.map((h) => h.hours), 1);
                  const barW = (item.hours / maxH) * 100;
                  return (
                    <div key={item.month}>
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-wider mb-1">
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{item.month}</span>
                        <span style={{ color: accentGreen }}>{item.hours}h</span>
                      </div>
                      <div className={cn('h-2 rounded-full overflow-hidden', isDark ? 'bg-[#21262d]' : 'bg-slate-100')}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${barW}%`, backgroundColor: accentBlue }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ——— RELATÓRIOS ——— */}
        {mainTab === 'relatorios' && (
          <section
            className={cn(
              'rounded-2xl p-6 border shadow-xl mb-8 space-y-4',
              cardBg,
              cardBorder,
            )}
          >
            <h2
              className={cn(
                'text-sm font-black uppercase tracking-widest',
                isDark ? 'text-white' : 'text-slate-900',
              )}
            >
              Exportar
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={exportPDF}
                disabled={isExporting}
                className={cn(
                  'py-4 rounded-xl font-black uppercase text-xs tracking-widest text-white disabled:opacity-50',
                )}
                style={{ backgroundColor: accentBlue }}
              >
                Baixar PDF
              </button>
              <button
                type="button"
                onClick={shareToWhatsApp}
                disabled={isExporting}
                className="py-4 rounded-xl font-black uppercase text-xs tracking-widest bg-[#25D366] text-white disabled:opacity-50"
              >
                Enviar (WhatsApp)
              </button>
            </div>
            <p className={cn('text-[10px] uppercase tracking-widest', isDark ? 'text-slate-500' : 'text-slate-400')}>
              Backup e histórico completo: menu ⋮ → Configurações
            </p>
          </section>
        )}

        {/* ——— PROJETO: formulário + marcações ——— */}
        {mainTab === 'projeto' && (
          <>
        <section className={cn(
          "rounded-2xl p-6 shadow-xl border mb-8 transition-colors duration-300",
          isDark ? `${cardBg} ${cardBorder}` : "bg-white border-slate-200"
        )}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className={cn(
                "text-xs font-black flex items-center gap-2 uppercase tracking-widest",
                theme === 'dark' ? "text-white/40" : "text-slate-400"
              )}>
                <User size={12} /> NOME DO COLABORADOR
              </label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Digite seu nome completo"
                className={cn(
                  "w-full px-4 py-3 border rounded-xl focus:ring-2 outline-none transition-all placeholder:text-white/20",
                  theme === 'dark' ? "bg-black border-white/10 text-white focus:ring-[#D4AF37]" : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-[#2563EB]"
                )}
              />
            </div>
            <div className="space-y-2">
              <label className={cn(
                "text-xs font-black flex items-center gap-2 uppercase tracking-widest",
                theme === 'dark' ? "text-white/40" : "text-slate-400"
              )}>
                <Briefcase size={12} /> CARGO
              </label>
              <div className="flex gap-4">
                {['Oficial', 'Ajudante'].map((option) => (
                  <button
                    key={option}
                    onClick={() => setRole(option as any)}
                    className={cn(
                      "flex-1 py-3 rounded-xl border font-bold transition-all active:scale-95 uppercase tracking-widest text-xs",
                      role === option 
                        ? theme === 'dark' ? "bg-[#D4AF37] border-[#D4AF37] text-white shadow-[#D4AF37]/30" : "bg-[#2563EB] border-[#2563EB] text-white shadow-[#2563EB]/30"
                        : theme === 'dark' 
                          ? "bg-black border-white/10 text-white/40 hover:border-white/20"
                          : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300"
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className={cn(
                "text-xs font-black flex items-center gap-2 uppercase tracking-widest",
                theme === 'dark' ? "text-white/40" : "text-slate-400"
              )}>
                <Briefcase size={12} /> OBRA PADRÃO (OPCIONAL)
              </label>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={defaultProject}
                  onChange={(e) => setDefaultProject(e.target.value)}
                  placeholder="Ex: San Carlos Can Brisa"
                  list="project-options"
                  className={cn(
                    "flex-grow px-4 py-3 border rounded-xl focus:ring-2 outline-none transition-all placeholder:text-white/20",
                    theme === 'dark' ? "bg-black border-white/10 text-white focus:ring-[#D4AF37]" : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-[#2563EB]"
                  )}
                />
                <button 
                  onClick={applyDefaultProject}
                  className={cn(
                    "px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95",
                    theme === 'dark' ? "bg-[#D4AF37] text-white shadow-[#D4AF37]/30" : "bg-[#2563EB] text-white shadow-[#2563EB]/30"
                  )}
                >
                  APLICAR A TODOS
                </button>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className={cn(
                "text-xs font-black flex items-center gap-2 uppercase tracking-widest",
                theme === 'dark' ? "text-white/40" : "text-slate-400"
              )}>
                <CalendarIcon size={12} /> PERÍODO
              </label>
              <div className={cn(
                "flex items-center justify-between border rounded-xl px-4 py-3",
                theme === 'dark' ? "bg-[#141414] border-white/10" : "bg-slate-50 border-slate-200"
              )}>
                <button onClick={() => changeMonth(-1)} className={cn(
                  "p-1 rounded-lg transition-colors",
                  theme === 'dark' ? "hover:bg-white/10" : "hover:bg-slate-200"
                )}>
                  <ChevronLeft size={20} />
                </button>
                <span className={cn(
                  "font-black uppercase tracking-widest",
                  theme === 'dark' ? "text-white" : "text-slate-900"
                )}>
                  {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <button onClick={() => changeMonth(1)} className={cn(
                  "p-1 rounded-lg transition-colors",
                  theme === 'dark' ? "hover:bg-white/10" : "hover:bg-slate-200"
                )}>
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className={cn(
                "text-xs font-black flex items-center gap-2 uppercase tracking-widest",
                theme === 'dark' ? "text-white/40" : "text-slate-400"
              )}>
                <PenTool size={12} /> ASSINATURA DIGITAL
              </label>
              <div className={cn(
                "flex items-center gap-4 p-4 border rounded-xl",
                theme === 'dark' ? "bg-[#141414] border-white/10" : "bg-slate-50 border-slate-200"
              )}>
                {signature ? (
                  <div className="flex-grow flex items-center justify-between">
                    <img src={signature} alt="Sua Assinatura" className={cn(
                      "h-12 object-contain rounded p-1",
                      theme === 'dark' ? "bg-white/5" : "bg-white shadow-sm"
                    )} />
                    <button 
                      onClick={() => setIsSignatureOpen(true)}
                      className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        theme === 'dark' ? "text-[#D4AF37] hover:text-[#b8962f]" : "text-[#2563EB] hover:text-[#1d4ed8]"
                      )}
                    >
                      ALTERAR ASSINATURA
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsSignatureOpen(true)}
                    className={cn(
                      "flex-grow flex items-center justify-center gap-2 py-2 border-2 border-dashed rounded-lg transition-all group",
                      theme === 'dark' ? "border-white/10 text-white/40 hover:border-[#D4AF37]/50 hover:text-white" : "border-slate-300 text-slate-400 hover:border-[#2563EB]/50 hover:text-slate-600"
                    )}
                  >
                    <PenTool size={16} className={cn(
                      "group-hover:text-current",
                      theme === 'dark' ? "group-hover:text-[#D4AF37]" : "group-hover:text-[#2563EB]"
                    )} />
                    <span className="text-[10px] font-black uppercase tracking-widest">ASSINAR AGORA</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Summary */}
          <div className={cn(
            "mt-6 pt-6 border-t flex items-center justify-between",
            theme === 'dark' ? "border-white/5" : "border-slate-100"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center",
                theme === 'dark' ? "bg-[#D4AF37]/10 text-[#D4AF37]" : "bg-[#2563EB]/10 text-[#2563EB]"
              )}>
                <Clock size={24} />
              </div>
              <div>
                <p className={cn(
                  "text-[10px] font-black uppercase tracking-[0.2em]",
                  theme === 'dark' ? "text-white/40" : "text-slate-400"
                )}>TOTAL DO MÊS</p>
                <p className={cn(
                  "text-2xl font-black",
                  theme === 'dark' ? "text-white" : "text-slate-900"
                )}>{totalHours} <span className={cn(
                  "text-xs font-normal",
                  theme === 'dark' ? "text-white/40" : "text-slate-400"
                )}>horas</span></p>
              </div>
            </div>
            <div className="text-right">
              <p className={cn(
                "text-[10px] font-black uppercase tracking-[0.2em]",
                theme === 'dark' ? "text-white/40" : "text-slate-400"
              )}>VALOR A RECEBER</p>
              <div className="flex items-center justify-end gap-1">
                <DollarSign size={20} className="text-emerald-500" />
                <p className="text-2xl font-black text-emerald-500">€ {totalEarnings.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Daily Entries */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className={cn(
              "text-xs font-black uppercase tracking-[0.2em]",
              theme === 'dark' ? "text-white/40" : "text-slate-400"
            )}>MARCAÇÕES DIÁRIAS</h2>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  if (confirm('Tem certeza que deseja limpar todos os dados deste mês?')) {
                    setEntries({});
                    db.entries.where('monthKey').equals(monthKey).delete();
                  }
                }}
                className={cn(
                  "text-[10px] font-black flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all uppercase tracking-widest",
                  theme === 'dark' ? "text-[#D4AF37] hover:text-[#b8962f] hover:bg-[#D4AF37]/10" : "text-[#2563EB] hover:text-[#1d4ed8] hover:bg-[#2563EB]/10"
                )}
              >
                <Trash2 size={12} /> LIMPAR MÊS
              </button>
              <span className={cn(
                "text-sm",
                theme === 'dark' ? "text-slate-500" : "text-slate-400"
              )}>{days.length} dias no mês</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout">
              {days.map((day, idx) => {
                const dayNum = day.getDate();
                const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                
                return (
                  <motion.div 
                    key={day.toISOString()}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={cn(
                      "rounded-2xl p-4 shadow-xl border transition-all duration-300",
                      entries[dayNum]?.isOffDay 
                        ? theme === 'dark' ? "border-white/5 bg-white/5 opacity-60" : "border-slate-100 bg-slate-50 opacity-60"
                        : theme === 'dark' 
                          ? isWeekend ? "border-[#D4AF37]/20 bg-black/80 hover:border-white/20" : "border-white/5 bg-black hover:border-white/20"
                          : isWeekend ? "border-[#2563EB]/20 bg-slate-100 hover:border-slate-300" : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <div className="flex flex-col md:flex-row gap-4">
                      {/* Day Indicator */}
                      <div className="flex items-center gap-3 md:w-24 shrink-0">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black",
                          isWeekend 
                            ? theme === 'dark' ? "bg-[#D4AF37] text-white shadow-[#D4AF37]/30" : "bg-[#2563EB] text-white shadow-[#2563EB]/30"
                            : theme === 'dark' ? "bg-black text-white/60" : "bg-slate-200 text-slate-600"
                        )}>
                          <span className="text-[10px] leading-none uppercase tracking-tighter">{format(day, 'EEE', { locale: ptBR })}</span>
                          <span className="text-xl leading-none">{dayNum}</span>
                        </div>
                        <div className={cn(
                          "md:hidden font-black uppercase tracking-widest text-xs flex items-center gap-2",
                          theme === 'dark' ? "text-white/80" : "text-slate-700"
                        )}>
                           {format(day, 'EEEE', { locale: ptBR })}
                           {isWeekend && (
                             <span className={cn(
                               "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter",
                               theme === 'dark' ? "bg-[#D4AF37]/20 text-[#D4AF37]" : "bg-[#2563EB]/20 text-[#2563EB]"
                             )}>FDS</span>
                           )}
                           {entries[dayNum]?.isOffDay && (
                             <span className={cn(
                               "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter",
                               theme === 'dark' ? "bg-white/10 text-white/40" : "bg-slate-200 text-slate-500"
                             )}>FOLGA</span>
                           )}
                        </div>
                      </div>

                      {/* Inputs */}
                      <div className={cn(
                        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-grow",
                        entries[dayNum]?.isOffDay && "opacity-80"
                      )}>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className={cn(
                              "text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
                              theme === 'dark' ? "text-white/30" : "text-slate-400"
                            )}>
                              <Clock size={10} /> HORAS
                            </label>
                            {dayNum > 1 && !entries[dayNum]?.marked && (
                              <button 
                                onClick={() => copyPrevious(dayNum)}
                                className={cn(
                                  "text-[10px] font-black flex items-center gap-0.5 uppercase tracking-widest",
                                  theme === 'dark' ? "text-[#D4AF37] hover:text-[#b8962f]" : "text-[#2563EB] hover:text-[#1d4ed8]"
                                )}
                                title="Copiar do dia anterior"
                              >
                                <Plus size={10} /> REPETIR
                              </button>
                            )}
                          </div>
                          <select 
                            disabled={entries[dayNum]?.marked}
                            value={entries[dayNum]?.hours || ''}
                            onChange={(e) => handleInputChange(dayNum, 'hours', e.target.value)}
                            className={cn(
                              "w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none text-sm appearance-none cursor-pointer",
                              theme === 'dark' ? "bg-black border-white/10 text-white focus:ring-[#D4AF37]" : "bg-white border-slate-200 text-slate-900 focus:ring-[#2563EB]",
                              entries[dayNum]?.marked && "opacity-60 cursor-not-allowed"
                            )}
                          >
                            <option value="">Selecione</option>
                            {hourOptions.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className={cn(
                            "text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
                            theme === 'dark' ? "text-white/30" : "text-slate-400"
                          )}>
                            <Briefcase size={10} /> OBRA
                          </label>
                          <input 
                            type="text" 
                            placeholder="Nome da obra"
                            list="project-options"
                            disabled={entries[dayNum]?.marked}
                            value={entries[dayNum]?.project || ''}
                            onChange={(e) => handleInputChange(dayNum, 'project', e.target.value)}
                            className={cn(
                              "w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none text-sm",
                              theme === 'dark' ? "bg-black border-white/10 text-white focus:ring-[#D4AF37] placeholder:text-white/10" : "bg-white border-slate-200 text-slate-900 focus:ring-[#2563EB] placeholder:text-slate-300",
                              entries[dayNum]?.marked && "opacity-60 cursor-not-allowed"
                            )}
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <button
                            disabled={entries[dayNum]?.marked || !entries[dayNum]?.hours || !entries[dayNum]?.project}
                            onClick={() => handleMarkDay(dayNum)}
                            className={cn(
                              "flex-1 py-2 rounded-lg font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2",
                              entries[dayNum]?.marked
                                ? entries[dayNum]?.isOffDay 
                                  ? "hidden" 
                                  : "bg-emerald-500 text-white shadow-emerald-500/30 cursor-default"
                                : (!entries[dayNum]?.hours || !entries[dayNum]?.project)
                                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                                  : theme === 'dark' 
                                    ? "bg-[#D4AF37] text-white shadow-[#D4AF37]/30 hover:bg-[#b8962f]" 
                                    : "bg-[#2563EB] text-white shadow-[#2563EB]/30 hover:bg-[#1d4ed8]"
                            )}
                          >
                            {entries[dayNum]?.marked ? (
                              <>MARCADO!</>
                            ) : (
                              <><Save size={12} /> MARCA PONTO</>
                            )}
                          </button>

                          {!entries[dayNum]?.marked && (
                            <button
                              onClick={() => handleMarkOffDay(dayNum)}
                              className={cn(
                                "py-2 px-4 rounded-lg font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2 border-2",
                                theme === 'dark' 
                                  ? "border-white/10 text-white/50 hover:bg-white/5" 
                                  : "border-slate-200 text-slate-400 hover:bg-slate-50"
                              )}
                              title="Marcar como Folga ou Feriado"
                            >
                              FOLGA
                            </button>
                          )}

                          {entries[dayNum]?.marked && (
                            <button
                              onClick={() => handleResetDay(dayNum)}
                              className={cn(
                                "p-2 rounded-lg transition-all active:scale-95",
                                theme === 'dark' ? "bg-white/5 text-white/40 hover:bg-white/10" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                              )}
                              title="Desmarcar este dia"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}

                          {entries[dayNum]?.isOffDay && (
                            <div className="flex-1 py-2 rounded-lg font-black uppercase tracking-widest text-[10px] bg-slate-500 text-white flex items-center justify-center gap-2">
                              FOLGA / FERIADO
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
          </>
        )}
      </main>

      {/* Settings & History Sheet */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "fixed right-0 top-0 bottom-0 w-full max-w-md z-50 shadow-2xl flex flex-col border-l",
                theme === 'dark' ? "bg-[#1f1f1f] border-white/10" : "bg-white border-slate-200"
              )}
            >
              <div className={cn(
                "p-6 border-b flex items-center justify-between",
                theme === 'dark' ? "border-white/5" : "border-slate-100"
              )}>
                <div className="flex items-center gap-2">
                  <Settings className={cn(
                    theme === 'dark' ? "text-[#D4AF37]" : "text-[#2563EB]"
                  )} size={24} />
                  <h2 className={cn(
                    "text-xl font-black uppercase tracking-tighter",
                    theme === 'dark' ? "text-white" : "text-slate-900"
                  )}>CONFIGURAÇÕES</h2>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)} 
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    theme === 'dark' ? "hover:bg-white/10 text-white/60" : "hover:bg-slate-100 text-slate-400"
                  )}
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-6 space-y-8">
                {/* Hourly Rate Section */}
                <section className="space-y-4">
                  <div className={cn(
                    "flex items-center gap-2",
                    theme === 'dark' ? "text-white/80" : "text-slate-600"
                  )}>
                    <DollarSign size={20} className="text-emerald-500" />
                    <h3 className="font-black uppercase tracking-widest text-xs">VALOR POR HORA</h3>
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl border space-y-3",
                    theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-slate-50 border-slate-200"
                  )}>
                    <p className={cn(
                      "text-[10px] uppercase tracking-widest font-bold",
                      theme === 'dark' ? "text-white/40" : "text-slate-400"
                    )}>DEFINA SEU GANHO POR HORA</p>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <DollarSign size={16} className="text-emerald-500" />
                        <span className="font-black text-emerald-500">€</span>
                      </div>
                      <input 
                        type="number" 
                        value={hourlyRate || ''}
                        onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className={cn(
                          "w-full pl-14 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-black text-emerald-500",
                          theme === 'dark' ? "bg-[#1f1f1f] border-white/10" : "bg-white border-slate-200"
                        )}
                      />
                    </div>
                    <p className={cn(
                      "text-[10px] uppercase tracking-widest font-bold pt-2",
                      theme === 'dark' ? "text-white/40" : "text-slate-400"
                    )}>META DE HORAS NO MÊS (PAINEL)</p>
                    <input 
                      type="number" 
                      min={1}
                      max={744}
                      value={monthlyHourGoal || ''}
                      onChange={(e) => setMonthlyHourGoal(Math.max(1, parseInt(e.target.value, 10) || 160))}
                      placeholder="160"
                      className={cn(
                        "w-full px-4 py-3 border rounded-xl focus:ring-2 outline-none font-black",
                        theme === 'dark' 
                          ? "bg-[#1f1f1f] border-white/10 text-white focus:ring-[#D4AF37]" 
                          : "bg-white border-slate-200 text-slate-900 focus:ring-[#2563EB]"
                      )}
                    />
                  </div>
                </section>

                {/* Quick Actions Section */}
                <section className="space-y-4">
                  <div className={cn(
                    "flex items-center gap-2",
                    theme === 'dark' ? "text-white/80" : "text-slate-600"
                  )}>
                    <CalendarIcon size={20} className={theme === 'dark' ? "text-[#D4AF37]" : "text-[#2563EB]"} />
                    <h3 className="font-black uppercase tracking-widest text-xs">AÇÕES RÁPIDAS</h3>
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl border space-y-4",
                    theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-slate-50 border-slate-200"
                  )}>
                    <button 
                      onClick={markWeekendsAsOff}
                      className={cn(
                        "w-full py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2",
                        theme === 'dark' ? "bg-white/5 text-white hover:bg-white/10" : "bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                      )}
                    >
                      <CalendarIcon size={14} /> MARCAR FINAIS DE SEMANA COMO FOLGA
                    </button>
                    <p className={cn(
                      "text-[8px] uppercase tracking-widest font-bold text-center",
                      theme === 'dark' ? "text-white/20" : "text-slate-400"
                    )}>ÚTIL PARA PREENCHER O MÊS MAIS RÁPIDO</p>
                  </div>
                </section>

                {/* Backup & Restore Section */}
                <section className="space-y-4">
                  <div className={cn(
                    "flex items-center gap-2",
                    theme === 'dark' ? "text-white/80" : "text-slate-600"
                  )}>
                    <Database size={20} />
                    <h3 className="font-black uppercase tracking-widest text-xs">DADOS E BACKUP</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={handleBackupData}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 border rounded-2xl transition-all group",
                        theme === 'dark' ? "bg-[#141414] border-white/5 hover:border-[#D4AF37]/50" : "bg-slate-50 border-slate-200 hover:border-[#2563EB]/50"
                      )}
                    >
                      <Download className={cn(
                        "group-hover:scale-110 transition-transform",
                        theme === 'dark' ? "text-[#D4AF37]" : "text-[#2563EB]"
                      )} size={24} />
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        theme === 'dark' ? "text-white/60" : "text-slate-500"
                      )}>BACKUP</span>
                    </button>
                    <label className={cn(
                      "flex flex-col items-center justify-center gap-2 p-4 border rounded-2xl transition-all group cursor-pointer",
                      theme === 'dark' ? "bg-[#141414] border-white/5 hover:border-[#D4AF37]/50" : "bg-slate-50 border-slate-200 hover:border-[#2563EB]/50"
                    )}>
                      <Upload className={cn(
                        "group-hover:scale-110 transition-transform",
                        theme === 'dark' ? "text-[#D4AF37]" : "text-[#2563EB]"
                      )} size={24} />
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        theme === 'dark' ? "text-white/60" : "text-slate-500"
                      )}>RESTAURAR</span>
                      <input type="file" accept=".json" onChange={handleRestoreData} className="hidden" />
                    </label>
                  </div>
                </section>

                {/* History Section */}
                <section className="space-y-4">
                  <div className={cn(
                    "flex items-center gap-2",
                    theme === 'dark' ? "text-white/80" : "text-slate-600"
                  )}>
                    <History size={20} />
                    <h3 className="font-black uppercase tracking-widest text-xs">HISTÓRICO DE MESES</h3>
                  </div>
                  <div className="space-y-3">
                    {history.length === 0 ? (
                      <div className={cn(
                        "text-center py-8 italic text-xs uppercase tracking-widest",
                        theme === 'dark' ? "text-white/20" : "text-slate-300"
                      )}>
                        NENHUM HISTÓRICO ENCONTRADO.
                      </div>
                    ) : (
                      history.map((item) => (
                        <div key={item.month} className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border",
                          theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-slate-50 border-slate-200"
                        )}>
                          <div>
                            <p className={cn(
                              "font-black uppercase tracking-tighter",
                              theme === 'dark' ? "text-white" : "text-slate-900"
                            )}>{item.month}</p>
                            <p className={cn(
                              "text-[10px] uppercase tracking-widest font-bold",
                              theme === 'dark' ? "text-white/40" : "text-slate-400"
                            )}>{item.days} DIAS TRABALHADOS</p>
                          </div>
                          <div className="text-right">
                            <p className={cn(
                              "font-black uppercase tracking-tighter",
                              theme === 'dark' ? "text-[#D4AF37]" : "text-[#2563EB]"
                            )}>{item.hours}H</p>
                            {hourlyRate > 0 && (
                              <div className="flex items-center justify-end gap-0.5">
                                <DollarSign size={10} className="text-emerald-500" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                                  € {(item.hours * hourlyRate).toFixed(2)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>

              <div className={cn(
                "p-6 border-t",
                theme === 'dark' ? "border-white/5 bg-[#141414]" : "border-slate-100 bg-slate-50"
              )}>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className={cn(
                    "w-full py-4 text-white rounded-2xl font-black uppercase tracking-[0.2em] active:scale-95 transition-all",
                    theme === 'dark' ? "bg-[#D4AF37] shadow-[#D4AF37]/30" : "bg-[#2563EB] shadow-[#2563EB]/30"
                  )}
                >
                  SALVAR E FECHAR
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Signature Modal */}
      <AnimatePresence>
        {isSignatureOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSignatureOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg z-[70] rounded-3xl shadow-2xl border flex flex-col overflow-hidden",
                theme === 'dark' ? "bg-[#1f1f1f] border-white/10" : "bg-white border-slate-200"
              )}
            >
              <div className={cn(
                "p-6 border-b flex items-center justify-between",
                theme === 'dark' ? "border-white/5 bg-[#141414]" : "border-slate-100 bg-slate-50"
              )}>
                <div className="flex items-center gap-2">
                  <PenTool className={cn(
                    theme === 'dark' ? "text-[#D4AF37]" : "text-[#2563EB]"
                  )} size={20} />
                  <h2 className={cn(
                    "text-sm font-black uppercase tracking-widest",
                    theme === 'dark' ? "text-white" : "text-slate-900"
                  )}>ASSINATURA DIGITAL</h2>
                </div>
                <button 
                  onClick={() => setIsSignatureOpen(false)} 
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    theme === 'dark' ? "hover:bg-white/10 text-white/40" : "hover:bg-slate-100 text-slate-400"
                  )}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 bg-white m-4 rounded-2xl shadow-inner">
                <SignatureCanvas 
                  ref={sigPad}
                  penColor="black"
                  canvasProps={{
                    className: "w-full h-64 cursor-crosshair"
                  }}
                />
              </div>

              <div className={cn(
                "p-6 border-t flex gap-3",
                theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-slate-50 border-slate-100"
              )}>
                <button 
                  onClick={handleClearSignature}
                  className={cn(
                    "flex-1 py-4 border rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all",
                    theme === 'dark' ? "border-white/10 text-white/60 hover:bg-white/5" : "border-slate-200 text-slate-500 hover:bg-slate-100"
                  )}
                >
                  LIMPAR
                </button>
                <button 
                  onClick={handleSaveSignature}
                  className={cn(
                    "flex-1 py-4 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all",
                    theme === 'dark' ? "bg-[#D4AF37] shadow-[#D4AF37]/30" : "bg-[#2563EB] shadow-[#2563EB]/30"
                  )}
                >
                  SALVAR ASSINATURA
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Hidden PDF Template */}
      <PDFTemplate data={workMonthData} innerRef={pdfRef} />

      {/* Floating Action Buttons for Mobile */}
      <div className="fixed bottom-6 right-6 sm:hidden z-40 flex flex-col gap-4">
        <button 
          onClick={shareToWhatsApp}
          disabled={isExporting}
          className="w-14 h-14 bg-[#25D366] text-white rounded-full shadow-[0_0_20px_rgba(37,211,102,0.5)] flex items-center justify-center active:scale-90 transition-all disabled:opacity-50"
          title="Compartilhar no WhatsApp"
        >
          {isExporting ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <MessageCircle size={24} />
          )}
        </button>
        <button 
          onClick={exportPDF}
          disabled={isExporting}
          className={cn(
            "w-14 h-14 text-white rounded-full flex items-center justify-center active:scale-90 transition-all disabled:opacity-50",
            theme === 'dark' ? "bg-[#D4AF37] shadow-[#D4AF37]/50" : "bg-[#2563EB] shadow-[#2563EB]/50"
          )}
          title="Gerar PDF"
        >
          {isExporting ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Download size={24} />
          )}
        </button>
      </div>
      <datalist id="project-options">
        <option value="San Carlos Can Brisa" />
      </datalist>
    </div>
  );
}
