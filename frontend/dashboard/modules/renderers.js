import {
  yesNo,
  setText,
  toFiniteNumber,
  formatTimestamp,
  formatTimestampWithRelative,
  describeSkyCondition,
  describeTemperatureCondition,
  describeWindSummaryCondition,
  sentenceCase
} from './formatters.js';

const MIN_RAIN_CHANCE_DISPLAY_PERCENT = 10;

function toRainChancePercent(value) {
  const parsed = toFiniteNumber(value);
  if (parsed === null) {
    return null;
  }
  return Math.max(0, Math.min(100, parsed));
}

function describeRainChancePhraseDetailed(forecast) {
  if (!forecast || typeof forecast !== 'object') {
    return null;
  }

  const rainChanceSoon = toRainChancePercent(forecast.rain_chance_percent_next_2_hours);
  const maxRainChanceLater = toRainChancePercent(forecast.max_rain_chance_percent_later_today);
  const likelyRainLater = forecast.likely_to_rain_later_today === true;
  const possibleRainLater = forecast.possible_rain_later_today === true;

  const hasSoonChance = rainChanceSoon !== null && rainChanceSoon >= MIN_RAIN_CHANCE_DISPLAY_PERCENT;
  const hasLaterChance =
    maxRainChanceLater !== null && maxRainChanceLater >= MIN_RAIN_CHANCE_DISPLAY_PERCENT;

  if (likelyRainLater) {
    if (hasLaterChance) {
      return `${Math.round(maxRainChanceLater)}% chance of rain later`;
    }
    return 'chance of rain later';
  }

  if (hasSoonChance || hasLaterChance) {
    if (hasLaterChance && (!hasSoonChance || maxRainChanceLater >= rainChanceSoon)) {
      return `${Math.round(maxRainChanceLater)}% chance of light rain later`;
    }
    return `${Math.round(rainChanceSoon)}% chance of light rain soon`;
  }

  if (possibleRainLater) {
    return 'chance of light rain later';
  }

  return null;
}

function describeRainChancePhraseSummary(forecast) {
  if (!forecast || typeof forecast !== 'object') {
    return null;
  }

  const rainChanceSoon = toRainChancePercent(forecast.rain_chance_percent_next_2_hours);
  const maxRainChanceLater = toRainChancePercent(forecast.max_rain_chance_percent_later_today);
  const likelyRainLater = forecast.likely_to_rain_later_today === true;
  const likelyDrizzleLater = forecast.likely_to_drizzle_later_today === true;
  const possibleRainLater = forecast.possible_rain_later_today === true;

  const hasSoonChance = rainChanceSoon !== null && rainChanceSoon >= MIN_RAIN_CHANCE_DISPLAY_PERCENT;
  const hasLaterChance =
    maxRainChanceLater !== null && maxRainChanceLater >= MIN_RAIN_CHANCE_DISPLAY_PERCENT;

  if (likelyDrizzleLater) {
    const drizzleConfidence = Math.max(rainChanceSoon || 0, maxRainChanceLater || 0);
    if (drizzleConfidence >= 70) {
      if (hasSoonChance && rainChanceSoon >= maxRainChanceLater) {
        return 'drizzle likely soon';
      }
      return 'drizzle likely later';
    }
    return 'might rain later';
  }

  if (likelyRainLater) {
    if (hasSoonChance && rainChanceSoon >= 80) {
      return 'likely pouring soon';
    }
    if (hasSoonChance && rainChanceSoon >= 50) {
      return 'likely rain soon';
    }
    if (hasLaterChance && maxRainChanceLater >= 75) {
      return 'likely pouring later';
    }
    return 'rain likely later';
  }

  if (possibleRainLater) {
    if (hasSoonChance) {
      return 'might rain soon';
    }
    if (hasLaterChance) {
      return 'might rain later';
    }
    return 'chance of light rain';
  }

  if (hasSoonChance || hasLaterChance) {
    if (hasSoonChance && (!hasLaterChance || rainChanceSoon >= maxRainChanceLater)) {
      return 'chance of light rain soon';
    }
    return 'chance of light rain later';
  }

  return null;
}

