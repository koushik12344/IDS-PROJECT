
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import RealTimeMonitor from './components/RealTimeMonitor';
import ReportsView from './components/ReportsView';
import AlertToast from './components/AlertToast';
import { ViewState, Packet, ThreatLevel, AttackType, Alert, ConnectionStatus } from './types';
import { analyzePacketThreat } from './services/geminiService';
import { ShieldAlert, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.DASHBOARD);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);
  const [selectedPacketForAnalysis, setSelectedPacketForAnalysis] = useState<Packet | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Session Statistics
  const [sessionStats, setSessionStats] = useState({ total: 0, threats: 0 });

  // Connection State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [isSimulating, setIsSimulating] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  const connectToBackend = () => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
      setConnectionStatus(ConnectionStatus.DISCONNECTED);
      return;
    }

    setConnectionStatus(ConnectionStatus.CONNECTING);
    setIsSimulating(false);

    try {
      const socket = new WebSocket('ws://localhost:8765');
      
      socket.onopen = () => {
        setConnectionStatus(ConnectionStatus.CONNECTED);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const newPacket: Packet = {
            id: data.id || Math.random().toString(36).substr(2, 9),
            timestamp: data.timestamp || new Date().toLocaleString(),
            sourceIP: data.sourceIP || 'Unknown',
            destIP: data.destIP || 'Unknown',
            protocol: data.protocol || 'TCP',
            length: data.length || 0,
            flag: data.flag || 'None',
            threatLevel: (data.threatLevel as ThreatLevel) || ThreatLevel.LOW,
            attackType: (data.attackType as AttackType) || AttackType.NORMAL,
            confidence: data.confidence || 0,
            features: data.features || {}
          };
          addPacket(newPacket);
        } catch (e) {
          console.error("Failed to parse packet", e);
        }
      };

      socket.onclose = () => {
        setConnectionStatus(ConnectionStatus.DISCONNECTED);
        wsRef.current = null;
      };

      socket.onerror = () => {
        setConnectionStatus(ConnectionStatus.ERROR);
        wsRef.current = null;
      };

      wsRef.current = socket;
    } catch (e) {
      setConnectionStatus(ConnectionStatus.ERROR);
    }
  };

  const addPacket = (newPacket: Packet) => {
    setSessionStats(prev => ({
      total: prev.total + 1,
      threats: newPacket.attackType !== AttackType.NORMAL ? prev.threats + 1 : prev.threats
    }));

    setPackets(prev => {
        const updated = [...prev, newPacket];
        return updated.slice(-100);
    });
    
    if (newPacket.threatLevel === ThreatLevel.HIGH || newPacket.threatLevel === ThreatLevel.CRITICAL) {
      setActiveAlert({
        id: newPacket.id,
        packetId: newPacket.id,
        type: newPacket.attackType,
        level: newPacket.threatLevel,
        timestamp: newPacket.timestamp,
        message: `Anomalous activity detected from ${newPacket.sourceIP} [Type: ${newPacket.attackType}]`
      });
    }
  };

  // Traffic Simulation
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isSimulating && connectionStatus !== ConnectionStatus.CONNECTED) {
      interval = setInterval(() => {
        const isAttack = Math.random() > 0.85; // 15% attack rate for visuals
        const attackTypes = [AttackType.DOS, AttackType.PROBE, AttackType.DDOS];
        const type = isAttack 
          ? attackTypes[Math.floor(Math.random() * attackTypes.length)] 
          : AttackType.NORMAL;

        const newPacket: Packet = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleString(),
          sourceIP: `192.168.1.${Math.floor(Math.random() * 255)}`,
          destIP: `10.42.0.${Math.floor(Math.random() * 255)}`,
          protocol: Math.random() > 0.5 ? 'TCP' : 'UDP',
          length: Math.floor(Math.random() * 1200) + 64,
          flag: isAttack ? 'SYN' : 'ACK',
          threatLevel: isAttack ? ThreatLevel.HIGH : ThreatLevel.LOW,
          attackType: type,
          confidence: isAttack ? 0.92 : 0.02,
          features: { }
        };

        addPacket(newPacket);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isSimulating, connectionStatus]);

  const handleAnalyzePacket = async (packet: Packet) => {
    setIsAnalyzing(true);
    setSelectedPacketForAnalysis(packet);
    setAnalysisResult('');
    const result = await analyzePacketThreat(packet);
    setAnalysisResult(result);
    setIsAnalyzing(false);
  };

  const isSystemActive = connectionStatus === ConnectionStatus.CONNECTED || isSimulating;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      <Sidebar currentView={view} setView={setView} />
      
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Top Header Bar */}
        <div className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center justify-between px-6 z-10">
           <div className="flex items-center gap-3">
             <div className="bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                <ShieldAlert className="text-emerald-500" size={18} />
             </div>
             <h2 className="font-bold text-slate-100 uppercase tracking-tight">
               {view === ViewState.DASHBOARD ? 'Security Overview' : view === ViewState.REALTIME ? 'Real-Time Intelligence' : 'Security Reports'}
             </h2>
           </div>
           
           <div className="flex items-center gap-6">
             <div className="flex flex-col items-end">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${
                   isSystemActive 
                   ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                   : 'bg-slate-900 border-slate-700 text-slate-500'
                }`}>
                   <div className={`w-2 h-2 rounded-full ${isSystemActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></div>
                   <span className="text-[10px] font-bold tracking-widest uppercase">System Online</span>
                </div>
                <span className="text-[9px] text-slate-500 mt-1 uppercase font-mono">IDS v2.0 Enterprise</span>
             </div>
           </div>
        </div>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-auto p-6 relative">
            <div className="scan-line"></div>
            {view === ViewState.DASHBOARD && (
              <Dashboard 
                packets={packets} 
                totalPackets={sessionStats.total}
                totalThreats={sessionStats.threats}
              />
            )}
            {view === ViewState.REALTIME && (
              <RealTimeMonitor 
                packets={packets} 
                onAnalyze={handleAnalyzePacket}
                connectionStatus={connectionStatus}
                onToggleConnection={connectToBackend}
                isSimulating={isSimulating}
                onToggleSimulation={() => setIsSimulating(!isSimulating)}
              />
            )}
            {view === ViewState.REPORTS && (
              <ReportsView 
                packets={packets}
              />
            )}
        </div>

        {/* AI Insight Overlay */}
        {selectedPacketForAnalysis && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-6">
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-emerald-500 p-2 rounded">
                        <ShieldAlert className="text-slate-900" size={20} />
                      </div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter">AI Threat Intel Report</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-950 p-3 rounded border border-slate-800">
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Source Address</p>
                        <p className="text-sm font-mono text-emerald-400">{selectedPacketForAnalysis.sourceIP}</p>
                      </div>
                      <div className="bg-slate-950 p-3 rounded border border-slate-800">
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Packet Type</p>
                        <p className="text-sm font-mono text-emerald-400">{selectedPacketForAnalysis.protocol} / {selectedPacketForAnalysis.attackType}</p>
                      </div>
                    </div>

                    <div className="bg-slate-950/80 p-5 rounded-lg border border-slate-800 min-h-[140px] relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-5">
                          <Loader2 size={80} className={isAnalyzing ? 'animate-spin' : ''} />
                        </div>
                        {isAnalyzing ? (
                            <div className="flex flex-col items-center justify-center h-24 gap-4 text-emerald-400">
                                <Loader2 className="animate-spin" size={32} />
                                <span className="text-xs font-bold tracking-widest uppercase animate-pulse">Neural Engine Processing...</span>
                            </div>
                        ) : (
                            <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                              {analysisResult}
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={() => setSelectedPacketForAnalysis(null)}
                        className="mt-8 w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all text-white shadow-lg shadow-emerald-900/20"
                    >
                        Dismiss Analysis
                    </button>
                </div>
            </div>
        )}

        <AlertToast alert={activeAlert} onClose={() => setActiveAlert(null)} />
      </main>
    </div>
  );
};

export default App;
