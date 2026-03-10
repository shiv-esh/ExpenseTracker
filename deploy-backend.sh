#!/bin/bash

# ============================================================
# Expense Tracker - Backend Deployment Script
# ============================================================
# Usage: ./deploy-backend.sh <path-to-pem-file>
# ============================================================

set -e

# --- Configuration ---
EC2_USER="ubuntu"
EC2_HOST="15.206.209.187"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Validate PEM file argument ---
if [ -z "$1" ]; then
    echo "❌ Error: Please provide the path to your .pem file."
    echo "   Usage: ./deploy-backend.sh <path-to-pem-file>"
    exit 1
fi

PEM_FILE="$1"

if [ ! -f "$PEM_FILE" ]; then
    echo "❌ Error: PEM file not found at '$PEM_FILE'"
    exit 1
fi

chmod 400 "$PEM_FILE"

echo "============================================================"
echo " 🔨 Building Backend"
echo "============================================================"

cd "$SCRIPT_DIR/service"
chmod +x mvnw
./mvnw clean package -DskipTests -q
echo "✅ Backend build successful."

echo ""
echo "============================================================"
echo " 📤 Uploading to EC2"
echo "============================================================"

scp -i "$PEM_FILE" -o StrictHostKeyChecking=no \
    "$SCRIPT_DIR/service/target/expenseTracker-0.0.1-SNAPSHOT.jar" \
    "$EC2_USER@$EC2_HOST:~/"

echo ""
echo "🚀 Restarting backend on EC2..."
ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" << 'REMOTE'
    pkill -f "expenseTracker-0.0.1-SNAPSHOT.jar" 2>/dev/null || true
    sleep 2
    nohup java -jar ~/expenseTracker-0.0.1-SNAPSHOT.jar > ~/app.log 2>&1 &
    echo "Backend started."
REMOTE

echo "============================================================"
echo " ✅ Backend Deployment Complete!"
echo " 📋 Logs: ssh -i $PEM_FILE $EC2_USER@$EC2_HOST 'tail -f ~/app.log'"
echo "============================================================"
