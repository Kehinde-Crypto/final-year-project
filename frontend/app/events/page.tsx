'use client';

import { useEffect, useState } from 'react';

/**
 * BLOCKCHAIN EVENT LOG — Transaction History Page
 * 
 * Smart Contract Interaction (Indirect):
 * This page does NOT call the smart contract directly. Instead, it receives
 * processed events via two channels:
 * 
 * 1. WebSocket (Real-time): Connects to the Transformer service at ws://localhost:8080
 *    The Transformer listens for on-chain events emitted by SupplyChain.sol:
 *    - ActorRegistered → when registerActor() is called
 *    - ProductCreated → when createProduct() is called by a Manufacturer
 *    - ProductTransferred → when transferProduct() moves a product in the chain
 *    - ProductRecalled → when recallProduct() is called
 *    - ProductStatusUpdated → when updateProductStatus() is called
 *    
 *    Each event goes through the 5-stage pipeline (decode → validate → enrich →
 *    mapToGraph → anomalyCheck) before being broadcast here via WebSocket.
 * 
 * 2. The event data includes:
 *    - Transaction hash (from the Ethereum transaction)
 *    - Block number (which block included this transaction)
 *    - Event type (which Solidity event was emitted)
 *    - Decoded arguments (product ID, actor addresses, etc.)
 *    - Anomaly flags (rapid transfer, backward transfer, etc.)
 */

interface EventEntry {
  id: string;
  timestamp: string;
  eventType: string;
  txHash: string;
  blockNumber: number;
  status: 'verified' | 'pending' | 'attention';
  data?: Record<string, unknown>;
}

const EVENT_TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  ProductTransferred: { icon: '📦', label: 'Shipped', color: 'text-accent' },
  ProductCreated: { icon: '🏭', label: 'Created', color: 'text-blue-400' },
  ActorRegistered: { icon: '👤', label: 'Registered', color: 'text-purple-400' },
  ProductRecalled: { icon: '⚠️', label: 'Recalled', color: 'text-red-400' },
  ProductStatusUpdated: { icon: '🔄', label: 'Updated', color: 'text-yellow-400' },
  ActorDeactivated: { icon: '🚫', label: 'Deactivated', color: 'text-slate-400' },
};

const FILTER_OPTIONS = ['All Events', 'Shipped', 'Received', 'Created'];

// Demo data (will be replaced by WebSocket events when the Transformer runs)
const DEMO_EVENTS: EventEntry[] = [
  {
    id: '1',
    timestamp: '2023-10-24T14:22:01Z',
    eventType: 'ProductTransferred',
    txHash: '0x72a...d93f',
    blockNumber: 18294103,
    status: 'verified',
  },
  {
    id: '2',
    timestamp: '2023-10-24T14:19:55Z',
    eventType: 'ProductCreated',
    txHash: '0xa1f...90cc',
    blockNumber: 18294098,
    status: 'verified',
  },
  {
    id: '3',
    timestamp: '2023-10-24T14:15:30Z',
    eventType: 'ActorRegistered',
    txHash: '0x44d...11bc',
    blockNumber: 18294082,
    status: 'pending',
  },
  {
    id: '4',
    timestamp: '2023-10-24T14:02:11Z',
    eventType: 'ProductTransferred',
    txHash: '0x92b...e440',
    blockNumber: 18294056,
    status: 'verified',
  },
  {
    id: '5',
    timestamp: '2023-10-24T13:55:04Z',
    eventType: 'ProductCreated',
    txHash: '0x33a...f922',
    blockNumber: 18294042,
    status: 'verified',
  },
];

