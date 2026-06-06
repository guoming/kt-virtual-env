export function PreloadMissing() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-lg font-semibold">未检测到 Electron 桥接</h1>
      <p className="max-w-md text-sm text-gray-600">
        请通过 <code className="rounded bg-gray-100 px-1">pnpm dev</code> 启动桌面应用，
        不要直接在浏览器访问 localhost:5173。
      </p>
      <p className="text-xs text-gray-500">若已在 Electron 中仍看到此页，请完全退出后重新 pnpm dev。</p>
    </div>
  );
}
