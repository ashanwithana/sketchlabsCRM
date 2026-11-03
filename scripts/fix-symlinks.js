#!/usr/bin/env node
/**
 * Post-build script to remove symlinks from .next/node_modules
 * This fixes Cloudflare Pages deployment errors about inaccessible symlinks
 */

const fs = require('fs');
const path = require('path');

const nodeModulesPath = path.join(__dirname, '../.next/node_modules');

console.log('🔍 Checking for symlinks in .next directory...');

if (!fs.existsSync(nodeModulesPath)) {
  console.log('✓ .next/node_modules not found, skipping symlink cleanup');
  process.exit(0);
}

let removedCount = 0;
let errorCount = 0;

function walkDir(dir, depth = 0) {
  // Prevent infinite loops
  if (depth > 20) return;

  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);

      try {
        const stat = fs.lstatSync(fullPath);

        if (stat.isSymbolicLink()) {
          try {
            fs.unlinkSync(fullPath);
            removedCount++;
            console.log(`  ✓ Removed: ${path.relative(process.cwd(), fullPath)}`);
          } catch (unlinkErr) {
            errorCount++;
            console.error(`  ✗ Failed to remove: ${fullPath}`, unlinkErr.message);
          }
        } else if (stat.isDirectory() && !stat.isSymbolicLink()) {
          walkDir(fullPath, depth + 1);
        }
      } catch (statErr) {
        // Skip files we can't stat (often symlinks to non-existent targets)
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err.message);
  }
}

walkDir(nodeModulesPath);

if (removedCount > 0) {
  console.log(`\n✓ Successfully removed ${removedCount} symlinks`);
} else {
  console.log(`\n✓ No symlinks found to remove`);
}

if (errorCount > 0) {
  console.warn(`⚠ Warning: ${errorCount} symlinks could not be removed`);
  process.exit(1);
}

process.exit(0);
