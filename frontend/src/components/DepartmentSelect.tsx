import React, { useState, useRef, useEffect } from 'react';
import { DEPARTMENT_CATEGORIES, ALL_DEPARTMENTS, DepartmentCourse } from '../data/departments';
import { ChevronDown, Search, Check, X, GraduationCap, Sparkles } from 'lucide-react';

interface DepartmentSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const DepartmentSelect: React.FC<DepartmentSelectProps> = ({
  id = 'department-select',
  value,
  onChange,
  placeholder = 'Select Department / Course...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isCustomInput, setIsCustomInput] = useState(false);
  const [customVal, setCustomVal] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const selectedCourse = ALL_DEPARTMENTS.find((d) => d.name === value);

  // Filter courses based on search and active tab
  const filteredCategories = DEPARTMENT_CATEGORIES.map((cat) => {
    if (activeCategory !== 'all' && cat.id !== activeCategory) {
      return { ...cat, courses: [] };
    }
    const q = search.trim().toLowerCase();
    if (!q) return cat;

    const filtered = cat.courses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        c.degree.toLowerCase().includes(q) ||
        cat.categoryName.toLowerCase().includes(q)
    );
    return { ...cat, courses: filtered };
  }).filter((cat) => cat.courses.length > 0);

  const handleSelect = (courseName: string) => {
    onChange(courseName);
    setIsOpen(false);
    setSearch('');
    setIsCustomInput(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customVal.trim()) {
      onChange(customVal.trim());
      setIsOpen(false);
      setIsCustomInput(false);
      setCustomVal('');
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 min-h-[44px] bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-left text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all shadow-2xs cursor-pointer ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-800'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden mr-2">
          <GraduationCap className="w-4 h-4 text-indigo-500 shrink-0" />
          {value ? (
            <div className="flex items-center gap-1.5 truncate">
              {selectedCourse && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 shrink-0">
                  {selectedCourse.degree}
                </span>
              )}
              <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{value}</span>
            </div>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 text-sm truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              onClick={handleClear}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-indigo-500' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[260px] sm:max-h-[340px] animate-in fade-in zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search department (e.g., CSE, AI, Sandwich, M.Sc)..."
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Category Filter Pills */}
            <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-0.5 no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-md whitespace-nowrap transition-colors ${
                  activeCategory === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                All ({ALL_DEPARTMENTS.length})
              </button>
              {DEPARTMENT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded-md whitespace-nowrap transition-colors ${
                    activeCategory === cat.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat.badge}
                </button>
              ))}
            </div>
          </div>

          {/* List of courses grouped by category */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-2">
            {filteredCategories.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                <p>No matching courses found.</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomInput(true);
                    setCustomVal(search);
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  <Sparkles className="w-3 h-3" />
                  Use "{search}" as custom department
                </button>
              </div>
            ) : (
              filteredCategories.map((category) => (
                <div key={category.id} className="space-y-1">
                  <div className="px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
                    <span>{category.categoryName}</span>
                    <span className="text-[10px] lowercase text-slate-400 font-normal">
                      {category.courses.length} courses
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    {category.courses.map((course) => {
                      const isSelected = value === course.name;
                      return (
                        <button
                          key={course.name}
                          type="button"
                          onClick={() => handleSelect(course.name)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200 font-medium'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span
                              className={`px-1.5 py-0.5 text-[9px] font-bold rounded shrink-0 ${
                                course.degree === 'M.Sc'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                                  : course.degree === 'B.Sc'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                                  : course.category.includes('Sandwich')
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                                  : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                              }`}
                            >
                              {course.code || course.degree}
                            </span>
                            <span className="truncate">{course.name}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-slate-400 font-normal">
                              {course.duration}
                            </span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Custom Department Option / Footer */}
          <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-850">
            {isCustomInput ? (
              <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={customVal}
                  onChange={(e) => setCustomVal(e.target.value)}
                  placeholder="Enter other course or department..."
                  className="flex-1 px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
                >
                  Set
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomInput(false)}
                  className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                <span>Total 27 PSG Tech Courses</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomInput(true);
                    setCustomVal('');
                  }}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                >
                  + Custom Department
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
