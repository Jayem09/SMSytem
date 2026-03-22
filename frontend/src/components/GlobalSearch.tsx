import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Package, User, ShoppingBag, X } from 'lucide-react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';

interface SearchResult {
  type: 'product' | 'customer' | 'order';
  id: number;
  title: string;
  subtitle: string;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'product': return <Package className="w-4 h-4 text-blue-500" />;
    case 'customer': return <User className="w-4 h-4 text-emerald-500" />;
    case 'order': return <ShoppingBag className="w-4 h-4 text-amber-500" />;
    default: return null;
  }
};

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    try {
      const res = await api.get(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
        signal: abortControllerRef.current.signal,
      });
      setResults(res.data.results || []);
      setIsOpen(true);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Global search failed', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim().length > 1) {
        performSearch(query);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, performSearch]);

  const handleSelect = (result: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    switch (result.type) {
      case 'product':
        navigate('/products'); 
        break;
      case 'customer':
        navigate('/customers');
        break;
      case 'order':
        navigate('/orders');
        break;
    }
  };

  return (
    <div className="relative w-full max-w-lg" ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search items, customers, or orders..."
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length > 1 && setIsOpen(true)}
        />
        {query && (
          <button 
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
          {loading ? (
            <div className="p-4 text-center text-gray-400 text-xs font-medium animate-pulse">Searching repository...</div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((result, idx) => (
                <button
                  key={`${result.type}-${result.id}-${idx}`}
                  onClick={() => handleSelect(result)}
                  className="w-full px-4 py-3 flex items-center gap-4 hover:bg-indigo-50/50 transition-all text-left group"
                >
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-white transition-colors">
                    {getIcon(result.type)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{result.title}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      {result.type} • {result.subtitle}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-sm font-bold text-gray-400">No results found for "{query}"</p>
              <p className="text-xs text-gray-300 mt-1">Try searching for a different keyword</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
