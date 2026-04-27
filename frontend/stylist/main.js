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
import { fetchJsonWithRetry } from './modules/requestClient.js';
import { createAnalysisController } from './modules/analysisView.js';
import { bindRotateControl } from './modules/rotateControl.js';

const state = createState();

const GENERATE_DEBOUNCE_MS = 220;

let generateRequestPromise = null;
let generateRequestQueued = false;
let generateDebounceTimer = null;
const analysisController = createAnalysisController();

function preloadClothingImages(groupedItems) {
    if (!groupedItems || typeof groupedItems !== 'object') return;

    const preloadUrls = new Set();
    Object.values(groupedItems).forEach(items => {
        if (!Array.isArray(items)) return;
        items.forEach(item => {
            const imagePath = item && item.image_path;
            if (typeof imagePath === 'string' && imagePath.trim()) {
                preloadUrls.add(IMAGE_BASE_URL + imagePath);
            }
        });
    });

    preloadUrls.forEach(src => {
        const image = new Image();
        image.src = src;
    });
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
        delete slot.dataset.currentSrc;
        slot.alt = '';
    } else {
        const nextSrc = IMAGE_BASE_URL + item.image_path;
        if (slot.dataset.currentSrc !== nextSrc) {
            slot.src = nextSrc;
            slot.dataset.currentSrc = nextSrc;
        }
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

async function generateOutfitOnce() {
    if (state.generateBtn) {
        state.generateBtn.disabled = true;
        state.generateBtn.classList.add('loading');
    }

    try {
        const selected = getCurrentSectionsForGeneration();
        const query = new URLSearchParams();

        if (typeof selected.outer === 'number') query.set('selected_outer', String(selected.outer));
        if (typeof selected.top === 'number') query.set('selected_top', String(selected.top));
        if (typeof selected.bottom === 'number') query.set('selected_bottom', String(selected.bottom));

        const queryString = query.toString();
        const payload = await fetchJsonWithRetry(
            `${API_BASE_URL}/generate-outfit${queryString ? `?${queryString}` : ''}`
        );

        applyOutfitBySection(payload.sections || {});
        analysisController.render(payload);
    } catch (error) {
        console.error('Error generating outfit:', error);
        alert(`Could not generate outfit: ${error.message || error}`);
    } finally {
        if (state.generateBtn) {
            state.generateBtn.disabled = false;
            state.generateBtn.classList.remove('loading');
        }
    }
}

async function generateOutfitFromServer() {
    if (generateRequestPromise) {
        generateRequestQueued = true;
        return generateRequestPromise;
    }

    generateRequestPromise = generateOutfitOnce();

    try {
        await generateRequestPromise;
    } finally {
        generateRequestPromise = null;
        if (generateRequestQueued) {
            generateRequestQueued = false;
            await generateOutfitFromServer();
        }
    }
}

function scheduleGenerateOutfit() {
    if (generateDebounceTimer !== null) {
        window.clearTimeout(generateDebounceTimer);
    }

    generateDebounceTimer = window.setTimeout(() => {
        generateDebounceTimer = null;
        void generateOutfitFromServer();
    }, GENERATE_DEBOUNCE_MS);
}

function rotateSection(sectionId, direction) {
    state.generatedOutfitActive = false;
    state.generatedOutfit[sectionId] = null;
    const changed = rotateSectionState(state, sectionId, direction);
    if (!changed) return false;
    analysisController.resetForManualChanges();
    renderSections();
    return true;
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
        const payload = await fetchJsonWithRetry(
            `${CLOTHING_API_URL}/${item.id}`,
            {
                method: 'DELETE'
            }
        );

        if (!payload.deleted) {
            const message = payload.status || 'Delete request did not complete successfully.';
            throw new Error(message);
        }

        removeCurrentItemFromSection(state, sectionId);
        analysisController.resetForManualChanges();
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
    analysisController.init();

    if (state.generateBtn) {
        state.generateBtn.onclick = scheduleGenerateOutfit;
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

        if (prevBtn) bindRotateControl(prevBtn, () => rotateSection(cfg.id, -1));
        if (nextBtn) bindRotateControl(nextBtn, () => rotateSection(cfg.id, 1));
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
        const clothes = await fetchJsonWithRetry(CLOTHING_API_URL);

        state.groupedItems = groupClothesBySection(clothes);
        preloadClothingImages(state.groupedItems);
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