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
        self.timer: RoomTimer = None
        self.halfway_timer: RoomTimer = None
        self.one_minute_timer: RoomTimer = None
        self.graph = {}
        self.path = {}
        self.counter = 1  # number of rounds to play; the actual number is n+1
        self.submissions = set()
        self.scores = []

    def close(self):
        if self.timer:
            self.timer.cancel()
        else:
            logging.debug("Tried to cancel timer, but this Session had no timer")
        if self.halfway_timer:
            self.timer.cancel()
        else:
            logging.debug("Tried to cancel halfway_timer, but this Session had no halfway_timer")
        if self.one_minute_timer:
            self.timer.cancel()
        else:
            logging.debug("Tried to cancel one_minute_timer, but this Session had no one_minute_timer")
        # self.halfway_timer.cancel()
        # self.one_minute_timer.cancel()


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

    def on_task_room_creation(self, data): # NOTE: this function does not work?
        room_id = data["room"]

        # automatically creates a room if it does not exists (defaultdict)
        this_session = self.session_manager[room_id]
        this_session.timer = RoomTimer(
            self.close_room_timeout, room_id, TIMEOUT_TIMER
        )
        this_session.halfway_timer = RoomTimer(
            self.warning_timer_half, room_id, TIMEOUT_TIMER//2
        )

        this_session.one_minute_timer = RoomTimer(
            self.warning_timer_one_min, room_id, TIMEOUT_TIMER-1
        )

        # add users to this session
        for usr in data["users"]:
            this_session.players.append(usr)

            # map a dictionary user_id: last board
            this_session.latest_board[usr["id"]] = None

        # manually adding the LLM bot
        LLM_bot_user = {'id':000, 'name':"BOT"}
        this_session.players.append(LLM_bot_user)

        # [{'name': 'pillow', 'x': 642, 'y': 548}, {'name': 'garbage', 'x': 418, 'y': 281}, {'name': 'cap', 'x': 667, 'y': 502}, {'name': 'cowboy', 'x': 657, 'y': 518}, {'name': 'pants', 'x': 368, 'y': 618}]

        logging.debug(f"USERS: {this_session.players}, usr: {usr}")

        self.move_divider(room_id, chat_area=25, task_area=75) # resize chat area

    def warning_timer_half(self, room_id):

        # message - There are 6 minutes left of this round.
        self.sio.emit(
            "text",
            {
                "message": COLOR_MESSAGE.format(
            color=WARNING_COLOR,
            message=f"Halfway done. There are {TIMEOUT_TIMER//2} minutes left.",
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

    def close_room(self, room_id):
        self.room_to_read_only(room_id)

        # delete data structures
        self.session_manager.clear_session(room_id)

    def close_room_timeout(self, room_id):
        
        # the messages including the unique ID to be copied to the survey
        self.sio.emit(
            "text",
            {
                "message": COLOR_MESSAGE.format(
            color=WARNING_COLOR,
            message="You took too long and were disconnected. Please paste the following code into Prolific: C10AVA0Z",
            ),
                "room": room_id,
                "html": True
            },
        )
        self.room_to_read_only(room_id)

        # delete data structures
        self.session_manager.clear_session(room_id)

    def calculate_score(self, room_id):

        ''' Calculates the score of the combined paths of both players. Paths must be identical!
        
        Parameters:
            room_id(int): the room for which to calculate the score.
        
        Return:
            score(int): The percentile of the combined sum of weights with respect to all possible paths. 1 is the 100 percentile, the best possible path.
        
        '''
        def calculate_tsp_score(graph, path):
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
            costs_indexed = [(i, costs[i]) for i in range(len(costs))]
            costs_indexed.sort(key=lambda x: x[1])
            costs.sort()
            index = bisect_left(costs, path_cost)
            percentile = index / (len(costs) - 1)
            best_path = perms[costs_indexed[0][0]]
            # print(f"cost: {path_cost}")
            # print(f"best path cost: {costs[0]}")
            # print(f"index: {index}")
            # print(f"overall paths: {len(costs)}")
            
            return percentile, best_path, costs[0], path_cost
        
        session = self.session_manager[room_id]
        user_ids = list(session.graph.keys())

        assert(session.path[user_ids[0]] == session.path[user_ids[1]])

        combined_graph = session.graph[user_ids[0]]
        for i, nodes in enumerate(self.session_manager[room_id].graph[user_ids[1]]):
            combined_graph[i] = [nodes[x] + combined_graph[i][x] for x in range(len(nodes))]
        path = session.path[user_ids[0]] #Take either of the two paths as they are identical
        path = path + [path[0]] #add start-node as end-node as well
        score, gold_path, gold_cost, path_cost = calculate_tsp_score(combined_graph, path)
        logging.debug(f"Best Path was: {gold_path}")
        logging.debug(f"lowest weights was: {gold_cost}")
        logging.debug(f"Chosen path was: {path_cost}")
            

        return score

    def confirmation_code(self, room_id, bonus, receiver_id=None):
        """ Generate token that will be sent to each player. """
        kwargs = {}
        # either only for one user or for both
        if receiver_id is not None:
            kwargs["receiver_id"] = receiver_id

#        confirmation_token = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))

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

            # user_id = data["user"]["id"]
            # other_user = [usr for usr in self.users_global if usr != user_id]

            # read out task greeting
            lines = ["*Welcome to the Sailsman game!*",
                     "--------------------------------",
                     """You and your partner are each seeing a graph. They are exactly the same, except for the different values on each edge (line) between nodes (circles). These values represent the time it takes to walk along each edge.""",
                     """**Your Goal** is to work together to choose the same path that visits every node exactly once and minimizes the total time (the sum of both your paths). You can talk to your partner using the chat — please use English only.""",
                     """**You Choose a Path** by clicking on a node to move there. To go back, click on a node you’ve already visited. You start at node 1. To **Finish the Game**, either of you can click the submit button once both paths are identical and complete.""",
                     "*NOTE*: before you start, make sure to **resize your chat** so that the entire graph on the right is visible.",
                     """*NOTE*: You can only submit if both paths are the same and both players have visited every node. If this is not the case, you will get a message, telling you what's missing.""",
                     "--------------------------------"]

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

            # logging.debug(f'THIS SESSION:\t{this_session}')
            self.log_event("board_logging", {"board": this_session.path}, room_id) # log the bot's changes to log files

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
                    # retrieve latest board and calculate score
                    # board1, board2 = list(this_session.latest_board.values())
                    paths = list(this_session.path.values())
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
                    
                    score = self.calculate_score(room_id)
                    self.log_event("score", {"score": score}, room_id)
                    # # log extra event (score event)
                    # self.log_event("score", {"score": score}, room_id)
                    # self.log_event("board_logging", {"board": this_session.latest_board}, room_id)

                    # this_session.timer.reset(TIMEOUT_TIMER)
                    # this_session.halfway_timer.reset(TIMEOUT_TIMER/2)
                    # this_session.one_minute_timer.reset(TIMEOUT_TIMER-1)

                    # this_session.scores += [score] # add the score to the list of scores

                    # this_session.submissions = set() # empty the list of who submitted (for next round)
                    self.sio.emit(
                            "text",
                            {
                                "message": WELCOME.format(
                                    message=f"Congrats, you completed the game! You found a joined path that is under the best {score*100}%.", color=STANDARD_COLOR
                                ),
                                "room": room_id,
                                "html": True
                            },
                        )
                    for usr in this_session.players:
                        self.confirmation_code(room_id=room_id, bonus=5, receiver_id=usr["id"])

                    self.close_room(room_id)
                    # if this_session.counter == 0: # if this is the last round
                        
                    #     # Inform users the experiment is over and give them the last score
                    #     msg = f"Your score is {score}. Thank you for playing! Please wait for your unique ID token."
                    #     self.sio.emit(
                    #         "text",
                    #         {
                    #             "message": COLOR_MESSAGE.format(message=msg, color=SUCCESS_COLOR),
                    #             "room": room_id,
                    #             "html": True,
                    #         },
                    #     )

                    #     bonus = any(el >= 99 for el in this_session.scores)

                        # Generating and showing the AMT token

                    # else: # if there's more rounds to play
                    #     this_session.counter -= 1
                    #     msg = f"Your score is {-1}. The round is over. Please wait for the next round to start."

                    #     self.sio.emit(
                    #         "text",
                    #         {
                    #             "message": COLOR_MESSAGE.format(message=msg, color=SUCCESS_COLOR),
                    #             "room": room_id,
                    #             "html": True,
                    #         },
                    #     )

                    #     sleep(0.5)

                    #     # run the new_episode command from the js pluging (placement.js); for resetting the front-end
                    #     self.sio.emit(
                    #         "message_command",
                    #         {
                    #             "command": {
                    #                 "event": "new_episode"
                    #             },
                    #             "room": room_id,
                    #         },
                    #     )

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