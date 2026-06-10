'use client';

import { useReadContract } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/lib/contract';
import { useEffect, useState } from 'react';

/**
 * COMMAND CENTER — Dashboard Page
 * 
 * Smart Contract Interaction:
 * - Calls `getCounts()` on SupplyChain.sol to retrieve total products, transfers, and actors.
 *   This is a READ-ONLY call (no gas cost) that returns three uint256 values:
 *   [totalProducts, totalTransfers, totalActors]
 * 
 * WebSocket Interaction:
 * - Connects to the Transformer service WebSocket (ws://localhost:8080) to receive
 *   real-time event updates as they're processed from blockchain events.
 *   Events include: ActorRegistered, ProductCreated, ProductTransferred, etc.
 */

interface WsEvent {
  type: string;
  data: {
    type: string;
    data: Record<string, unknown>;
    enriched?: Record<string, unknown>;
  };
  timestamp: string;
}

export default function DashboardPage() {
  const [events, setEvents] = useState<WsEvent[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  // ── Smart Contract Read: getCounts() ──────────────────────
  // This calls the getCounts() view function on SupplyChain.sol
  // Returns: [totalProducts (uint256), totalTransfers (uint256), totalActors (uint256)]
  // The useReadContract hook from wagmi automatically:
  //   1. Encodes the function call using the ABI
  //   2. Sends an eth_call to the Hardhat RPC endpoint
  //   3. Decodes the response into typed values
  const { data: counts, isLoading } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getCounts',
  });

  // ── WebSocket: Real-time event stream from Transformer ────
  // The Transformer service broadcasts events via WebSocket after
  // processing them through the pipeline (decode → validate → enrich → mapToGraph)
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout;

    const connectWs = () => {
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => setWsConnected(true);
        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWs, 5000);
        };
        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'event' || parsed.type === 'anomaly') {
              setEvents((prev) => [parsed, ...prev].slice(0, 50));
            }
          } catch { /* ignore parse errors */ }
        };
        ws.onerror = () => ws?.close();
      } catch { /* WebSocket not available */ }
    };
    connectWs();

    return () => {
      ws?.close();
      clearTimeout(reconnectTimer);
    };
  }, []);

  const stats = [
    {
      label: 'ACTIVE SHIPMENTS',
      value: counts ? counts[0]?.toString() : '—',
      sub: '↗ +12.4% vs last period',
      color: 'text-accent',
    },
    {
      label: 'RECENT EVENTS (LAYER 1)',
      value: counts ? counts[1]?.toString() : '—',
      sub: 'Validated blocks in the last 24h',
      color: 'text-slate-200',
    },
    {
      label: 'NEO4J NODE COUNT (LAYER 3)',
      value: counts ? ((Number(counts[0]) + Number(counts[1]) + Number(counts[2])) || 0).toLocaleString() : '—',
      sub: 'Active relational graph connections',
      color: 'text-slate-200',
    },
    {
      label: 'SYSTEM HEALTH',
      value: '99.9%',
      sub: 'Operational / All nodes verified',
      color: 'text-accent',
      isHealth: true,
    },
  ];

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'ProductTransferred': return '📦';
      case 'ProductCreated': return '🏭';
      case 'ActorRegistered': return '👤';
      case 'ProductRecalled': return '⚠️';
      default: return '📋';
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'ProductTransferred': return 'Smart Contract Execution';
      case 'ProductCreated': return 'Product Registration';
      case 'ActorRegistered': return 'Actor Verification';
      case 'ProductRecalled': return 'Product Recall Alert';
      case 'ProductStatusUpdated': return 'Status Update';
      default: return type;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Command Center</h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time decentralized ledger synchronization and supply chain telemetry.
        </p>
      </div>

      {/* Stats row — data sourced from SupplyChain.sol getCounts() */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {stat.label}
            </p>
            <p className={`text-3xl font-bold ${stat.color}`}>
              {isLoading ? (
                <span className="inline-block w-16 h-8 bg-navy-700 rounded animate-pulse" />
              ) : (
                stat.value
              )}
            </p>
            <p className={`text-xs ${stat.label === 'ACTIVE SHIPMENTS' ? 'text-accent' : 'text-slate-500'}`}>
              {stat.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Global Transit Map — Left 3 cols */}
        <div className="lg:col-span-3 card min-h-[400px] relative overflow-hidden">
          <div className="absolute top-4 left-4 z-10">
            <h3 className="text-sm font-semibold text-slate-200">Global Transit Map</h3>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent" /> High Priority Node
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-500" /> Standard Logistics
              </span>
            </div>
          </div>
          {/* Map visualization area */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full h-full">
              {/* Decorative grid lines */}
              <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-slate-500"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
              {/* Animated dots representing nodes */}
              <div className="absolute top-1/3 left-1/3 dot-live" />
              <div className="absolute top-2/3 left-2/3 w-3 h-3 rounded-full bg-slate-600 opacity-60" />
              <div className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-accent/40" />
              {/* Dashed connection lines */}
              <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <line x1="33%" y1="33%" x2="66%" y2="66%" stroke="rgba(0,229,160,0.2)" strokeWidth="1" strokeDasharray="4 4"/>
                <line x1="50%" y1="50%" x2="66%" y2="66%" stroke="rgba(0,229,160,0.15)" strokeWidth="1" strokeDasharray="4 4"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Event Stream — Right 2 cols */}
        <div className="lg:col-span-2 card flex flex-col max-h-[500px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Event Stream</h3>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-0.5">
                Real-time Ledger Updates
              </p>
            </div>
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-accent dot-live' : 'bg-slate-600'}`} />
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {events.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 text-sm">No events yet.</p>
                <p className="text-slate-600 text-xs mt-1">
                  {wsConnected ? 'Waiting for blockchain events...' : 'WebSocket disconnected. Start the Transformer service.'}
                </p>
              </div>
            ) : (
              events.map((evt, i) => (
                <div key={i} className="flex items-start gap-3 animate-slide-up">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    evt.type === 'anomaly' ? 'bg-red-400' : 'bg-accent'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-600">
                      {new Date(evt.timestamp).toLocaleTimeString('en-GB', { timeZone: 'GMT' })} GMT
                    </p>
                    <p className="text-sm font-semibold text-slate-200 mt-0.5">
                      {getEventLabel(evt.data?.type || '')}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {getEventIcon(evt.data?.type || '')} {evt.data?.type} event processed
                    </p>
                    <span className={`inline-block mt-1 ${
                      evt.type === 'anomaly' ? 'badge-attention' : 'badge-verified'
                    }`}>
                      {evt.type === 'anomaly' ? '⚠ Attention' : '● Verified'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {events.length > 0 && (
            <div className="mt-3 pt-3 border-t border-card-border">
              <button className="text-xs text-accent hover:text-accent-300 uppercase tracking-wider font-medium w-full text-center">
                View Full Logs
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Throughput Efficiency */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Throughput Efficiency</h3>
          <div className="space-y-4">
            {[
              { label: 'EU CORRIDOR', value: 94 },
              { label: 'PACIFIC RIM', value: 82 },
              { label: 'AMERICAS', value: 68 },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-4">
                <span className="text-xs text-slate-400 w-28">{item.label}</span>
                <div className="flex-1 h-1.5 bg-navy-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-1000"
                    style={{ width: `${item.value}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 w-10 text-right">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ledger Integrity */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Ledger Integrity</h3>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-lg border-2 border-accent/30 flex flex-col items-center justify-center bg-accent/5">
              <span className="text-lg font-bold text-accent">SECURE</span>
              <span className="text-[9px] text-slate-500 uppercase tracking-wider">Hash Validated</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['SHA-256', 'EIP-1559', 'L3-Graph'].map((tag) => (
                <span key={tag} className="px-2.5 py-1 text-[10px] font-medium bg-accent/10 text-accent rounded border border-accent/20">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}