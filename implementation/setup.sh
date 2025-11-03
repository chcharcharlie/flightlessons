#!/bin/bash

echo "FlightLessons Setup Script"
echo "========================="

# Check if npm cache needs fixing
if [ -w ~/.npm ]; then
    echo "✓ npm cache permissions OK"
else
    echo "⚠️  npm cache needs permission fix"
    echo "Run: sudo chown -R $(whoami) ~/.npm"
    echo "Then run this script again"
    exit 1
fi

# Install main dependencies
echo "Installing frontend dependencies..."
npm install --legacy-peer-deps

# Install functions dependencies
echo "Installing Cloud Functions dependencies..."
cd functions
npm install
cd ..

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update .env with your Firebase config"
fi

echo ""
echo "Setup complete! Next steps:"
echo "1. Update .env with your Firebase configuration"
echo "2. Run 'firebase login' if not already logged in"
echo "3. Run 'firebase use --add' to select your project"
echo "4. Run 'npm run emulators' in one terminal"
echo "5. Run 'npm run dev' in another terminal"