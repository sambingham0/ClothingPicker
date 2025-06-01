const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const sharp = require("sharp");

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  // Serve index.html if parameter is present
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Enable CORS and static file serving
app.use(express.static("./"));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

// Add caching middleware
app.use((req, res, next) => {
  if (req.url.match(/\.(jpg|jpeg|png|gif)$/)) {
    res.set("Cache-Control", "public, max-age=31557600");
  }
  next();
});

async function resizeImages() {
  const baseDir = "assets/clothes";
  const categories = ["casual", "athletic", "sleep"];
  const sections = ["layers", "tops", "bottoms"];

  for (const category of categories) {
    for (const section of sections) {
      const dir = path.join(baseDir, category, section);
      try {
        const files = await fs.readdir(dir);
        const imageFiles = files.filter((file) =>
          /\.(jpg|jpeg|png|gif)$/i.test(file),
        );

        for (const file of imageFiles) {
          const filePath = path.join(dir, file);
          const image = sharp(filePath);

          // Check if image has alpha channel
          const metadata = await image.metadata();
          const hasAlpha = metadata.hasAlpha || metadata.channels === 4;

          const resizedImage = image.resize(200, 200, {
            fit: "inside",
            withoutEnlargement: true,
          });

          if (hasAlpha) {
            // Use PNG for images with transparency
            await resizedImage
              .png({
                quality: 80,
                progressive: true,
              })
              .toFile(filePath + ".compressed");
          } else {
            // Use JPEG for images without transparency
            await resizedImage
              .jpeg({
                quality: 70,
                progressive: true,
              })
              .toFile(filePath + ".compressed");
          }
          // Replace original with compressed version
          await fs.unlink(filePath);
          await fs.rename(filePath + ".compressed", filePath);
          console.log(`Processed: ${filePath}`);
        }
      } catch (error) {
        console.error(`Error processing ${dir}:`, error);
      }
    }
  }
  console.log("All images resized successfully.");
}


// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const { category, section } = req.body;
    const dir = `assets/clothes/${category}/${section}`;
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Not an image file"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Handle file upload
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const { category, section } = req.body;

    // Check if image has alpha channel
    const image = sharp(req.file.path);
    const metadata = await image.metadata();
    const hasAlpha = metadata.hasAlpha || metadata.channels === 4;

    const resizedImage = image.resize(800, 800, {
      fit: "inside",
      withoutEnlargement: true,
    });

    if (hasAlpha) {
      await resizedImage
        .png({
          quality: 80,
          progressive: true,
        })
        .toFile(req.file.path + ".compressed");
    } else {
      await resizedImage
        .jpeg({
          quality: 70,
          progressive: true,
        })
        .toFile(req.file.path + ".compressed");
    }

    // Replace original with compressed version
    await fs.unlink(req.file.path);
    await fs.rename(req.file.path + ".compressed", req.file.path);

    // Update index.json
    const dir = `assets/clothes/${category}/${section}`;
    const files = await fs.readdir(dir);
    const imageFiles = files.filter((file) =>
      /\.(jpg|jpeg|png|gif)$/i.test(file),
    );

    await fs.writeFile(
      path.join(dir, "index.json"),
      JSON.stringify(imageFiles, null, 2),
    );

    res.json({
      success: true,
      filename: req.file.filename,
      message: "File uploaded successfully",
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      error: "Upload failed",
      message: error.message,
    });
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Upload endpoint: http://localhost:${port}/upload`);

  // Run image processing in background after server starts
  console.log("Starting background image processing...");
  resizeImages()
    .then(() => {
      console.log("Background image processing completed!");
    })
    .catch((error) => {
      console.error("Background image processing failed:", error);
    });
});
