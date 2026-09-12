import logging
import os
import socket
import time
from collections import OrderedDict
from collections.abc import Callable
from enum import Enum

from gridappsd import GridAPPSD, topics

os.environ.setdefault("GRIDAPPSD_ADDRESS", "localhost")
os.environ.setdefault("GRIDAPPSD_PORT", "61613")
os.environ.setdefault("GRIDAPPSD_USER", "system")
os.environ.setdefault("GRIDAPPSD_PASSWORD", "manager")

logger = logging.getLogger(__name__)

PLATFORM_PROBE_TTL = 10.0

class SimulationState(Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    ERROR = "error"

class GridAPPSDError(Exception):
    """Custom exception for GridAPPS-D operations"""

    pass

class GridAPPSDHelper:

    def __init__(self):
        self.gapps: GridAPPSD | None = None
        self.sim_id: str | None = None
        self.sim_state: SimulationState = SimulationState.IDLE
        self.current_limit_map = {}
        # Keyed by a model id the client supplies, so it is bounded and evicts
        # oldest-first: nothing else prunes it and the desktop server is a
        # long-lived process.
        self.agent_roster_cache = OrderedDict()
        self._available: bool = False
        self._topology_service_down: bool = False
        self._platform_ready: bool | None = None
        self._platform_checked_at: float = 0.0
        self._try_initial_connect()

    @staticmethod
    def _is_port_open(host=None, port=None, timeout=2) -> bool:
        host = host or os.environ.get("GRIDAPPSD_ADDRESS", "localhost")
        port = int(port or os.environ.get("GRIDAPPSD_PORT", 61613))
        try:
            with socket.create_connection((host, port), timeout=timeout):
                return True
        except (ConnectionRefusedError, TimeoutError, OSError):
            return False

    def _try_initial_connect(self):
        if not self._is_port_open():
            logger.warning("GridAPPS-D port 61613 is not open — skipping connection. Features disabled.")
            print("port not available")
            self.gapps = None
            self._available = False
            return

        try:
            self.gapps = GridAPPSD()
            self._available = self.is_connected()
            if self._available:
                logger.info("Connected to GridAPPS-D")
            else:
                logger.warning("GridAPPS-D client built but no session established — features disabled.")
                self.gapps = None
        except Exception as e:
            logger.warning(f"GridAPPS-D is not reachable — features disabled. ({e})")
            self.gapps = None
            self._available = False

    def try_connect(self) -> bool:
        self.disconnect()

        if not self._is_port_open():
            logger.warning("GridAPPS-D port still not open.")
            self._available = False
            return False

        try:
            self.gapps = GridAPPSD()
            self._available = self.is_connected()
            if not self._available:
                logger.warning("GridAPPS-D client built but no session established.")
                self.gapps = None
                return False
            self._topology_service_down = False  # give the topology service another chance
            logger.info("Reconnected to GridAPPS-D")
            return True
        except Exception as e:
            logger.warning(f"Reconnection failed: {e}")
            self.gapps = None
            self._available = False
            return False

    def _ensure_connected(self):
        if not self._available:
            raise GridAPPSDError("GridAPPS-D is not available. Call try_connect() or restart with GridAPPS-D running.")

        if not self.is_connected():
            self._available = False
            self.gapps = None
            raise GridAPPSDError("Lost connection to GridAPPS-D. Call try_connect() to re-establish.")

    def is_connected(self) -> bool:
        """Check if connected to GridAPPS-D"""
        if self.gapps is None:
            return False
        try:
            return self.gapps.connected
        except Exception:
            return False

    def is_available(self) -> bool:
        return self._available and self.is_connected()

    def is_platform_ready(self, force: bool = False) -> bool:
        if not self.is_connected():
            self._platform_ready = None
            return False

        now = time.monotonic()
        if (
            not force
            and self._platform_ready is not None
            and now - self._platform_checked_at < PLATFORM_PROBE_TTL
        ):
            return self._platform_ready

        ready = False
        try:
            response = self.gapps.query_model_names()
            ready = isinstance(response, dict) and "error" not in response
            if not ready:
                logger.warning(
                    f"GridAPPS-D broker is reachable but the platform is not serving queries: {response}"
                )
        except Exception as e:
            logger.warning(f"GridAPPS-D platform probe failed: {e}")

        self._platform_ready = ready
        self._platform_checked_at = now
        return ready

    def disconnect(self):
        """Cleanly disconnect from GridAPPS-D"""
        if self.gapps:
            try:
                self.gapps.disconnect()
            except Exception as e:
                logger.warning(f"Error during disconnect: {e}")
            finally:
                self.gapps = None
                self.sim_id = None
                self.sim_state = SimulationState.IDLE
                self._platform_ready = None

    # ─── Model Queries ────────────────────────────────────────────────

    def get_models(self) -> list:
        """Retrieve available power system models"""
        self._ensure_connected()
        try:
            response = self.gapps.query_model_info()
            return response.get("data", [])
        except Exception as e:
            logger.error(f"Failed to retrieve models: {e}")
            raise GridAPPSDError(f"Failed to retrieve models: {e}") from e

    def get_distributed_areas(self, model_mrid: str, timeout: int | None = None) -> dict | None:
        if self._topology_service_down:
            logger.info(
                f"Skipping topology request for {model_mrid}: service marked "
                "unavailable earlier this session (reconnect to retry)."
            )
            return None

        if timeout is None:
            timeout = int(os.environ.get("GLIMPSE_TOPOLOGY_TIMEOUT", "30"))

        self._ensure_connected()
        topic = "goss.gridappsd.request.data.cimtopology"
        message = {
            "requestType": "GET_DISTRIBUTED_AREAS",
            "mRID": model_mrid,
            "resultFormat": "JSON",
        }
        try:
            response = self.gapps.get_response(topic, message, timeout=timeout)
        except Exception as e:
            self._topology_service_down = True
            logger.warning(
                f"Topology service request failed for {model_mrid} ({e}). "
                "Marking the service unavailable for this session; distribution "
                "areas will be derived from the CIM model instead."
            )
            return None

        if not response or "error" in response:
            logger.warning(f"No topology returned for {model_mrid}: {response}")
            return None

        # Some GridAPPS-D services wrap the payload under a "data" key.
        if "DistributionArea" not in response and isinstance(response.get("data"), dict):
            return response["data"]
        return response

    # ─── Simulation Lifecycle ─────────────────────────────────────────

    def start_simulation(self, sim_config: dict) -> dict:
        """Start a simulation and store the simulation ID."""
        self._ensure_connected()
        try:
            response = self.gapps.get_response(
                topics.REQUEST_SIMULATION, sim_config, timeout=30
            )

            if response is None:
                raise GridAPPSDError("No response received from GridAPPS-D")

            if "error" in response:
                raise GridAPPSDError(f"Simulation start error: {response['error']}")

            self.sim_id = response.get("simulation_id") or response.get("simulationId")

            if not self.sim_id:
                raise GridAPPSDError(f"No simulation ID in response: {response}")

            # get current limits for each model object
            for ps_conf in sim_config["power_system_configs"]:
                message = {
                    "configurationType": 'GridLAB-D Limits',
                    "parameters": {
                        "simulation_id": self.sim_id,
                        "model_id": ps_conf["Line_name"]
                    }
                }

                res = self.gapps.get_response(topics.CONFIG, message, timeout=30)
                for current in res["data"]["limits"]["currents"]:
                    self.current_limit_map[current["id"]] = current

            self.sim_state = SimulationState.RUNNING
            logger.info(f"Simulation started: {self.sim_id}")
            return {"simulation_id": self.sim_id, "state": self.sim_state.value}

        except GridAPPSDError:
            self.sim_state = SimulationState.ERROR
            raise
        except Exception as e:
            self.sim_state = SimulationState.ERROR
            raise GridAPPSDError(f"Failed to start simulation: {e}") from e

    def _send_sim_command(self, command: str, sim_id: str | None = None) -> dict:
        """Send a command to the simulation (internal helper)."""
        self._ensure_connected()
        target_id = sim_id or self.sim_id

        if not target_id:
            raise GridAPPSDError(
                "No simulation ID available. Start a simulation first."
            )

        topic = topics.simulation_input_topic(target_id)

        try:
            response = self.gapps.get_response(topic, {"command": command}, timeout=30)
            return response or {}
        except Exception as e:
            raise GridAPPSDError(f"Failed to send '{command}' command: {e}") from e

    def pause_simulation(self, sim_id: str | None = None) -> dict:
        """Pause the current or specified simulation."""
        result = self._send_sim_command("pause", sim_id)
        self.sim_state = SimulationState.PAUSED
        logger.info(f"Simulation paused: {sim_id or self.sim_id}")
        return {"state": self.sim_state.value, **result}

    def resume_simulation(self, sim_id: str | None = None) -> dict:
        """Resume the current or specified simulation."""
        result = self._send_sim_command("resume", sim_id)
        self.sim_state = SimulationState.RUNNING
        logger.info(f"Simulation resumed: {sim_id or self.sim_id}")
        return {"state": self.sim_state.value, **result}

    def stop_simulation(self, sim_id: str | None = None) -> dict:
        """Stop the current or specified simulation."""
        self._ensure_connected()
        target_id = sim_id or self.sim_id

        if not target_id:
            raise GridAPPSDError("No simulation ID available.")

        topic = topics.simulation_input_topic(target_id)

        try:
            self.gapps.send(topic, {"command": "stop"})
            self.sim_state = SimulationState.STOPPED
            logger.info(f"Simulation stopped: {target_id}")

            # Cleanup if stopping the tracked simulation
            if target_id == self.sim_id:
                self.sim_id = None

            return {"state": self.sim_state.value}
        except Exception as e:
            self.sim_state = SimulationState.ERROR
            raise GridAPPSDError(f"Failed to stop simulation: {e}") from e

    def send_simulation_input(self, input_data: dict, sim_id: str | None = None) -> None:
        """Send input data to the simulation."""
        self._ensure_connected()
        target_id = sim_id or self.sim_id

        if not target_id:
            raise GridAPPSDError("No simulation ID available. Start a simulation first.")

        topic = topics.simulation_input_topic(target_id)

        try:
            self.gapps.send(topic, input_data)
            logger.debug(f"Sent input to simulation {target_id}: {input_data}")
        except Exception as e:
            raise GridAPPSDError(f"Failed to send input: {e}") from e

    # ─── Simulation Output Subscription ───────────────────────────────

    def subscribe_to_simulation_output(self, callback: Callable, sim_id: str | None = None):
        """Subscribe to simulation output. Callback receives (headers, message)."""
        self._ensure_connected()
        target_id = sim_id or self.sim_id

        if not target_id:
            raise GridAPPSDError("No simulation ID available. Start a simulation first.")

        topic = topics.simulation_output_topic(target_id)
        logger.info(f"Subscribing to simulation output on: {topic}")

        try:
            self.gapps.subscribe(topic, callback=callback)
        except Exception as e:
            raise GridAPPSDError(
                f"Failed to subscribe to simulation output: {e}"
            ) from e

    def subscribe_to_simulation_log(self, callback: Callable, sim_id: str | None = None):
        """Subscribe to simulation log messages."""
        self._ensure_connected()
        target_id = sim_id or self.sim_id

        if not target_id:
            raise GridAPPSDError("No simulation ID available.")

        topic = topics.simulation_log_topic(target_id)
        logger.info(f"Subscribing to simulation log on: {topic}")

        try:
            self.gapps.subscribe(topic, callback=callback)
        except Exception as e:
            raise GridAPPSDError(f"Failed to subscribe to simulation log: {e}") from e

    # ─── Status ───────────────────────────────────────────────────────

    def get_status(self) -> dict:
        """Return a full status snapshot."""
        return {
            "connected": self.is_connected(),
            "simulation_id": self.sim_id,
            "simulation_state": self.sim_state.value,
        }
