import os
from urllib import response
from gridappsd import GridAPPSD

os.environ["GRIDAPPSD_USER"] = "system"
os.environ["GRIDAPPSD_PASSWORD"] = "manager"


class GridAPPSDHelper:

    def __init__(self):
        self.START_SIMULATION = "/queue/goss.gridappsd.process.request.simulation"
        self.SIMULATION_STATUS_LOG = "/topic/goss.gridappsd.simulation.log"
        self.SIMULATION_OUTPUT = "/topic/goss.gridappsd.simulation.output.>"
        self.CONTROL_SIMULATION = "/topic/goss.gridappsd.simulation.input"
        self.gapps = None
        self._connect()

    def _connect(self):
        """Initialize connection to GridAPPS-D"""
        try:
            self.gapps = GridAPPSD()

            return True
        except Exception as e:
            self.gapps = None
            return False

    def _reconnect(self):
        """Attempt to reconnect to GridAPPS-D"""
        if self.gapps:
            try:
                self.gapps.disconnect()
            except:
                pass
        return self._connect()

    def is_connected(self):
        """Check if connected to GridAPPS-D"""
        if self.gapps is None:
            return False

        try:
            # Test connection with a simple query
            return self.gapps.connected
        except Exception as e:
            return False

    def get_models(self):
        """Retrieve available power system models"""
        if not self.is_connected():
            raise Exception("Not connected to GridAPPS-D")

        try:
            response = self.gapps.query_model_info()
            return response["data"]
        except Exception as e:
            print(e)

    def disconnect(self):
        """Cleanly disconnect from GridAPPS-D"""
        if self.gapps:
            try:
                self.gapps.disconnect()
            except Exception as e:
                print(e)
            finally:
                self.gapps = None

    def start_simulation(self, sim_config: dict):
        if not self.is_connected():
            raise Exception("Not connected to GridAPPS-D")
        try:
            response = self.gapps.get_response(
                self.START_SIMULATION, sim_config, timeout=30
            )
            self.sim_id = response.get("simulation_id")
            return response
        except Exception as e:
            print(e)

    def pause_simulation(self, sim_id: str):
        if not self.is_connected():
            raise Exception("Not connected to GridAPPS-D")
        try:
            topic = self.CONTROL_SIMULATION + f".{sim_id}"
            response = self.gapps.get_response(topic, {"command": "pause"}, timeout=30)
            return response
        except Exception as e:
            print(e)

    def resume_simulation(self, sim_id: str):
        if not self.is_connected():
            raise Exception("Not connected to GridAPPS-D")
        try:
            topic = self.CONTROL_SIMULATION + f".{sim_id}"
            response = self.gapps.get_response(topic, {"command": "resume"}, timeout=30)
            return response
        except Exception as e:
            print(e)

    def stop_simulation(self, sim_id: str):
        if not self.is_connected():
            raise Exception("Not connected to GridAPPS-D")
        try:
            topic = self.CONTROL_SIMULATION + f".{self.sim_id}"
            self.gapps.send(topic, {"command": "stop"})
            self.sim_id = None
        except Exception as e:
            print(e)

    def subscribe_to_simulation_output(self, callback):
        if not self.is_connected():
            raise Exception("Not connected to GridAPPS-D")
        try:
            topic = self.SIMULATION_OUTPUT + f".{self.sim_id}"
            self.gapps.subscribe(topic, callback=callback)
        except Exception as e:
            print(e)
