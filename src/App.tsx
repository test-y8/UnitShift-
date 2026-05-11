/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Ruler, 
  Weight, 
  Thermometer, 
  Clock, 
  Droplets, 
  Gauge,
  History, 
  Star, 
  Moon, 
  Sun, 
  ArrowRightLeft,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Search,
  Loader2,
  Info,
  Mic,
  MicOff,
  Plus,
  X,
  Zap
} from 'lucide-react';
import { CATEGORIES, convertValue, HistoryItem, Category, Unit } from './constants';
import { GoogleGenAI, Type } from "@google/genai";

// Extension for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const ICON_MAP: Record<string, any> = {
  Ruler,
  Weight,
  Thermometer,
  Clock,
  Droplets,
  Gauge,
  Zap
};

// Initialize Gemini API safely
const getAiInstance = () => {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY" || !key.trim()) return null;
    return new GoogleGenAI({ apiKey: key });
  } catch (e) {
    console.error("Failed to initialize AI instance:", e);
    return null;
  }
};

const ai = getAiInstance();

// Local Smart Parser - Replaces Gemini AI with local logic
const smartParseQuery = (query: string, allCats: Category[]) => {
  const q = query.toLowerCase().trim().replace(/[?!,.]$/, '');
  const normalize = (s: string) => s.toLowerCase().replace(/s$/, '').trim();

  // 1. Identify Target Unit First (searching from the end usually helps)
  const splitters = [/\s+(?:to|in|into|as)\s+/, /\s*=\s*/, /\s+is\s+/, /how many (.*?) in (.*)/i];
  let left = '';
  let right = '';
  
  // Try "How many X in Y" pattern specifically
  const howManyMatch = q.match(/^how\s+many\s+(.*?)\s+(?:are\s+)?in\s+(.*)$/i);
  if (howManyMatch) {
    right = howManyMatch[1].trim();
    left = howManyMatch[2].trim();
  } else {
    for (const s of splitters) {
      const parts = q.split(s);
      if (parts.length >= 2) {
        // Everything before the last splitter is the source
        left = parts.slice(0, -1).join(' ').trim();
        right = parts[parts.length - 1].trim();
        break;
      }
    }
  }

  if (left && right) {
    // 2. Identify the target category and unit
    let targetUnit: Unit | null = null;
    let targetCat: Category | null = null;

    for (const cat of allCats) {
      const found = cat.units.find(u => 
        normalize(u.value) === normalize(right) || 
        normalize(u.label).includes(normalize(right)) ||
        (u.symbol && normalize(u.symbol) === normalize(right))
      );
      if (found) {
        targetUnit = found;
        targetCat = cat;
        break;
      }
    }

    if (targetCat && targetUnit) {
      // 3. Scan the Left side for multiple value-unit pairs in this category
      // Look for patterns like "5 feet", "6 inches", "10kg", etc.
      const chunkRegex = /(-?\d*\.?\d+)\s*([a-zA-Z%°Åµ]*)/g;
      let m;
      let totalValueInBase = 0;
      const parsedFound: { val: number; unit: Unit }[] = [];

      while ((m = chunkRegex.exec(left)) !== null) {
        const val = parseFloat(m[1]);
        const unitStr = m[2].trim();
        if (!isNaN(val)) {
          const unit = targetCat.units.find(u => 
            normalize(u.value) === normalize(unitStr) || 
            normalize(u.label).includes(normalize(unitStr)) ||
            (u.symbol && normalize(u.symbol) === normalize(unitStr))
          );
          
          if (unit) {
            // Temperature is special
            if (targetCat.id === 'temperature') {
              let cVal = val;
              if (unit.value === 'f') cVal = (val - 32) * (5 / 9);
              if (unit.value === 'k') cVal = val - 273.15;
              if (unit.value === 'r') cVal = (val - 491.67) * (5 / 9);
              totalValueInBase = cVal; // Temps don't sum, we just take the last one found
            } else {
              totalValueInBase += val * unit.ratio;
            }
            parsedFound.push({ val, unit });
          }
        }
      }

      if (parsedFound.length > 0) {
        // Result: Convert from base to target
        const finalValue = targetCat.id === 'temperature' 
          ? totalValueInBase // Temperate base is handled in convertValue
          : totalValueInBase / (targetCat.units.find(u => u.value === targetCat?.baseUnit)?.ratio || 1);

        // If multi-unit, provide an explanation and set state to base unit
        const displaySource = parsedFound.map(p => `${p.val} ${p.unit.label.split('(')[0].trim()}`).join(' + ');
        
        return {
          category: targetCat.id,
          // If only one unit found, use it. If multiple, use the first one and adjust value for state UI
          fromUnit: parsedFound[0].unit.value,
          toUnit: targetUnit.value,
          value: targetCat.id === 'temperature' 
            ? parsedFound[0].val // Keep temp as is
            : (totalValueInBase / parsedFound[0].unit.ratio), // Scale first unit value to match total
          explanation: `Locally parsed: ${displaySource} → ${targetUnit.label.split('(')[0].trim()}`
        };
      }
    }
  }

  // Fallback pattern for simple category search
  for (const cat of allCats) {
    if (q.includes(cat.label.toLowerCase()) || q.includes(cat.id)) {
      return {
        category: cat.id,
        explanation: `Switched to ${cat.label} category.`
      };
    }
  }

  return null;
};

