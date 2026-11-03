#!/usr/bin/env node
/**
 * Post-build script to remove symlinks from .next/node_modules
 * This fixes Cloudflare Pages deployment errors about inaccessible symlinks
 */

const fs = require('fs');
const path = require('path');

const nodeModulesPath = path.join(__dirname, '../.next/node_modules');

if (!fs.existsSync(nodeModulesPath)) {
  console.log('✓ .next/node_modules not found (standalone build), skipping symlink cleanup');
  process.exit(0);
}

let removedCount = 0;

function walkDir(dir) {
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.lstatSync(fullPath);
      
      if (stat.isSymbolicLink()) {
        try {
          fs.unlinkSync(fullPath);
          removedCount++;
          console.log(`Removed symlink: ${fullPath}`);
        } catch (err) {
          console.error(`Failed to remove symlink ${fullPath}:`, err.message);
        }
      } else if (stat.isDirectory()) {
        walkDir(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error walking directory ${dir}:`, err.message);
  }
}

walkDir(nodeModulesPath);
console.log(`✓ Removed ${removedCount} symlinks from .next/node_modules`);
