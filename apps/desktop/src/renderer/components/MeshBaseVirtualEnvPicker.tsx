import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { buildMeshVersion } from '@kt-virtual-env/shared';

type MeshBaseVirtualEnvPickerProps = {
  value: string;
  options: string[];
  meshUserId: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onCopyMeshHeader?: (value: string) => void;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function filterVirtualEnvOptions(options: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((ve) => ve.toLowerCase().includes(q));
}

function previewMeshVersion(base: string, meshUserId: string): string | null {
  try {
    return buildMeshVersion(base, meshUserId);
  } catch {
    return null;
  }
}

// [AI-GEN] scope:MeshBaseVirtualEnvPicker, model:auto, reviewed:false
export function MeshBaseVirtualEnvPicker({
  value,
  options,
  meshUserId,
  disabled,
  onChange,
  onCopyMeshHeader,
}: MeshBaseVirtualEnvPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);

  useEffect(() => {
    if (!open) setDraft(value);
  }, [value, open]);

  const filteredOptions = useMemo(
    () => filterVirtualEnvOptions(options, open ? draft : value),
    [options, open, draft, value],
  );

  const meshVersion = previewMeshVersion(value.trim(), meshUserId);

  const updateMenuPos = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const preferredHeight = 180;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.min(
      preferredHeight,
      openUp ? spaceAbove : spaceBelow,
      window.innerHeight - 16,
    );
    const width = Math.max(rect.width, 220);
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
  }, [open, updateMenuPos, filteredOptions.length]);

  const selectOption = (ve: string) => {
    setDraft(ve);
    onChange(ve);
    setOpen(false);
  };

  const commitDraft = () => {
    onChange(draft.trim());
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
            {filteredOptions.map((ve) => (
              <li key={ve}>
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left font-mono hover:bg-gray-100"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(ve)}
                >
                  {ve}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div className="min-w-[9rem] max-w-[14rem]">
      <input
        ref={inputRef}
        type="text"
        placeholder="dev、dev.v1 …"
        disabled={disabled}
        value={open ? draft : value}
        className="w-full rounded border border-indigo-200 px-2 py-1 font-mono text-sm focus:border-indigo-400 focus:outline-none"
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setDraft(value);
          setOpen(true);
        }}
        onBlur={() => {
          setTimeout(() => {
            commitDraft();
            setOpen(false);
          }, 150);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(value);
            setOpen(false);
          }
          if (e.key === 'Enter') {
            if (filteredOptions.length === 1) {
              selectOption(filteredOptions[0]!);
            } else {
              commitDraft();
              setOpen(false);
            }
          }
        }}
      />
      {dropdown}
      {meshUserId ? (
        meshVersion ? (
          <button
            type="button"
            title="点击复制 x-virtual-env"
            className="mt-1 block w-full truncate rounded-md bg-green-50 px-2 py-0.5 text-left font-mono text-xs font-semibold text-green-900 hover:bg-green-100"
            onClick={() => onCopyMeshHeader?.(meshVersion)}
          >
            {meshVersion}
          </button>
        ) : (
          <span className="mt-1 block text-xs text-gray-400">请填写有效 virtual-env</span>
        )
      ) : (
        <span className="mt-1 block text-xs text-gray-400">请先在配置页填写个人标识</span>
      )}
    </div>
  );
}
// [/AI-GEN]
