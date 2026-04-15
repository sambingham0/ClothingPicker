import io
import uuid
from pathlib import Path

import cv2
import numpy as np
from rembg import remove
from PIL import Image

from app_config import CLOTHING_STORAGE_DIR


def _safe_filename_stem(filename):
    stem = Path(filename or "upload").stem.strip()
    if not stem:
        return "upload"

    sanitized = "".join(char if char.isalnum() or char in {"-", "_"} else "_" for char in stem)
    return sanitized.strip("_") or "upload"

def process_and_save_image(file):
    # Read file into PIL Image
    with Image.open(file.file) as image:
        output = remove(image)

    if isinstance(output, Image.Image):
        output_image = output.convert("RGBA")
    else:
        with Image.open(io.BytesIO(output)) as generated:
            output_image = generated.convert("RGBA")

    # Convert to OpenCV
    output_np = np.array(output_image)
    if output_np.ndim != 3 or output_np.shape[2] < 4:
        raise ValueError("Processed image does not contain an alpha channel.")

    # Crop to bounding box
    alpha = output_np[:, :, 3]
    coords = cv2.findNonZero((alpha > 0).astype(np.uint8))
    if coords is None:
        raise ValueError("Could not detect a foreground subject in the uploaded image.")

    x, y, w, h = cv2.boundingRect(coords)
    cropped = output_np[y:y+h, x:x+w]

    # resize to 512x512
    cropped_pil = Image.fromarray(cropped)
    cropped_pil.thumbnail((512, 512), Image.LANCZOS)
    cropped_resized = cropped_pil
    final_img = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    offset = ((512 - cropped_resized.width) // 2, (512 - cropped_resized.height) // 2)
    final_img.paste(cropped_resized, offset)

    # Save as PNG to storage/ and update db
    storage_dir = Path(CLOTHING_STORAGE_DIR)
    storage_dir.mkdir(parents=True, exist_ok=True)

    # Strip extension from original filename
    base_name = _safe_filename_stem(file.filename)
    unique_id = uuid.uuid4().hex[:8]
    filename = f"{base_name}_{unique_id}.png"
    save_path = storage_dir / filename
    final_img.save(save_path)

    # Return result dict with only the filename
    return {"status": "saved", "image_path": filename}