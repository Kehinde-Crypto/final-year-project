'use client';

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useState } from 'react';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/lib/contract';

/**
 * PRODUCTS PAGE — Product Catalog & Creation
 * 
 * Smart Contract Interactions:
 * 
 * 1. getAllProductIds() → READ: Returns uint256[] of all product IDs.
 *    These IDs are stored in the `productIds` array in SupplyChain.sol.
 *    Each ID is auto-incremented when createProduct() is called.
 * 
 * 2. getProduct(uint256) → READ: Returns full product details:
 *    (id, name, description, category, manufacturer, currentOwner, status, createdAt, updatedAt)
 *    - `manufacturer` is the address of the Actor who created the product (must have
 *      role=Manufacturer), set permanently at creation time.
 *    - `currentOwner` starts as the manufacturer, then changes with each transferProduct() call.
 *    - `status` is a ProductStatus enum: Created(0), InTransit(1), Delivered(2), Sold(3), Recalled(4)
 * 
 * 3. createProduct(name, description, category) → WRITE: Creates a new Product.
 *    Requires the caller to be a registered Manufacturer (enforced by onlyManufacturer modifier).
 *    Emits a ProductCreated event which the Transformer then processes into Neo4j.
 *    Gas cost: ~100k-150k gas depending on string lengths.
 */

const STATUS_MAP: Record<number, { label: string; class: string }> = {
  0: { label: 'Created', class: 'badge-info' },
  1: { label: 'In Transit', class: 'badge-pending' },
  2: { label: 'Delivered', class: 'badge-verified' },
  3: { label: 'Sold', class: 'badge-verified' },
  4: { label: 'Recalled', class: 'badge-attention' },
};

function ProductCard({ productId }: { productId: bigint }) {
  const [showInsights, setShowInsights] = useState(false);
  const [insight, setInsight] = useState('');
  const [isInsightLoading, setIsInsightLoading] = useState(false);

  const { data } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getProduct',
    args: [productId],
  });

  if (!data) {
    return (
      <div className="p-4 bg-navy-900 rounded-lg border border-card-border animate-pulse">
        <div className="h-4 bg-navy-700 rounded w-1/2 mb-2" />
        <div className="h-3 bg-navy-700 rounded w-1/3" />
      </div>
    );
  }

  const [id, name, description, category, , , status] = data as [bigint, string, string, string, string, string, number, bigint, bigint];
  const statusInfo = STATUS_MAP[Number(status)] || { label: 'Unknown', class: 'badge' };

  const cypherQuery = `MATCH path = (start:Actor)-[:MANUFACTURES]->(p:Product {id: "${id.toString()}"})
OPTIONAL MATCH (p)<-[:OWNS]-(currentOwner:Actor)
OPTIONAL MATCH (t:Transfer {productId: "${id.toString()}"})-[:TRANSFERRED_TO]->(receiver:Actor)
RETURN path, currentOwner, t, receiver`;

  const fetchInsight = async () => {
    setIsInsightLoading(true);
    setInsight('');
    try {
      const res = await fetch('http://localhost:8000/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: `The user clicked to view the history and journey of Product #${id.toString()} (${name})`,
          cypher_query: cypherQuery
        })
      });
      const result = await res.json();
      setInsight(result.response);
    } catch (e) {
      setInsight('⚠ Error connecting to LLM server. Ensure python server.py is running.');
    }
    setIsInsightLoading(false);
  };

  return (
    <div className="p-4 bg-navy-900 rounded-lg border border-card-border hover:border-accent/20 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-200">{name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
        <span className={statusInfo.class}>{statusInfo.label}</span>
      </div>
      
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-slate-600">ID: #{id.toString()}</span>
          <span className="text-[10px] text-slate-600">|</span>
          <span className="text-[10px] text-accent">{category}</span>
        </div>
        
        <button 
          onClick={() => setShowInsights(!showInsights)}
          className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 hover:text-accent transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Graph Insights
        </button>
      </div>

      {/* Expandable Insights Section */}
      {showInsights && (
        <div className="mt-4 pt-4 border-t border-card-border animate-fade-in">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Cypher Query</span>
              <button 
                onClick={() => navigator.clipboard.writeText(cypherQuery)}
                className="text-[10px] text-accent hover:text-white transition-colors"
              >
                Copy
              </button>
            </div>
            <pre className="text-[10px] text-slate-300 bg-navy-950 p-2.5 rounded border border-card-border overflow-x-auto font-mono">
              {cypherQuery}
            </pre>
          </div>

          <div className="flex items-start gap-3">
            <button 
              onClick={fetchInsight}
              disabled={isInsightLoading}
              className="btn-primary text-[10px] py-1.5 px-3 min-w-[120px] disabled:opacity-50"
            >
              {isInsightLoading ? 'Analyzing...' : 'Generate AI Report'}
            </button>
            
            <div className="flex-1 min-h-[30px] text-xs text-slate-300 leading-relaxed">
              {isInsightLoading && <span className="animate-pulse text-slate-500">LLM is explaining the graph data...</span>}
              {!isInsightLoading && insight && (
                <div className="bg-accent/10 border border-accent/20 p-2.5 rounded text-slate-200">
                  {insight}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  const { isConnected } = useAccount();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  const { data: productIds, refetch } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getAllProductIds',
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description || !category) return;
    
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'createProduct',
      args: [name, description, category],
    });
  };

  // Refetch products when transaction confirms
  if (isSuccess) {
    refetch();
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Products</h1>
        <p className="text-sm text-slate-500 mt-1">Manage products on the supply chain ledger.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product List */}
        <div className="lg:col-span-2 card">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">All Products</h2>
          {productIds && (productIds as bigint[]).length > 0 ? (
            <div className="space-y-3">
              {(productIds as bigint[]).map((id) => (
                <ProductCard key={id.toString()} productId={id} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">No products found.</p>
              <p className="text-slate-600 text-xs mt-1">Create one to get started.</p>
            </div>
          )}
        </div>

        {/* Create Product Form */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Create Product</h2>
          {!isConnected ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">Connect your wallet to create products.</p>
              <p className="text-slate-600 text-xs mt-1">Must be a registered Manufacturer.</p>
            </div>
          ) : (
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Name</label>
                <input
                  type="text" value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-dark" required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-dark" rows={3} required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
                <input
                  type="text" value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-dark" required
                />
              </div>
              <button type="submit" disabled={isPending || isConfirming} className="btn-primary w-full disabled:opacity-50">
                {isPending || isConfirming ? 'Creating...' : 'Create Product'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}