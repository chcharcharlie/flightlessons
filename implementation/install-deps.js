#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('FlightLessons Dependency Installer');
console.log('==================================\n');

function runCommand(command, cwd = process.cwd()) {
  try {
    execSync(command, { stdio: 'inherit', cwd });
    return true;
  } catch (error) {
    return false;
  }
}

// Create minimal package.json for initial install
const minimalPackage = {
  name: 'flightlessons-temp',
  version: '1.0.0',
  private: true,
};

console.log('Creating temporary package.json...');
fs.writeFileSync('package-temp.json', JSON.stringify(minimalPackage, null, 2));

// Install dependencies one by one
const dependencies = [
  'react@18.2.0',
  'react-dom@18.2.0',
  'react-router-dom@6.20.0',
  'firebase@10.7.0',
  'zustand@4.4.7',
  '@headlessui/react@1.7.17',
  '@heroicons/react@2.0.18',
  '@tanstack/react-query@5.12.2',
  'zod@3.22.4',
  'date-fns@2.30.0'
];

const devDependencies = [
  '@types/react@18.2.43',
  '@types/react-dom@18.2.17',
  'typescript@5.3.3',
  'vite@5.0.8',
  '@vitejs/plugin-react@4.2.1',
  'tailwindcss@3.3.6',
  'autoprefixer@10.4.16',
  'postcss@8.4.32',
  'eslint@8.55.0',
  '@typescript-eslint/eslint-plugin@6.14.0',
  '@typescript-eslint/parser@6.14.0',
  'eslint-plugin-react-hooks@4.6.0',
  'eslint-plugin-react-refresh@0.4.5',
  'prettier@3.1.1'
];

console.log('\nInstalling dependencies...');
dependencies.forEach(dep => {
  console.log(`Installing ${dep}...`);
  runCommand(`npm install ${dep} --legacy-peer-deps`);
});

console.log('\nInstalling dev dependencies...');
devDependencies.forEach(dep => {
  console.log(`Installing ${dep}...`);
  runCommand(`npm install -D ${dep} --legacy-peer-deps`);
});

// Clean up
fs.unlinkSync('package-temp.json');

console.log('\nInstalling Cloud Functions dependencies...');
runCommand('npm install', path.join(process.cwd(), 'functions'));

console.log('\n✅ Installation complete!');
console.log('\nNext steps:');
console.log('1. Copy .env.example to .env and add your Firebase config');
console.log('2. Run: firebase login');
console.log('3. Run: firebase use --add');
console.log('4. Start emulators: npm run emulators');
console.log('5. Start dev server: npm run dev');