// A reader chooses a title at a library; circulation still locks one exact copy.
export function groupHoldings(copies) {
  const groups = new Map();
  for (const copy of copies) {
    const key = JSON.stringify([copy.editionId, copy.libraryId]);
    if (!groups.has(key)) groups.set(key, { key, copies: [], availableCopies: [] });
    const group = groups.get(key); group.copies.push(copy);
    if (copy.availability === 'available' && copy.activeRequestId === null) group.availableCopies.push(copy);
  }
  for (const group of groups.values()) {
    group.availableCopies.sort((a,b) => String(a.id).localeCompare(String(b.id)));
    group.selectedCopy = group.availableCopies[0] || group.copies[0];
  }
  return [...groups.values()];
}
