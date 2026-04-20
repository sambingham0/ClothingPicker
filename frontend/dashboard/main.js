import {
  formatTimestamp,
  formatTimestampWithRelative,
  getReasonMessage,
  setText
} from './modules/formatters.js';
import {
  renderRuntime,
  renderActivity,
  renderLogs,
  renderLogsUnavailable,
  renderWeather
} from './modules/renderers.js';
import { createSpotifyController } from './modules/spotifyPanel.js';

const POLL_INTERVAL_MS = 1500;
const REFRESH_META_TICK_MS = 1000;

const elements = {
  healthPill: document.getElementById('health-pill'),
  refreshMeta: document.getElementById('refresh-meta'),
  runtimeStatus: document.getElementById('runtime-status'),
  runtimeQuery: document.getElementById('runtime-query'),
  runtimeListening: document.getElementById('runtime-listening'),
  runtimeHeard: document.getElementById('runtime-heard'),
  runtimeHeardAt: document.getElementById('runtime-heard-at'),
  runtimeCommand: document.getElementById('runtime-command'),
  runtimeCommandAt: document.getElementById('runtime-command-at'),
  runtimePlugin: document.getElementById('runtime-plugin'),
  runtimeNotice: document.getElementById('runtime-notice'),
  activitySummary: document.getElementById('activity-summary'),
  activityList: document.getElementById('activity-list'),
  weatherSummary: document.getElementById('weather-summary'),
  weatherTemp: document.getElementById('weather-temp'),
  weatherWind: document.getElementById('weather-wind'),
  weatherPrecip: document.getElementById('weather-precip'),
  weatherUpdated: document.getElementById('weather-updated'),
  spotifySummary: document.getElementById('spotify-summary'),
  spotifyUpdated: document.getElementById('spotify-updated'),
  spotifyEmbedWrap: document.getElementById('spotify-embed-wrap'),
  spotifyEmbed: document.getElementById('spotify-embed'),
  spotifyPrevBtn: document.getElementById('spotify-prev-btn'),
  spotifyToggleBtn: document.getElementById('spotify-toggle-btn'),
  spotifyNextBtn: document.getElementById('spotify-next-btn'),
  spotifyTransferBtn: document.getElementById('spotify-transfer-btn'),
  spotifyVolumeSlider: document.getElementById('spotify-volume-slider'),
  spotifyVolumeValue: document.getElementById('spotify-volume-value'),
  logsSummary: document.getElementById('logs-summary'),
  logFeed: document.getElementById('log-feed'),
  refreshBtn: document.getElementById('refresh-btn')
};

let pollingTimer = null;
let inflightRefresh = null;
let refreshMetaTicker = null;
let lastSuccessfulRefreshAtIso = null;
let lastRefreshFailed = false;

const spotifyController = createSpotifyController(
  elements,
  {
    formatTimestampWithRelative,
    getReasonMessage,
    setText,
    settleMs: 1800
  },
  fetchJson
);

function setPill(pill, text, tone) {
  if (!pill) return;
  pill.textContent = text;
  pill.className = `pill pill-${tone}`;
}

function setRefreshMeta(text) {
  if (elements.refreshMeta) {
    elements.refreshMeta.textContent = text;
  }
}

function updateRefreshMetaTicker() {
  if (lastRefreshFailed || !lastSuccessfulRefreshAtIso) {
    return;
  }

  setRefreshMeta(`Last refresh: ${formatTimestampWithRelative(lastSuccessfulRefreshAtIso)}`);
}

function startRefreshMetaTicker() {
  if (refreshMetaTicker !== null) {
    return;
  }

  refreshMetaTicker = window.setInterval(() => {
    updateRefreshMetaTicker();
  }, REFRESH_META_TICK_MS);
}

function stopRefreshMetaTicker() {
  if (refreshMetaTicker === null) {
    return;
  }

  clearInterval(refreshMetaTicker);
  refreshMetaTicker = null;
}


function renderError(message) {
  renderRuntime(elements, { status: 'error', isSpeaking: false });

  if (elements.runtimeStatus) elements.runtimeStatus.textContent = 'error';
  if (elements.runtimeQuery) elements.runtimeQuery.textContent = '—';
  if (elements.runtimeListening) elements.runtimeListening.textContent = '—';
  if (elements.runtimeHeard) elements.runtimeHeard.textContent = message;
  if (elements.runtimeHeardAt) elements.runtimeHeardAt.textContent = '—';
  if (elements.runtimeCommand) elements.runtimeCommand.textContent = '—';
  if (elements.runtimeCommandAt) elements.runtimeCommandAt.textContent = '—';
  if (elements.runtimePlugin) elements.runtimePlugin.textContent = '—';
  if (elements.runtimeNotice) elements.runtimeNotice.textContent = message;

  if (elements.activitySummary) {
    elements.activitySummary.textContent = message;
  }

  if (elements.activityList) {
    elements.activityList.replaceChildren();
    const item = document.createElement('li');
    item.className = 'activity-empty';
    item.textContent = message;
    elements.activityList.appendChild(item);
  }

  if (elements.logsSummary) {
    elements.logsSummary.textContent = message;
  }

  if (elements.logFeed) {
    elements.logFeed.replaceChildren();
    const item = document.createElement('div');
    item.className = 'log-empty';
    item.textContent = message;
    elements.logFeed.appendChild(item);
  }

  renderWeather(elements, null, message);
  spotifyController.renderSpotify(null, message);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.detail || payload.message || `Request failed (${response.status})`);
  }

  return payload;
}

