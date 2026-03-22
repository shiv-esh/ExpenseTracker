#!/bin/bash

# ============================================================
# Expense Tracker - Backend Deployment Script
# ============================================================
# Usage: ./deploy-backend.sh <path-to-pem-file>
# ============================================================

set -e

# --- Configuration ---
EC2_USER="shivesh"
EC2_HOST="192.168.29.71"
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

scp $SSH_OPTS \
    "$SCRIPT_DIR/service/target/expenseTracker-0.0.1-SNAPSHOT.jar" \
    "$EC2_USER@$EC2_HOST:~/"

echo ""
echo "🚀 Restarting backend on EC2..."
ssh $SSH_OPTS "$EC2_USER@$EC2_HOST" << 'REMOTE'
    pkill -f "expenseTracker-0.0.1-SNAPSHOT.jar" 2>/dev/null || true
    sleep 5
    nohup java -jar ~/expenseTracker-0.0.1-SNAPSHOT.jar > ~/app.log 2>&1 &
    echo "Backend started."
REMOTE

echo "============================================================"
echo " ✅ Backend Deployment Complete!"
echo " 📋 Logs: ssh $SSH_OPTS $EC2_USER@$EC2_HOST 'tail -f ~/app.log'"
echo "============================================================"
