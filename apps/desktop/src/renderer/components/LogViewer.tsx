interface Props {
  lines: string[];
}

export function LogViewer({ lines }: Props) {
  return (
    <pre className="h-48 overflow-auto rounded bg-gray-900 p-2 text-xs text-green-200">
      {lines.length === 0 ? '等待日志…' : lines.join('\n')}
    </pre>
  );
}
