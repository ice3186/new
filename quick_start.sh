#!/bin/bash

# Quick Start Script for EMR Care Gap Monitoring System
# This script helps you get started quickly

set -e

echo "======================================================"
echo "EMR Care Gap Monitoring System - Quick Start"
echo "======================================================"
echo ""

# Check Python version
echo "Checking Python version..."
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed"
    echo "Please install Python 3.11 or higher"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "Found Python $PYTHON_VERSION"
echo ""

# Install dependencies
echo "Installing dependencies..."
if [ -f "requirements.txt" ]; then
    pip3 install -r requirements.txt
    echo "Dependencies installed successfully"
else
    echo "Error: requirements.txt not found"
    exit 1
fi
echo ""

# Setup environment file
echo "Setting up environment configuration..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "Created .env file from template"
    echo ""
    echo "IMPORTANT: You must edit .env and add your credentials!"
    echo "Run: nano .env (or use your preferred editor)"
    echo ""
    read -p "Press Enter to continue..."
else
    echo ".env file already exists"
fi
echo ""

# Test if .env has been configured
if grep -q "your_api_key_here" .env 2>/dev/null; then
    echo "WARNING: .env file still contains placeholder values"
    echo "You need to edit .env and add your actual credentials"
    echo ""
    read -p "Do you want to edit .env now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ${EDITOR:-nano} .env
    fi
fi
echo ""

# Make main.py executable
echo "Making main.py executable..."
chmod +x main.py
echo ""

# Test connection
echo "======================================================"
echo "Setup complete! Now testing API connection..."
echo "======================================================"
echo ""

if python3 main.py test; then
    echo ""
    echo "======================================================"
    echo "Success! Your EMR Care Gap Monitor is ready to use"
    echo "======================================================"
    echo ""
    echo "Next steps:"
    echo "1. Review and customize rules: nano care_gap_rules.yaml"
    echo "2. Run a manual check: python3 main.py check"
    echo "3. View all rules: python3 main.py rules"
    echo "4. Start continuous monitoring: python3 main.py monitor"
    echo ""
    echo "For detailed instructions, see README.md and SETUP_GUIDE.md"
else
    echo ""
    echo "======================================================"
    echo "API connection test failed"
    echo "======================================================"
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Verify your credentials in .env"
    echo "2. Check your internet connection"
    echo "3. Review logs in care_gap_monitor.log"
    echo "4. See SETUP_GUIDE.md for detailed setup instructions"
    echo ""
fi
