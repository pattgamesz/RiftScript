// Cross-origin request wrapper using Tampermonkey's GM_xmlhttpRequest
// Falls back to regular fetch if GM_xmlhttpRequest is not available

export function gmFetch(url, options = {}) {
    if (typeof GM_xmlhttpRequest === 'undefined') {
        return fetch(url, options).then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
            return res.json();
        });
    }

    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: options.method || 'GET',
            url,
            headers: options.headers || {},
            onload(response) {
                if (response.status >= 200 && response.status < 300) {
                    try {
                        resolve(JSON.parse(response.responseText));
                    } catch (e) {
                        reject(new Error(`JSON parse error: ${url}`));
                    }
                } else {
                    console.warn(`[RiftScript] HTTP ${response.status} from ${url}:`, response.responseText?.substring(0, 500));
                    reject(new Error(`HTTP ${response.status}: ${url}`));
                }
            },
            onerror(err) {
                reject(new Error(`Request failed: ${url}`));
            },
        });
    });
}

export function gmFetchText(url) {
    if (typeof GM_xmlhttpRequest === 'undefined') {
        return fetch(url).then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
            return res.text();
        });
    }

    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url,
            onload(response) {
                if (response.status >= 200 && response.status < 300) {
                    resolve(response.responseText);
                } else {
                    reject(new Error(`HTTP ${response.status}: ${url}`));
                }
            },
            onerror() {
                reject(new Error(`Request failed: ${url}`));
            },
        });
    });
}