const generateId = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {}
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

export default function App() {
  const [activeCategoryId, setActiveCategoryId] = useState(() => CATEGORIES[0]?.id || '');
  const [inputValue, setInputValue] = useState<string>('1');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem('theme') === 'dark' || 
          (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    } catch (e) {
      return false;
    }
    return false;
  });
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('unitshift_history');
        return saved ? JSON.parse(saved) : [];
      }
    } catch (e) {
      return [];
    }
    return [];
  });
  const [favorites, setFavorites] = useState<HistoryItem[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('unitshift_favorites');
        return saved ? JSON.parse(saved) : [];
      }
    } catch (e) {
      return [];
    }
    return [];
  });
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom Units State
  const [customUnits, setCustomUnits] = useState<Record<string, Unit[]>>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('unitshift_custom_units');
        return saved ? JSON.parse(saved) : {};
      }
    } catch (e) {
      return {};
    }
    return {};
  });
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newUnit, setNewUnit] = useState({ label: '', symbol: '', ratio: '' });

  // Merge default categories with custom units
  const allCategories = useMemo(() => {
    return CATEGORIES.map(cat => ({
      ...cat,
      units: [...cat.units, ...(customUnits[cat.id] || [])]
    }));
  }, [customUnits]);

  // Use the current active category from the merged list
  const activeCategory = useMemo(() => {
    return allCategories.find(c => c.id === activeCategoryId) || allCategories[0];
  }, [allCategories, activeCategoryId]);

  const [fromUnit, setFromUnit] = useState(activeCategory.units[0].value);
  const [toUnit, setToUnit] = useState(activeCategory.units[1].value);

  // Ensure selected units are always valid for the active category
  useEffect(() => {
    if (!activeCategory.units.find(u => u.value === fromUnit)) {
      setFromUnit(activeCategory.units[0].value);
    }
    if (!activeCategory.units.find(u => u.value === toUnit)) {
      setToUnit(activeCategory.units[activeCategory.units.length > 1 ? 1 : 0].value);
    }
  }, [activeCategory, fromUnit, toUnit]);

  // Smart Search States
  const [appQuery, setAppQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [smartResult, setSmartResult] = useState<{
    category?: string;
    fromUnit?: string;
    toUnit?: string;
    value?: number;
    explanation?: string;
  } | null>(null);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      setAppQuery(transcript);
      // Automatically trigger conversion
      processSmartQuery(undefined, transcript);
    };

    recognition.start();
  };

  // Persist custom units
  useEffect(() => {
    localStorage.setItem('unitshift_custom_units', JSON.stringify(customUnits));
  }, [customUnits]);

  const handleAddCustomUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const ratioNum = parseFloat(newUnit.ratio);
    if (!newUnit.label || !newUnit.symbol || isNaN(ratioNum)) return;

    const unit: Unit = {
      label: `${newUnit.label} (${newUnit.symbol})`,
      value: newUnit.symbol.toLowerCase().trim(),
      ratio: ratioNum,
      symbol: newUnit.symbol.toLowerCase().trim(),
      description: 'User-defined custom unit.'
    };

    setCustomUnits(prev => ({
      ...prev,
      [activeCategory.id]: [...(prev[activeCategory.id] || []), unit]
    }));

    setNewUnit({ label: '', symbol: '', ratio: '' });
    setShowAddCustom(false);
  };

  const removeCustomUnit = (categoryId: string, unitValue: string) => {
    setCustomUnits(prev => ({
      ...prev,
      [categoryId]: (prev[categoryId] || []).filter(u => u.value !== unitValue)
    }));
  };

  const processSmartQuery = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const queryToProcess = overrideQuery || appQuery;
    if (!queryToProcess.trim()) return;

    setIsProcessing(true);
    setSmartResult(null);

    let data: any = null;

    if (ai) {
      try {
        const result = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `User wants to convert units or ask about units. Query: "${queryToProcess}"
          
          Available Units Context:
          ${CATEGORIES.map(c => `${c.label} (${c.id}): ${c.units.map(u => u.label + ' [' + u.value + ']').join(', ')}`).join('\n')}
          
          Task:
          1. If it's a specific conversion request (e.g. "5m to ft"), parse numerical value, category ID, source unit key, and target unit key.
          2. Provide a brief (1 sentence) explanation, comparison, or fun fact about the unit or conversion.
          3. Map the units strictly to the valid 'value' keys provided in context.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                fromUnit: { type: Type.STRING },
                toUnit: { type: Type.STRING },
                value: { type: Type.NUMBER },
                explanation: { type: Type.STRING }
              },
              required: ["explanation"]
            }
          }
        });
        const text = result.text;
        if (text) data = JSON.parse(text);
      } catch (err) {
        console.error("AI Error, falling back to local search:", err);
      }
    }

    // Fallback to local if AI is not available or failed
    if (!data) {
      data = smartParseQuery(queryToProcess, allCategories);
    }
    
    if (data) {
      setSmartResult(data);

      // Automatically apply conversion if data is valid
      if (data.category) {
        const cat = allCategories.find(c => c.id === data.category);
        if (cat) {
          setActiveCategoryId(cat.id);
          if (data.fromUnit) setFromUnit(data.fromUnit);
          if (data.toUnit) setToUnit(data.toUnit);
          if (data.value !== undefined) setInputValue(data.value.toString());
        }
      }
    } else {
      setError("Couldn't parse that request. Try '5 miles to km'.");
    }
    
    setIsProcessing(false);
  };

  const handleInputChange = (val: string) => {
    // Basic pattern for numeric input (allowing for decimal and negative)
    if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
      if (val.length > 20) return; // Prevention of extreme length
      setInputValue(val);
      
      const num = parseFloat(val);
      if (!isNaN(num) && (Math.abs(num) > 1e30)) {
        setError('Value too large');
      } else {
        setError(null);
      }
    }
  };

  const formatDisplay = (val: number) => {
    if (val === 0) return '0';
    // Use scientific notation for very large or very small numbers
    if (Math.abs(val) > 1e12 || (Math.abs(val) < 1e-6 && val !== 0)) {
      return val.toExponential(4);
    }
    return val.toLocaleString(undefined, { 
      maximumFractionDigits: val < 1 ? 8 : 4,
      minimumFractionDigits: 0
    });
  };

  // Sync category units when activeCategory changes
  useEffect(() => {
    setFromUnit(activeCategory.units[0].value);
    setToUnit(activeCategory.units[1].value);
  }, [activeCategory]);

  // Dark mode effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Save history and favorites
  useEffect(() => {
    localStorage.setItem('unitshift_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('unitshift_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const result = useMemo(() => {
    const val = parseFloat(inputValue);
    if (isNaN(val)) return 0;
    return convertValue(val, fromUnit, toUnit, activeCategory.id);
  }, [inputValue, fromUnit, toUnit, activeCategory]);

  const handleSwap = () => {
    const temp = fromUnit;
    setFromUnit(toUnit);
    setToUnit(temp);
    if (result !== 0) {
      // Use clean string representation for the input
      setInputValue(formatDisplay(result).replace(/,/g, ''));
    }
  };

  const addToHistory = () => {
    const val = parseFloat(inputValue);
    if (isNaN(val)) return;

    const newItem: HistoryItem = {
      id: generateId(),
      fromValue: val,
      fromUnit,
      toValue: result,
      toUnit,
      category: activeCategory.id,
      timestamp: Date.now()
    };

    setHistory(prev => [newItem, ...prev.slice(0, 49)]);
  };

  const toggleFavorite = (item: HistoryItem) => {
    setFavorites(prev => {
      const exists = prev.find(f => 
        f.fromValue === item.fromValue && 
        f.fromUnit === item.fromUnit && 
        f.toUnit === item.toUnit
      );
      if (exists) {
        return prev.filter(f => f.id !== exists.id);
      }
      return [item, ...prev];
    });
  };

  const isFavorite = (item: HistoryItem) => {
    return favorites.some(f => 
      f.fromValue === item.fromValue && 
      f.fromUnit === item.fromUnit && 
      f.toUnit === item.toUnit
    );
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearHistory = () => {
    if (confirm('Clear all history?')) {
      setHistory([]);
    }
  };

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark text-slate-900 dark:text-slate-100 transition-colors duration-300 p-4 md:p-8 selection:bg-accent selection:text-white">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
              UnitShift
              <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent font-bold uppercase tracking-widest">v2 Local</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Precision conversion for the modern professional.</p>
          </div>
          <div className="flex items-center gap-3">
            <form onSubmit={processSmartQuery} className="relative group flex-1 md:flex-none">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-accent transition-colors">
                <Search size={16} />
              </div>
              <input 
                type="text"
                placeholder="Convert '5 miles to km'..."
                value={appQuery}
                onChange={(e) => setAppQuery(e.target.value)}
                className="w-full md:w-64 pl-10 pr-20 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm focus:ring-2 focus:ring-accent outline-none text-sm transition-all placeholder:text-slate-400"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button 
                  type="button"
                  onClick={startListening}
                  className={`p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-accent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <button 
                  type="submit"
                  disabled={isProcessing || !appQuery.trim()}
                  className="p-2 rounded-xl text-accent hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-all"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                </button>
              </div>
            </form>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-3 rounded-2xl bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all border border-slate-100 dark:border-slate-700"
              id="theme-toggle"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {/* Smart Insight Card */}
        <AnimatePresence>
          {smartResult?.explanation && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-3xl bg-accent/5 border border-accent/20 flex items-start gap-4"
            >
              <div className="p-2 rounded-2xl bg-accent text-white shadow-lg shadow-accent/20 shrink-0">
                <Info size={16} />
              </div>
              <div className="space-y-1 py-1">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Processing Insight</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed italic">
                  "{smartResult.explanation}"
                </p>
              </div>
              <button 
                onClick={() => setSmartResult(null)}
                className="ml-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Converter Core */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Category Nav */}
            <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar mask-fade-right">
              {allCategories.map((cat) => {
                const Icon = ICON_MAP[cat.icon];
                const isActive = activeCategoryId === cat.id;
                const colorMap: Record<string, string> = {
                  blue: 'bg-blue-500 shadow-blue-500/20',
                  emerald: 'bg-emerald-500 shadow-emerald-500/20',
                  orange: 'bg-orange-500 shadow-orange-500/20',
                  purple: 'bg-purple-500 shadow-purple-500/20',
                  cyan: 'bg-cyan-500 shadow-cyan-500/20',
                  rose: 'bg-rose-500 shadow-rose-500/20',
                  yellow: 'bg-yellow-500 shadow-yellow-500/20',
                };
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setActiveCategoryId(cat.id);
                      setFromUnit(cat.units[0].value);
                      setToUnit(cat.units[1].value);
                    }}
                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl whitespace-nowrap transition-all ${
                      isActive 
                        ? `${colorMap[cat.color]} text-white shadow-lg` 
                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="font-medium text-sm">{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Main Conversion Tool */}
            <div className="glass-card p-6 md:p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                
                {/* Input Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = ICON_MAP[activeCategory.icon];
                      return <Icon size={14} className={`text-${activeCategory.color}-500`} />;
                    })()}
                    <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">From</label>
                  </div>
                  <div className="space-y-4">
                    <div className="relative">
                      <input 
                        type="text"
                        inputMode="decimal"
                        value={inputValue}
                        onChange={(e) => handleInputChange(e.target.value)}
                        placeholder="0.00"
                        className={`w-full text-4xl md:text-5xl font-mono bg-transparent outline-none transition-colors ${error ? 'text-red-500' : `focus:text-${activeCategory.color}-500`}`}
                      />
                      {error && (
                        <div className="absolute -bottom-6 left-0 text-[10px] text-red-500 font-bold uppercase tracking-wider">
                          {error}
                        </div>
                      )}
                    </div>
                    <select 
                      value={fromUnit}
                      onChange={(e) => setFromUnit(e.target.value)}
                      className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 text-sm font-medium focus:ring-2 focus:ring-${activeCategory.color}-500 outline-none`}
                    >
                      {activeCategory.units.map(u => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                    {activeCategory.units.find(u => u.value === fromUnit)?.description && (
                      <div className="flex items-start justify-between gap-2 px-1">
                        <div className="flex items-start gap-2">
                          <Info size={12} className={`mt-0.5 text-${activeCategory.color}-500 shrink-0`} />
                          <p className="text-[10px] leading-tight text-slate-400 font-medium italic">
                            {activeCategory.units.find(u => u.value === fromUnit)?.description}
                          </p>
                        </div>
                        {customUnits[activeCategory.id]?.some(u => u.value === fromUnit) && (
                          <button 
                            onClick={() => removeCustomUnit(activeCategory.id, fromUnit)}
                            className="text-[10px] text-red-500 font-bold uppercase hover:underline"
                            type="button"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Swap Button (Desktop) */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block z-10">
                  <button 
                    onClick={handleSwap}
                    className={`p-3 rounded-full bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-slate-700 hover:scale-110 active:scale-95 transition-all text-${activeCategory.color}-500 hover:bg-slate-50 dark:hover:bg-slate-700`}
                    title="Swap Units"
                  >
                    <ArrowRightLeft size={20} />
                  </button>
                </div>

                {/* Arrow Decor (Mobile Only) */}
                <div className="flex md:hidden justify-center py-2">
                  <button 
                    onClick={handleSwap}
                    className={`p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-${activeCategory.color}-500 active:scale-90 transition-transform flex items-center gap-2`}
                  >
                    <ArrowRightLeft size={20} className="rotate-90" />
                    <span className="text-xs font-bold uppercase tracking-widest">Swap</span>
                  </button>
                </div>

                {/* Result Section */}
                <div className="space-y-3 relative">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = ICON_MAP[activeCategory.icon];
                      return <Icon size={14} className={`text-${activeCategory.color}-500`} />;
                    })()}
                    <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">To</label>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 group">
                      <div className={`flex-1 text-4xl md:text-5xl font-mono text-${activeCategory.color}-500 truncate`}>
                        {formatDisplay(result)}
                      </div>
                      <button 
                        onClick={copyToClipboard}
                        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-400"
                        title="Copy to clipboard"
                      >
                        {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                      </button>
                    </div>
                    <select 
                      value={toUnit}
                      onChange={(e) => setToUnit(e.target.value)}
                      className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 text-sm font-medium focus:ring-2 focus:ring-${activeCategory.color}-500 outline-none`}
                    >
                      {activeCategory.units.map(u => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                    {activeCategory.units.find(u => u.value === toUnit)?.description && (
                      <div className="flex items-start justify-between gap-2 px-1">
                         <div className="flex items-start gap-2">
                          <Info size={12} className={`mt-0.5 text-${activeCategory.color}-500 shrink-0`} />
                          <p className="text-[10px] leading-tight text-slate-400 font-medium italic">
                            {activeCategory.units.find(u => u.value === toUnit)?.description}
                          </p>
                        </div>
                        {customUnits[activeCategory.id]?.some(u => u.value === toUnit) && (
                          <button 
                            onClick={() => removeCustomUnit(activeCategory.id, toUnit)}
                            className="text-[10px] text-red-500 font-bold uppercase hover:underline"
                            type="button"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Conversions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {activeCategory.units
                  .filter(u => u.value !== fromUnit && u.value !== toUnit)
                  .slice(0, 4)
                  .map(u => {
                    const quickRes = convertValue(parseFloat(inputValue) || 0, fromUnit, u.value, activeCategory.id);
                    return (
                      <button
                        key={u.value}
                        onClick={() => setToUnit(u.value)}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 text-left hover:border-accent transition-all group"
                      >
                        <p className="text-[10px] font-bold text-slate-400 uppercase truncate">{u.label.split('(')[0]}</p>
                        <p className={`text-sm font-mono font-bold text-${activeCategory.color}-500 truncate group-hover:text-accent transition-colors`}>
                          {formatDisplay(quickRes)}
                        </p>
                      </button>
                    );
                  })}
              </div>

              {/* Action Bar */}
              <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center gap-4">
                <button 
                  onClick={addToHistory}
                  className={`px-6 py-3 rounded-xl bg-${activeCategory.color}-500 hover:bg-${activeCategory.color}-600 text-white text-sm font-semibold transition-all flex items-center gap-2 shadow-lg shadow-${activeCategory.color}-500/20`}
                >
                  <History size={16} />
                  Log Conversion
                </button>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowAddCustom(!showAddCustom)}
                    className={`px-4 py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-accent hover:text-accent transition-all text-xs font-bold uppercase flex items-center gap-2`}
                  >
                    <Plus size={16} />
                    Custom Unit
                  </button>
                  <button 
                    onClick={() => toggleFavorite({
                      id: generateId(),
                      fromValue: parseFloat(inputValue),
                      fromUnit,
                      toValue: result,
                      toUnit,
                      category: activeCategory.id,
                      timestamp: Date.now()
                    })}
                    className={`p-3 rounded-xl border border-slate-100 dark:border-slate-700 transition-all group ${
                      isFavorite({ fromValue: parseFloat(inputValue), fromUnit, toUnit } as any) 
                        ? 'bg-amber-400 text-white border-amber-400' 
                        : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-amber-500'
                    }`}
                  >
                    <Star size={20} fill={isFavorite({ fromValue: parseFloat(inputValue), fromUnit, toUnit } as any) ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>

              {/* Add Custom Unit Form */}
              <AnimatePresence>
                {showAddCustom && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <form 
                      onSubmit={handleAddCustomUnit}
                      className="mt-6 p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border-2 border-dashed border-slate-200 dark:border-slate-700 space-y-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Define Custom {activeCategory.label} Unit</h4>
                        <button type="button" onClick={() => setShowAddCustom(false)} className="text-slate-400 hover:text-red-500">
                          <X size={16} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Label (e.g. Furlong)</label>
                          <input 
                            required
                            placeholder="Unit Name"
                            value={newUnit.label}
                            onChange={e => setNewUnit({...newUnit, label: e.target.value})}
                            className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-accent"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Symbol (e.g. fur)</label>
                          <input 
                            required
                            placeholder="Symbol"
                            value={newUnit.symbol}
                            onChange={e => setNewUnit({...newUnit, symbol: e.target.value})}
                            className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-accent"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Ratio to {activeCategory.baseUnit}</label>
                          <input 
                            required
                            type="number"
                            step="any"
                            placeholder="e.g. 201.168"
                            value={newUnit.ratio}
                            onChange={e => setNewUnit({...newUnit, ratio: e.target.value})}
                            className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-accent"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <button 
                          type="submit"
                          className="flex-1 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold transition-all hover:opacity-90"
                        >
                          Save Custom Unit
                        </button>
                        <div className="flex-1 text-[10px] text-slate-400 leading-tight">
                          * Unit will be saved locally to this category. Ratio should be relative to the base unit ({activeCategory.baseUnit}).
                        </div>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Sidebar: History & Favorites */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Favorites Segment */}
            {favorites.length > 0 && (
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <Star size={16} className="text-amber-500" />
                    Favorites
                  </h3>
                </div>
                <div className="space-y-3">
                  <AnimatePresence>
                    {favorites.map((fav) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={fav.id}
                        onClick={() => {
                          setActiveCategoryId(allCategories.find(c => c.id === fav.category)?.id || activeCategoryId);
                          setInputValue(fav.fromValue.toString());
                          setFromUnit(fav.fromUnit);
                          setToUnit(fav.toUnit);
                        }}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:ring-2 hover:ring-accent/20 cursor-pointer transition-all border border-slate-100 dark:border-slate-700 relative group"
                      >
                         <div className="flex items-center justify-between">
                            <div className={`text-xs font-bold font-mono text-${CATEGORIES.find(c => c.id === fav.category)?.color || 'slate'}-500 mb-1 flex items-center gap-1`}>
                              {(() => {
                                const cat = CATEGORIES.find(c => c.id === fav.category);
                                const Icon = ICON_MAP[cat?.icon || 'Ruler'];
                                return <Icon size={10} />;
                              })()}
                              {fav.category.toUpperCase()}
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(fav); }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                         </div>
                         <div className="flex items-center gap-2 text-sm">
                           <span className="font-mono font-medium truncate max-w-[80px]">{formatDisplay(fav.fromValue)} {fav.fromUnit}</span>
                           <ArrowRightLeft size={12} className="text-slate-300" />
                           <span className={`font-mono font-bold text-${CATEGORIES.find(c => c.id === fav.category)?.color || 'accent'}-500 truncate max-w-[120px]`}>{formatDisplay(fav.toValue)} {fav.toUnit}</span>
                         </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* History Segment */}
            <div className="glass-card p-6 space-y-4 min-h-[300px]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                  <History size={16} />
                  Recent History
                </h3>
                {history.length > 0 && (
                  <button 
                    onClick={clearHistory}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    title="Clear history"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              
              <div className="space-y-3">
                {history.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <div className="p-3 mx-auto w-fit rounded-full bg-slate-50 dark:bg-slate-800 text-slate-300">
                      <History size={24} />
                    </div>
                    <p className="text-xs text-slate-400">No logs yet. Try converting something!</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {history.map((item) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={item.id}
                        onClick={() => {
                          setActiveCategoryId(allCategories.find(c => c.id === item.category)?.id || activeCategoryId);
                          setInputValue(item.fromValue.toString());
                          setFromUnit(item.fromUnit);
                          setToUnit(item.toUnit);
                        }}
                        className="p-4 rounded-xl border border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-all flex items-center justify-between group"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-mono truncate max-w-[80px]">{formatDisplay(item.fromValue)} {item.fromUnit}</span>
                            <ArrowRightLeft size={10} className="text-slate-300" />
                            <span className={`font-mono font-semibold text-${CATEGORIES.find(c => c.id === item.category)?.color || 'slate'}-500 truncate max-w-[120px]`}>{formatDisplay(item.toValue)} {item.toUnit}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter flex items-center gap-1">
                            {(() => {
                              const cat = CATEGORIES.find(c => c.id === item.category);
                              const Icon = ICON_MAP[cat?.icon || 'Ruler'];
                              return <Icon size={8} />;
                            })()}
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setHistory(h => h.filter(i => i.id !== item.id)); }}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
