import { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  ChevronUp,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/**
 * Sortable, searchable, paginated table with CSV export — the table used by
 * every Agents tab. Ported from the Garuda Firebase design.
 *
 * Columns are `{ header, accessorKey?, cell?, sortable?, className? }`.
 */
export default function DataTable({
  data = [],
  columns = [],
  searchPlaceholder = 'Search records...',
  searchFilterKeys,
  onRowClick,
  actions,
  filters,
  emptyMessage = 'No records found',
  defaultPageSize = 10,
  exportFileName = 'garuda-export.csv',
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const query = searchQuery.toLowerCase().trim();

    return data.filter((row) => {
      if (searchFilterKeys && searchFilterKeys.length > 0) {
        return searchFilterKeys.some((key) => {
          const val = row[key];
          return val !== undefined && val !== null && String(val).toLowerCase().includes(query);
        });
      }
      return Object.values(row).some(
        (val) => val !== undefined && val !== null && String(val).toLowerCase().includes(query)
      );
    });
  }, [data, searchQuery, searchFilterKeys]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredData, sortKey, sortOrder]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;

  // A filter that shrinks the result set can strand the viewer past the last
  // page, which would render an empty table with rows available.
  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, safePage, pageSize]);

  const handleSort = (colKey) => {
    if (!colKey) return;
    if (sortKey === colKey) {
      // asc → desc → unsorted
      if (sortOrder === 'asc') setSortOrder('desc');
      else {
        setSortKey(null);
        setSortOrder('asc');
      }
    } else {
      setSortKey(colKey);
      setSortOrder('asc');
    }
  };

  const handleExportCSV = () => {
    if (sortedData.length === 0) return;

    const headers = columns.map((c) => `"${String(c.header).replace(/"/g, '""')}"`).join(',');
    const rows = sortedData.map((row) =>
      columns
        .map((c) => {
          const val = c.accessorKey ? row[c.accessorKey] : '';
          return `"${String(val ?? '').replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    // A Blob keeps commas, quotes and newlines intact, which encodeURI on a
    // data: URL does not.
    const blob = new Blob([[headers, ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl border border-[#e7e5e4] shadow-sm overflow-hidden flex flex-col">
      {/* Header controls */}
      <div className="p-4 border-b border-[#e7e5e4] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[#78716c] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-[#e7e5e4] bg-[#f5f5f4]/50 focus:bg-white focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
            />
          </div>
          {filters}
        </div>

        <div className="flex items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1c1917] bg-[#f5f5f4] border border-[#e7e5e4] rounded-lg hover:bg-gray-100 transition-colors"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#78716c]" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#f5f5f4]/75 border-b border-[#e7e5e4] text-[11px] font-bold text-[#78716c] uppercase tracking-wider">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  onClick={() => col.sortable && handleSort(col.accessorKey)}
                  className={`py-3 px-4 ${col.className || ''} ${
                    col.sortable ? 'cursor-pointer hover:text-[#1c1917] select-none' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="flex flex-col text-[10px]">
                        {sortKey === col.accessorKey ? (
                          sortOrder === 'asc' ? (
                            <ChevronUp className="w-3.5 h-3.5 text-[#2563EB]" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-[#2563EB]" />
                          )
                        ) : (
                          <span className="opacity-30">↕</span>
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e7e5e4] text-xs font-medium text-[#1c1917]">
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rowIdx) => (
                <tr
                  key={row.id ?? rowIdx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition-colors ${
                    onRowClick ? 'cursor-pointer hover:bg-[#2563EB]/5' : 'hover:bg-[#f5f5f4]/50'
                  }`}
                >
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className={`py-3 px-4 ${col.className || ''}`}>
                      {col.cell
                        ? col.cell(row, rowIdx)
                        : col.accessorKey
                        ? String(row[col.accessorKey] ?? '')
                        : ''}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-[#78716c]">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className="text-sm font-medium">{emptyMessage}</p>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-xs text-[#2563EB] font-semibold hover:underline"
                      >
                        Clear search filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-[#e7e5e4] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#78716c] bg-white">
        <div className="flex items-center gap-2">
          <span>
            Showing{' '}
            <strong className="text-[#1c1917]">
              {sortedData.length === 0 ? 0 : (safePage - 1) * pageSize + 1}
            </strong>{' '}
            to{' '}
            <strong className="text-[#1c1917]">
              {Math.min(safePage * pageSize, sortedData.length)}
            </strong>{' '}
            of <strong className="text-[#1c1917]">{sortedData.length}</strong> records
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="ml-2 px-2 py-1 border border-[#e7e5e4] rounded text-xs text-[#1c1917] bg-white"
          >
            <option value={5}>5 / page</option>
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={safePage === 1}
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            className="p-1.5 rounded border border-[#e7e5e4] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#f5f5f4] text-[#1c1917]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1 font-semibold text-[#1c1917]">
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            className="p-1.5 rounded border border-[#e7e5e4] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#f5f5f4] text-[#1c1917]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
