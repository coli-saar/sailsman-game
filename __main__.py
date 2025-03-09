from itertools import permutations
from bisect import bisect_left, bisect_right
from collections import defaultdict
import logging

import math
import random
from threading import Timer

import requests

from templates import TaskBot
from time import sleep
import threading


from .config import *

class TutorialTracker:
    def __init__(self):
        self._update_path_message_sent = defaultdict(lambda: False)
        self._start_tutorial_message_sent = False
        self._submittable_message_sent = False
        self._perfect_submission_message_sent = False
        self._deviated_finished_paths_message_sent = False
        self._deviated_path_message_sent = defaultdict(lambda: False)
        self._showed_tutorial_recap = False

    def sent_update_path_message(self, user_id):
        if self._update_path_message_sent[user_id]:
            return True
        self._update_path_message_sent[user_id] = True
        return False
    
    def start_tutorial_message_sent(self):
        if self._start_tutorial_message_sent:
            return True
        self._start_tutorial_message_sent = True
        return False
    
    def submittable_message_sent(self):
        if self._submittable_message_sent:
            return True
        self._submittable_message_sent = True
        return False
    
    def perfect_submission_message_sent(self):
        if self._perfect_submission_message_sent:
            return True
        self._perfect_submission_message_sent = True
        return False
    
    def showed_tutorial_recap(self):
        if self._showed_tutorial_recap:
            return True
        self._showed_tutorial_recap = True
        return False
    
    def deviated_finished_paths_message_sent(self):
        if self._deviated_finished_paths_message_sent:
            return True
        self._deviated_finished_paths_message_sent = True
        return False
        
    def deviated_path_message_sent(self, user_id):
        if self._deviated_path_message_sent[user_id]:
            return True
        self._deviated_path_message_sent[user_id] = True
        return False

    

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
        self.halfway_timer: RoomTimer = None
        self.one_minute_timer: RoomTimer = None
        self.graph = {}
        self.path = {}
        self.graph_created = defaultdict(lambda: False)

        self._node_str = {
            0: "living room",
            1: "kitchen",
            2: "garden",
            3: "play room",
            4: "attic",
        }

        self.tutorial_tracker = TutorialTracker()

        self.user_ids = set()

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
        self.graph_created = defaultdict(lambda: False)

    def get_node_str(self, node_id):
        return self._node_str[node_id]
    
    def other_user(self, user_id):
        return list(self.user_ids - {user_id})[0]
    
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


    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.episode_started_event = threading.Event()  # Create an event to signal episode start
        self.session_manager = SessionManager(Session)
        self.data_collection = "AMT"
        self.started = False

    def on_task_room_creation(self, data): # function doesn't get called in --dev mode
        room_id = data["room"]
        logging.debug(f"Room {room_id} was created")

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
    
    def create_graph_data(self, room_id, user_id):
        this_session = self.session_manager[room_id]
        if this_session.graph_created[user_id]:
            return
        num_nodes = this_session.graph_size
        max_weight = this_session.max_weight
        min_weight = 1


        # Calculate the total weight that should be distributed across the graph edges.
        # This is based on the average of max and min weights and the number of edges in a complete graph.
        total_weight = (max_weight + min_weight) * (num_nodes * (num_nodes - 1) // 2) // 2
        
        graph = [[0 for _ in range(num_nodes)] for _ in range(num_nodes)]
        remaining_edges = num_nodes * (num_nodes - 1) // 2
        current_weight_sum = 0

        for i in range(num_nodes):
            for j in range(i + 1, num_nodes):
                # Calculate the target mean weight for the remaining edges.
                target_mean = min(max_weight, max(min_weight, (total_weight - current_weight_sum) // remaining_edges))
                
                # Deviation from the target mean can be at most the smaller difference from the mean to min or max weight.
                std = min(max_weight - target_mean, target_mean - min_weight)
                
                # Calculate the minimum possible weight for the current edge.
                # Ensure that the remaining weight can add up to total_weight.
                current_min_weight = target_mean - math.ceil(std * ((remaining_edges - 1) / (num_nodes * (num_nodes - 1) // 2)))
                
                # Calculate the maximum possible weight for the current edge.
                # It adjusts the target mean by a factor based on the remaining edges.
                current_max_weight = target_mean + math.ceil(std * ((remaining_edges - 1) / (num_nodes * (num_nodes - 1) // 2)))
                
                w = random.randint(current_min_weight, current_max_weight)
                
                current_weight_sum += w
                
                remaining_edges -= 1
                
                graph[i][j] = w
                graph[j][i] = w
        this_session.graph[user_id] = graph
        this_session.graph_created[user_id] = True
        


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
            index = bisect_right(costs, path_cost)
            percentile = (len(costs) - index) / (len(costs) - 1)
            best_path = (0,) + perms[costs_indexed[-1][0]] + (0,) # get the index of the lowest cost and take its permutation. Add start and end node.
            
            return percentile, best_path, costs[-1], path_cost
        
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
        print("Starting new episode")
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
            
            if not current_session.tutorial_tracker.start_tutorial_message_sent():
                self.sio.emit(
                    "text",
                    {
                        "message": WELCOME.format(message="This is a tutorial episode, which will help you understand the mechanics of the game. You will get some additional information.", color=SUCCESS_COLOR),
                        "room": room_id,
                        "html": True
                    }
                )

            self.sio.emit(
                "message_command",
                {
                    "command": {"event": "new_episode"},
                    "room": room_id,
                }
            )
        else:
            self.send_prolific_code(room_id)

            self.close_room(room_id)
        logging.debug(f"user variable: {self.user}")
        self.started = True
        self.episode_started_event.set()  # Signal that the episode has started

    def _start_game(self, room_id):
        """Start the game for the given room. Only used in --dev mode."""
        if self.started:
            return
        
        self._start_new_episode(room_id)

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
                "You and your partner are each seeing a graph representation of the same house 🏠 with the same rooms that you can see to the right. All rooms are connected by **lines** which represent the hallways between them. While the house is the same, the amount of🪙 **coins** 🪙 in each hallway are different for you and your partner.",
                "**Task:** *Travel through the rooms in the same order* as your partner, and visit each room *only **once***, while getting *as many total coins as possible*. Use the chat to agree on a path. Please only communicate in English.",
                "**Score:** Your reward will be the *sum of all the coins you and your partner have collected together* on the path you chose, so try to get as many as possible.",
                "**Mechanics:** To select a path, **click** on the room you wish to visit. To go back, click on the room you visited previously. You may revise your path during the round, but your final path must be **identical**. To end the round, either you or your partner should click the blue **SUBMIT** button.",
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

            # Deprecated: do not process commands from itself 
            # THIS NEVER HAPPENS!
            # Between two human players, self.user is always identical, with a value lower than both user_ids.
            # Always use the user_id to manage commands
            if user_id == self.user:
                return

            logging.debug(
                f"Received a command from {data['user']['name']}: {data['command']}"
            )

            this_session = self.session_manager[room_id]

            if isinstance(data["command"], dict):
                if data["command"]["event"] == "save_graph":
                    this_session.graph[user_id] = data["command"]["graph"]
                    logging.debug(f"received graph: {this_session.graph[user_id]}")
                    self.log_event("save_graph", {"graph": this_session.graph[user_id], "user_id": user_id}, room_id)

                if data["command"]["event"] == "update_path":
                    path = [node["id"] for node in data["command"]["path"]]
                    try:
                        path_length_change = len(path) - len(this_session.path[user_id])
                    except:
                        path_length_change = 0
                    this_session.path[user_id] = path

                    if len(this_session.user_ids) == 2 and len(path) > 1: # For dev mode only. Otherwise, user ids should already be set by the document_ready event.
                        if not this_session.tutorial_tracker.sent_update_path_message(user_id):
                            start_node = this_session.path[user_id][-2]
                            end_node = this_session.path[user_id][-1]
                            start_node_str = this_session.get_node_str(start_node)
                            end_node_str = this_session.get_node_str(end_node)
                            coins_collected = this_session.graph[user_id][start_node][end_node]
                            other_user_coins = this_session.graph[this_session.other_user(user_id)][start_node][end_node]

                            other_user_id = this_session.other_user(user_id)
                            self.sio.emit(
                                "text",
                                {
                                    "message": WELCOME.format(
                                        message=f"Your partner has updated their path and went from the {start_node_str} to the {end_node_str}. They collected {coins_collected} coins. Together you get {coins_collected + other_user_coins} coins on that path.", color=SUCCESS_COLOR
                                    ),
                                    "room": room_id,
                                    "receiver_id": other_user_id,
                                    "html": True
                                },
                            )

                        paths = list(this_session.path.values())
                        logging.debug(f"paths: {paths}")
                        if len(paths[0]) == this_session.graph_size + 1 and len(paths[1]) == this_session.graph_size + 1:
                            if paths[0] == paths[1]:
                                if not this_session.tutorial_tracker.submittable_message_sent():
                                    self.sio.emit(
                                        "text",
                                        {
                                            "message": WELCOME.format(message="You both completed your paths and they are identical! You can now submit your path.", color=SUCCESS_COLOR),
                                            "room": room_id,
                                            "html": True
                                        },
                                    )
                            else:
                                if not this_session.tutorial_tracker.deviated_finished_paths_message_sent():
                                    self.sio.emit(
                                        "text",
                                        {
                                            "message": WELCOME.format(message="You both completed a path, but they are not identical. Make sure that you chose the same path before submitting.", color=SUCCESS_COLOR),
                                            "room": room_id,
                                            "html": True
                                        },
                                    )

                        longest_shared_prefix_length = 0
                        for i in range(min(len(paths[0]), len(paths[1]))):
                            if paths[0][i] == paths[1][i]:
                                longest_shared_prefix_length += 1
                            else:
                                break

                        user_path_diff = len(this_session.path[user_id]) - longest_shared_prefix_length
                        other_user_path_diff = len(this_session.path[this_session.other_user(user_id)]) - longest_shared_prefix_length

                        if user_path_diff == 1 and other_user_path_diff > 0 and path_length_change == 1:
                            if not this_session.tutorial_tracker.deviated_path_message_sent(user_id):
                                self.sio.emit(
                                    "text",
                                    {
                                        "message": WELCOME.format(message="Your path deviated from your partner's path. Make sure to choose the same path.", color=SUCCESS_COLOR),
                                        "room": room_id,
                                        "html": True,
                                        "receiver_id": user_id
                                    },
                                )

                    logging.debug(f"current path of user {user_id} is {this_session.path[user_id]}")
                    self.log_event("update_path", {"path": this_session.path[user_id], "user_id": user_id}, room_id)
                
                if data["command"]["event"] == "document_ready":
                    this_session.user_ids.add(user_id)

                    if not self.started:
                        # wait until episode has started
                        self.episode_started_event.wait()
                    
                    self.create_graph_data(room_id, user_id)
                    logging.debug(f"Sending draw graph to user {user_id}")
                    logging.debug(f"Current self.user: {self.user}")
                    self.sio.emit(
                        "message_command",
                        {
                            "command": {
                                "event": "draw_graph",
                                "graph": this_session.graph[user_id],
                                "size": this_session.graph_size,
                                "max_weight": this_session.max_weight,
                                "min_weight": 1,
                                "user_id": user_id
                            },
                            "room": room_id,
                        }
                    )
                if data["command"]["event"] == "start_game":
                    self._start_game(room_id)


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
                    if len(paths[0]) != this_session.graph_size + 1:
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

                    if not this_session.tutorial_tracker.perfect_submission_message_sent():
                        if percentile_score != 100:
                            self.sio.emit(
                                "text",
                                {
                                    "message": WELCOME.format(message="Your path is not the best possible. Try to get a better one!", color=SUCCESS_COLOR),
                                    "room": room_id,
                                    "html": True
                                },
                            )
                        return
                    
                    if not this_session.tutorial_tracker.showed_tutorial_recap():
                        self.sio.emit(
                            "message_command",
                            {
                                "command": {"event": "show_end_tutorial_screen", "coins_collected": combined_paths_value, "gold_coins_collected": gold_value},
                                "room": room_id,
                            }
                        )
                        return


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

    def reset_event(self):
        self.episode_started_event.clear()  # Reset the event if needed for the next episode

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
