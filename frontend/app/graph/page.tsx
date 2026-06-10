'use client';

import { useReadContract } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/lib/contract';
import { useState, useEffect } from 'react';

/**
 * GRAPH EXPLORER — Knowledge Graph Visualization Page
 * 
 * Smart Contract Interactions:
 * 
 * 1. getAllActors() → Returns address[] of all registered supply chain actors.
 *    The contract stores each actor's address in an `actorList` array on-chain.
 *    We use this to populate the graph nodes.
 * 
 * 2. getActor(address) → Returns (name, role, location, isActive, registeredAt)
 *    for a specific actor address. The Actor struct in Solidity has:
 *    - id (address), name (string), role (ActorRole enum: 1=Manufacturer,
 *      2=Supplier, 3=Distributor, 4=Retailer, 5=Consumer),
 *      location (string), isActive (bool), registeredAt (uint256).
 *    When a user clicks a node, we call getActor() to populate the details panel.
 * 
 * 3. getAllProductIds() → Returns uint256[] of all product IDs.
 *    Each product was created via createProduct() by a Manufacturer.
 *    Used to show product nodes on the graph.
 * 
 * 4. getProduct(uint256) → Returns full product details.
 * 
 * 5. getProductTransferHistory(uint256) → Returns uint256[] of transfer IDs.
 *    Each transfer was created when transferProduct() was called, which also
 *    emitted the ProductTransferred event consumed by the Transformer service.
 *    The transfer enforces: Manufacturer→Supplier→Distributor→Retailer→Consumer.
 */

const ROLE_NAMES: Record<number, string> = {
  0: 'None',
  1: 'Manufacturer',
  2: 'Supplier',
  3: 'Distributor',
  4: 'Retailer',
  5: 'Consumer',
};

const ROLE_ICONS: Record<number, string> = {
  1: '🏭',
  2: '📦',
  3: '🚛',
  4: '🏪',
  5: '👤',
};

interface ActorDetails {
  address: string;
  name: string;
  role: number;
  location: string;
  isActive: boolean;
  registeredAt: bigint;
}

interface NodePosition {
  x: number;
  y: number;
  address: string;
  label: string;
  role: number;
}

