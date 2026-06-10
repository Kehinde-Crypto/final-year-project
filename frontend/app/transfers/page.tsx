'use client';

import { useAccount, useWriteContract } from 'wagmi';
import { useState } from 'react';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/lib/contract';

/**
 * TRANSFERS PAGE — Product Transfer Between Supply Chain Actors
 * 
 * Smart Contract Interaction:
 * 
 * transferProduct(productId, to, location, notes) → WRITE
 * 
 * This is the most important function in the supply chain system.
 * When called, it:
 * 
 * 1. Validates the caller owns the product (isProductOwner modifier)
 * 2. Validates the caller is a registered active actor (onlyRegisteredActor modifier)
 * 3. Validates the recipient is also a registered active actor
 * 4. Enforces the SUPPLY CHAIN PATH:
 *    - Manufacturer (1) can only send to Supplier (2)
 *    - Supplier (2) can only send to Distributor (3)
 *    - Distributor (3) can only send to Retailer (4)
 *    - Retailer (4) can only send to Consumer (5)
 *    Any other transfer path is REJECTED.
 * 
 * 5. Creates a TransferRecord struct on-chain
 * 6. Updates the product's currentOwner to the recipient
 * 7. Updates the product status:
 *    - Default: InTransit
 *    - If recipient is Retailer: Delivered
 *    - If recipient is Consumer: Sold
 * 
 * 8. Emits ProductTransferred event → The Transformer service picks this up,
 *    processes it through the 5-stage pipeline, and creates in Neo4j:
 *    - A new (:Transfer) node
 *    - TRANSFERRED_FROM relationship to sender Actor
 *    - TRANSFERRED_TO relationship to recipient Actor
 *    - TRANSFER_OF relationship to the Product
 *    - Updates CURRENTLY_OWNED_BY relationship on the Product
 * 
 * Gas cost: ~80k-120k gas per transfer.
 */

export default function TransfersPage() {
  const { isConnected } = useAccount();
  const [productId, setProductId] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const { writeContract, isPending } = useWriteContract();

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !toAddress || !location) return;
    
    // Call transferProduct(uint256, address, string, string) on SupplyChain.sol
    // The product must be owned by msg.sender and the recipient must be
    // the next valid actor in the chain (e.g., Manufacturer→Supplier)
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'transferProduct',
      args: [BigInt(productId), toAddress as `0x${string}`, location, notes],
    });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Transfer Product</h1>
        <p className="text-sm text-slate-500 mt-1">
          Move products to the next participant in the supply chain.
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-200 mb-1">Transfer Product Ownership</h2>
          <p className="text-xs text-slate-600 mb-5">
            Transfers must follow: Manufacturer → Supplier → Distributor → Retailer → Consumer
          </p>

          {!isConnected ? (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">Connect your wallet to transfer products.</p>
              <p className="text-slate-600 text-xs mt-1">You must own the product and be a registered actor.</p>
            </div>
          ) : (
            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Product ID</label>
                <input
                  type="number" value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="input-dark" required min="1"
                  placeholder="e.g., 1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Recipient Address</label>
                <input
                  type="text" value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                  className="input-dark" placeholder="0x..." required
                />
                <p className="text-[10px] text-slate-600 mt-1">
                  Must be a registered actor with the correct role (next in chain).
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Location</label>
                <input
                  type="text" value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="input-dark" required placeholder="e.g., Lagos Warehouse"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Notes (Optional)</label>
                <textarea
                  value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="input-dark" rows={2} placeholder="Additional transfer details..."
                />
              </div>
              <button type="submit" disabled={isPending} className="btn-primary w-full disabled:opacity-50">
                {isPending ? 'Transferring...' : 'Transfer Product'}
              </button>
            </form>
          )}

          {/* Supply chain flow diagram */}
          <div className="mt-6 pt-6 border-t border-card-border">
            <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-3">Valid Transfer Path</p>
            <div className="flex items-center justify-between text-center">
              {['🏭 Manufacturer', '📦 Supplier', '🚛 Distributor', '🏪 Retailer', '👤 Consumer'].map((label, i, arr) => (
                <div key={label} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-sm mb-1">
                      {label.split(' ')[0]}
                    </div>
                    <span className="text-[9px] text-slate-500">{label.split(' ')[1]}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <svg className="w-6 h-3 text-accent/40 mx-1" fill="none" stroke="currentColor" viewBox="0 0 24 12">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M0 6h20m-4-4l4 4-4 4" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}