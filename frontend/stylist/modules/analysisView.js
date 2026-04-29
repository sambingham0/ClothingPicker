const MIN_RAIN_CHANCE_DISPLAY_PERCENT = 10;

function toChancePercent(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.min(100, parsed));
}

function describeRainChance(forecast) {
    if (!forecast || typeof forecast !== 'object') {
        return null;
    }

    const rainChanceSoon = toChancePercent(forecast.rain_chance_percent_next_2_hours);
    const maxRainChanceLater = toChancePercent(forecast.max_rain_chance_percent_later_today);
    const likelyRainLater = forecast.likely_to_rain_later_today === true;
    const possibleRainLater = forecast.possible_rain_later_today === true;

    const hasSoonChance = rainChanceSoon !== null && rainChanceSoon >= MIN_RAIN_CHANCE_DISPLAY_PERCENT;
    const hasLaterChance =
        maxRainChanceLater !== null && maxRainChanceLater >= MIN_RAIN_CHANCE_DISPLAY_PERCENT;

    if (likelyRainLater) {
        if (hasLaterChance) {
            return `${Math.round(maxRainChanceLater)}% chance of rain later`;
        }
        return 'Chance of rain later';
    }

    if (hasSoonChance || hasLaterChance) {
        if (hasLaterChance && (!hasSoonChance || maxRainChanceLater >= rainChanceSoon)) {
            return `${Math.round(maxRainChanceLater)}% chance of light rain later`;
        }
        return `${Math.round(rainChanceSoon)}% chance of light rain soon`;
    }

    if (possibleRainLater) {
        return 'Chance of light rain later';
    }

    return null;
}

function describeSkyCondition(weatherCode, isRainy, isDay) {
    const code = Number(weatherCode);
    if (!Number.isFinite(code)) {
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

function formatWeatherLine(weather) {
    if (!weather || typeof weather !== 'object') {
        return 'Weather unavailable; score is based on structure only.';
    }

    const temperatureC = Number(weather.temperature_c);
    const legacyTemperature = Number(weather.temperature);
    const windKph = Number(weather.wind_kph);
    const windGustKph = Number(weather.wind_gust_kph);
    const legacyWindMph = Number(weather.wind_speed);
    const precipitationMm = Number(weather.precipitation_mm);
    const legacyPrecipitationIn = Number(weather.precipitation);
    const forecast = weather && typeof weather === 'object' ? weather.forecast : null;

    const rainChanceText = describeRainChance(forecast);
    const fetchedAtText = weather.fetched_at_utc ? new Date(weather.fetched_at_utc).toLocaleString() : null;
    const skySummary = describeSkyCondition(weather.weather_code, weather.is_rainy, weather.is_day);

    const segments = [];
    if (Number.isFinite(temperatureC)) {
        const temperatureF = (temperatureC * 9) / 5 + 32;
        segments.push(`Temp ${temperatureF.toFixed(0)}F`);
    } else if (Number.isFinite(legacyTemperature)) {
        segments.push(`Temp ${legacyTemperature.toFixed(0)}F`);
    }

    if (Number.isFinite(windKph)) {
        const windMph = windKph * 0.621371;
        segments.push(`Wind ${windMph.toFixed(0)} mph`);
    } else if (Number.isFinite(legacyWindMph)) {
        segments.push(`Wind ${legacyWindMph.toFixed(0)} mph`);
    }

    if (Number.isFinite(windGustKph) && windGustKph > 0) {
        const gustMph = windGustKph * 0.621371;
        segments.push(`Gust ${gustMph.toFixed(0)} mph`);
    }

    if (Number.isFinite(precipitationMm)) {
        if (precipitationMm > 0) {
            segments.push(`Precip ${precipitationMm.toFixed(1)} mm`);
        } else {
            segments.push(rainChanceText || 'No measurable precipitation');
        }
    } else if (Number.isFinite(legacyPrecipitationIn)) {
        const rain = Number(weather.rain) || 0;
        const snow = Number(weather.snowfall) || 0;
        if (legacyPrecipitationIn > 0 || rain > 0 || snow > 0) {
            segments.push(
                `Precip ${legacyPrecipitationIn.toFixed(2)} in (rain ${rain.toFixed(2)}, snow ${snow.toFixed(2)})`
            );
        } else {
            segments.push(rainChanceText || 'No measurable precipitation');
        }
    } else {
        segments.push(rainChanceText || 'No measurable precipitation');
    }

    segments.push(skySummary);

    if (weather.band) {
        segments.push(`Band ${String(weather.band)}`);
    }

    if (weather.source === 'fallback') {
        segments.push('Using fallback weather');
    }

    if (fetchedAtText) {
        segments.push(`Fetched ${fetchedAtText}`);
    }

    return segments.join(' | ');
}

export function createAnalysisController() {
    const analysisElements = {
        score: null,
        weather: null,
        reasons: null
    };

    function init() {
        analysisElements.score = document.getElementById('analysis-score');
        analysisElements.weather = document.getElementById('analysis-weather');
        analysisElements.reasons = document.getElementById('analysis-reasons');
    }

    function render(payload) {
        if (!analysisElements.score || !analysisElements.weather || !analysisElements.reasons) return;

        const score = Number(payload && payload.score);
        analysisElements.score.textContent = Number.isFinite(score)
            ? `Score: ${score}`
            : 'Score: unavailable';

        analysisElements.weather.textContent = formatWeatherLine(payload ? payload.weather : null);

        const reasons = Array.isArray(payload && payload.reasons) && payload.reasons.length
            ? payload.reasons
            : ['Reasons are not available yet.'];

        analysisElements.reasons.replaceChildren();
        reasons.forEach(reason => {
            const li = document.createElement('li');
            li.textContent = reason;
            analysisElements.reasons.appendChild(li);
        });
    }

    function resetForManualChanges() {
        if (!analysisElements.score || !analysisElements.weather || !analysisElements.reasons) return;
        analysisElements.score.textContent = 'Generated score no longer applies after changes.';
        analysisElements.weather.textContent = 'Generate again to recalculate scoring.';
        analysisElements.reasons.replaceChildren();

        const li = document.createElement('li');
        li.textContent = 'Press Generate Outfit to create a fresh recommendation.';
        analysisElements.reasons.appendChild(li);
    }

    return {
        init,
        render,
        resetForManualChanges
    };
}
