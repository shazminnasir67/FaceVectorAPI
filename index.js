const faceapi = require('@vladmandic/face-api');
const canvas = require('canvas');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const app = express();
const PORT = 3000;

// Configure multer for image uploads
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

let modelsLoaded = false;

// Load models once when server starts
async function loadModels() {
  try {
    console.log('Loading models...');
    await faceapi.nets.tinyFaceDetector.loadFromDisk('./models');
    await faceapi.nets.faceRecognitionNet.loadFromDisk('./models');
    await faceapi.nets.faceLandmark68Net.loadFromDisk('./models');
    modelsLoaded = true;
    console.log('✅ Models loaded successfully!');
  } catch (error) {
    console.error('❌ Error loading models:', error.message);
    process.exit(1);
  }
}

// Extract face embeddings from image
async function extractEmbeddings(imagePath) {
  try {
    const img = await canvas.loadImage(imagePath);
    const options = new faceapi.TinyFaceDetectorOptions({ 
      inputSize: 160, 
      scoreThreshold: 0.5 
    });
    
    const result = await faceapi
      .detectSingleFace(img, options)
      .withFaceLandmarks()
      .withFaceDescriptor();

    return result;
  } catch (error) {
    throw new Error(`Error processing image: ${error.message}`);
  }
}

// API endpoint to get embeddings
app.post('/embeddings', upload.single('image'), async (req, res) => {
  if (!modelsLoaded) {
    return res.status(503).json({ 
      error: 'Models are still loading. Please try again.' 
    });
  }

  if (!req.file) {
    return res.status(400).json({ 
      error: 'No image file provided. Please upload an image.' 
    });
  }

  const imagePath = req.file.path;

  try {
    const result = await extractEmbeddings(imagePath);
    
    // Clean up uploaded file
    fs.unlinkSync(imagePath);

    if (result) {
      res.json({
        success: true,
        embeddings: Array.from(result.descriptor),
        confidence: result.detection.score,
        dimensions: result.descriptor.length
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No face detected in the image'
      });
    }
  } catch (error) {
    // Clean up uploaded file on error
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    modelsLoaded: modelsLoaded 
  });
});

// Start server
async function startServer() {
  await loadModels();
  
  app.listen(PORT, () => {
    console.log(`🚀 Face API server running on http://localhost:${PORT}`);
    console.log(`📸 POST to /embeddings with an image to get face embeddings`);
    console.log(`❤️  GET /health to check server status`);
  });
}

startServer();
