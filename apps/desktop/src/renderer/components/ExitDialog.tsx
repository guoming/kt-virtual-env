interface Props {
  count: number;
  onStopAll: () => void;
  onCancel: () => void;
}

export function ExitDialog({ count, onStopAll, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-96 rounded-lg bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">退出应用</h3>
        <p className="mt-2 text-sm text-gray-600">当前有 {count} 个活跃会话，如何处理？</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded border px-3 py-1 text-sm" onClick={onCancel}>
            取消
          </button>
          <button className="rounded bg-red-600 px-3 py-1 text-sm text-white" onClick={onStopAll}>
            全部停止并退出
          </button>
        </div>
      </div>
    </div>
  );
}
