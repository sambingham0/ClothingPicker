import { createSectionRecord, mapTypeToSectionIds } from './config.js';

export function createState() {
    return {
        groupedItems: createSectionRecord(() => []),
        activeIndex: createSectionRecord(() => 0),
        deleting: createSectionRecord(() => false),
        generatedOutfit: createSectionRecord(() => null),
        generatedOutfitActive: false,
        sectionElements: {},
        canvasSlots: {},
        generateBtn: null
    };
}

export function getItems(state, sectionId) {
    return state.groupedItems[sectionId] || [];
}

export function getCurrentItem(state, sectionId) {
    const items = getItems(state, sectionId);
    if (!items.length) return null;
    const currentIndex = (state.activeIndex[sectionId] || 0) % items.length;
    return items[currentIndex];
}

function normalizeActiveIndices(state) {
    Object.keys(state.groupedItems).forEach(sectionId => {
        const items = getItems(state, sectionId);
        if (!items.length) {
            state.activeIndex[sectionId] = 0;
            return;
        }

        state.activeIndex[sectionId] = (state.activeIndex[sectionId] || 0) % items.length;
    });
}

function getSelectedIdsExcept(state, sectionId) {
    const selectedIds = new Set();

    Object.keys(state.groupedItems).forEach(otherSectionId => {
        if (otherSectionId === sectionId) return;

        const selected = getCurrentItem(state, otherSectionId);
        if (selected && typeof selected.id === 'number') {
            selectedIds.add(selected.id);
        }
    });

    return selectedIds;
}

function findAvailableIndex(items, startIndex, direction, blockedIds) {
    if (!items.length) return -1;

    for (let steps = 0; steps < items.length; steps++) {
        const candidateIndex = (startIndex + steps * direction + items.length) % items.length;
        const candidate = items[candidateIndex];
        if (!candidate || blockedIds.has(candidate.id)) continue;
        return candidateIndex;
    }

    return -1;
}

function ensureUniqueSelection(state) {
    const lockedIds = new Set();

    Object.keys(state.groupedItems).forEach(sectionId => {
        const items = getItems(state, sectionId);
        if (!items.length) {
            state.activeIndex[sectionId] = 0;
            return;
        }

        const startIndex = state.activeIndex[sectionId] || 0;
        const preferred = items[startIndex % items.length];

        if (preferred && !lockedIds.has(preferred.id)) {
            state.activeIndex[sectionId] = startIndex % items.length;
            lockedIds.add(preferred.id);
            return;
        }

        const availableIndex = findAvailableIndex(items, startIndex, 1, lockedIds);
        if (availableIndex >= 0) {
            state.activeIndex[sectionId] = availableIndex;
            lockedIds.add(items[availableIndex].id);
        }
    });
}

export function rotateSectionState(state, sectionId, direction) {
    const items = getItems(state, sectionId);
    if (!items.length) return false;

    const blockedIds = getSelectedIdsExcept(state, sectionId);
    const currentIndex = (state.activeIndex[sectionId] || 0) % items.length;
    const firstCandidate = (currentIndex + direction + items.length) % items.length;
    const availableIndex = findAvailableIndex(items, firstCandidate, direction, blockedIds);
    if (availableIndex < 0) return false;

    state.activeIndex[sectionId] = availableIndex;
    normalizeActiveIndices(state);
    return true;
}

export function removeCurrentItemFromSection(state, sectionId) {
    const items = getItems(state, sectionId);
    if (!items.length) return;

    const currentIndex = state.activeIndex[sectionId] % items.length;
    const nextItems = items.slice();
    nextItems.splice(currentIndex, 1);

    state.groupedItems[sectionId] = nextItems;

    if (!nextItems.length) {
        state.activeIndex[sectionId] = 0;
    } else {
        state.activeIndex[sectionId] = currentIndex % nextItems.length;
    }

    normalizeActiveIndices(state);
    ensureUniqueSelection(state);
}

export function groupClothesBySection(clothes) {
    const grouped = createSectionRecord(() => []);

    clothes.forEach(item => {
        const sectionIds = mapTypeToSectionIds(item.type);
        sectionIds.forEach(sectionId => {
            grouped[sectionId].push(item);
        });
    });

    return grouped;
}

export function enforceUniqueSelection(state) {
    normalizeActiveIndices(state);
    ensureUniqueSelection(state);
}
