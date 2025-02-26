from itertools import permutations
from bisect import bisect_left
from collections import defaultdict
import logging
# import random
from threading import Timer
# import string
import requests
# from time import sleep
from templates import TaskBot
from time import sleep
# from random import randrange, choice


from .config import *
# from .msgfunctions import *

class RoomTimer:
    def __init__(self, function, room_id, TIMER):
        self.function = function
        self.room_id = room_id
        self.start_timer(TIMER)

    def start_timer(self, TIMER):
        self.timer = Timer(
            TIMER*60,
            self.function,
            args=[self.room_id]
        )
        self.timer.start()

    def reset(self, TIMER):
        self.timer.cancel()
        self.start_timer(TIMER)
        logging.debug("reset timer")

    def cancel(self):
        self.timer.cancel()


class Session:
    def __init__(self):
        self.players = []
        self.episode_timer = None
        # self.timer: RoomTimer = None
        self.halfway_timer: RoomTimer = None
        self.one_minute_timer: RoomTimer = None
        self.graph = {}
        self.path = {}

        # Change these numbers to adjust the episodes to play. Make sure that len(self.graph_sizes) >= self.number_of_episodes and len(self.max_weights) >= self.number_of_episodes, at best they are equal.
        self.episode_counter = 2  # number of rounds to play
        self.graph_sizes = [5, 4] # counted right to left
        assert(self.episode_counter == len(self.graph_sizes))
        self.max_weights = [10, 10] # counted right to left
        assert(self.episode_counter == len(self.max_weights))
        self.episode_times = [8, 7] # counted right to left
        assert(self.episode_counter == len(self.episode_times))
        self.submissions = set()
        self.scores = []

    def close(self):
        self.cancel_timers()

    def cancel_timers(self):
        if self.episode_timer:
            self.episode_timer.cancel()
        if self.halfway_timer:
            self.halfway_timer.cancel()
        if self.one_minute_timer:
            self.one_minute_timer.cancel()

    def next_episode(self):
        self.episode_counter -= 1
        self.cancel_timers()

    @property
    def graph_size(self):
        return self.graph_sizes[self.episode_counter]

    @property
    def max_weight(self):
        return self.max_weights[self.episode_counter]

    @property
    def time(self):
        return self.episode_times[self.episode_counter]



class SessionManager:

    def __init__(self, session_factory):
        self._sessions = defaultdict(session_factory)

    def create_session(self, room_id):
        self._sessions[room_id] = Session()

    def clear_session(self, room_id):
        if room_id in self._sessions:
            self._sessions[room_id].close()
            self._sessions.pop(room_id)

    def __contains__(self, room_id) -> bool:
        return room_id in self._sessions

    def __getitem__(self, room_id) -> Session:
        return self._sessions[room_id]

    def __setitem__(self, room_id, session: Session):
        self._sessions[room_id] = session


