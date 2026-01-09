#!/bin/bash

# Parse command line arguments
copy_plugins=false
copy_images=false
num_users=2  # Default number of users

# Process all arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -p|-pi|-ip)
            copy_plugins=true
            ;;
        -i|-pi|-ip)
            copy_images=true
            ;;
        -u)
            if [[ $# -gt 1 ]]; then
                num_users="$2"
                shift  # Skip the next argument (the number)
            fi
            ;;
    esac
    shift  # Move to the next argument
done

echo "start game with $num_users users"
# Base command
cmd="python /home/slurk/slurk-bots/start_bot_podman.py sailsman-game --users $num_users --slurk-api-token 1599028a-f8fa-4c3f-a175-efa02407b295 --tokens"

# Add options based on flags
if [ "$copy_plugins" = true ]; then
    cmd="$cmd --copy-plugins --copy-plugins-to-container slurk_slurk_1"
fi

if [ "$copy_images" = true ]; then
    cmd="$cmd --copy-images --copy-images-to-container slurk_slurk_1"
fi

# Execute the command
eval $cmd