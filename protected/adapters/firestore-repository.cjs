"use strict";
/** Persistence port adapter. Domain code treats references as opaque handles.
 * A transaction provides get/create/set/update and snapshots with exists/data().
 * Other stores implement the same port without importing Firebase into core.
 */
class FirestoreRightsRepository {
  constructor(database) {
    this.database = database;
  }
  ref(collection, id) {
    return id === undefined
      ? this.database.collection(collection).doc()
      : this.database.collection(collection).doc(id);
  }
  read(collection, id) {
    return this.ref(collection, id).get();
  }
  runTransaction(work) {
    return this.database.runTransaction(work);
  }
  async append(collection, record) {
    return this.database.collection(collection).add(record);
  }
  async list(collection, filters = []) {
    let query = this.database.collection(collection);
    for (const [field, operator, value] of filters)
      query = query.where(field, operator, value);
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
}
module.exports = { FirestoreRightsRepository };
