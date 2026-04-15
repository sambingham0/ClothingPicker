const POLL_INTERVAL_MS = 1500;
const SPOTIFY_CONTROL_SETTLE_MS = 1800;
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
  spotifyVolDownBtn: document.getElementById('spotify-vol-down-btn'),
  spotifyTransferBtn: document.getElementById('spotify-transfer-btn'),
  spotifyVolUpBtn: document.getElementById('spotify-vol-up-btn'),
  logsSummary: document.getElementById('logs-summary'),
  logFeed: document.getElementById('log-feed'),
  refreshBtn: document.getElementById('refresh-btn')
};

let pollingTimer = null;
let inflightRefresh = null;
let activeSpotifyEmbedUrl = null;
let inflightSpotifyControl = null;
let spotifyIsPlaying = null;
let spotifyCurrentTrackUri = null;
let spotifyControlSettleUntil = 0;
let spotifyPendingIsPlaying = null;
let spotifyPendingPreviousTrackUri = null;
let refreshMetaTicker = null;
let lastSuccessfulRefreshAtIso = null;
let lastRefreshFailed = false;

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTimestamp(value) {
  const parsed = parseDate(value);
  if (!parsed) return value ? String(value) : 'unknown';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(parsed);
}

function formatRelativeTime(value) {
  const parsed = parseDate(value);
  if (!parsed) return value ? String(value) : 'unknown';

  const deltaMs = Date.now() - parsed.getTime();
  const absMs = Math.abs(deltaMs);

  if (absMs < 1000) {
    return 'just now';
  }

  const units = [
    { name: 'day', ms: 24 * 60 * 60 * 1000 },
    { name: 'hour', ms: 60 * 60 * 1000 },
    { name: 'minute', ms: 60 * 1000 },
    { name: 'second', ms: 1000 }
  ];

  for (const unit of units) {
    if (absMs >= unit.ms) {
      const count = Math.floor(absMs / unit.ms);
      const suffix = count === 1 ? '' : 's';
      return deltaMs >= 0
        ? `${count} ${unit.name}${suffix} ago`
        : `in ${count} ${unit.name}${suffix}`;
    }
  }

  return 'just now';
}

function formatTimestampWithRelative(value) {
  if (!value) return 'unknown';

  const absolute = formatTimestamp(value);
  const relative = formatRelativeTime(value);
  return relative === 'just now'
    ? `${absolute} (just now)`
    : `${absolute} (${relative})`;
}

