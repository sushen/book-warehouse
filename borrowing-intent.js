export async function prepareBorrowing(store, copyId) {
  if (!store.user()) await store.signInGoogle();
  if (!store.user()) throw new Error('signInRequired');
  await store.ensureReader();
  const profile = await store.profile();
  if (!profile?.displayName?.trim()) return { code: 'profileRequired' };
  const copy = await store.getCopy(copyId);
  if (!copy || copy.availability !== 'available' || copy.activeRequestId !== null) {
    return { code: 'copyUnavailable' };
  }
  return { code: 'ready', copy, profile };
}
