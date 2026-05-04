/**
 * Shared in-memory store for dynamically created waitlists.
 * Both waitlistManagement (writer) and lobbyManagement (reader) import this
 * module — because LWC bundles everything into a single JS file, the module
 * instance is the same object, giving us a true singleton.
 */

let _waitlists = [];
const _listeners = new Set();

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
