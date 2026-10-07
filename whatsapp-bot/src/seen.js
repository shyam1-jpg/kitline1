'use strict';

/** In-memory de-dupe so Meta retries do not send the same reply twice. */
function createSeenStore(limit = 1000) {
  const ids = new Set();
  const order = [];

  return {
    has(id) {
      return ids.has(id);
    },
    add(id) {
      if (!id || ids.has(id)) return;
      ids.add(id);
      order.push(id);
      while (order.length > limit) {
        const old = order.shift();
        ids.delete(old);
      }
    },
    size() {
      return ids.size;
    },
  };
}

module.exports = { createSeenStore };
