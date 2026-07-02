const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dir = path.join(__dirname, 'public/images');

async function processImages() {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
  let count = 0;
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const outName = file.replace(/\.(jpg|png)$/i, '.webp');
    const outPath = path.join(dir, outName);
    
    // Skip if already exists
    if (fs.existsSync(outPath)) {
      console.log(`Skipping ${file} - webp already exists`);
      continue;
    }
    
    try {
      console.log(`Processing ${file}...`);
      await sharp(filePath)
        .resize({ width: 1920, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(outPath);
        
      count++;
      
      // Delete the original file after successful conversion to save space
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error(`Failed on ${file}:`, e);
    }
  }
  console.log(`Processed ${count} images.`);
}

processImages();
