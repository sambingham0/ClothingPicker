from rembg import remove
from PIL import Image
import cv2
import numpy as np
import os
import uuid

def process_and_save_image(file):
    # Read file into PIL Image
    image = Image.open(file.file)

    # Remove background
    output = remove(image)

    # Convert to OpenCV
    output_np = np.array(output)

    # Crop to bounding box
    alpha = output_np[:, :, 3]
    coords = cv2.findNonZero((alpha > 0).astype(np.uint8))
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
    os.makedirs("storage", exist_ok=True)
    # Strip extension from original filename
    base_name = os.path.splitext(file.filename)[0]
    unique_id = uuid.uuid4().hex[:8]
    save_path = f"storage/{base_name}_{unique_id}.png"
    final_img.save(save_path)

    # Return result dict
    return {"status": "saved", "image_path": save_path}