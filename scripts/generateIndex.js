const fs = require("fs").promises;
const path = require("path");

async function generateIndexFiles() {
  const baseDir = path.join(__dirname, "assets", "clothes");
  const categories = ["casual", "athletic", "sleep"];
  const sections = ["layers", "tops", "bottoms"];

  try {
    // Create base directory if it doesn't exist
    await fs.mkdir(baseDir, { recursive: true });

    for (const category of categories) {
      const categoryPath = path.join(baseDir, category);
      await fs.mkdir(categoryPath, { recursive: true });

      for (const section of sections) {
        const sectionPath = path.join(categoryPath, section);
        await fs.mkdir(sectionPath, { recursive: true });

        try {
          // Get all image files in the directory
          const files = await fs.readdir(sectionPath);
          const imageFiles = files.filter((file) =>
            /\.(jpg|jpeg|png|gif)$/i.test(file),
          );

          // Write index.json
          const indexPath = path.join(sectionPath, "index.json");
          await fs.writeFile(indexPath, JSON.stringify(imageFiles, null, 2));

          console.log(`✓ Created index.json for ${category}/${section}`);
          if (imageFiles.length === 0) {
            console.log(`  Warning: No images found in ${category}/${section}`);
          } else {
            console.log(`  Found ${imageFiles.length} images`);
          }
        } catch (err) {
          console.error(`✗ Error processing ${category}/${section}:`, err);
        }
      }
    }
  } catch (error) {
    console.error("Fatal error:", error);
  }
}

generateIndexFiles();
