export function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatTimestamp(value) {
  const parsed = parseDate(value);
  if (!parsed) return value ? String(value) : 'unknown';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(parsed);
}

export function formatRelativeTime(value) {
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

export function formatTimestampWithRelative(value) {
  if (!value) return 'unknown';

  const absolute = formatTimestamp(value);
  const relative = formatRelativeTime(value);
  return relative === 'just now'
    ? `${absolute} (just now)`
    : `${absolute} (${relative})`;
}

export function yesNo(value) {
  return value ? 'Yes' : 'No';
}

export function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setText(node, value) {
  if (node) {
    node.textContent = value;
  }
}

export function formatMinutesSeconds(totalMs) {
  const safeMs = toFiniteNumber(totalMs);
  if (safeMs === null) return '—';

  const totalSeconds = Math.max(0, Math.round(safeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function describeWindSummaryCondition(windKph, gustKph) {
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

export function describeTemperatureCondition(temperatureF) {
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

export function describeSkyCondition(weatherCode, isRainy, isDay = null) {
  const code = toFiniteNumber(weatherCode);
  if (code === null) {
    return isRainy ? 'rainy' : 'conditions unclear';
  }

  if (code === 0) return isDay === false ? 'clear night' : 'clear';
  if (code === 1) return isDay === false ? 'mostly clear night' : 'mostly clear';
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

export function sentenceCase(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return value;
  }

  const trimmed = value.trim();
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

export function formatSpotifyProgress(progressMs, durationMs) {
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

export function getReasonMessage(reason, fallback) {
  if (reason instanceof Error && reason.message) {
    return reason.message;
  }

  if (typeof reason === 'string' && reason.trim()) {
    return reason.trim();
  }

  return fallback;
}
