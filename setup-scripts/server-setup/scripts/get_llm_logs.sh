#!/bin/bash

OUTPUT_DIR="/home/slurk/logs/tsp-agent-logs"

# Function to copy logs from a container
copy_logs() {
    local container=$1
    echo "Processing container: $container"
    
    # Create output directories for this container
    # local container_dir="$OUTPUT_DIR/${container}"
    mkdir -p "$OUTPUT_DIR/dialogue"
    # mkdir -p "$OUTPUT_DIR/gsm"

    # Copy dialogue logs
    echo "Copying dialogue logs..."
    podman cp "$container:/usr/src/sailsman/tsp-game-agent/logs/v3/dialogue/." "$OUTPUT_DIR/dialogue/V3/" || echo "Warning: Could not copy dialogue logs from $container"

    # Copy gsm logs
    # echo "Copying gsm logs..."
    # podman cp "$container:/usr/src/sailsman/tsp-game-agent/logs/v3/gsm/." "$OUTPUT_DIR/gsm/V3/" || echo "Warning: Could not copy gsm logs from $container"

    echo "Logs have been copied to $OUTPUT_DIR"
    echo "  - Dialogue logs: $OUTPUT_DIR/dialogue/"
    echo "  - GSM logs: $OUTPUT_DIR/gsm/"
}

# Check if -a flag is provided
if [ "$1" = "-a" ]; then
    # Create base output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Get all container IDs/names except slurk_slurk_1 and slurk_database
    containers=$(podman ps -a --format '{{.Names}}' | grep -v -E 'slurk_slurk_1|slurk_db_1')
    
    if [ -z "$containers" ]; then
        echo "No eligible containers found."
        exit 1
    fi
    
    # Process each container
    echo "Processing all containers except slurk_slurk_1 and slurk_db_1..."
    for container in $containers; do
        copy_logs "$container"
        echo "----------------------------------------"
    done
    
    echo "All container logs have been processed"
else
    # Original single container functionality
    if [ -z "$1" ]; then
        echo "Usage: $0 [-a] | <container_name_or_id>"
        echo "  -a: Process all containers except slurk_slurk_1 and slurk_database"
        exit 1
    fi

    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Process single container
    copy_logs "$1"
fi
