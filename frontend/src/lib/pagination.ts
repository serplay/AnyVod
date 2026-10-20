export type PageItem = number | 'ellipsis-start' | 'ellipsis-end'

/** Page numbers to display, with ellipses around the current page. */
export function getPageNumbers(page: number, totalPages: number): PageItem[] {
  const maxVisible = 7
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: PageItem[] = [1]
  if (page > 3) pages.push('ellipsis-start')
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (page < totalPages - 2) pages.push('ellipsis-end')
  pages.push(totalPages)
  return pages
}
