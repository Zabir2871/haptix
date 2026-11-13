import React, { useMemo, useState } from 'react';
import { Play, Square, Star, Shuffle, Search, Trash2 } from 'lucide-react';
import { PatternDefinition, samplePatternCurve } from '../engine/hapticsLogic';

interface PatternStudioGridProps {
  patternsMap: Record<string, PatternDefinition>;
  activePatternName: string | null;
  highlightedIndex: number;
  favorites: string[];
  onSelectPattern: (name: string, index: number) => void;
  onStopPattern: () => void;
  onToggleFavorite: (name: string) => void;
  onDeleteCustomPattern?: (name: string) => void;
}

const PatternSparkline: React.FC<{ fn: PatternDefinition['fn']; isActive: boolean }> = ({
  fn,
  isActive,
}) => {
  const { strongPath, weakPath } = useMemo(() => {
    const samples = samplePatternCurve(fn, 44, 2);
    const width = 160;
    const height = 40;
    const sPoints = samples.map((pt, i) => {
      const x = (i / (samples.length - 1)) * width;
      const y = height - 4 - pt.strong * (height - 8);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const wPoints = samples.map((pt, i) => {
      const x = (i / (samples.length - 1)) * width;
      const y = height - 4 - pt.weak * (height - 8);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return {
      strongPath: sPoints.join(' '),
      weakPath: wPoints.join(' '),
    };
  }, [fn]);

  return (
    <svg
      viewBox="0 0 160 40"
      className="w-full h-10 rounded-lg bg-slate-100/90 dark:bg-[#0B0D12] p-1 overflow-visible"
      aria-hidden="true"
    >
      <line
        x1="0"
        y1="20"
        x2="160"
        y2="20"
        stroke="currentColor"
        className="text-slate-300 dark:text-slate-800"
        strokeDasharray="2 3"
        strokeWidth="1"
      />
      <path
        d={weakPath}
        fill="none"
        stroke={isActive ? '#00E5FF' : '#06B6D4'}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={isActive ? 0.95 : 0.65}
      />
      <path
        d={strongPath}
        fill="none"
        stroke={isActive ? '#FFB800' : '#F59E0B'}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const PatternStudioGrid: React.FC<PatternStudioGridProps> = ({
  patternsMap,
  activePatternName,
  highlightedIndex,
  favorites,
  onSelectPattern,
  onStopPattern,
  onToggleFavorite,
  onDeleteCustomPattern,
}) => {
  const [filter, setFilter] = useState<'all' | 'core' | 'custom' | 'favorites'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allPatternNames = Object.keys(patternsMap);

  const filteredNames = allPatternNames.filter((name) => {
    const def = patternsMap[name];
    if (searchQuery.trim() && !name.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
      return false;
    }
    if (filter === 'favorites') return favorites.includes(name);
    if (filter === 'core') return !def.category || def.category === 'core';
    if (filter === 'custom') return def.category && def.category !== 'core';
    return true;
  });

  const handleRandomPick = () => {
    if (allPatternNames.length === 0) return;
    const randomIdx = Math.floor(Math.random() * allPatternNames.length);
    const chosen = allPatternNames[randomIdx];
    onSelectPattern(chosen, randomIdx);
  };

  return (
    <div className="space-y-4">
      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Interactive Filter Segmented Control */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-[#14161B] border border-slate-300/60 dark:border-[#232733] overflow-x-auto"
          role="tablist"
          aria-label="Pattern Library Filters"
        >
          {(
            [
              { id: 'all', label: `All (${allPatternNames.length})` },
              { id: 'core', label: 'Core (13)' },
              { id: 'custom', label: 'Custom' },
              { id: 'favorites', label: `Saved (${favorites.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              onClick={() => setFilter(tab.id)}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                filter === tab.id
                  ? 'bg-white dark:bg-[#232734] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search + Surprise Trigger */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter waveforms..."
              aria-label="Filter waveforms by name"
              className="w-full min-h-[38px] pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-[#14161B] border border-slate-200 dark:border-[#242834] text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#FF5500]"
            />
          </div>

          <button
            type="button"
            onClick={handleRandomPick}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#14161B] border border-slate-200 dark:border-[#242834] hover:border-[#FF5500] text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Trigger random waveform pattern"
          >
            <Shuffle className="w-3.5 h-3.5 text-[#FF5500]" />
            <span>Surprise</span>
          </button>
        </div>
      </div>

      {/* Pattern Cards Grid */}
      {filteredNames.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#14161B] border border-slate-200 dark:border-[#242834] p-8 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            No haptic patterns match this view.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Record a custom motion loop in the XY Pad or build a sequence in the 16-Step Sequencer.
          </p>
        </div>
      ) : (
        <div
          id="pattern-container"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
        >
          {filteredNames.map((name) => {
            const globalIndex = allPatternNames.indexOf(name);
            const def = patternsMap[name];
            const isActive = activePatternName === name;
            const isHighlighted = highlightedIndex === globalIndex;
            const isFav = favorites.includes(name);
            const isCustom = def.category && def.category !== 'core';

            return (
              <div
                key={name}
                className={`group rounded-2xl p-3.5 transition-all border flex flex-col justify-between ${
                  isActive
                    ? 'bg-[#FF5500]/10 dark:bg-[#FF5500]/12 border-[#FF5500]'
                    : isHighlighted
                    ? 'bg-white dark:bg-[#14161B] border-amber-400/80 dark:border-amber-400/70'
                    : 'bg-white dark:bg-[#14161B] border-slate-200 dark:border-[#232733] hover:border-slate-300 dark:hover:border-[#343949]'
                }`}
              >
                {/* Card Top Header */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                        {String(globalIndex + 1).padStart(2, '0')}.
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {name}
                      </h3>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      <span>{isCustom ? 'Custom Patch' : 'Core Synth'}</span>
                      <span aria-hidden="true" className="mx-1">
                        ·
                      </span>
                      <span>{def.description || 'Dual-motor modulation curve'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isCustom && onDeleteCustomPattern && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCustomPattern(name);
                        }}
                        aria-label={`Delete custom pattern ${name}`}
                        className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(name);
                      }}
                      aria-label={
                        isFav ? `Remove ${name} from saved` : `Save ${name} to favorites`
                      }
                      className={`min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                        isFav
                          ? 'text-[#FFB800]'
                          : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Dual-Channel Waveform Preview */}
                <PatternSparkline fn={def.fn} isActive={isActive} />

                {/* Card Bottom Action Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      onStopPattern();
                    } else {
                      onSelectPattern(name, globalIndex);
                    }
                  }}
                  className={`mt-3 w-full min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#FF5500] text-white'
                      : 'bg-slate-100 dark:bg-[#1C2029] hover:bg-slate-200 dark:hover:bg-[#252A36] text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {isActive ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop Pattern</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Engage {name}</span>
                      </>
                    )}
                  </span>
                  <span className="font-mono text-[11px] opacity-75">
                    {isActive ? 'LIVE' : isHighlighted ? 'PAD SEL' : 'CH 1+2'}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
