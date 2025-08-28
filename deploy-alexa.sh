#!/bin/bash

# ASK CLI deployment script for Inventory Tracker
# Usage: ./deploy-alexa.sh

echo "🚀 Deploying Alexa Skill..."

# Check if ASK CLI is configured
if ! ask util get-profile --profile default &>/dev/null; then
    echo "❌ ASK CLI not configured. Please run 'ask configure' first."
    exit 1
fi

# Deploy the skill
echo "📤 Deploying skill package..."
ask deploy

# Get skill status
echo "📊 Getting skill status..."
ask skill list

echo "✅ Deployment complete!"
echo ""
echo "🧪 To test your skill:"
echo "  ask dialog --locale ja-JP"
echo ""
echo "🔍 To check skill status:"  
echo "  ask skill list"
echo ""
echo "📝 To update interaction model only:"
echo "  ask deploy --target model"