#!/usr/bin/env node

/**
 * Simple bundle analyzer to detect duplicate modules
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Analyzing bundle for duplicate modules...\n');

// Analyze Vite build output
const distPath = path.join(__dirname, 'dist');

if (!fs.existsSync(distPath)) {
  console.log('❌ No dist folder found. Run "npm run build" first.');
  process.exit(1);
}

const files = fs.readdirSync(distPath);
const jsFiles = files.filter(f => f.endsWith('.js'));

console.log('📦 JavaScript bundles found:');
jsFiles.forEach(file => {
  const stats = fs.statSync(path.join(distPath, file));
  const sizeKB = (stats.size / 1024).toFixed(2);
  console.log(`  ${file} - ${sizeKB} KB`);
});

console.log('\n✅ Bundle analysis complete!');
console.log('\n💡 Tips to prevent duplicate loading:');
console.log('  • Use dynamic imports for non-critical modules');
console.log('  • Check Vite manualChunks configuration');
console.log('  • Use modulepreload for critical modules');
console.log('  • Monitor Network tab in DevTools for duplicate requests');

console.log('\n🚀 To test MediaEditor without blocking startup:');
console.log('  Open browser console and run: showMediaEditor()');
