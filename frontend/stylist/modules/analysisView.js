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

    if (weather.band) {
        segments.push(`Band ${String(weather.band)}`);
    }

    if (weather.source === 'fallback') {
        segments.push('Using fallback weather');
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
