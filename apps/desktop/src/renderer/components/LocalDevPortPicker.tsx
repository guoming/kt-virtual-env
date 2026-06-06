import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { runtimeLabel, type LocalDevPort } from '@kt-virtual-env/shared';

type LocalDevPortPickerProps = {
  value: string;
  options: LocalDevPort[];
  disabled?: boolean;
  onChange: (value: string) => void;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const MIN_DROPDOWN_WIDTH = 300;
const MAX_DROPDOWN_WIDTH = 420;

function estimateDropdownWidth(
  options: LocalDevPort[],
  inputWidth: number,
): number {
  let contentWidth = MIN_DROPDOWN_WIDTH;
  for (const option of options) {
    const label = `${option.port} ${option.serviceName} (${runtimeLabel(option.runtime)})`;
    contentWidth = Math.max(contentWidth, label.length * 7.5 + 28);
  }
  const capped = Math.min(MAX_DROPDOWN_WIDTH, contentWidth);
  return Math.max(inputWidth, capped);
}

// [AI-GEN] scope:LocalDevPortPicker, model:auto, reviewed:false
export function LocalDevPortPicker({
  value,
  options,
  disabled,
  onChange,
}: LocalDevPortPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);

  const matched = useMemo(() => {
    const port = Number.parseInt(value, 10);
    if (!Number.isFinite(port)) return undefined;
    return options.find((d) => d.port === port);
  }, [value, options]);

  const filteredOptions = useMemo(() => {
    const q = value.trim();
    if (!q) return options;
    return options.filter((d) => String(d.port).startsWith(q));
  }, [value, options]);

  const updateMenuPos = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const preferredHeight = 200;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.min(
      preferredHeight,
      openUp ? spaceAbove : spaceBelow,
      window.innerHeight - 16,
    );
    const width = estimateDropdownWidth(filteredOptions, rect.width);
    let left = rect.left;
    if (left + width > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - 16 - width);
    }
    setMenuPos({
      top: openUp ? rect.top - gap - maxHeight : rect.bottom + gap,
      left,
      width,
      maxHeight: Math.max(maxHeight, 80),
    });
  }, [filteredOptions]);

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
  }, [open, updateMenuPos, filteredOptions.length]);

  const selectPort = (port: number) => {
    onChange(String(port));
    setOpen(false);
  };

  const dropdown =
    open && menuPos && filteredOptions.length > 0
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
            {filteredOptions.map((d) => (
              <li key={`${d.pid}-${d.port}`}>
                <button
                  type="button"
                  className="w-full whitespace-nowrap px-3 py-1.5 text-left hover:bg-gray-100"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectPort(d.port)}
                >
                  <span className="font-mono text-sm">{d.port}</span>
                  <span className="ml-2 text-sm text-gray-800">{d.serviceName}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    ({runtimeLabel(d.runtime)})
                  </span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div className="w-[6.5rem]">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        placeholder="选择或输入"
        disabled={disabled}
        value={value}
        className="w-full rounded border px-2 py-1 font-mono text-sm"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter' && filteredOptions.length === 1) {
            selectPort(filteredOptions[0]!.port);
          }
        }}
      />
      {dropdown}
      {matched && (
        <div className="mt-0.5 text-xs text-gray-500">
          {matched.serviceName} · {runtimeLabel(matched.runtime)}
        </div>
      )}
    </div>
  );
}
// [/AI-GEN]