function yesNo(value) {
  return value ? 'Yes' : 'No';
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function setText(node, value) {
  if (node) {
    node.textContent = value;
  }
}

function formatMinutesSeconds(totalMs) {
  const safeMs = toFiniteNumber(totalMs);
  if (safeMs === null) return '—';

  const totalSeconds = Math.max(0, Math.round(safeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function describeWindSummaryCondition(windKph, gustKph) {
  const baseKph = toFiniteNumber(windKph);
  const peakKph = toFiniteNumber(gustKph);

  if (baseKph === null && peakKph === null) {
    return 'wind unknown';
  }

  const baseMph = baseKph === null ? 0 : baseKph * 0.621371;
  const peakMph = peakKph === null ? baseMph : Math.max(baseMph, peakKph * 0.621371);

  if (peakMph < 8) {
    return 'calm';
  }

  if (peakMph < 16) {
    return 'breezy';
  }

  if (peakMph < 26) {
    return 'windy';
  }

  return 'very windy';
}

function describeTemperatureCondition(temperatureF) {
  const temp = toFiniteNumber(temperatureF);
  if (temp === null) {
    return 'temperature unknown';
  }

  if (temp < 25) {
    return 'frigid';
  }

  if (temp < 40) {
    return 'chilly';
  }

  if (temp < 60) {
    return 'cool';
  }

  if (temp < 75) {
    return 'mild';
  }

  if (temp < 86) {
    return 'warm';
  }

  return 'hot';
}

function describeSkyCondition(weatherCode, isRainy) {
  const code = toFiniteNumber(weatherCode);
  if (code === null) {
    return isRainy ? 'rainy' : 'conditions unclear';
  }

  if (code === 0) return 'clear';
  if (code === 1) return 'mostly clear';
  if (code === 2) return 'partly cloudy';
  if (code === 3) return 'cloudy';

  if (code === 45 || code === 48) return 'foggy';

  if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) return 'drizzly';
  if (code === 61 || code === 63 || code === 65 || code === 66 || code === 67) return 'rainy';
  if (code === 80 || code === 81 || code === 82) return 'showery';

  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return 'snowy';

  if (code === 95 || code === 96 || code === 99) return 'stormy';

  return isRainy ? 'rainy' : 'cloudy';
}

function sentenceCase(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return value;
  }

  const trimmed = value.trim();
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function formatSpotifyProgress(progressMs, durationMs) {
  const safeDuration = toFiniteNumber(durationMs);
  const safeProgress = toFiniteNumber(progressMs);

  if (safeDuration === null && safeProgress === null) {
    return '—';
  }

  if (safeDuration === null) {
    return formatMinutesSeconds(safeProgress);
  }

  if (safeProgress === null) {
    return `0:00 / ${formatMinutesSeconds(safeDuration)}`;
  }

  return `${formatMinutesSeconds(safeProgress)} / ${formatMinutesSeconds(safeDuration)}`;
}

function getReasonMessage(reason, fallback) {
  if (reason instanceof Error && reason.message) {
    return reason.message;
  }

  if (typeof reason === 'string' && reason.trim()) {
    return reason.trim();
  }

  return fallback;
}

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

function setSpotifyEmbed(url) {
  if (!elements.spotifyEmbed) return;

  const nextUrl = typeof url === 'string' && url.trim() ? url.trim() : null;
  if (!nextUrl) {
    elements.spotifyEmbed.hidden = true;
    if (elements.spotifyEmbedWrap) {
      elements.spotifyEmbedWrap.hidden = true;
    }
    if (activeSpotifyEmbedUrl !== null) {
      elements.spotifyEmbed.removeAttribute('src');
      activeSpotifyEmbedUrl = null;
    }
    return;
  }

  if (activeSpotifyEmbedUrl !== nextUrl) {
    elements.spotifyEmbed.src = nextUrl;
    activeSpotifyEmbedUrl = nextUrl;
  }
  elements.spotifyEmbed.hidden = false;
  if (elements.spotifyEmbedWrap) {
    elements.spotifyEmbedWrap.hidden = false;
  }
}

function spotifyControlButtons() {
  return [
    elements.spotifyPrevBtn,
    elements.spotifyToggleBtn,
    elements.spotifyNextBtn,
    elements.spotifyVolDownBtn,
    elements.spotifyTransferBtn,
    elements.spotifyVolUpBtn
  ].filter(Boolean);
}

function updateSpotifyToggleButton() {
  if (!elements.spotifyToggleBtn) return;
  elements.spotifyToggleBtn.textContent = spotifyIsPlaying === true ? 'Pause' : 'Play';
}

function updateSpotifyControlButtons() {
  const disabled = inflightSpotifyControl !== null;
  for (const button of spotifyControlButtons()) {
    button.disabled = disabled;
  }
}

function isSpotifyControlSettling() {
  return Date.now() < spotifyControlSettleUntil;
}

function beginSpotifyControlSettle(action) {
  spotifyControlSettleUntil = Date.now() + SPOTIFY_CONTROL_SETTLE_MS;

  if (action === 'play') {
    spotifyPendingIsPlaying = true;
  } else if (action === 'pause') {
    spotifyPendingIsPlaying = false;
  } else {
    spotifyPendingIsPlaying = null;
  }

  if (action === 'next' || action === 'previous') {
    spotifyPendingPreviousTrackUri = spotifyCurrentTrackUri;
  } else {
    spotifyPendingPreviousTrackUri = null;
  }
}

function clearSpotifyControlSettle() {
  spotifyControlSettleUntil = 0;
  spotifyPendingIsPlaying = null;
  spotifyPendingPreviousTrackUri = null;
}

async function refreshSpotifyWidget() {
  try {
    const payload = await fetchJson('/widgets/spotify');
    renderSpotify(payload);
  } catch (error) {
    console.error('Unable to refresh Spotify widget:', error);
  }
}

function runtimeStatusLabel(runtime) {
  const status = runtime.status || 'unknown';
  if (status !== 'awaiting-wake-word') {
    return status;
  }

  if (runtime.lastCommandAtUtc) {
    return `${status} (last command ${formatRelativeTime(runtime.lastCommandAtUtc)})`;
  }

  return `${status} (no commands yet)`;
}

function renderRuntime(runtime) {
  if (!runtime) runtime = {};

  if (elements.runtimeStatus) elements.runtimeStatus.textContent = runtimeStatusLabel(runtime);
  if (elements.runtimeQuery) elements.runtimeQuery.textContent = yesNo(runtime.queryModeActive);
  if (elements.runtimeListening) elements.runtimeListening.textContent = yesNo(runtime.isListeningForCommand);
  if (elements.runtimeHeard) elements.runtimeHeard.textContent = runtime.lastHeardTranscript || '—';
  if (elements.runtimeHeardAt) elements.runtimeHeardAt.textContent = formatTimestampWithRelative(runtime.lastHeardAtUtc);
  if (elements.runtimeCommand) elements.runtimeCommand.textContent = runtime.lastCommand || '—';
  if (elements.runtimeCommandAt) elements.runtimeCommandAt.textContent = formatTimestampWithRelative(runtime.lastCommandAtUtc);

  if (elements.runtimePlugin) {
    const handled = runtime.lastCommandHandled;
    const plugin = runtime.lastHandledPlugin || '—';
    elements.runtimePlugin.textContent = handled === null || handled === undefined
      ? '—'
      : `${plugin} (${handled ? 'handled' : 'not handled'})`;
  }

  if (elements.runtimeNotice) elements.runtimeNotice.textContent = runtime.lastNotice || '—';
}

function renderActivity(items) {
  if (!elements.activityList) return;

  elements.activityList.replaceChildren();

  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'activity-empty';
    empty.textContent = 'No service activity yet.';
    elements.activityList.appendChild(empty);
    if (elements.activitySummary) {
      elements.activitySummary.textContent = 'No service activity has been recorded yet.';
    }
    return;
  }

  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'activity-item';

    const title = document.createElement('strong');
    title.textContent = item.serviceName || 'unknown';

    const meta = document.createElement('span');
    meta.textContent = formatTimestampWithRelative(item.lastSeenAtUtc);

    li.appendChild(title);
    li.appendChild(document.createElement('br'));
    li.appendChild(meta);
    elements.activityList.appendChild(li);
  });

  if (elements.activitySummary) {
    const latest = items[0];
    elements.activitySummary.textContent = `Latest service activity: ${formatTimestampWithRelative(latest?.lastSeenAtUtc)}. Services tracked: ${items.length}.`;
  }
}

