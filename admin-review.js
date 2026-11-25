export function reviewRows(rows, selected) {
  return selected ? [selected, ...rows.filter(row => row.id !== selected.id)] : rows;
}
