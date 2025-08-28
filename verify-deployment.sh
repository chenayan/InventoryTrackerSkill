#!/bin/bash

# Post-Deployment Verification Script
# Runs comprehensive tests against deployed production environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Post-Deployment Verification${NC}"
echo "=================================="

# Check if deployment URL is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Usage: $0 <deployment-url>${NC}"
    echo "Example: $0 https://your-app.vercel.app"
    exit 1
fi

DEPLOYMENT_URL="$1"
echo -e "${YELLOW}🎯 Testing deployment at: ${DEPLOYMENT_URL}${NC}"

# Remove trailing slash from URL
DEPLOYMENT_URL=${DEPLOYMENT_URL%/}

# Check if the deployment is accessible
echo -e "${YELLOW}📡 Checking deployment accessibility...${NC}"
if curl -f -s --max-time 10 "$DEPLOYMENT_URL" > /dev/null; then
    echo -e "${GREEN}✅ Deployment is accessible${NC}"
else
    echo -e "${RED}❌ Deployment is not accessible${NC}"
    echo "Please check your deployment URL and try again."
    exit 1
fi

# Run the post-deployment tests
echo -e "${YELLOW}🧪 Running post-deployment verification tests...${NC}"
echo ""

DEPLOYMENT_URL="$DEPLOYMENT_URL" npm test -- --testNamePattern="Post-Deployment Verification" --verbose

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All post-deployment tests passed!${NC}"
    echo "=================================="
    echo -e "${GREEN}✅ Your deployment is working correctly${NC}"
    echo ""
    echo -e "${BLUE}📱 Alexa Skill Endpoint:${NC}"
    echo "   $DEPLOYMENT_URL/api/inventory"
    echo ""
    echo -e "${BLUE}🌐 Web Interface:${NC}"
    echo "   $DEPLOYMENT_URL"
    echo ""
    echo -e "${BLUE}🔗 API Base URL:${NC}"
    echo "   $DEPLOYMENT_URL/api"
    echo ""
    echo -e "${GREEN}🚀 Ready for production use!${NC}"
else
    echo ""
    echo -e "${RED}❌ Some post-deployment tests failed${NC}"
    echo "Please check the test output above and fix any issues."
    exit 1
fi