import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchKnowledgeSearch } from '../api';
import {
  Search,
  Award,
  ChevronDown,
  ChevronUp,
  FileText,
  HelpCircle,
  TrendingUp,
  Compass
} from 'lucide-react';

export default function KnowledgeBase() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Categories
  const categories = [
    { name: 'VPN', query: 'VPN' },
    { name: 'Password Reset', query: 'Password' },
    { name: 'Email', query: 'Email' },
    { name: 'Printer', query: 'Printer' },
    { name: 'Software Installation', query: 'Software' }
  ];

  // Popular Articles
  const popularArticles = [
    { title: 'Global VPN Configuration and Troubleshooting Guide', views: '1.2k views', category: 'VPN' },
    { title: 'Active Directory Password Recovery Self-Service Instructions', views: '980 views', category: 'Password Reset' },
    { title: 'Outlook Email Client Configuration and Exchange Access', views: '750 views', category: 'Email' }
  ];

  // FAQs
  const faqs = [
    { q: 'How do I unlock my AD account?', a: 'Log in to the Self-Service Password Portal or initiate a Chat request with our AI Assistant to trigger password diagnostics.' },
    { q: 'Why does my printer show status offline?', a: 'Verify your local ping gateway. Ensure that you have the correct office printer drivers installed from the Software registry.' },
    { q: 'How to request software license access?', a: 'Create a ticket under the Software Installation category specifying your license needs. Handoff is processed in 15 mins.' }
  ];

  // Trending Searches
  const trendingSearches = [
    'VPN offline status',
    'Reset email credentials',
    'Printer drivers setup',
    'Office license request'
  ];

  // Semantic query hook
  const { data: results = [], isLoading, isError } = useQuery({
    queryKey: ['kbSearch', debouncedQuery],
    queryFn: () => fetchKnowledgeSearch(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    const timer = setTimeout(() => {
      setDebouncedQuery(val);
      setExpandedIndex(null);
    }, 300);
    return () => clearTimeout(timer);
  };

  const handleTagClick = (phrase: string) => {
    setQuery(phrase);
    setDebouncedQuery(phrase);
    setExpandedIndex(null);
  };

  // Helper to color confidence scores
  const getConfidenceStyle = (score: number) => {
    if (score >= 0.8) return 'bg-emerald-50 text-emerald-700 border-emerald-150';
    if (score >= 0.5) return 'bg-amber-50 text-amber-700 border-amber-150';
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto text-slate-800">
      
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Knowledge Base
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Access troubleshooting resources, employee setup guides, and vector-indexed documentation.
        </p>
      </div>

      {/* Immediate Toolbar: Search & Categories */}
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative shadow-2xs rounded-lg overflow-hidden border border-slate-200 bg-white focus-within:ring-1 focus-within:ring-blue-500 transition-all">
          <Search className="absolute left-4 top-3 text-slate-400" size={16} />
          <input
            type="text"
            value={query}
            onChange={handleSearchChange}
            placeholder="Search our knowledge base or enter keywords... (e.g. 'Cisco VPN error')"
            className="w-full pl-11 pr-4 py-2.5 text-slate-800 text-xs focus:outline-none"
          />
        </div>

        {/* Categories Grid pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Categories:</span>
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => handleTagClick(cat.query)}
              className="px-3 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs font-semibold text-slate-600 hover:text-blue-700 rounded-full transition shadow-3xs cursor-pointer"
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Semantic Search Results (Visible if query active) */}
      {debouncedQuery.length >= 2 ? (
        <div className="space-y-4 pt-2 border-t border-slate-150">
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Semantic matches in support database</span>
            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-105">ChromaDB Vector Match</span>
          </div>

          {isLoading ? (
            <div className="space-y-3.5 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-slate-100 rounded-xl" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-4 bg-rose-50 border border-rose-150 text-rose-700 rounded-xl text-center text-xs font-semibold">
              Error querying ChromaDB vector store.
            </div>
          ) : results.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400">
              <HelpCircle size={32} className="mx-auto text-slate-350 mb-2" />
              <h3 className="font-semibold text-slate-700 text-xs">No matching guides found</h3>
              <p className="text-[10px] text-slate-400 max-w-xs mx-auto mt-1 leading-normal">
                Try querying broader terms (e.g. "VPN" instead of "Cisco VPN client error 101").
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {results.map((item: any, index: number) => {
                const isExpanded = expandedIndex === index;
                return (
                  <div
                    key={index}
                    className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 shadow-3xs transition flex flex-col gap-3"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900 flex items-center gap-2 text-xs">
                          <FileText size={14} className="text-blue-600 shrink-0" />
                          {item.doc_title}
                        </h3>
                        <span className="text-[10px] text-slate-400 block mt-0.5 font-semibold">
                          Section Reference: {item.section}
                        </span>
                      </div>

                      <div className={`px-2 py-0.5 border rounded font-bold text-[9px] flex items-center gap-1 shrink-0 ${getConfidenceStyle(item.confidence)}`}>
                        <Award size={11} />
                        <span>{(item.confidence * 100).toFixed(0)}% match score</span>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                      <span className="bg-slate-50 border border-slate-150 px-2 py-0.5 rounded">
                        Category: {item.category}
                      </span>
                      <span className="bg-slate-50 border border-slate-150 px-2 py-0.5 rounded truncate max-w-xs">
                        Source Document: {item.document}
                      </span>
                    </div>

                    {/* Preview snippets */}
                    <div className="relative border-t border-slate-100 pt-2.5 mt-1">
                      <div className={`text-xs text-slate-655 leading-relaxed font-semibold ${isExpanded ? '' : 'line-clamp-2'}`}>
                        {item.content}
                      </div>

                      <button
                        onClick={() => setExpandedIndex(isExpanded ? null : index)}
                        className="mt-2.5 text-[10px] font-bold text-blue-600 hover:text-blue-500 flex items-center gap-0.5 cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp size={12} /> Hide guide content
                          </>
                        ) : (
                          <>
                            <ChevronDown size={12} /> Expand full guide
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Static Content Dashboard (shown above the fold immediately if no query active) */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
          {/* Left: Popular Guides & FAQ lists */}
          <div className="md:col-span-8 space-y-6">
            {/* Popular Guides */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
              <h2 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider text-slate-400">
                <Compass size={14} className="text-blue-600" />
                Popular Reference Articles
              </h2>
              <div className="space-y-3 text-xs leading-normal">
                {popularArticles.map((art) => (
                  <div key={art.title} className="flex justify-between items-start border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                    <div>
                      <span
                        onClick={() => handleTagClick(art.category)}
                        className="font-bold text-slate-800 hover:text-blue-600 transition cursor-pointer"
                      >
                        {art.title}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5 font-semibold">
                        Category: {art.category}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-100 border border-slate-150 px-2 py-0.5 rounded-full shrink-0">
                      {art.views}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Frequently Asked Questions */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
              <h2 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider text-slate-400">
                <HelpCircle size={14} className="text-blue-600" />
                Frequently Asked Questions
              </h2>
              <div className="space-y-3.5 text-xs">
                {faqs.map((faq) => (
                  <div key={faq.q} className="space-y-1">
                    <span className="font-bold text-slate-850 block">Q: {faq.q}</span>
                    <span className="text-slate-500 font-semibold block leading-relaxed">{faq.a}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Trending Searches tags */}
          <div className="md:col-span-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 sticky top-20">
              <h2 className="font-bold text-slate-905 text-xs flex items-center gap-1.5 uppercase tracking-wider text-slate-400">
                <TrendingUp size={14} className="text-blue-600 animate-pulse" />
                Trending Searches
              </h2>
              <p className="text-[10px] text-slate-400 font-semibold">
                Click a popular query below to automatically run vector search.
              </p>
              <div className="flex flex-col gap-2 pt-1">
                {trendingSearches.map((term) => (
                  <button
                    key={term}
                    onClick={() => handleTagClick(term)}
                    className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-lg text-xs font-semibold text-slate-655 hover:text-blue-700 transition shadow-3xs cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
