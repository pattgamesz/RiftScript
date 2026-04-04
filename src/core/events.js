// Simple pub-sub event bus with last-event caching
const handlers = {};
const cache = {};

export function on(name, handler) {
    if (!handlers[name]) handlers[name] = [];
    handlers[name].push(handler);
    // Replay last cached event to new subscriber
    if (cache[name] !== undefined) {
        try { handler(cache[name]); } catch(e) { console.error('[RiftScript]', name, e); }
    }
}

export function emit(name, data) {
    cache[name] = data;
    if (!handlers[name]) return;
    for (const handler of handlers[name]) {
        try { handler(data); } catch(e) { console.error('[RiftScript]', name, e); }
    }
}

export function last(name) {
    return cache[name];
}
