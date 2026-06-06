export type ServiceListTab = 'all' | 'favorites' | 'active';

interface TabCounts {
  all: number;
  favorites: number;
  active: number;
}

interface Props {
  tab: ServiceListTab;
  counts: TabCounts;
  onTabChange: (tab: ServiceListTab) => void;
  onStopAll?: () => void;
}

const TABS: Array<{ id: ServiceListTab; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'favorites', label: '收藏' },
  { id: 'active', label: '进行中' },
];

// [AI-GEN] scope:ServiceListTabs, model:auto, reviewed:false
export function ServiceListTabs({ tab, counts, onTabChange, onStopAll }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b">
      <div className="flex gap-1">
        {TABS.map((item) => {
          const count = counts[item.id];
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`rounded-t px-3 py-2 text-sm transition-colors ${
                active
                  ? 'border border-b-0 border-gray-200 bg-white font-medium text-blue-800'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
              onClick={() => onTabChange(item.id)}
            >
              {item.label}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                  active ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
      {tab === 'active' && counts.active > 0 && onStopAll && (
        <button
          type="button"
          className="mb-1 text-xs text-red-600 hover:underline"
          onClick={onStopAll}
        >
          停止全部
        </button>
      )}
    </div>
  );
}
// [/AI-GEN]