function renderLogs(entries, logsRequestedAtUtc) {
  if (!elements.logFeed) return;

  elements.logFeed.replaceChildren();

  if (!Array.isArray(entries) || entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'log-empty';
    empty.textContent = 'No assistant logs yet.';
    elements.logFeed.appendChild(empty);
    if (elements.logsSummary) {
      elements.logsSummary.textContent = `No logs captured. Last checked: ${formatTimestampWithRelative(logsRequestedAtUtc)}.`;
    }
    return;
  }

  const displayedEntries = [...entries].reverse();

  displayedEntries.forEach(entry => {
    const row = document.createElement('article');
    row.className = 'log-entry';

    const meta = document.createElement('div');
    meta.className = 'log-meta';

    const timestamp = document.createElement('span');
    timestamp.textContent = formatTimestamp(entry.timestampUtc);

    const stream = document.createElement('span');
    stream.textContent = entry.stream || 'stdout';

    meta.appendChild(timestamp);
    meta.appendChild(stream);

    const message = document.createElement('div');
    message.className = 'log-message';
    message.textContent = entry.message || '';

    row.appendChild(meta);
    row.appendChild(message);
    elements.logFeed.appendChild(row);
  });

  if (elements.logsSummary) {
    const latest = displayedEntries[0];
    elements.logsSummary.textContent = `Showing ${entries.length} log entries. Latest: ${formatTimestampWithRelative(latest?.timestampUtc)}. Last checked: ${formatTimestampWithRelative(logsRequestedAtUtc)}.`;
  }
}

function renderLogsUnavailable(message) {
  if (elements.logFeed) {
    elements.logFeed.replaceChildren();
    const item = document.createElement('div');
    item.className = 'log-empty';
    item.textContent = message;
    elements.logFeed.appendChild(item);
  }

  if (elements.logsSummary) {
    elements.logsSummary.textContent = message;
  }
}

