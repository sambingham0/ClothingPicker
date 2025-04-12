import os
import random
import tkinter as tk
from PIL import Image, ImageTk

# Path to clothing folders
CLOTHES_DIR = "/home/pi/clothes"
CATEGORIES = ["athletic", "casual", "formal", "sleep"]
LAYERS = ["layers", "tops", "bottoms"]

class ClothesPickerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Clothes Picker")
        self.root.geometry("800x480")

        self.current_category = "casual"  # Default category
        self.current_indices = {"layers": 0, "tops": 0, "bottoms": 0}
        self.layer_visible = True  # Track if the layer is toggled on/off

        self.images = self.load_images()

        # UI Elements
        self.layer_label = tk.Label(root)
        self.top_label = tk.Label(root)
        self.bottom_label = tk.Label(root)

        self.layer_label.grid(row=1, column=0, padx=20)
        self.top_label.grid(row=1, column=1, padx=20)
        self.bottom_label.grid(row=1, column=2, padx=20)

        # Buttons for navigation
        self.create_buttons()

        self.show_images()

    def load_images(self):
        """Load all images from the selected category."""
        images = {layer: [] for layer in LAYERS}
        for layer in LAYERS:
            folder = os.path.join(CLOTHES_DIR, self.current_category, layer)
            if os.path.exists(folder):
                images[layer] = [os.path.join(folder, img) for img in os.listdir(folder) if img.endswith(('.jpg', '.png', '.jpeg'))]
        return images

    def show_images(self):
        """Display selected clothing images."""
        self.display_image(self.layer_label, self.images["layers"], self.current_indices["layers"], self.layer_visible)
        self.display_image(self.top_label, self.images["tops"], self.current_indices["tops"], True)
        self.display_image(self.bottom_label, self.images["bottoms"], self.current_indices["bottoms"], True)

    def display_image(self, label, images, index, visible=True):
        """Display an image in the given label."""
        if images and visible:
            img_path = images[index % len(images)]
            img = Image.open(img_path).resize((150, 150), Image.Resampling.LANCZOS)
            img = ImageTk.PhotoImage(img)
            label.config(image=img)
            label.image = img
        else:
            label.config(image="")

    def change_item(self, layer, direction):
        """Scroll up or down in a specific layer."""
        if self.images[layer]:
            if direction == "up":
                self.current_indices[layer] = (self.current_indices[layer] + 1) % len(self.images[layer])
            else:
                self.current_indices[layer] = (self.current_indices[layer] - 1) % len(self.images[layer])
            self.show_images()

    def toggle_layer(self):
        """Toggle layer visibility on/off."""
        self.layer_visible = not self.layer_visible
        self.show_images()

    def apply_random_selection(self):
        """Select a random top, bottom, and layer based on active filters."""
        for layer in LAYERS:
            if self.images[layer]:
                self.current_indices[layer] = random.randint(0, len(self.images[layer]) - 1)
        self.show_images()

    def save_preset(self):
        """Save the current outfit as a preset."""
        preset_folder = os.path.join(CLOTHES_DIR, "presets")
        os.makedirs(preset_folder, exist_ok=True)

        for layer in LAYERS:
            if self.images[layer]:
                img_path = self.images[layer][self.current_indices[layer]]
                os.system(f"cp '{img_path}' '{preset_folder}/{layer}_{os.path.basename(img_path)}'")

        print("Outfit saved!")

    def open_filter_menu(self):
        """Opens the filter selection menu."""
        filter_window = tk.Toplevel(self.root)
        filter_window.title("Select Category")

        for category in CATEGORIES:
            btn = tk.Button(filter_window, text=category.capitalize(), command=lambda c=category: self.apply_filter(c))
            btn.pack()

    def apply_filter(self, category):
        """Apply category filter and reload images."""
        self.current_category = category
        self.images = self.load_images()
        self.current_indices = {"layers": 0, "tops": 0, "bottoms": 0}
        self.show_images()

    def create_buttons(self):
        """Create all UI buttons based on schematic."""
        # Navigation Buttons for each clothing section
        for i, layer in enumerate(["layers", "tops", "bottoms"]):
            tk.Button(self.root, text="▲", command=lambda l=layer: self.change_item(l, "up")).grid(row=0, column=i)
            tk.Button(self.root, text="▼", command=lambda l=layer: self.change_item(l, "down")).grid(row=2, column=i)

        # "X" Button to toggle Layer visibility
        tk.Button(self.root, text="❌", command=self.toggle_layer).grid(row=3, column=0)

        # Heart button for saving outfit
        tk.Button(self.root, text="❤️", command=self.save_preset).grid(row=0, column=3)

        # File button for favorites and filters
        tk.Button(self.root, text="📂", command=self.open_filter_menu).grid(row=2, column=3)

        # Random outfit button
        tk.Button(self.root, text="🔀", command=self.apply_random_selection).grid(row=3, column=3)

if __name__ == "__main__":
    app = ClothesPickerApp(tk.Tk())
    app.root.mainloop()
