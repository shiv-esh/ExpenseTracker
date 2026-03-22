#!/bin/bash

# ============================================================
# Expense Tracker - Frontend Deployment Script
# ============================================================
# Usage: ./deploy-frontend.sh <path-to-pem-file>
# ============================================================

set -e

# --- Configuration ---
EC2_USER="shivesh"
EC2_HOST="192.168.29.71"
EC2_FRONTEND_PATH="/home/shivesh/expense-tracker/"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Validate PEM file argument ---
PEM_FILE="$1"

# --- Optional PEM file check ---
SSH_OPTS="-o StrictHostKeyChecking=no"
if [ -n "$PEM_FILE" ] && [ -f "$PEM_FILE" ]; then
    chmod 400 "$PEM_FILE"
    SSH_OPTS="$SSH_OPTS -i $PEM_FILE"
    echo "🔑 Using provided PEM file: $PEM_FILE"
else
    echo "🔑 Using default SSH key"
fi

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

# Prepare directory (No sudo needed for home folder)
ssh $SSH_OPTS "$EC2_USER@$EC2_HOST" "mkdir -p $EC2_FRONTEND_PATH"

# Clear old frontend files
echo "   → Cleaning old frontend directory on host..."
ssh $SSH_OPTS "$EC2_USER@$EC2_HOST" \
    "rm -rf $EC2_FRONTEND_PATH/*"

# Upload Frontend dist
echo "   → Uploading frontend assets..."
scp -r $SSH_OPTS \
    "$SCRIPT_DIR/view/expense-tracker/dist/expense-tracker/." \
    "$EC2_USER@$EC2_HOST:$EC2_FRONTEND_PATH/"

echo "============================================================"
echo " ✅ Frontend Deployment Complete!"
echo " 🌐 App: http://$EC2_HOST"
echo "============================================================"
