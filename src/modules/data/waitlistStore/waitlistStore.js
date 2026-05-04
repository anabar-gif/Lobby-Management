/**
 * Shared in-memory store for dynamically created waitlists.
 * Module-level singleton — survives LWC component destroy/recreate on tab navigation.
 */

let _waitlists = [];
const _listeners = new Set();

// ── Waitlist rows (datatable) ──────────────────────────────────────────────
let _rows = null; // null = not yet initialised; component seeds it on first mount

export function getRows() {
    return _rows;
}

export function setRows(rows) {
    _rows = rows;
}

// ── Lobby dynamic waitlists ────────────────────────────────────────────────
export function getWaitlists() {
    return _waitlists;
}

export function addWaitlist(waitlist) {
    _waitlists = [..._waitlists, waitlist];
    _listeners.forEach(fn => fn(_waitlists));
}

export function subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
}
