'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * AI QUERY ASSISTANT — Natural Language Chat Interface
 * 
 * LLM Server Interaction (NOT smart contract — this talks to the LLM layer):
 * 
 * The chat page sends POST requests to the FastAPI LLM server at localhost:8000/chat.
 * The LLM server (planned in the `llm/` directory) does the following:
 * 
 * 1. Receives the user's natural language query (e.g., "Where is product #1?")
 * 2. Uses LangChain to feed the query + Neo4j schema into Llama 3
 * 3. Llama 3 generates a Cypher query (e.g., MATCH (p:Product {id: 1}) RETURN p)
 * 4. The Cypher query runs against Neo4j to get results
 * 5. Llama 3 translates the raw results back to a human-readable response
 * 6. The response is returned to this frontend as JSON: { response: "..." }
 * 
 * The Neo4j graph data was populated by the Transformer service, which
 * processed smart contract events (ProductCreated, ProductTransferred, etc.)
 * into graph nodes and relationships. So indirectly, the AI can answer
 * questions about on-chain data without directly querying the blockchain.
 */

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  'Show all products in the supply chain',
  'Who manufactured product #1?',
  'List all transfers for SKU-001',
  'Find any anomalies or suspicious transfers',
  'Which actors are currently active?',
  'Show the complete journey of product #2',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: query,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // ── LLM API Call ──────────────────────────────────────
      // POST to FastAPI server which runs LangChain + Llama 3.
      // The server translates natural language → Cypher, queries Neo4j,
      // and returns a human-readable response.
      const apiUrl = process.env.NEXT_PUBLIC_LLM_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: data.response || data.answer || 'No response received.',
          timestamp: new Date(),
        }]);
      } else {
        throw new Error('Server error');
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: '⚠ Unable to connect to the AI server. Make sure the LLM server is running:\n\n```\ncd llm\npython server.py\n```\n\nThe server should be at localhost:8000.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(input);
  };

  return (
    <div className="animate-fade-in h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-100">AI Query Assistant</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ask questions about the supply chain knowledge graph in natural language.
        </p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 card flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-300 mb-2">
                Knowledge Graph Intelligence
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md">
                Query your supply chain data using natural language. The AI translates your
                questions into Cypher queries against the Neo4j knowledge graph.
              </p>

              {/* Suggestion chips */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-lg w-full">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSubmit(suggestion)}
                    className="px-3 py-2 bg-navy-700/50 border border-card-border rounded-lg text-xs text-slate-400 hover:text-accent hover:border-accent/30 transition-colors text-left"
                  >
                    &quot;{suggestion}&quot;
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
                >
                  <div className={`max-w-[80%] ${
                    msg.role === 'user'
                      ? 'bg-accent/10 border border-accent/20 rounded-2xl rounded-br-md'
                      : 'bg-navy-700/50 border border-card-border rounded-2xl rounded-bl-md'
                  } px-4 py-3`}>
                    <div className="flex items-center gap-2 mb-1">
                      {msg.role === 'assistant' && (
                        <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center">
                          <svg className="w-3 h-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12" />
                          </svg>
                        </div>
                      )}
                      <span className="text-[10px] text-slate-600">
                        {msg.role === 'user' ? 'You' : 'AI Assistant'} • {msg.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start animate-fade-in">
                  <div className="bg-navy-700/50 border border-card-border rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-slate-500">Querying knowledge graph...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-card-border p-4">
          <form onSubmit={handleFormSubmit} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about products, transfers, actors..."
              className="input-dark flex-1"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              ) : (
                'Send'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}