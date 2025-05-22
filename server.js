const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const port = 3000;

// Enable CORS and static file serving
app.use(express.static('./'));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const { category, section } = req.body;
        const dir = `assets/clothes/${category}/${section}`;
        await fs.mkdir(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image file'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Handle file upload
app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        const { category, section } = req.body;
        
        // Update index.json
        const dir = `assets/clothes/${category}/${section}`;
        const files = await fs.readdir(dir);
        const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file));
        
        await fs.writeFile(
            path.join(dir, 'index.json'),
            JSON.stringify(imageFiles, null, 2)
        );

        res.json({ 
            success: true, 
            filename: req.file.filename,
            message: 'File uploaded successfully'
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            error: 'Upload failed', 
            message: error.message 
        });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Upload endpoint: http://localhost:${port}/upload`);
});