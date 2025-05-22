let clothesIndex = {};
const BASE_URL = "assets/clothes/"; // Removed leading slash
const SECTIONS = ["layers", "tops", "bottoms"];

// State management
let state = {
  activeCategory: "casual",
  favoritesMode: false,
  currentIndex: {
    layers: 0,
    tops: 0,
    bottoms: 0
  },
  layerVisible: true,
  favoritesPresets: [],
  favoritesIndex: 0
};

// Build the clothes index dynamically
async function buildClothesIndex() {
    const categories = ['casual', 'athletic', 'sleep'];
    const sections = ['layers', 'tops', 'bottoms'];
    const index = {};

    try {
        for (const category of categories) {
            index[category] = {};
            
            for (const section of sections) {
                try {
                    const response = await fetch(`${BASE_URL}${category}/${section}/index.json`);
                    if (!response.ok) {
                        console.warn(`No images found for ${category}/${section}`);
                        index[category][section] = [];
                        continue;
                    }
                    const files = await response.json();
                    index[category][section] = files;
                } catch (err) {
                    console.warn(`Error loading ${category}/${section}:`, err);
                    index[category][section] = [];
                }
            }
        }
        return index;
    } catch (error) {
        console.error('Error building clothes index:', error);
        return null;
    }
}

// Core rendering function
function renderCurrentImages() {
    SECTIONS.forEach((section) => {
        const container = document.getElementById("image-" + section);
        container.innerHTML = "";

        // Helper function to show message
        const showMessage = (text) => {
            const p = document.createElement("p");
            p.textContent = text;
            p.style.color = "gray";
            p.style.fontSize = "1.2rem";
            container.appendChild(p);
        };

        // Handle favorites mode
        if (state.favoritesMode) {
            if (!state.favoritesPresets.length) {
                showMessage("(No favorites saved)");
                return;
            }

            const preset = state.favoritesPresets[state.favoritesIndex % state.favoritesPresets.length];
            if (!preset[section]) {
                showMessage("(No image)");
                return;
            }

            if (section === "layers" && !state.layerVisible) {
                showMessage("(Hidden)");
                return;
            }

            const img = document.createElement("img");
            img.src = BASE_URL + preset[section];
            img.alt = section;
            container.appendChild(img);
            return;
        }

        // Handle normal mode
        const categoryObj = clothesIndex[state.activeCategory] || {};
        const filenames = categoryObj[section] || [];

        if (!filenames.length) {
            showMessage("(No image)");
            return;
        }

        if (section === "layers" && !state.layerVisible) {
            showMessage("(Hidden)");
            return;
        }

        let idx = state.currentIndex[section] % filenames.length;
        if (idx < 0) idx += filenames.length;
        
        const img = document.createElement("img");
        img.src = `${BASE_URL}${state.activeCategory}/${section}/${filenames[idx]}`;
        img.alt = section;
        container.appendChild(img);
    });
}

// Event handlers
function handleCategoryChange(e) {
    const newCategory = e.target.value;
    state.activeCategory = newCategory;
    state.favoritesMode = newCategory === "favorites";
    
    if (state.favoritesMode) {
        loadFavoritesFromStorage();
        state.favoritesIndex = 0;
    } else {
        // Randomize all sections when changing categories
        SECTIONS.forEach(section => {
            const sectionImages = (clothesIndex[newCategory] || {})[section] || [];
            if (sectionImages.length) {
                state.currentIndex[section] = Math.floor(Math.random() * sectionImages.length);
            } else {
                state.currentIndex[section] = 0;
            }
        });
    }
    
    renderCurrentImages();
}

function cycleItem(section, direction) {
    if (state.favoritesMode) {
        if (section !== "tops") return;
        if (!state.favoritesPresets.length) return;
        
        const delta = direction === "up" ? -1 : 1;
        state.favoritesIndex = (state.favoritesIndex + delta + state.favoritesPresets.length) % state.favoritesPresets.length;
    } else {
        const arr = (clothesIndex[state.activeCategory] || {})[section] || [];
        if (!arr.length) return;
        
        const delta = direction === "up" ? -1 : 1;
        state.currentIndex[section] = (state.currentIndex[section] + delta + arr.length) % arr.length;
    }
    
    renderCurrentImages();
}