export function runtimeStatusLabel(runtime) {
  const status = runtime.status || 'unknown';
  if (status !== 'awaiting-wake-word') {
    return status;
  }

  if (runtime.lastCommandAtUtc) {
    return `${status} (last command ${formatTimestampWithRelative(runtime.lastCommandAtUtc)})`;
  }

  return `${status} (no commands yet)`;
}

export function renderRuntime(elements, runtime) {
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

export function renderActivity(elements, items) {
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

export function renderLogs(elements, entries, logsRequestedAtUtc) {
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

export function renderLogsUnavailable(elements, message) {
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

function joinWithAnd(parts) {
  const values = (parts || []).filter(Boolean);
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

function describeForecastOutlook(weather, windKph, gustKph) {
  const forecast = weather && typeof weather === 'object' ? weather.forecast : null;
  if (!forecast || typeof forecast !== 'object') {
    return null;
  }

  const forecastPhrases = [];
  const rainChancePhrase = describeRainChancePhraseSummary(forecast);

  if (forecast.likely_thunderstorms_tonight === true) {
    forecastPhrases.push('thunderstorms tonight');
  } else if (forecast.likely_to_snow_later_today === true) {
    forecastPhrases.push('snow likely later');
  } else if (rainChancePhrase) {
    forecastPhrases.push(rainChancePhrase);
  }

  const currentWind = toFiniteNumber(windKph) || 0;
  const currentGust = toFiniteNumber(gustKph) || 0;
  const currentPeakWind = Math.max(currentWind, currentGust);
  if (currentPeakWind < 16) {
    if (forecast.likely_to_be_very_windy_later_today === true) {
      forecastPhrases.push('very windy later');
    } else if (forecast.likely_to_be_windy_later_today === true) {
      forecastPhrases.push('wind picking up later');
    }
  }

  if (!forecastPhrases.length) {
    return null;
  }

  return joinWithAnd(forecastPhrases);
}

function describePrecipitationDisplay(weather, precipitationMm) {
  if (precipitationMm === null) {
    return 'unknown';
  }

  if (precipitationMm > 0) {
    return `${(precipitationMm / 25.4).toFixed(2)} in`;
  }

  const forecast = weather && typeof weather === 'object' ? weather.forecast : null;
  if (!forecast || typeof forecast !== 'object') {
    return 'No measurable precipitation';
  }

  const rainChancePhrase = describeRainChancePhraseDetailed(forecast);
  if (rainChancePhrase) {
    return rainChancePhrase.charAt(0).toUpperCase() + rainChancePhrase.slice(1);
  }

  return 'No measurable precipitation';
}

export function renderWeather(elements, payload, errorMessage = null) {
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
  const precipText = describePrecipitationDisplay(weather, precipitationMm);

  const checkedAt = formatTimestamp(weather.fetched_at_utc || payload.requestedAtUtc);
  const skySummaryRaw = describeSkyCondition(weather.weather_code, weather.is_rainy, weather.is_day);
  const skySummary = skySummaryRaw === 'clear' ? 'sunny' : skySummaryRaw;
  const tempSummary = describeTemperatureCondition(temperatureF);
  const windSummaryRaw = describeWindSummaryCondition(windKph, gustKph);
  const windSummary = windSummaryRaw === 'calm' ? 'no wind' : windSummaryRaw;
  const forecastSummary = describeForecastOutlook(weather, windKph, gustKph);

  const summaryParts = [skySummary, tempSummary, windSummary];
  let summaryText = summaryParts.join(', ');
  if (forecastSummary) {
    summaryText = `${summaryText}, and ${forecastSummary}`;
  }

  setText(elements.weatherSummary, sentenceCase(`${summaryText}.`));
  setText(elements.weatherTemp, temperatureText);
  setText(elements.weatherWind, windText);
  setText(elements.weatherPrecip, precipText);
  setText(elements.weatherUpdated, `Fetched: ${checkedAt}`);
}
