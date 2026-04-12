import {
    API_BASE_URL,
    IMAGE_BASE_URL,
    CLOTHING_API_URL,
    SECTION_IDS,
    METADATA_FIELDS,
    sectionConfig,
    applyLayerAdjustment
} from './config.js';

import {
    createState,
    getItems,
    getCurrentItem,
    rotateSectionState,
    removeCurrentItemFromSection,
    groupClothesBySection,
    enforceUniqueSelection
} from './store.js';

const state = createState();

const analysisElements = {
    score: null,
    weather: null,
    reasons: null
};

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
            segments.push('No measurable precipitation');
        }
    } else if (Number.isFinite(legacyPrecipitationIn)) {
        const rain = Number(weather.rain) || 0;
        const snow = Number(weather.snowfall) || 0;
        if (legacyPrecipitationIn > 0 || rain > 0 || snow > 0) {
            segments.push(
                `Precip ${legacyPrecipitationIn.toFixed(2)} in (rain ${rain.toFixed(2)}, snow ${snow.toFixed(2)})`
            );
        } else {
            segments.push('No measurable precipitation');
        }
    } else {
        segments.push('No measurable precipitation');
    }

    if (weather.band) {
        segments.push(`Band ${String(weather.band)}`);
    }

    if (weather.source === 'fallback') {
        segments.push('Using fallback weather');
    }

    return segments.join(' | ');
}

function renderAnalysis(payload) {
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

function resetAnalysisForManualChanges() {
    if (!analysisElements.score || !analysisElements.weather || !analysisElements.reasons) return;
    analysisElements.score.textContent = 'Generated score no longer applies after changes.';
    analysisElements.weather.textContent = 'Generate again to recalculate scoring.';
    analysisElements.reasons.replaceChildren();

    const li = document.createElement('li');
    li.textContent = 'Press Generate Outfit to create a fresh recommendation.';
    analysisElements.reasons.appendChild(li);
}

function formatMetadataValue(value) {
    if (Array.isArray(value)) {
        const cleaned = value
            .map(item => String(item || '').trim())
            .filter(Boolean);
        return cleaned.length ? cleaned.join(', ') : '-';
    }

    if (value === null || value === undefined) return '-';
    const text = String(value).trim();
    return text || '-';
}

function renderMetadata(section, item) {
    if (!section || !section.metadataValues) return;

    METADATA_FIELDS.forEach(field => {
        const target = section.metadataValues[field.key];
        if (!target) return;
        target.textContent = formatMetadataValue(item ? item[field.key] : null);
    });
}

function renderSection(sectionId) {
    const section = state.sectionElements[sectionId];
    const slot = state.canvasSlots[sectionId];
    const items = getItems(state, sectionId);
    const isDeleting = state.deleting[sectionId] === true;
    const generatedValue = state.generatedOutfit[sectionId];
    const item = state.generatedOutfitActive
        ? items.find(entry => entry.id === generatedValue) || null
        : getCurrentItem(state, sectionId);

    if (!section) return;

    renderMetadata(section, item);
    const disableNavigation = isDeleting || items.length <= 1;

    if (section.prevBtn) section.prevBtn.disabled = disableNavigation;
    if (section.nextBtn) section.nextBtn.disabled = disableNavigation;

    if (section.deleteBtn) {
        section.deleteBtn.disabled = isDeleting || !item;
        section.deleteBtn.textContent = isDeleting ? 'Deleting...' : 'Delete';
    }

    if (!items.length) {
        section.status.textContent = 'No items';
    } else {
        section.status.textContent = `${state.activeIndex[sectionId] + 1}/${items.length}`;
    }

    if (!slot) return;

    if (!item) {
        slot.style.display = 'none';
        slot.removeAttribute('src');
        slot.alt = '';
    } else {
        slot.src = IMAGE_BASE_URL + item.image_path;
        slot.alt = item.type || 'Clothing item';
        slot.style.display = 'block';
    }
}

function renderSections() {
    SECTION_IDS.forEach(sectionId => {
        renderSection(sectionId);
    });
}

function applyOutfitBySection(sectionOutfit) {
    if (!sectionOutfit || typeof sectionOutfit !== 'object') {
        alert('No outfit could be generated.');
        return;
    }

    SECTION_IDS.forEach(sectionId => {
        const targetId = sectionOutfit[sectionId];
        state.generatedOutfit[sectionId] = typeof targetId === 'number' ? targetId : null;

        const items = getItems(state, sectionId);
        const activeIndex = items.findIndex(entry => entry.id === targetId);
        state.activeIndex[sectionId] = activeIndex >= 0 ? activeIndex : 0;
    });
    state.generatedOutfitActive = true;

    renderSections();
}

function getCurrentSectionsForGeneration() {
    return Object.fromEntries(
        SECTION_IDS.map(sectionId => {
            if (state.generatedOutfitActive && typeof state.generatedOutfit[sectionId] === 'number') {
                return [sectionId, state.generatedOutfit[sectionId]];
            }

            const current = getCurrentItem(state, sectionId);
            return [sectionId, current && typeof current.id === 'number' ? current.id : null];
        })
    );
}

async function generateOutfitFromServer() {
    if (state.generateBtn) {
        state.generateBtn.disabled = true;
        state.generateBtn.textContent = 'Generating...';
    }

    try {
        const selected = getCurrentSectionsForGeneration();
        const query = new URLSearchParams();

        if (typeof selected.outer === 'number') query.set('selected_outer', String(selected.outer));
        if (typeof selected.top === 'number') query.set('selected_top', String(selected.top));
        if (typeof selected.bottom === 'number') query.set('selected_bottom', String(selected.bottom));

        const queryString = query.toString();
        const response = await fetch(
            `${API_BASE_URL}/generate-outfit${queryString ? `?${queryString}` : ''}`
        );
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(payload.detail || payload.message || `Request failed (${response.status})`);
        }

        applyOutfitBySection(payload.sections || {});
        renderAnalysis(payload);
    } catch (error) {
        console.error('Error generating outfit:', error);
        alert(`Could not generate outfit: ${error.message || error}`);
    } finally {
        if (state.generateBtn) {
            state.generateBtn.disabled = false;
            state.generateBtn.textContent = 'Generate Outfit';
        }
    }
}