function toggleLayer() {
    state.layerVisible = !state.layerVisible;
    document.getElementById("toggle-layer-btn").textContent = state.layerVisible ? "Remove Layer" : "Add Layer";
    renderCurrentImages();
}

function applyRandomSelection() {
    if (state.favoritesMode) return;
    
    SECTIONS.forEach((section) => {
        const arr = (clothesIndex[state.activeCategory] || {})[section] || [];
        if (arr.length) {
            state.currentIndex[section] = Math.floor(Math.random() * arr.length);
        }
    });
    
    renderCurrentImages();
}

// Storage functions
function loadFavoritesFromStorage() {
    try {
        const raw = localStorage.getItem("clothesFavorites");
        state.favoritesPresets = raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn("Could not parse favorites:", e);
        state.favoritesPresets = [];
    }
}

function saveFavoritesToStorage() {
    localStorage.setItem("clothesFavorites", JSON.stringify(state.favoritesPresets, null, 2));
}

function savePreset() {
    if (state.favoritesMode) {
        alert("Cannot save preset while in favorites mode");
        return;
    }

    const newPreset = {};
    SECTIONS.forEach((section) => {
        const arr = (clothesIndex[state.activeCategory] || {})[section] || [];
        if (arr.length && (state.layerVisible || section !== "layers")) {
            const idx = state.currentIndex[section] % arr.length;
            newPreset[section] = `${state.activeCategory}/${section}/${arr[idx]}`;
        } else {
            newPreset[section] = null;
        }
    });

    loadFavoritesFromStorage();
    state.favoritesPresets.push(newPreset);
    saveFavoritesToStorage();
    alert("Saved current combination as a new favorite preset");
}

// Sleep mode
let sleepTimer = null;
function setupSleepMode() {
    function enterSleepMode() {
        document.body.style.display = "none";
    }

    function wakeUp() {
        clearTimeout(sleepTimer);
        document.body.style.display = "flex";
        sleepTimer = setTimeout(enterSleepMode, 1000 * 60 * 15);
    }

    document.addEventListener("click", wakeUp);
    document.addEventListener("keydown", wakeUp);
    sleepTimer = setTimeout(enterSleepMode, 1000 * 60 * 15);
}

// Upload handling functions
function showUploadModal() {
    document.getElementById('upload-modal').style.display = 'block';
}

function closeUploadModal() {
    document.getElementById('upload-modal').style.display = 'none';
    document.getElementById('upload-form').reset();
}

async function handleUpload(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Upload failed');
        
        const result = await response.json();
        if (result.success) {
            closeUploadModal();
            // Rebuild the clothes index and refresh display
            clothesIndex = await buildClothesIndex();
            renderCurrentImages();
            document.getElementById('footer-msg').textContent = 'Upload successful!';
        }
    } catch (error) {
        console.error('Upload error:', error);
        document.getElementById('footer-msg').textContent = 'Upload failed. Please try again.';
    }
}

// Add these to your DOMContentLoaded event listener
document.getElementById('upload-btn').addEventListener('click', showUploadModal);
document.getElementById('upload-form').addEventListener('submit', handleUpload);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeUploadModal();
});

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
    // Load clothes index
    const index = await buildClothesIndex();
    if (!index) {
        document.getElementById('footer-msg').textContent = 'Error loading images';
        return;
    }
    clothesIndex = index;

    // Load favorites
    loadFavoritesFromStorage();

    // Randomize initial selection
    SECTIONS.forEach(section => {
        const sectionImages = (clothesIndex[state.activeCategory] || {})[section] || [];
        if (sectionImages.length) {
            state.currentIndex[section] = Math.floor(Math.random() * sectionImages.length);
        }
    });

    // Setup event listeners
    document.getElementById("category-select").addEventListener("change", handleCategoryChange);
    document.getElementById("random-btn").addEventListener("click", applyRandomSelection);
    document.getElementById("toggle-layer-btn").addEventListener("click", toggleLayer);
    document.getElementById("save-preset-btn").addEventListener("click", savePreset);

    // Setup cycle buttons
    document.querySelectorAll(".cycle-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const section = e.target.getAttribute("data-section");
            const direction = e.target.classList.contains("up-btn") ? "up" : "down";
            cycleItem(section, direction);
        });
    });

    // Initial render
    renderCurrentImages();

    // Setup sleep mode
    setupSleepMode();
});