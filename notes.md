# 14.11.2024:
There was an issue with connecting in: templates.py: line 52 (sio.connect() in run()) would try to connect but the connection will not always be done in time before an sio.emit() is called (in this case in sailsman/\_\_main\_\_.py: line 285 in joined_room()).
The error this produces is: ```socketio.exceptions.BadNamespaceError: / is not a connected namespace.```.
To fix it, I changed the slurk server to have ```always_connect=True``` in ```slurk/slurk/extensions/events.py```
 line 3: ```socketio = SocketIO(ping_interval=5, ping_timeout=120, always_connect=True)```