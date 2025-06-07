let clothesIndex = {};
const BASE_URL = "assets/clothes/"; // Removed leading slash
const SECTIONS = ["layers", "tops", "bottoms"];
const imageCache = new Map();

// State management
let state = {
  activeCategory: "casual",
  favoritesMode: false,
  currentIndex: {
    layers: 0,
    tops: 0,
    bottoms: 0,
  },
  layerVisible: true,
  favoritesPresets: [],
  favoritesIndex: 0,
};

// Build the clothes index dynamically
async function buildClothesIndex() {
  const categories = ["casual", "athletic", "sleep"];
  const sections = ["layers", "tops", "bottoms"];
  const index = {};

  try {
    for (const category of categories) {
      index[category] = {};

      for (const section of sections) {
        try {
          const response = await fetch(
            `${BASE_URL}${category}/${section}/index.json`,
          );
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
    console.error("Error building clothes index:", error);
    return null;
  }
}

async function preloadImage(url) {
  if (imageCache.has(url)) {
    return imageCache.get(url);
  }

  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

  imageCache.set(url, promise);
  return promise;
}

async function renderCurrentImages() {
  if (state.favoritesMode) {
    // Show the current favorite preset
    const preset = state.favoritesPresets[state.favoritesIndex];
    if (preset) {
      const renderPromises = ["layers", "tops", "bottoms"].map(async (section) => {
        const img = document.querySelector(`#${section}-viewport img`);
        const viewport = document.querySelector(`#${section}-viewport`);
        viewport.classList.add("loading");
        if (preset[section]) {
          img.src = BASE_URL + preset[section];
          img.style.display = "";
        } else {
          img.src = "";
          img.style.display = "none";
        }
        viewport.classList.remove("loading");
      });
      await Promise.all(renderPromises);
    } else {
      // No favorites, clear images
      for (const section of ["layers", "tops", "bottoms"]) {
        const img = document.querySelector(`#${section}-viewport img`);
        img.src = "";
        img.style.display = "none";
      }
    }
    return;
  }

  // Normal mode
  const { activeCategory, currentIndex } = state;
  if (!clothesIndex[activeCategory]) {
    // Optionally show a message to the user
    document.getElementById("footer-msg").textContent = "No images for this category.";
    // Clear images
    for (const section of ["layers", "tops", "bottoms"]) {
      const img = document.querySelector(`#${section}-viewport img`);
      img.src = "";
      img.style.display = "none";
    }
    return;
  }

  // Process all sections in parallel
  const renderPromises = ["layers", "tops", "bottoms"].map(async (section) => {
    const files = clothesIndex[activeCategory][section];
    if (files && files.length > 0) {
      const currentFileIndex = currentIndex[section] % files.length;
      const nextIndex = (currentFileIndex + 1) % files.length;
      const prevIndex = (currentFileIndex - 1 + files.length) % files.length;

      // Current image URL
      const currentUrl = `${BASE_URL}${activeCategory}/${section}/${files[currentFileIndex]}`;

      // Preload next and previous images
      const nextUrl = `${BASE_URL}${activeCategory}/${section}/${files[nextIndex]}`;
      const prevUrl = `${BASE_URL}${activeCategory}/${section}/${files[prevIndex]}`;

      // Render current image
      await renderImage(section, currentUrl);

      // Preload next/prev images in background (don't await these)
      preloadImage(nextUrl).catch(err => console.warn(`Failed to preload ${nextUrl}:`, err));
      preloadImage(prevUrl).catch(err => console.warn(`Failed to preload ${prevUrl}:`, err));
    } else {
      // No files for this section, clear image
      const img = document.querySelector(`#${section}-viewport img`);
      img.src = "";
      img.style.display = "none";
    }
  });

  await Promise.all(renderPromises);
}

async function renderImage(section, url) {
  const img = document.querySelector(`#${section}-viewport img`);
  const viewport = document.querySelector(`#${section}-viewport`);

  console.log(`Attempting to render ${section} with URL: ${url}`);
  viewport.classList.add("loading");

  try {
    // Hide the layer image if layerVisible is false
    if (section === "layers" && !state.layerVisible) {
      img.style.display = "none";
      img.src = "";
      console.log(`Hidden layer for ${section}`);
    } else {
      await preloadImage(url);
      img.src = url;
      img.style.display = "";
      console.log(`Successfully loaded ${section}: ${url}`);
    }
  } catch (error) {
    console.warn(`Failed to load image: ${url}`, error);
    // Clear the image on error and hide it
    img.src = "";
    img.style.display = "none";
    // Show a placeholder or error message
    const errorMsg = document.querySelector(`#${section}-error`) || 
                    document.createElement('div');
    errorMsg.id = `${section}-error`;
    errorMsg.textContent = `Failed to load ${section} image`;
    errorMsg.style.cssText = 'color: red; text-align: center; padding: 10px;';
    if (!document.querySelector(`#${section}-error`)) {
      viewport.appendChild(errorMsg);
    }
  } finally {
    viewport.classList.remove("loading");
  }
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
    SECTIONS.forEach((section) => {
      const sectionImages = (clothesIndex[newCategory] || {})[section] || [];
      if (sectionImages.length) {
        state.currentIndex[section] = Math.floor(
          Math.random() * sectionImages.length,
        );
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
    state.favoritesIndex =
      (state.favoritesIndex + delta + state.favoritesPresets.length) %
      state.favoritesPresets.length;
  } else {
    const arr = (clothesIndex[state.activeCategory] || {})[section] || [];
    if (!arr.length) return;

    const delta = direction === "up" ? -1 : 1;
    state.currentIndex[section] =
      (state.currentIndex[section] + delta + arr.length) % arr.length;
  }

  renderCurrentImages();
}

function toggleLayer() {
  state.layerVisible = !state.layerVisible;
  document.getElementById("toggle-layer-btn").textContent = state.layerVisible
    ? "Remove Layer"
    : "Add Layer";
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
  localStorage.setItem(
    "clothesFavorites",
    JSON.stringify(state.favoritesPresets, null, 2),
  );
}

function showManagePresetsModal() {
  loadFavoritesFromStorage();
  const list = document.getElementById("presets-list");
  list.innerHTML = "";
  state.favoritesPresets.forEach((preset, idx) => {
    const li = document.createElement("li");
    li.textContent = `Preset ${idx + 1}: ` +
      ["layers", "tops", "bottoms"]
        .map(section => preset[section] ? preset[section].split('/').pop() : "None")
        .join(" / ");
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.onclick = () => {
      state.favoritesPresets.splice(idx, 1);
      saveFavoritesToStorage();
      showManagePresetsModal();
      renderCurrentImages();
    };
    li.appendChild(delBtn);
    list.appendChild(li);
  });
  document.getElementById("manage-presets-modal").style.display = "block";
}

function closeManagePresetsModal() {
  document.getElementById("manage-presets-modal").style.display = "none";
}

// Add event listener for the manage presets button
document.getElementById("upload-btn-mobile").addEventListener("click", showUploadModal);
document.getElementById("manage-presets-btn").addEventListener("click", showManagePresetsModal);
document.getElementById("manage-presets-btn-mobile").addEventListener("click", showManagePresetsModal);


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
  document.getElementById("upload-modal").style.display = "block";
}

function closeUploadModal() {
  document.getElementById("upload-modal").style.display = "none";
  document.getElementById("upload-form").reset();
}

async function handleUpload(e) {
  e.preventDefault();
  const formData = new FormData(e.target);

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error("Upload failed");

    const result = await response.json();
    if (result.success) {
      closeUploadModal();
      // Rebuild the clothes index and refresh display
      clothesIndex = await buildClothesIndex();
      renderCurrentImages();
      document.getElementById("footer-msg").textContent = "Upload successful!";
    }
  } catch (error) {
    console.error("Upload error:", error);
    document.getElementById("footer-msg").textContent =
      "Upload failed. Please try again.";
  }
}

// Add these to your DOMContentLoaded event listener
document
  .getElementById("upload-btn")
  .addEventListener("click", showUploadModal);
document.getElementById("upload-form").addEventListener("submit", handleUpload);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeUploadModal();
});

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  // Load clothes index
  const index = await buildClothesIndex();
  if (!index) {
    document.getElementById("footer-msg").textContent = "Error loading images";
    return;
  }
  clothesIndex = index;

  // Add debugging
  console.log("Clothes index loaded:", clothesIndex);
  console.log("Current state:", state);

  // Load favorites
  loadFavoritesFromStorage();

  // Randomize initial selection
  SECTIONS.forEach((section) => {
    const sectionImages =
      (clothesIndex[state.activeCategory] || {})[section] || [];
    if (sectionImages.length) {
      state.currentIndex[section] = Math.floor(
        Math.random() * sectionImages.length,
      );
    }
  });

  // Setup event listeners
  document
    .getElementById("category-select")
    .addEventListener("change", handleCategoryChange);
  document
    .getElementById("random-btn")
    .addEventListener("click", applyRandomSelection);
  document
    .getElementById("toggle-layer-btn")
    .addEventListener("click", toggleLayer);
  document
    .getElementById("save-preset-btn")
    .addEventListener("click", savePreset);

  // Setup cycle buttons
  document.querySelectorAll(".cycle-btn").forEach((btn) => {
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
