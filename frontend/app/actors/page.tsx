'use client';

import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { useState, useEffect } from 'react';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/lib/contract';

/**
 * ACTORS PAGE — Supply Chain Participant Management
 * 
 * Smart Contract Interactions:
 * 
 * 1. getAllActors() → READ: Returns address[] of all registered actors.
 *    The contract stores these in `actorList` array. Anyone who has called
 *    registerActor() will have their address added to this array.
 * 
 * 2. getActor(address) → READ: Returns (name, role, location, isActive, registeredAt)
 *    - role is an ActorRole enum:
 *        0=None, 1=Manufacturer, 2=Supplier, 3=Distributor, 4=Retailer, 5=Consumer
 *    - isActive: can be set to false by the contract owner via deactivateActor()
 *    - registeredAt: block.timestamp when registerActor() was called
 * 
 * 3. registerActor(name, role, location) → WRITE: Registers the caller as a supply chain actor.
 *    The Solidity contract requires:
 *    - role != None (0)
 *    - Actor not already registered (actors[msg.sender].id == address(0))
 *    - Name not empty
 *    Emits ActorRegistered event → Transformer creates an (:Actor) node in Neo4j.
 *    NOTE: Role values must be 1-5 (NOT 0-indexed — role 0 is "None" and is rejected).
 */

const ROLES = [
  { value: 1, label: 'Manufacturer', icon: '🏭' },
  { value: 2, label: 'Supplier', icon: '📦' },
  { value: 3, label: 'Distributor', icon: '🚛' },
  { value: 4, label: 'Retailer', icon: '🏪' },
  { value: 5, label: 'Consumer', icon: '👤' },
];

const ROLE_NAMES: Record<number, string> = {
  0: 'None', 1: 'Manufacturer', 2: 'Supplier', 3: 'Distributor', 4: 'Retailer', 5: 'Consumer',
};

function ActorCard({ address }: { address: string }) {
  const { data } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getActor',
    args: [address as `0x${string}`],
  });

  if (!data) {
    return (
      <div className="p-4 bg-navy-900 rounded-lg border border-card-border animate-pulse">
        <div className="h-4 bg-navy-700 rounded w-1/2 mb-2" />
        <div className="h-3 bg-navy-700 rounded w-1/3" />
      </div>
    );
  }

  const [name, role, location, isActive] = data as [string, number, string, boolean, bigint];
  const roleInfo = ROLES.find((r) => r.value === Number(role));

  return (
    <div className="p-4 bg-navy-900 rounded-lg border border-card-border hover:border-accent/20 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-lg">
            {roleInfo?.icon || '●'}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">{name}</p>
            <p className="text-xs text-slate-500">{ROLE_NAMES[Number(role)]}</p>
          </div>
        </div>
        <span className={isActive ? 'badge-verified' : 'badge-attention'}>
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-[10px] text-slate-500">📍 {location}</span>
        <span className="text-[10px] font-mono text-slate-600 truncate">
          {address.slice(0, 8)}...{address.slice(-6)}
        </span>
      </div>
    </div>
  );
}

export default function ActorsPage() {
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  const [name, setName] = useState('');
  const [role, setRole] = useState(1); // Default to Manufacturer (1, not 0!)
  const [location, setLocation] = useState('');

  const { data: actorAddresses } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getAllActors',
  });

  const { writeContract, isPending } = useWriteContract();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !location) return;
    
    // registerActor(name: string, role: uint8, location: string)
    // Role must be 1-5 (Manufacturer=1, Supplier=2, etc.)
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'registerActor',
      args: [name, role, location],
    });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Actors</h1>
        <p className="text-sm text-slate-500 mt-1">Manage supply chain participants on the ledger.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actor List */}
        <div className="lg:col-span-2 card">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Registered Actors</h2>
          {actorAddresses && (actorAddresses as `0x${string}`[]).length > 0 ? (
            <div className="space-y-3">
              {(actorAddresses as `0x${string}`[]).map((address) => (
                <ActorCard key={address} address={address} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">No actors registered yet.</p>
            </div>
          )}
        </div>

        {/* Register Actor Form */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Register Actor</h2>
          {!mounted ? (
             <div className="text-center py-8 animate-pulse">
                <div className="h-4 bg-slate-800 rounded w-1/2 mx-auto"></div>
             </div>
          ) : !isConnected ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">Connect your wallet to register.</p>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="input-dark" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
                <select value={role} onChange={(e) => setRole(Number(e.target.value))}
                  className="input-dark">
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.icon} {r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Location</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                  className="input-dark" required />
              </div>
              <button type="submit" disabled={isPending} className="btn-primary w-full disabled:opacity-50">
                {isPending ? 'Registering...' : 'Register Actor'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}