export default function GraphPage() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [actorDetails, setActorDetails] = useState<ActorDetails | null>(null);
  const [graphNodes, setGraphNodes] = useState<NodePosition[]>([]);

  // ── Smart Contract Read: getAllActors() ────────────────────
  // Calls the public function that returns the actorList[] array.
  // This array is populated every time registerActor() is called.
  const { data: actorAddresses } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getAllActors',
  });

  // ── Smart Contract Read: getActor(selectedNode) ───────────
  // When a graph node is clicked, we fetch the full details.
  // The ABI specifies this returns 5 values:
  //   name (string), role (uint8), location (string),
  //   isActive (bool), registeredAt (uint256)
  const { data: selectedActorData } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getActor',
    args: selectedNode ? [selectedNode as `0x${string}`] : undefined,
    query: { enabled: !!selectedNode },
  });

  // ── Smart Contract Read: getAllProductIds() ────────────────
  // Returns all product IDs from the productIds[] array.
  const { data: productIds } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getAllProductIds',
  });

  // Build graph positions when actors load
  useEffect(() => {
    if (actorAddresses && (actorAddresses as string[]).length > 0) {
      const addresses = actorAddresses as string[];
      const centerX = 350;
      const centerY = 250;
      const radius = 180;

      const nodes = addresses.map((addr, i) => {
        const angle = (i / addresses.length) * 2 * Math.PI - Math.PI / 2;
        return {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
          address: addr,
          label: `${addr.slice(0, 6)}...${addr.slice(-4)}`,
          role: (i % 5) + 1, // Approximate — real role comes from getActor()
        };
      });
      setGraphNodes(nodes);
    }
  }, [actorAddresses]);

  // Update actor details when selection changes
  useEffect(() => {
    if (selectedActorData && selectedNode) {
      const [name, role, location, isActive, registeredAt] = selectedActorData as [string, number, string, boolean, bigint];
      setActorDetails({
        address: selectedNode,
        name,
        role: Number(role),
        location,
        isActive,
        registeredAt,
      });
    }
  }, [selectedActorData, selectedNode]);

  const totalProducts = productIds ? (productIds as bigint[]).length : 0;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Graph Explorer</h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
            <span className="dot-live" /> Live Mesh Topology: Node Alpha-7
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Graph Canvas — Left 3 cols */}
        <div className="lg:col-span-3 card min-h-[550px] relative overflow-hidden">
          <svg
            className="w-full h-full absolute inset-0"
            viewBox="0 0 700 500"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Grid pattern */}
            <defs>
              <pattern id="graphGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(100,116,139,0.08)" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#graphGrid)" />

            {/* Connection lines between nodes */}
            {graphNodes.map((node, i) =>
              graphNodes.slice(i + 1).map((other, j) => {
                const dist = Math.sqrt(Math.pow(node.x - other.x, 2) + Math.pow(node.y - other.y, 2));
                if (dist < 300) {
                  return (
                    <line
                      key={`${i}-${j}`}
                      x1={node.x} y1={node.y}
                      x2={other.x} y2={other.y}
                      stroke="rgba(0,229,160,0.15)"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                  );
                }
                return null;
              })
            )}

            {/* Actor nodes */}
            {graphNodes.map((node) => (
              <g
                key={node.address}
                className="cursor-pointer"
                onClick={() => setSelectedNode(node.address)}
              >
                {/* Glow effect */}
                <circle
                  cx={node.x} cy={node.y} r={selectedNode === node.address ? 28 : 22}
                  fill={selectedNode === node.address ? 'rgba(0,229,160,0.15)' : 'rgba(0,229,160,0.05)'}
                  stroke={selectedNode === node.address ? 'rgba(0,229,160,0.6)' : 'rgba(0,229,160,0.2)'}
                  strokeWidth="1.5"
                  className="transition-all duration-300"
                />
                {/* Inner circle */}
                <circle
                  cx={node.x} cy={node.y} r={14}
                  fill="#111827"
                  stroke="rgba(0,229,160,0.4)"
                  strokeWidth="1"
                />
                {/* Icon */}
                <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="14">
                  {ROLE_ICONS[node.role] || '●'}
                </text>
                {/* Label */}
                <text
                  x={node.x} y={node.y + 38}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily="monospace"
                  className="uppercase tracking-wider"
                >
                  {ROLE_NAMES[node.role] || node.label}
                </text>
              </g>
            ))}

            {/* Product nodes (smaller) */}
            {totalProducts > 0 && Array.from({ length: Math.min(totalProducts, 5) }).map((_, i) => {
              const x = 450 + (i % 3) * 80;
              const y = 150 + Math.floor(i / 3) * 100;
              return (
                <g key={`product-${i}`}>
                  <circle cx={x} cy={y} r={10} fill="rgba(0,229,160,0.08)" stroke="rgba(0,229,160,0.2)" strokeWidth="1"/>
                  <circle cx={x} cy={y} r={5} fill="rgba(0,229,160,0.3)"/>
                  <text x={x} y={y + 24} textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">
                    SKU-{String(i + 1).padStart(4, '0')}
                  </text>
                </g>
              );
            })}

            {/* "No data" message */}
            {graphNodes.length === 0 && (
              <text x="350" y="250" textAnchor="middle" fill="#64748b" fontSize="14">
                Connect wallet and deploy contract to see graph nodes
              </text>
            )}
          </svg>

          {/* Zoom controls */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2">
            <button className="w-8 h-8 rounded bg-navy-700/80 border border-card-border flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </button>
            <button className="w-8 h-8 rounded bg-navy-700/80 border border-card-border flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            <button className="w-8 h-8 rounded bg-navy-700/80 border border-card-border flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Node Details Panel — Right 2 cols */}
        <div className="lg:col-span-2 card flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200">Node Details</h3>
            {actorDetails?.isActive && (
              <span className="badge-verified text-[10px]">ACTIVE NODE</span>
            )}
          </div>

          {actorDetails ? (
            <div className="space-y-4 flex-1">
              {/* Entity Name */}
              <div className="p-3 bg-navy-900 rounded-lg border border-card-border">
                <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">Entity Name</p>
                <p className="text-lg font-semibold text-accent">{actorDetails.name}</p>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  ID: {actorDetails.address.slice(0, 10)}...{actorDetails.address.slice(-6)}
                </p>
              </div>

              {/* Blockchain Hash */}
              <div className="p-3 bg-navy-900 rounded-lg border border-card-border">
                <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">Blockchain Hash</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-mono text-slate-400 truncate">
                    {actorDetails.address}
                  </p>
                  <button
                    onClick={() => navigator.clipboard.writeText(actorDetails.address)}
                    className="text-slate-600 hover:text-slate-400 transition-colors shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Transit History */}
              <div className="mt-2">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                  </svg>
                  <h4 className="text-sm font-semibold text-slate-300">Transit History</h4>
                </div>

                <div className="space-y-4 relative">
                  {/* Timeline line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-card-border" />

                  <div className="flex items-start gap-3 relative">
                    <div className="w-3.5 h-3.5 rounded-full bg-accent border-2 border-navy-800 z-10 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-accent uppercase font-semibold">Registered</p>
                      <p className="text-sm font-semibold text-slate-200">{actorDetails.location}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(Number(actorDetails.registeredAt) * 1000).toLocaleDateString('en-GB', {
                          year: 'numeric', month: 'short', day: 'numeric',
                        })}
                      </p>
                      <div className="mt-1 px-2 py-1 bg-navy-900 rounded text-[10px] text-slate-500 inline-block">
                        Role: {ROLE_NAMES[actorDetails.role]} • Status: {actorDetails.isActive ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 relative">
                    <div className="w-3.5 h-3.5 rounded-full bg-navy-600 border-2 border-navy-800 z-10 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase">Supply Chain Role</p>
                      <p className="text-sm text-slate-300">
                        {ROLE_ICONS[actorDetails.role]} {ROLE_NAMES[actorDetails.role]}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* View Full Audit Trail */}
              <button className="btn-primary w-full flex items-center justify-center gap-2 mt-auto">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                VIEW FULL AUDIT TRAIL
              </button>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center py-8">
              <div>
                <div className="w-16 h-16 rounded-full bg-navy-700 mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                </div>
                <p className="text-slate-500 text-sm">Click a node on the graph</p>
                <p className="text-slate-600 text-xs mt-1">to view actor details and audit trail</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