function renderWeather(payload, errorMessage = null) {
  const weather = payload && typeof payload === 'object' ? payload.weather : null;

  if (errorMessage || !weather || typeof weather !== 'object') {
    const message = errorMessage || 'Weather widget unavailable.';
    setText(elements.weatherSummary, message);
    setText(elements.weatherTemp, '—');
    setText(elements.weatherWind, '—');
    setText(elements.weatherPrecip, '—');
    setText(elements.weatherUpdated, '—');
    return;
  }

  const temperatureC = toFiniteNumber(weather.temperature_c);
  const temperatureF = temperatureC === null ? null : ((temperatureC * 9) / 5) + 32;
  const temperatureText = temperatureF === null ? 'unknown' : `${Math.round(temperatureF)}F`;

  const windKph = toFiniteNumber(weather.wind_kph);
  const gustKph = toFiniteNumber(weather.wind_gust_kph);
  const windMph = windKph === null ? null : (windKph * 0.621371);
  const gustMph = gustKph === null ? null : (gustKph * 0.621371);
  const windText = windKph === null
    ? 'unknown'
    : gustMph !== null && gustMph > 0
      ? `Wind: ${windMph.toFixed(0)} mph | Gusts: ${gustMph.toFixed(0)} mph`
      : `Wind: ${windMph.toFixed(0)} mph`;

  const precipitationMm = toFiniteNumber(weather.precipitation_mm);
  const precipText = precipitationMm === null
    ? 'unknown'
    : precipitationMm > 0
      ? `${(precipitationMm / 25.4).toFixed(2)} in`
      : 'No measurable precipitation';

  const checkedAt = formatTimestampWithRelative(payload.requestedAtUtc);
  const skySummary = describeSkyCondition(weather.weather_code, weather.is_rainy);
  const tempSummary = describeTemperatureCondition(temperatureF);
  const windSummary = describeWindSummaryCondition(windKph, gustKph);

  setText(elements.weatherSummary, sentenceCase(`${skySummary} and ${tempSummary} and ${windSummary}.`));
  setText(elements.weatherTemp, temperatureText);
  setText(elements.weatherWind, windText);
  setText(elements.weatherPrecip, precipText);
  setText(elements.weatherUpdated, checkedAt);
}

function renderSpotify(payload, errorMessage = null) {
  if (errorMessage || !payload || typeof payload !== 'object') {
    const message = errorMessage || 'Spotify widget unavailable.';
    setText(elements.spotifySummary, message);
    setText(elements.spotifyUpdated, '—');
    setSpotifyEmbed(null);
    spotifyIsPlaying = null;
    spotifyCurrentTrackUri = null;
    updateSpotifyToggleButton();
    updateSpotifyControlButtons();
    return;
  }

  const available = payload.available === true;
  const track = payload.track && typeof payload.track === 'object' ? payload.track : null;
  const device = payload.device && typeof payload.device === 'object' ? payload.device : null;
  const isPlaying = payload.isPlaying === true ? true : payload.isPlaying === false ? false : null;
  const incomingTrackUri = typeof track?.uri === 'string' && track.uri.trim() ? track.uri.trim() : null;

  const settling = isSpotifyControlSettling();
  let effectiveIsPlaying = isPlaying;
  if (settling && spotifyPendingIsPlaying !== null && isPlaying !== spotifyPendingIsPlaying) {
    effectiveIsPlaying = spotifyPendingIsPlaying;
  } else if (spotifyPendingIsPlaying !== null && isPlaying === spotifyPendingIsPlaying) {
    spotifyPendingIsPlaying = null;
  }

  let effectiveTrackUri = incomingTrackUri;
  let effectiveEmbedUrl = typeof payload.embedUrl === 'string' && payload.embedUrl.trim()
    ? payload.embedUrl.trim()
    : null;

  if (settling && spotifyPendingPreviousTrackUri && incomingTrackUri === spotifyPendingPreviousTrackUri) {
    effectiveTrackUri = spotifyCurrentTrackUri;
    effectiveEmbedUrl = activeSpotifyEmbedUrl;
  } else if (spotifyPendingPreviousTrackUri && incomingTrackUri && incomingTrackUri !== spotifyPendingPreviousTrackUri) {
    spotifyPendingPreviousTrackUri = null;
  }

  if (!settling) {
    spotifyPendingPreviousTrackUri = null;
    spotifyPendingIsPlaying = null;
  }

  let statusText = 'Unavailable';
  if (available && effectiveIsPlaying === true) {
    statusText = 'Playing';
  } else if (available && effectiveIsPlaying === false && (track || effectiveTrackUri)) {
    statusText = 'Paused';
  } else if (available) {
    statusText = 'Idle';
  }

  const updatedText = formatTimestampWithRelative(payload.requestedAtUtc);
  const messageText = typeof payload.message === 'string' && payload.message.trim()
    ? payload.message.trim()
    : available
      ? 'Spotify is connected.'
      : 'Spotify is unavailable.';

  const deviceName = typeof device?.name === 'string' && device.name.trim() ? device.name.trim() : null;
  const summarySuffix = deviceName ? ` on ${deviceName}` : '';
  const summaryText = available
    ? `${statusText}${summarySuffix}.`
    : `${statusText}${summarySuffix}. ${messageText}`;

  setText(elements.spotifySummary, summaryText);
  setText(elements.spotifyUpdated, updatedText);
  setSpotifyEmbed(effectiveEmbedUrl);

  spotifyIsPlaying = effectiveIsPlaying;
  if (effectiveTrackUri) {
    spotifyCurrentTrackUri = effectiveTrackUri;
  } else if (!available) {
    spotifyCurrentTrackUri = null;
  }
  updateSpotifyToggleButton();
  updateSpotifyControlButtons();
}

