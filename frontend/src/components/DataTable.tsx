interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onView?: (item: T) => void;
  actions?: (item: T) => React.ReactNode;
}

export default function DataTable<T extends { id: number | string }>({
  columns,
  data,
  loading = false,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  onEdit,
  onDelete,
  onView,
  actions,
}: DataTableProps<T>) {
  return (
    <div>
      {onSearchChange && (
        <div className="mb-4">
          <input
            type="text"
            value={searchValue || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
          />
        </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map((col) => (
                <th key={col.key} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {col.label}
                </th>
              ))}
              {(onEdit || onDelete || actions) && (
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-gray-400">
                  No records found.
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-gray-900">
                      {col.render ? col.render(item) : (item as unknown as Record<string, React.ReactNode>)[col.key]}
                    </td>
                  ))}
                  {(onEdit || onDelete || onView || actions) && (
                    <td className="px-4 py-3 text-right space-x-2">
                      {actions ? (
                        actions(item)
                      ) : (
                        <>
                          {onView && (
                        <button
                          onClick={() => onView(item)}
                          className="text-gray-600 hover:text-gray-800 text-xs font-medium cursor-pointer"
                        >
                          View
                        </button>
                      )}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(item)}
                          className="text-indigo-600 hover:text-indigo-800 text-xs font-medium cursor-pointer"
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(item)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