function rotateSection(sectionId, direction) {
    state.generatedOutfitActive = false;
    state.generatedOutfit[sectionId] = null;
    const changed = rotateSectionState(state, sectionId, direction);
    if (!changed) return;
    resetAnalysisForManualChanges();
    renderSections();
}

async function deleteCurrentItem(sectionId) {
    if (state.deleting[sectionId]) return;

    const item = getCurrentItem(state, sectionId);
    if (!item || typeof item.id !== 'number') {
        alert('No deletable item selected.');
        return;
    }

    const itemType = item.type || 'item';
    const confirmed = window.confirm(`Delete this ${itemType}? This cannot be undone.`);
    if (!confirmed) return;

    state.deleting[sectionId] = true;
    renderSections();

    try {
        const response = await fetch(`${CLOTHING_API_URL}/${item.id}`, {
            method: 'DELETE'
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload.deleted) {
            const message = payload.status || `Request failed (${response.status})`;
            throw new Error(message);
        }

        removeCurrentItemFromSection(state, sectionId);
        resetAnalysisForManualChanges();
    } catch (error) {
        console.error('Error deleting clothing item:', error);
        alert(`Could not delete item: ${error.message || error}`);
    } finally {
        state.deleting[sectionId] = false;
        renderSections();
    }
}

function buildSections() {
    state.sectionElements = {};
    state.canvasSlots = {};

    state.generateBtn = document.getElementById('generate-outfit-btn');
    analysisElements.score = document.getElementById('analysis-score');
    analysisElements.weather = document.getElementById('analysis-weather');
    analysisElements.reasons = document.getElementById('analysis-reasons');

    if (state.generateBtn) {
        state.generateBtn.onclick = generateOutfitFromServer;
    }

    sectionConfig.forEach(cfg => {
        const sectionRoot = document.querySelector(`.outfit-section[data-section-id="${cfg.id}"]`);
        const controlsRoot = document.querySelector(`.canvas-toggle-group[data-section-id="${cfg.id}"]`);
        const slot = document.querySelector(`.canvas-layer[data-section-id="${cfg.id}"]`);

        if (controlsRoot) {
            controlsRoot.style.top = `${cfg.controlY}%`;
        }

        if (slot) {
            slot.style.zIndex = String(cfg.zIndex);
            applyLayerAdjustment(slot, cfg.id);
            state.canvasSlots[cfg.id] = slot;
        }

        if (!sectionRoot) return;

        const status = sectionRoot.querySelector('.item-status');
        const deleteBtn = sectionRoot.querySelector('.meta-delete-btn');
        const prevBtn = controlsRoot ? controlsRoot.querySelector('[data-action="prev"]') : null;
        const nextBtn = controlsRoot ? controlsRoot.querySelector('[data-action="next"]') : null;
        const metadataValues = Object.fromEntries(
            METADATA_FIELDS.map(field => [
                field.key,
                sectionRoot.querySelector(`[data-metadata-key="${field.key}"]`)
            ])
        );

        if (prevBtn) prevBtn.onclick = () => rotateSection(cfg.id, -1);
        if (nextBtn) nextBtn.onclick = () => rotateSection(cfg.id, 1);
        if (deleteBtn) deleteBtn.onclick = () => deleteCurrentItem(cfg.id);

        state.sectionElements[cfg.id] = {
            root: sectionRoot,
            prevBtn,
            nextBtn,
            deleteBtn,
            status,
            metadataValues
        };
    });
}

async function loadClothingImages() {
    try {
        const clothes = await fetch(CLOTHING_API_URL).then(res => res.json());
        state.groupedItems = groupClothesBySection(clothes);
        enforceUniqueSelection(state);
        buildSections();
        if (Array.isArray(clothes) && clothes.length > 0) {
            await generateOutfitFromServer();
        } else {
            renderSections();
        }
    } catch (error) {
        console.error('Error fetching clothing:', error);
        alert('Error fetching clothing: ' + error);
    }
}

loadClothingImages();