function renderError(message) {
  renderRuntime({ status: 'error', isSpeaking: false });

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

  renderWeather(null, message);
  renderSpotify(null, message);
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

async function sendSpotifyControl(action) {
  if (inflightSpotifyControl) {
    return;
  }

  beginSpotifyControlSettle(action);

  const previousPlaying = spotifyIsPlaying;

  if (action === 'play') {
    spotifyIsPlaying = true;
    updateSpotifyToggleButton();
  } else if (action === 'pause') {
    spotifyIsPlaying = false;
    updateSpotifyToggleButton();
  }

  inflightSpotifyControl = action;
  updateSpotifyControlButtons();
  const actionLabelMap = {
    previous: 'previous',
    play: 'play',
    pause: 'pause',
    next: 'next',
    volume_down: 'volume down',
    volume_up: 'volume up',
    transfer_here: 'transfer'
  };
  const actionLabel = actionLabelMap[action] || action;

  try {
    const response = await fetch('/widgets/spotify/control', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      cache: 'no-store',
      body: JSON.stringify({ action })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok !== true) {
      throw new Error(payload.message || `Spotify command failed (${response.status}).`);
    }

    window.setTimeout(() => {
      void refreshSpotifyWidget();
    }, 250);
  } catch (error) {
    spotifyIsPlaying = previousPlaying;
    updateSpotifyToggleButton();
    clearSpotifyControlSettle();
    console.error(getReasonMessage(error, `Unable to send Spotify ${actionLabel} command.`));
  } finally {
    inflightSpotifyControl = null;
    updateSpotifyControlButtons();
  }
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
      renderRuntime(runtime);
      renderActivity(statusPayload.recentServiceActivity || []);

      if (logsResult.status === 'fulfilled') {
        const logsPayload = logsResult.value;
        renderLogs(logsPayload.entries || [], logsPayload.requestedAtUtc);
      } else {
        renderLogsUnavailable(getReasonMessage(logsResult.reason, 'Assistant logs are temporarily unavailable.'));
      }

      if (weatherResult.status === 'fulfilled') {
        try {
          renderWeather(weatherResult.value);
        } catch (error) {
          renderWeather(null, getReasonMessage(error, 'Weather widget unavailable.'));
        }
      } else {
        renderWeather(null, getReasonMessage(weatherResult.reason, 'Weather widget unavailable.'));
      }

      if (spotifyResult.status === 'fulfilled') {
        try {
          renderSpotify(spotifyResult.value);
        } catch (error) {
          renderSpotify(null, getReasonMessage(error, 'Spotify widget unavailable.'));
        }
      } else {
        renderSpotify(null, getReasonMessage(spotifyResult.reason, 'Spotify widget unavailable.'));
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

const spotifyControlBindings = [
  [elements.spotifyPrevBtn, 'previous'],
  [elements.spotifyNextBtn, 'next'],
  [elements.spotifyVolDownBtn, 'volume_down'],
  [elements.spotifyVolUpBtn, 'volume_up']
];

for (const [button, action] of spotifyControlBindings) {
  if (!button) continue;
  button.addEventListener('click', () => {
    void sendSpotifyControl(action);
  });
}

if (elements.spotifyToggleBtn) {
  elements.spotifyToggleBtn.addEventListener('click', () => {
    const action = spotifyIsPlaying === true ? 'pause' : 'play';
    void sendSpotifyControl(action);
  });
}

if (elements.spotifyTransferBtn) {
  elements.spotifyTransferBtn.addEventListener('click', () => {
    void sendSpotifyControl('transfer_here');
  });
}

updateSpotifyToggleButton();
updateSpotifyControlButtons();

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