#!/bin/bash

# ============================================================
# Expense Tracker - Frontend Deployment Script
# ============================================================
# Usage: ./deploy-frontend.sh <path-to-pem-file>
# ============================================================

set -e

# --- Configuration ---
EC2_USER="ubuntu"
EC2_HOST="15.206.209.187"
EC2_FRONTEND_PATH="/home/ubuntu/expense-tracker/"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Validate PEM file argument ---
if [ -z "$1" ]; then
    echo "❌ Error: Please provide the path to your .pem file."
    echo "   Usage: ./deploy-frontend.sh <path-to-pem-file>"
    exit 1
fi

PEM_FILE="$1"

if [ ! -f "$PEM_FILE" ]; then
    echo "❌ Error: PEM file not found at '$PEM_FILE'"
    exit 1
fi

chmod 400 "$PEM_FILE"

echo "============================================================"
echo " 🔨 Building Frontend"
echo "============================================================"

cd "$SCRIPT_DIR/view/expense-tracker"
npm install --silent
npm run build -- --configuration production
echo "✅ Frontend build successful."

echo ""
echo "============================================================"
echo " 📤 Uploading to EC2"
echo "============================================================"

# Prepare EC2 directory
ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" \
    "sudo mkdir -p $EC2_FRONTEND_PATH && sudo chown -R $EC2_USER:$EC2_USER /home/ubuntu/expense-tracker"

# Clear old frontend files
echo "   → Cleaning old frontend directory on host..."
ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" \
    "rm -rf $EC2_FRONTEND_PATH/*"

# Upload Frontend dist
echo "   → Uploading frontend assets..."
scp -r -i "$PEM_FILE" -o StrictHostKeyChecking=no \
    "$SCRIPT_DIR/view/expense-tracker/dist/expense-tracker/." \
    "$EC2_USER@$EC2_HOST:$EC2_FRONTEND_PATH/"

echo "============================================================"
echo " ✅ Frontend Deployment Complete!"
echo " 🌐 App: http://$EC2_HOST"
echo "============================================================"
