import threading
import time
import logging

from flask import Flask, jsonify, request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import subprocess
import re

app = Flask(__name__)

EXCLUDE_CONTAINER = ["slurk_slurk_1", "slurk_db_1"]
SLURK_API_TOKEN = "1599028a-f8fa-4c3f-a175-efa02407b295"
container_timers = {}
# container_task_ids = {}
container_room_ids = {}
MAX_CONTAINER = 30

GRAPH_TYPES = ["greedy", "non_greedy"]


logging.basicConfig(
    filename="../logs/start_site/start_sailsman.log",
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)

# Initialize the limiter correctly
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["50 per day"],
    storage_uri="memory://"
)

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({
        "error": "Rate limit exceeded",
        "message": "Please try again in a moment."

    }), 429


def list_game_containers():
    command = f"podman ps -a --format '{{{{.ID}}}} {{{{.Names}}}}' |grep -vE '{'|'.join(EXCLUDE_CONTAINER)}'| awk '{{print $1}}'"
    result = subprocess.run(command, capture_output=True, text=True, shell=True)
    containers = result.stdout.strip().split("\n")
    return containers

def parse_container_logs(container_name):
    logs = subprocess.run(f"podman logs {container_name}", capture_output=True, text=True, shell=True).stderr
    user_joined = "document_ready" in logs
    user_left = "Removing user" in logs
    return user_joined, user_left

def parse_start_sailsman_output(output):
    # take first 12 characters, which is the equivalent length when running podman ps
    container_id = re.findall(r"CONTAINER_ID:\s*(\S+)", output)[0][:12]

    room_id = int(re.findall(r"room id:\s*(\d+)", output)[0])
    task_id = int(re.findall(r"task id:\s*(\d+)", output)[0])
    token = re.findall(r"Token:\s*(\S+)", output)[0]
    link = re.findall(r"Link:\s*(\S+)", output)[0]
    return container_id, room_id, task_id, token, link

def make_container_space():
    print("Cleaning up containers")
    now = time.time()
    containers = list_game_containers()
    print(f"list containers {containers}")
    print(f"current running container {container_timers}")
    to_remove = []
    to_save_logs = []
    for c in containers:
        if c not in container_timers:
            print("[WARNING]: There are containers that haven't been created with this application")
            continue
        start_time = container_timers.get(c)
        user_joined, user_left = parse_container_logs(c)
        # task_id = container_task_ids[c]
        container_up_timer = now - start_time

        app.logger.info(f"container up time of {c} is {container_up_timer}")
        if container_up_timer > 120 and not user_joined:
            to_remove.append(c)
            # app.logger.info(f"Removing task {task_id}. Status: No user joined.")
            # print(f"removing {c} because no user has joined in time.")
        elif user_left:
            to_remove.append(c)
            to_save_logs.append(c)
            # app.logger.info(f"Removing task {task_id}. Status: Task completed.")
            # print(f"removing {c} because user has left.")
        elif container_up_timer > 60 * 40:
            to_remove.append(c)
            # app.logger.info(f"Removing task {task_id}. Status: Container was up too long.")
            # print(f"removing {c} because it has been running for {container_up_timer} seconds.")

    # only remove batches of at least 5 containers
    if len(to_remove) < 5 and len(container_timers) < MAX_CONTAINER:
        app.logger.info(f"not removing containers as there are only {len(to_remove)} to remove.")
        return True
    
    if not to_remove:
        app.logger.info("No containers there to remove.")
        return False
    
    # Download logs
    for c in to_save_logs:
        room_id = container_room_ids[c]
        app.logger.info(f"downloading logs for room {room_id}")
        subprocess.run(f"../scripts/get_llm_logs.sh {c}", shell=True)
        subprocess.run(f"python download_logs_from_room.py --room_id {room_id} --token {SLURK_API_TOKEN} --output-dir ../logs/human-agent",shell=True)

    # Remove Container
    subprocess.run(["podman", "stop"] + to_remove)
    subprocess.run(["podman", "rm"] + to_remove)

    for c in to_remove:
        container_timers.pop(c, None)
        container_room_ids.pop(c, None)
    return True

def retreive_uses():
    with open("../.sailsman_graph_uses", "r") as f:
        uses = []
        for l in f.readlines():
            uses.append(int(l.split()[-1]))

    return uses

def update_uses(i, num):
    with open("../.sailsman_graph_uses", "r+") as f:
        lines = f.readlines()
        lines[i] = re.sub(r'\S+$', f"{num}", lines[i])
        f.seek(0)
        f.writelines(lines)
        f.truncate()

def update_sailsman_config(graph_type, graph_index):
    with open("sailsman-game/config.py", "r+") as f:
        lines = f.readlines()
        f.seek(0)
        
        new_lines = []
        for line in lines:
            if line.strip().startswith("GRAPH_TYPE"):
                # Replace the line with the new value
                new_line = f'GRAPH_TYPE = "{graph_type}"\n'
            elif line.strip().startswith("GRAPH_INDEX"):
                new_line = f'GRAPH_INDEX = {graph_index}\n'
            else:
                new_line = line
            new_lines.append(new_line)
        
        f.writelines(new_lines)
        f.truncate()

@app.route('/start-game/', methods=['POST'])
@limiter.limit("1 per second")  # Add specific rate limit for this endpoint
def start_game():

    if not make_container_space():
        return jsonify({
            "error": "Containers full",
            "message": "There are too many games running. Please try again in a moment.",
        }), 429

    uses = retreive_uses()
    current_min_use = uses.index(min(uses))

    update_uses(current_min_use, uses[current_min_use] + 1)

    # next_graph_type = GRAPH_TYPES[current_min_use // 2] # greedy or non-greedy graph
    next_graph_index = current_min_use + 2 #alter between two permutations

    update_sailsman_config(GRAPH_TYPES[0], next_graph_index)

    result = subprocess.run(["../scripts/start_sailsman.sh", "-u", "1", "-ip"], capture_output=True, text=True)
    container_id, room_id, task_id, token, link = parse_start_sailsman_output(result.stdout)
    container_timers[container_id] = time.time()
    container_room_ids[container_id] = room_id
    app.logger.info(f"created container with id: {container_id}, task id {task_id}, and room id: {room_id}. It can be accessed at {link}.")
    



    return jsonify({
        "login_url": link
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8001)