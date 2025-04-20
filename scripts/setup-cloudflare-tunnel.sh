#!/bin/bash
# Script to set up a Cloudflare tunnel for the SQLite MCP server
# Usage: ./setup-cloudflare-tunnel.sh <tunnel-name> <domain> [http-port]

set -e

# Default values
TUNNEL_NAME=${1:-"sqlite-mcp"}
DOMAIN=${2:-"$TUNNEL_NAME.example.com"}
HTTP_PORT=${3:-31111}

echo "Setting up Cloudflare tunnel with the following configuration:"
echo "Tunnel Name: $TUNNEL_NAME"
echo "Domain: $DOMAIN"
echo "HTTP Port: $HTTP_PORT"
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "Error: cloudflared is not installed. Please install it first."
    echo "Visit: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation"
    exit 1
fi

# Check if user is logged in to Cloudflare
echo "Checking Cloudflare authentication..."
if ! cloudflared tunnel list &> /dev/null; then
    echo "You need to log in to Cloudflare first."
    cloudflared login
fi

# Create the tunnel
echo "Creating Cloudflare tunnel: $TUNNEL_NAME"
TUNNEL_ID=$(cloudflared tunnel create "$TUNNEL_NAME" | grep -oP 'Created tunnel \K[^ ]+' | tail -1)
echo "Tunnel created with ID: $TUNNEL_ID"

# Create DNS record
echo "Creating DNS record: $DOMAIN -> $TUNNEL_NAME"
cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN"

# Create config file
CONFIG_FILE="cloudflared-$TUNNEL_NAME.yml"
echo "Creating configuration file: $CONFIG_FILE"

cat > "$CONFIG_FILE" << EOF
tunnel: $TUNNEL_ID
credentials-file: ~/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $DOMAIN
    service: http://localhost:$HTTP_PORT
  - service: http_status:404
EOF

echo "Configuration file created successfully."
echo ""
echo "To start the tunnel, run:"
echo "cloudflared tunnel --config $CONFIG_FILE run"
echo ""
echo "To install as a service (recommended for production):"
echo "sudo cloudflared service install --config $CONFIG_FILE"
echo ""
echo "Note: It may take 5-15 minutes for SSL certificates to be provisioned."
echo "If you encounter SSL errors, please wait and try again later."
