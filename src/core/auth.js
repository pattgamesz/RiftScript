// Reads the game's Firebase auth token from IndexedDB
// Token is never stored or transmitted anywhere outside the Ironwood API

let authToken = null;

function readTokenFromIndexedDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('firebaseLocalStorageDb');
        req.onerror = () => reject(new Error('Cannot open Firebase IndexedDB'));
        req.onsuccess = () => {
            const db = req.result;
            try {
                const tx = db.transaction('firebaseLocalStorage', 'readonly');
                const store = tx.objectStore('firebaseLocalStorage');
                const getAll = store.getAll();
                getAll.onsuccess = () => {
                    for (const entry of getAll.result || []) {
                        const token = entry?.value?.stsTokenManager?.accessToken;
                        if (token) {
                            resolve(token);
                            return;
                        }
                    }
                    reject(new Error('No auth token found in Firebase storage'));
                };
                getAll.onerror = () => reject(new Error('Failed to read Firebase storage'));
            } catch (e) {
                reject(e);
            }
        };
    });
}

export async function initAuthInterceptor() {
    try {
        authToken = await readTokenFromIndexedDB();
        console.log('[RiftScript] Auth token loaded');
    } catch (e) {
        console.warn('[RiftScript] Could not read auth token:', e.message);
        // Retry after a few seconds in case Firebase hasn't written it yet
        setTimeout(async () => {
            try {
                authToken = await readTokenFromIndexedDB();
                console.log('[RiftScript] Auth token loaded (retry)');
            } catch (e2) {
                console.warn('[RiftScript] Auth token not available:', e2.message);
            }
        }, 5000);
    }
}

export function getAuthToken() {
    return authToken;
}

export function hasAuth() {
    return authToken !== null;
}
