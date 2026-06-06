interface Props {
  active: boolean;
  onToggle: () => void;
  label: string;
}

// [AI-GEN] scope:FavoriteStarButton, model:auto, reviewed:false
export function FavoriteStarButton({ active, onToggle, label }: Props) {
  return (
    <button
      type="button"
      className={`rounded p-1 transition-colors ${
        active ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400'
      }`}
      title={active ? `取消收藏：${label}` : `收藏：${label}`}
      aria-label={active ? `取消收藏 ${label}` : `收藏 ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
        {active ? (
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        ) : (
          <path
            fillRule="evenodd"
            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
            clipRule="evenodd"
          />
        )}
      </svg>
    </button>
  );
}
// [/AI-GEN]
