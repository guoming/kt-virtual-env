import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { filterStainUrlHistory } from '@kt-virtual-env/shared';

type StainUrlHistoryInputProps = {
  value: string;
  history: string[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  onRemoveHistory: (url: string) => void;
  onEnter?: () => void;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

// [AI-GEN] scope:StainUrlHistoryInput, model:auto, reviewed:false
export function StainUrlHistoryInput({
  value,
  history,
  disabled,
  placeholder,
  onChange,
  onRemoveHistory,
  onEnter,
}: StainUrlHistoryInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);

  const filteredHistory = useMemo(
    () => filterStainUrlHistory(history, value),
    [history, value],
  );

  const updateMenuPos = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const preferredHeight = 240;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.min(
      preferredHeight,
      openUp ? spaceAbove : spaceBelow,
      window.innerHeight - 16,
    );
    let left = rect.left;
    const width = Math.max(rect.width, 360);
    if (left + width > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - 16 - width);
    }
    setMenuPos({
      top: openUp ? rect.top - gap - maxHeight : rect.bottom + gap,
      left,
      width,
      maxHeight: Math.max(maxHeight, 96),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
    const onReposition = () => updateMenuPos();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updateMenuPos, filteredHistory.length]);

  const selectHistory = (entry: string) => {
    onChange(entry);
    setOpen(false);
  };

  const dropdown =
    open && menuPos && filteredHistory.length > 0
      ? createPortal(
          <ul
            className="fixed z-[9999] overflow-auto rounded border border-gray-200 bg-white py-1 text-sm shadow-lg"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
            }}
          >
            {filteredHistory.map((entry) => (
              <li key={entry} className="flex items-stretch hover:bg-gray-50">
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate px-3 py-2 text-left"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectHistory(entry)}
                  title={entry}
                >
                  {entry}
                </button>
                <button
                  type="button"
                  className="shrink-0 px-2.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`删除历史记录 ${entry}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onRemoveHistory(entry)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        className="w-full rounded border px-3 py-2 text-sm"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter') {
            if (filteredHistory.length === 1) {
              selectHistory(filteredHistory[0]!);
              return;
            }
            onEnter?.();
          }
        }}
      />
      {dropdown}
    </div>
  );
}
// [/AI-GEN]
