import React from 'react';
import { addDays, addMonths, endOfMonth, endOfWeek, format, isBefore, isSameMonth, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const DAY_HEADERS = {
  et: ['E', 'T', 'K', 'N', 'R', 'L', 'P'],
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S']
};

export default function MultiDatePicker({
  month,
  onMonthChange,
  selectedDates = [],
  onToggleDate,
  lang = 'et',
  minDate = new Date()
}) {
  const monthStart = React.useMemo(() => startOfMonth(month || new Date()), [month]);
  const selectedSet = React.useMemo(() => new Set(selectedDates), [selectedDates]);
  const monthLabel = React.useMemo(
    () => monthStart.toLocaleDateString(lang === 'en' ? 'en-GB' : 'et-EE', {
      month: 'long',
      year: 'numeric'
    }),
    [lang, monthStart]
  );
  const dayHeaders = DAY_HEADERS[lang] || DAY_HEADERS.et;
  const minDay = startOfDay(minDate);

  const calendarDays = React.useMemo(() => {
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });
    const days = [];
    let cursor = start;
    while (cursor <= end) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [monthStart]);

  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-4 dark:bg-black dark:border-white/10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(monthStart, -1))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200"
          aria-label="Eelmine kuu"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold capitalize text-slate-800 dark:text-slate-100">{monthLabel}</div>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(monthStart, 1))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200"
          aria-label="Järgmine kuu"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {dayHeaders.map((label) => (
          <div key={label} className="py-1 text-center text-[11px] font-semibold uppercase text-slate-400">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((dayDate) => {
          const dateKey = format(dayDate, 'yyyy-MM-dd');
          const inMonth = isSameMonth(dayDate, monthStart);
          const isDisabled = !inMonth || isBefore(dayDate, minDay);
          const isSelected = selectedSet.has(dateKey);
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => {
                if (isDisabled) return;
                onToggleDate(dateKey);
              }}
              disabled={isDisabled}
              className={cn(
                'flex aspect-square items-center justify-center rounded-xl text-sm font-semibold transition',
                !inMonth && 'text-slate-300',
                inMonth && !isSelected && !isDisabled && 'border border-slate-200 text-slate-700 hover:bg-slate-50',
                isSelected && 'bg-emerald-600 text-white shadow-sm',
                isDisabled && 'cursor-not-allowed bg-slate-50 text-slate-300'
              )}
            >
              {format(dayDate, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
