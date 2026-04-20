const REQUEST_TIMEOUT_MS = 9000;
const REQUEST_RETRY_COUNT = 1;
const REQUEST_RETRY_BASE_DELAY_MS = 300;

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

function wait(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
}

function isRetryableStatus(statusCode) {
    return RETRYABLE_STATUS_CODES.has(Number(statusCode));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } finally {
        window.clearTimeout(timeoutId);
    }
}

export async function fetchJsonWithRetry(
    url,
    options = {},
    { timeoutMs = REQUEST_TIMEOUT_MS, retries = REQUEST_RETRY_COUNT } = {}
) {
    const totalAttempts = Math.max(0, Number(retries) || 0) + 1;
    let finalError = null;

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
        const isLastAttempt = attempt === totalAttempts;

        try {
            const response = await fetchWithTimeout(url, options, timeoutMs);
            const payload = await response.json().catch(() => ({}));

            if (response.ok) {
                return payload;
            }

            const message = payload.detail || payload.message || `Request failed (${response.status})`;
            const statusError = new Error(message);
            statusError.statusCode = response.status;

            if (!isLastAttempt && isRetryableStatus(response.status)) {
                await wait(REQUEST_RETRY_BASE_DELAY_MS * attempt);
                continue;
            }

            throw statusError;
        } catch (error) {
            finalError = error;
            const isAbort = error && error.name === 'AbortError';
            const isNetworkError = isAbort || error instanceof TypeError;

            if (!isLastAttempt && isNetworkError) {
                await wait(REQUEST_RETRY_BASE_DELAY_MS * attempt);
                continue;
            }

            if (isAbort) {
                throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`);
            }

            throw error;
        }
    }

    throw finalError || new Error('Request failed.');
}
