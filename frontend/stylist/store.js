import { createSectionRecord, mapTypeToSectionId } from './config.js';

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

export function rotateSectionState(state, sectionId, direction) {
    const items = getItems(state, sectionId);
    if (!items.length) return false;

    const nextIndex = (state.activeIndex[sectionId] + direction + items.length) % items.length;
    state.activeIndex[sectionId] = nextIndex;
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
}

export function groupClothesBySection(clothes) {
    const grouped = createSectionRecord(() => []);

    clothes.forEach(item => {
        const sectionId = mapTypeToSectionId(item.type);
        if (sectionId) {
            grouped[sectionId].push(item);
        }
    });

    return grouped;
}