class Sailsman(TaskBot):

    session_manager = SessionManager(Session)
    data_collection = "AMT"

    def on_task_room_creation(self, data): # function doesn't get called in --dev mode
        room_id = data["room"]
        logging.debug(f"Room {room_id} was created")

        # sleep(10)
        self._start_new_episode(room_id)
        self.move_divider(room_id, chat_area=25, task_area=75) # resize chat area


    def warning_timer_half(self, room_id):

        current_session = self.session_manager[room_id]
        self.sio.emit(
            "text",
            {
                "message": COLOR_MESSAGE.format(
            color=WARNING_COLOR,
            message=f"Halfway done. There are {current_session.time / 2} minutes left.",
            ),
                "room": room_id,
                "html": True
            },
        )

    def warning_timer_one_min(self, room_id):

        self.sio.emit(
            "text",
            {
                "message": COLOR_MESSAGE.format(
            color=WARNING_COLOR,
            message="Only 1 minute left! Please submit your solution to proceed!",
            ),
                "room": room_id,
                "html": True
            },
        )

    def episode_timeout(self, room_id):
        self.sio.emit(
            "text",
            {
                "message": COLOR_MESSAGE.format(
            color=WARNING_COLOR,
            message="Ooops the time for this episode went out. ",
            ),
                "room": room_id,
                "html": True
            },
        )
        self.log_event("session_timeout", {}, room_id)
        self._start_new_episode(room_id)

    def close_room(self, room_id):
        self.room_to_read_only(room_id)

        # delete data structures
        self.session_manager.clear_session(room_id)

    def send_prolific_code(self, room_id):
        
        # the messages including the unique ID to be copied to the survey
        message = "Congratulations! You've completed the study. Here is your completion code: CETJD9OZ. Please paste it into Prolific in order to be eligible for compensation."
        self.sio.emit(
            "text",
            {
                "message": COLOR_MESSAGE.format(
            color=WARNING_COLOR,
            message=message
            ),
                "room": room_id,
                "html": True
            },
        )
    

    def calculate_score(self, room_id):

        ''' Calculates the score of the combined paths of both players. Paths must be identical!
        
        Parameters:
            room_id(int): the room for which to calculate the score.
        
        Return:
            percentile_score(float): The percentile of the combined sum of weights with respect to all possible paths. 0 is the best possible path.
            gold_path(tuple[int]): The best possible path.
            gold_cost(): Cost of the best possible path.
            path_cost(): Cost of the combined chosen paths.
        
        '''
        def calculate_tsp_score(graph, path):
            """Calculates values for all paths in a given graph.

            Parameters:
                graph(list[list[int]]): A list of lists, giving the edge weights from each index (node) to every other index (every other node).
                path(list[int]): A list of nodes.

            Return:
                cost_percentile(float): The score percentile in which the path falls with respect to all other possible paths.
                best_path(tuple[int]): The best possible path.
                best_cost(int): Cost of the best path.
                path_cost(int): Cost of the given path.

            """
            nodes = len(graph)
            perms = list(permutations(list(range(1, nodes)))) # Start node = 0
            path_cost = 0
            assert(path[0] == path[-1])
            for i in range(len(path) - 1):
                path_cost += graph[path[i]][path[i+1]]
            costs = []
            for perm in perms:
                path = (0,) + perm + (0,)
                cost = 0
                for i in range(len(path) - 1):
                    cost += graph[path[i]][path[i+1]]

                costs.append(cost)
            costs_indexed = [(i, costs[i]) for i in range(len(costs))] # should be simplified with enumerate
            costs_indexed.sort(key=lambda x: x[1])
            costs.sort()
            index = bisect_left(costs, path_cost)
            percentile = index / (len(costs) - 1)
            best_path = (0,) + perms[costs_indexed[0][0]] + (0,) # get the index of the lowest cost and take its permutation. Add start and end node.
            
            return percentile, best_path, costs[0], path_cost
        
        session = self.session_manager[room_id]
        user_ids = list(session.graph.keys())

        assert(session.path[user_ids[0]] == session.path[user_ids[1]])

        combined_graph = session.graph[user_ids[0]]
        for i, nodes in enumerate(self.session_manager[room_id].graph[user_ids[1]]):
            combined_graph[i] = [nodes[x] + combined_graph[i][x] for x in range(len(nodes))]
        path = session.path[user_ids[0]] #Take either of the two paths as they are identical
        path = path + [path[0]] #add start-node as end-node as well
        percentile_score, gold_path, gold_cost, path_cost = calculate_tsp_score(combined_graph, path)

        return percentile_score, gold_path, gold_cost, path_cost

    def _start_new_episode(self, room_id):
        sleep(1)
        current_session = self.session_manager[room_id]
        current_session.next_episode()
        if current_session.episode_counter >= 0:
            current_session.episode_timer = RoomTimer(
                self.episode_timeout, room_id, current_session.time
            )
            current_session.halfway_timer = RoomTimer(
                self.warning_timer_half, room_id, current_session.time / 2
            )

            current_session.one_minute_timer = RoomTimer(
                self.warning_timer_one_min, room_id, current_session.time - 1
            )
            message = f"This is episode {len(current_session.graph_sizes) - current_session.episode_counter} out of {len(current_session.graph_sizes)} episodes for you to complete.\n You have {current_session.time} minutes to complete this episode."
            self.sio.emit(
                    "text",
                    {
                        "message": WELCOME.format(
                            message=message, color=STANDARD_COLOR
                        ),
                        "room": room_id,
                        "html": True
                    },
                )
            
            self.sio.emit(
                "message_command",
                {
                "command": {
                    "event": "new_episode",
                    "size": current_session.graph_size,
                    "max_weight": current_session.max_weight,
                    "min_weight": 1
                },
                "room": room_id
                }
            )
                        
        else:
            self.send_prolific_code(room_id)

            self.close_room(room_id)
        

    def confirmation_code(self, room_id, bonus, receiver_id=None): #When should this be used?
        """ Generate token that will be sent to each player. """
        kwargs = {}
        # either only for one user or for both
        if receiver_id is not None:
            kwargs["receiver_id"] = receiver_id

        if bonus:
            confirmation_token = "BONUSCODE"
        else:
            confirmation_token = "REGULARCODE"

        # post confirmation token to logs
        response = requests.post(
            f"{self.uri}/logs",
            json={
                "event": "confirmation_log",
                "room_id": room_id,
                "data": {"confirmation_token": confirmation_token},
                **kwargs,
            },
            headers={"Authorization": f"Bearer {self.token}"},
        )
        self.request_feedback(response, "post confirmation token to logs")

        self._show_amt_token(room_id, confirmation_token, receiver_id)

        return confirmation_token

    def _show_amt_token(self, room, token, receiver):

        # the messages including the unique ID to be copied to the survey
        self.sio.emit(
            "text",
            {
                "message": COLOR_MESSAGE.format(
            color=STANDARD_COLOR,
            message="Please copy the following unique ID code before you close this window and go back to Prolific.",
            ),
                "room": room,
                "html": True
            },
        )

        self.sio.emit(
            "text",
            {
                "message": COLOR_MESSAGE.format(
                    color=STANDARD_COLOR, message=f"Your confirmation code: {token}"
                ),
                "room": room,
                "receiver_id": receiver,
                "html": True
            },
        )


    def register_callbacks(self):
        
        @self.sio.event
        def joined_room(data):
            """Triggered once after the bot joins a room."""
            logging.debug('WE HAVE ENTERED THE ROOM')
            logging.debug(f'DATA:\t{data}')
            room_id = data["room"]
            if room_id:
                logging.info(f"Bot joined room {room_id}")
            else:
                logging.error("No room_id provided in joined_room data")

            sleep(0.5)
            lines = ["Welcome to the game!",
                "----------------------",
                "You and your partner are each seeing a graph representation of the same house 🏠. The **circles** represent the rooms, and the **lines** represent the hallways between them, containing 🪙 **coins** 🪙 (the numbers on the lines). ",
                "**Task:** *Travel through the rooms in the same order* as your partner, and visit each room *only **once***, while getting *as many total coins as possible*. Use the chat to agree on a path. Please only communicate in English.",
                "**Score:** Your reward will be an *even split of all the coins you and your partner have collected together* on the path you chose, so try to get as many as possible.",
                "**Mechanics:** To select a path, **click** on the room you wish to visit. To go back, click on the room you visited previously. You may revise your path during the round, but your final path must be **identical**. To end the round, either you or your partner should click the blue **SUBMIT** button.",
                "⚠️ **IMPORTANT** ⚠️: DO NOT refresh your browser. Only identical paths can be submitted. You start in the *living room* (L).",
                "Wait for the first episode to start."]

            for line in lines:
            
                self.sio.emit(
                    "text",
                    {
                        "message": WELCOME.format(
                            message=line, color=STANDARD_COLOR
                        ),
                        "room": room_id,
                        "html": True
                    },
                )
 
        @self.sio.event
        def text_message(data):
            if self.user == data["user"]["id"]:
                return
            else:
                room_id = data["room"]

            logging.debug(f"message received")

            this_session = self.session_manager[room_id]

            logging.debug(this_session.path)

        @self.sio.event
        def command(data):
            """Parse user commands."""
            room_id = data["room"]
            user_id = data["user"]["id"]

            # do not process commands from itself
            if user_id == self.user:
                return

            logging.debug(
                f"Received a command from {data['user']['name']}: {data['command']}"
            )

            this_session = self.session_manager[room_id]
            # if (data["command"] isinstance dict):
            if isinstance(data["command"], dict):
                # if the command is a dict (currently: only board_logging)
                if data["command"]["event"] == "save_graph":
                    this_session.graph[user_id] = data["command"]["graph"]
                    logging.debug(f"received graph: {this_session.graph[user_id]}")
                    self.log_event("save_graph", {"graph": this_session.graph[user_id], "user_id": user_id}, room_id)
                    # board = data["command"]["board"]
                    # update latest board for this user
                    # this_session.latest_board[user_id] = board
                    # logging.debug(this_session.latest_board)
                if data["command"]["event"] == "update_path":
                    path = [node["id"] for node in data["command"]["path"]]
                    this_session.path[user_id] = path
                    logging.debug(f"current path of user {user_id} is {this_session.path[user_id]}")
                    self.log_event("update_path", {"path": this_session.path[user_id], "user_id": user_id}, room_id)


            else:
                if data["command"] == "stop":
                    
                    # retreive the currently selected paths of both players. paths is a list of list of nodes.
                    paths = list(this_session.path.values())

                    # Check whether both players have selected some path
                    if len(paths) < 2:
                        self.sio.emit(
                            "text",
                            {
                                "message": WELCOME.format(
                                    message="You must choose a path with your partner first, before submitting! See the Welcome Message on how to do so.", color=STANDARD_COLOR
                                ),
                                "room": room_id,
                                "html": True
                            },
                        )
                        return
                    
                    # Check whether paths are equal
                    if paths[0] != paths[1]:
                        self.sio.emit(
                            "text",
                            {
                                "message": WELCOME.format(
                                    message="Your paths are not the same. Make sure that your paths are equivalent before submitting!", color=STANDARD_COLOR
                                ),
                                "room": room_id,
                                "html": True
                            },
                        )
                        return
                    
                    # Check that the paths visit every node once.
                    if len(paths[0]) != len(list(this_session.graph.values())[0]):
                        self.sio.emit(
                            "text",
                            {
                                "message": WELCOME.format(
                                    message="Your paths are not complete. Make sure to choose every node once.", color=STANDARD_COLOR
                                ),
                                "room": room_id,
                                "html": True
                            },
                        )
                        return
                    
                    percentile_score, gold_path, gold_value, combined_paths_value = self.calculate_score(room_id)

                    #Log Scores
                    log_dict = {
                        "percentile score": percentile_score,
                        "best possible path": gold_path,
                        "value of best possible path": gold_value,
                        "value of combined chosen path": combined_paths_value}
                    
                    self.log_event("submit", log_dict, room_id)

                    score = int((1-percentile_score)*100)
                    message = f"Your score is {score}."
                    if score < 25:
                        message += "That's ok."
                    elif score < 75:
                        message += f"That's a fine result."
                    elif score < 100:
                        message = f"Congrats, you found a joint path with a score of {score}. That's really good!"
                    else:
                        message = f"You found the best path! You scored {score} points."

                    self.sio.emit(
                            "text",
                            {
                                "message": COLOR_MESSAGE.format(
                                    message=message, color=SUCCESS_COLOR
                                ),
                                "room": room_id,
                                "html": True
                            },
                        )

                    # Start next episode
                    self._start_new_episode(room_id)

    def room_to_read_only(self, room_id):
        """Set room to read only."""
        # set room to read-only
        response = requests.patch(
            f"{self.uri}/rooms/{room_id}/attribute/id/text",
            json={"attribute": "readonly", "value": "True"},
            headers={"Authorization": f"Bearer {self.token}"},
        )
        if not response.ok:
            logging.error(f"Could not set room to read_only: {response.status_code}")
            response.raise_for_status()

        response = requests.patch(
            f"{self.uri}/rooms/{room_id}/attribute/id/text",
            json={"attribute": "placeholder", "value": "This room is read-only"},
            headers={"Authorization": f"Bearer {self.token}"},
        )
        if not response.ok:
            logging.error(f"Could not set room to read_only: {response.status_code}")
            response.raise_for_status()

        response = requests.get(
            f"{self.uri}/rooms/{room_id}/users",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        if not response.ok:
            logging.error(f"Could not get user: {response.status_code}")

        users = response.json()
        for user in users:
            if user["id"] != self.user:
                response = requests.get(
                    f"{self.uri}/users/{user['id']}",
                    headers={"Authorization": f"Bearer {self.token}"},
                )
                if not response.ok:
                    logging.error(f"Could not get user: {response.status_code}")
                    response.raise_for_status()
                etag = response.headers["ETag"]

                response = requests.delete(
                    f"{self.uri}/users/{user['id']}/rooms/{room_id}",
                    headers={"If-Match": etag, "Authorization": f"Bearer {self.token}"},
                )
                if not response.ok:
                    logging.error(
                        f"Could not remove user from task room: {response.status_code}"
                    )
                    response.raise_for_status()
                logging.debug("Removing user from task room was successful.")

if __name__ == "__main__":
    # set up loggingging configuration
    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s:%(message)s")

    # create commandline parser
    parser = Sailsman.create_argparser()
    args = parser.parse_args()

    # create bot instance
    bot = Sailsman(args.token, args.user, args.task, args.host, args.port)
    # connect to chat server
    bot.run()
