#!/bin/bash

echo "🚀 Starting Voice Chat Server..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start Redis
echo "📦 Starting Redis..."
docker compose up -d

# Wait for Redis to be healthy
echo "⏳ Waiting for Redis to be ready..."
timeout=30
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker compose ps | grep -q "healthy"; then
        echo "✅ Redis is healthy!"
        break
    fi
    sleep 1
    elapsed=$((elapsed + 1))
done

if [ $elapsed -eq $timeout ]; then
    echo "❌ Redis failed to start within $timeout seconds"
    exit 1
fi

# Show status
echo ""
echo "📊 Service Status:"
docker compose ps

echo ""
echo "🌐 Services Running:"
echo "  - Redis: localhost:6379"
echo "  - Redis Commander: http://localhost:8081"
echo ""

# Start Node.js server
echo "🎙️ Starting Voice Chat Server..."
yarn dev

