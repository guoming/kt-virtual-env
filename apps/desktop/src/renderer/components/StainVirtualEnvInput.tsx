import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  filterMeshSessionsByQuery,
  resolveStainVirtualEnv,
  type Session,
} from '@kt-virtual-env/shared';
import { MESH_HEADER } from '../lib/branding';

type StainVirtualEnvInputProps = {
  value: string;
  meshSessions: Session[];
  meshUserId: string;
  onChange: (value: string) => void;
  onOpenMeshPage?: () => void;
  onOpenSettings?: () => void;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function meshOptionLabel(session: Session): string {
  const port = session.localPort !== undefined ? `:${session.localPort}` : '';
  return `${session.target} (${session.namespace})${port}`;
}

// [AI-GEN] scope:StainVirtualEnvInput, model:auto, reviewed:false
export function StainVirtualEnvInput({
  value,
  meshSessions,
  meshUserId,
  onChange,
  onOpenMeshPage,
  onOpenSettings,
}: StainVirtualEnvInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);

  const resolved = useMemo(
    () => resolveStainVirtualEnv(value, meshUserId),
    [value, meshUserId],
  );

  const matchedMesh = useMemo(
    () => meshSessions.find((s) => s.virtualEnv === resolved),
    [meshSessions, resolved],
  );

  const filteredMeshes = useMemo(
    () => filterMeshSessionsByQuery(meshSessions, value),
    [meshSessions, value],
  );

  const updateMenuPos = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const preferredHeight = 220;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.min(
      preferredHeight,
      openUp ? spaceAbove : spaceBelow,
      window.innerHeight - 16,
    );
    let left = rect.left;
    const width = Math.max(rect.width, 400);
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
  }, [open, updateMenuPos, filteredMeshes.length]);

  const selectMesh = (session: Session) => {
    onChange(session.virtualEnv ?? '');
    setOpen(false);
  };

  const dropdown =
    open && menuPos
      ? createPortal(
          <div
            className="fixed z-[9999] overflow-auto rounded border border-gray-200 bg-white py-1 text-sm shadow-lg"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
            }}
          >
            {filteredMeshes.length > 0 ? (
              <>
                <div className="px-3 py-1 text-xs font-medium text-gray-500">
                  进行中的流量转发
                </div>
                {filteredMeshes.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-gray-100"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectMesh(session)}
                  >
                    <div className="font-medium text-gray-800">
                      {meshOptionLabel(session)}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-indigo-800">
                      {session.virtualEnv}
                    </div>
                  </button>
                ))}
              </>
            ) : meshSessions.length === 0 ? (
              <div className="px-3 py-2 text-gray-600">
                <span>暂无进行中的流量转发</span>
                {onOpenMeshPage && (
                  <button
                    type="button"
                    className="ml-2 text-blue-600 hover:underline"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={onOpenMeshPage}
                  >
                    前往流量转发
                  </button>
                )}
              </div>
            ) : (
              <div className="px-3 py-2 text-gray-500">无匹配项，可继续手动输入</div>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="space-y-1">
      <input
        ref={inputRef}
        type="text"
        placeholder="dev.v1 或 dev.v1.developer"
        value={value}
        className="w-full rounded border px-2 py-1.5 font-mono text-sm"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter' && filteredMeshes.length === 1) {
            selectMesh(filteredMeshes[0]!);
          }
        }}
      />
      {dropdown}
      {meshUserId ? (
        <p className="text-xs text-gray-600">
          个人标识（配置页）：<code className="font-mono">{meshUserId}</code>
          {value.trim() && resolved && value.trim() !== resolved && (
            <span className="ml-2 text-indigo-700">
              → 将注入 <code className="font-mono">{resolved}</code>
            </span>
          )}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-amber-800">
          <span>未配置个人标识，仅支持输入完整 {MESH_HEADER}</span>
          {onOpenSettings && (
            <button
              type="button"
              className="rounded border border-amber-300 bg-white px-2 py-0.5 hover:bg-amber-50"
              onClick={onOpenSettings}
            >
              前往配置
            </button>
          )}
        </div>
      )}
      {matchedMesh && (
        <p className="text-xs text-green-800">
          已匹配流量转发：{matchedMesh.target} ({matchedMesh.namespace})
          {matchedMesh.localPort !== undefined && ` · :${matchedMesh.localPort}`}
        </p>
      )}
    </div>
  );
}
// [/AI-GEN]