function setHealthFromRuntime(runtime) {
  const status = runtime?.status || 'unknown';

  if (status === 'error') {
    setPill(elements.healthPill, 'Assistant error', 'bad');
    return;
  }

  if (runtime?.isSpeaking) {
    setPill(elements.healthPill, 'Assistant speaking', 'good');
    return;
  }

  if (status === 'awaiting-wake-word') {
    setPill(elements.healthPill, 'Assistant idle', 'neutral');
    return;
  }

  setPill(elements.healthPill, 'Assistant online', 'good');
}

async function refreshDashboard(options = {}) {
  if (inflightRefresh) {
    return inflightRefresh;
  }

  const manual = Boolean(options.manual);
  if (manual && elements.refreshBtn) {
    elements.refreshBtn.disabled = true;
    elements.refreshBtn.textContent = 'Refreshing...';
  }

  inflightRefresh = (async () => {
    try {
      const [statusResult, logsResult, weatherResult, spotifyResult] = await Promise.allSettled([
        fetchJson('/assistant/status'),
        fetchJson('/assistant/logs?limit=120'),
        fetchJson('/widgets/weather'),
        fetchJson('/widgets/spotify')
      ]);

      if (statusResult.status !== 'fulfilled') {
        throw new Error(getReasonMessage(statusResult.reason, 'Unable to load assistant status.'));
      }

      const statusPayload = statusResult.value;

      const runtime = statusPayload.runtime || {};
      renderRuntime(elements, runtime);
      renderActivity(elements, statusPayload.recentServiceActivity || []);

      if (logsResult.status === 'fulfilled') {
        const logsPayload = logsResult.value;
        renderLogs(elements, logsPayload.entries || [], logsPayload.requestedAtUtc);
      } else {
        renderLogsUnavailable(elements, getReasonMessage(logsResult.reason, 'Assistant logs are temporarily unavailable.'));
      }

      if (weatherResult.status === 'fulfilled') {
        try {
          renderWeather(elements, weatherResult.value);
        } catch (error) {
          renderWeather(elements, null, getReasonMessage(error, 'Weather widget unavailable.'));
        }
      } else {
        renderWeather(elements, null, getReasonMessage(weatherResult.reason, 'Weather widget unavailable.'));
      }

      if (spotifyResult.status === 'fulfilled') {
        try {
          spotifyController.renderSpotify(spotifyResult.value);
        } catch (error) {
          spotifyController.renderSpotify(null, getReasonMessage(error, 'Spotify widget unavailable.'));
        }
      } else {
        spotifyController.renderSpotify(null, getReasonMessage(spotifyResult.reason, 'Spotify widget unavailable.'));
      }

      setHealthFromRuntime(runtime);
      lastSuccessfulRefreshAtIso = new Date().toISOString();
      lastRefreshFailed = false;
      updateRefreshMetaTicker();
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
      lastRefreshFailed = true;
      setPill(elements.healthPill, 'Assistant offline', 'bad');
      renderError(error.message || 'Unable to reach the assistant.');
      setRefreshMeta(`Last refresh failed: ${formatTimestamp(new Date().toISOString())}`);
    } finally {
      if (manual && elements.refreshBtn) {
        elements.refreshBtn.disabled = false;
        elements.refreshBtn.textContent = 'Refresh';
      }
      inflightRefresh = null;
    }
  })();

  return inflightRefresh;
}

function startPolling() {
  if (pollingTimer !== null) {
    return;
  }

  pollingTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      void refreshDashboard();
    }
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollingTimer === null) {
    return;
  }

  clearInterval(pollingTimer);
  pollingTimer = null;
}

spotifyController.bindControls();

if (elements.refreshBtn) {
  elements.refreshBtn.addEventListener('click', () => {
    void refreshDashboard({ manual: true });
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    void refreshDashboard();
    startPolling();
    startRefreshMetaTicker();
    return;
  }

  stopPolling();
  stopRefreshMetaTicker();
});

window.addEventListener('beforeunload', () => {
  stopPolling();
  stopRefreshMetaTicker();
});

void refreshDashboard();
if (document.visibilityState === 'visible') {
  startPolling();
  startRefreshMetaTicker();
}