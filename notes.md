# 14.11.2024:
There was an issue with connecting in: templates.py: line 52 (sio.connect() in run()) would try to connect but the connection will not always be done in time before an sio.emit() is called (in this case in sailsman/\_\_main\_\_.py: line 285 in joined_room()).
The error this produces is: ```socketio.exceptions.BadNamespaceError: / is not a connected namespace.```.
To fix it, I changed the slurk server to have ```always_connect=True``` in ```slurk/slurk/extensions/events.py```
 line 3: ```socketio = SocketIO(ping_interval=5, ping_timeout=120, always_connect=True)```

 # Starting the Bot on the Server
 The `slurk/` directory and `slurk-bots/` directory must be next to each other. I put a docker-compose file in their same directory. Let's call it `server`. 
 First, to start the slurk server with the postgres database, in `server` run:
 `$ podman-compose up`

Copy the admin token that gets shown once the server has started:\
```$ export SLURK_API_TOKEN={admin_token}```
Next move inside the `slurk-bots/` directory. Activate the conda environment and run the 'start_bot.py'. As on the server podman is used, I changed the python script, so here, `start_bot_podman.py` must be used:
```
$ cd slurk-bots
$ conda activate {conda-environment}
$ python start_bot_podman.py sailsman --users 2 --slurk-api-token $SLURK_API_TOKEN --tokens --waiting-room-layout-dict waiting_room_layout.json
```
token amazon turk
which logs

look into how to host a server:
 - make front-end with instrucitons and button -> clicke: generates link to waiting room, use stack
 - How can the slurk/server be run and accessed and ported to
 - use potsdam as refernce