# Save the IDs of images you want to keep
KEEP_IMAGES="docker.io/library/python:3.9 docker.io/library/postgres:latest localhost/slurk_slurk:latest localhost/slurk/sailsman:latest"
podman image prune -f
# Remove all images except those in KEEP_IMAGES
podman images --format "{{.Repository}}:{{.Tag}}" | grep -v -E "$(echo $KEEP_IMAGES | sed 's/ /|/g')" | xargs -r podman rmi