export default function EventsPage() {
  const [events, setEvents] = useState<EventEntry[]>(DEMO_EVENTS);
  const [activeFilter, setActiveFilter] = useState('All Events');
  const [wsConnected, setWsConnected] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const eventsPerPage = 10;

  // ── WebSocket: Live event stream ──────────────────────────
  // Receives events from the Transformer service after pipeline processing
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
        ws.onmessage = (message) => {
          try {
            const parsed = JSON.parse(message.data);
            if (parsed.type === 'event' && parsed.data) {
              const newEvent: EventEntry = {
                id: `ws-${Date.now()}`,
                timestamp: parsed.timestamp,
                eventType: parsed.data.type || 'Unknown',
                txHash: parsed.data.meta?.transactionHash
                  ? `${parsed.data.meta.transactionHash.slice(0, 5)}...${parsed.data.meta.transactionHash.slice(-4)}`
                  : '0x...',
                blockNumber: parsed.data.meta?.blockNumber || 0,
                status: parsed.data.hasAnomaly ? 'attention' : 'verified',
              };
              setEvents((prev) => [newEvent, ...prev]);
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

  // Filter logic
  const filteredEvents = events.filter((evt) => {
    if (activeFilter === 'All Events') return true;
    if (activeFilter === 'Shipped') return evt.eventType === 'ProductTransferred';
    if (activeFilter === 'Received') return evt.eventType === 'ProductCreated' || evt.eventType === 'ActorRegistered';
    if (activeFilter === 'Created') return evt.eventType === 'ProductCreated';
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / eventsPerPage));
  const currentEvents = filteredEvents.slice(
    (currentPage - 1) * eventsPerPage,
    currentPage * eventsPerPage
  );

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <p className="text-[10px] uppercase tracking-[3px] text-accent font-semibold">
          Immutable Protocol
        </p>
        <h1 className="text-2xl font-bold text-slate-100 mt-1">
          Event Log <span className="text-slate-500 font-normal">Layer 1/2</span>
        </h1>
        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-accent dot-live' : 'bg-slate-600'}`} />
            Live Network Feed
          </span>
          <span>Block Height: <span className="text-slate-300 font-semibold">
            {events[0]?.blockNumber ? events[0].blockNumber.toLocaleString() : '—'}
          </span></span>
          <span>Nodes Online: <span className="text-slate-300 font-semibold">
            {wsConnected ? '1' : '0'}
          </span></span>
        </div>
      </div>

      {/* Filters + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {FILTER_OPTIONS.map((filter) => (
            <button
              key={filter}
              onClick={() => { setActiveFilter(filter); setCurrentPage(1); }}
              className={activeFilter === filter ? 'filter-tab-active' : 'filter-tab-inactive'}
            >
              {filter}
            </button>
          ))}
          <button className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
          </button>
          <button className="p-2 text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
          </button>
        </div>
      </div>

      {/* Event Table */}
      <div className="card p-0 overflow-hidden">
        <table className="table-dark">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Event Type</th>
              <th>Transaction Hash</th>
              <th>Block</th>
              <th>Status</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {currentEvents.map((evt) => {
              const { date, time } = formatTimestamp(evt.timestamp);
              const config = EVENT_TYPE_CONFIG[evt.eventType] || {
                icon: '📋', label: evt.eventType, color: 'text-slate-400',
              };
              return (
                <tr key={evt.id}>
                  <td>
                    <p className="text-sm text-slate-300">{date}</p>
                    <p className="text-xs text-slate-600">{time}</p>
                  </td>
                  <td>
                    <span className={`flex items-center gap-2 font-medium ${config.color}`}>
                      {config.icon} {config.label}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono text-xs text-slate-500">{evt.txHash}</span>
                  </td>
                  <td>
                    <span className="font-mono text-xs text-slate-400">
                      #{evt.blockNumber.toLocaleString()}
                    </span>
                  </td>
                  <td>
                    <span className={
                      evt.status === 'verified' ? 'badge-verified' :
                      evt.status === 'pending' ? 'badge-pending' :
                      'badge-attention'
                    }>
                      ● {evt.status === 'verified' ? 'Verified' :
                         evt.status === 'pending' ? 'Pending' : 'Attention'}
                    </span>
                  </td>
                  <td className="text-right">
                    <button className="p-1.5 text-slate-500 hover:text-accent transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-card-border">
          <p className="text-xs text-slate-500">
            Showing {((currentPage - 1) * eventsPerPage) + 1}-{Math.min(currentPage * eventsPerPage, filteredEvents.length)} of {filteredEvents.length} entries
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 text-xs text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-colors"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-7 h-7 text-xs rounded transition-colors ${
                  currentPage === i + 1
                    ? 'bg-accent text-navy-900 font-semibold'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {i + 1}
              </button>
            ))}
            {totalPages > 5 && (
              <>
                <span className="text-xs text-slate-600 px-1">...</span>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className={`w-7 h-7 text-xs rounded transition-colors ${
                    currentPage === totalPages
                      ? 'bg-accent text-navy-900 font-semibold'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {totalPages}
                </button>
              </>
            )}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-xs text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-colors"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Throughput (TPS)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">1,402.8</span>
            <span className="text-xs text-accent font-medium">↗ +12.4%</span>
          </div>
          <div className="w-full h-1 bg-navy-600 rounded-full mt-2">
            <div className="w-3/4 h-full bg-accent rounded-full" />
          </div>
        </div>

        <div className="stat-card">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Gas Efficiency</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">94.2%</span>
            <span className="text-xs text-accent font-medium">● Optimal</span>
          </div>
          <div className="w-full h-1 bg-navy-600 rounded-full mt-2">
            <div className="w-[94%] h-full bg-accent rounded-full" />
          </div>
        </div>

        <div className="stat-card">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Validator Uptime</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">99.999%</span>
            <span className="text-xs text-slate-500 font-medium">● Standard</span>
          </div>
          <div className="w-full h-1 bg-navy-600 rounded-full mt-2">
            <div className="w-[99.9%] h-full bg-accent rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
