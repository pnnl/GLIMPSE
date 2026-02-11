import logging
import os
from gridappsd import GridAPPSD

os.environ["GRIDAPPSD_USER"] = "system"
os.environ["GRIDAPPSD_PASSWORD"] = "manager"

USERNAME = os.getenv("GRIDAPPSD_USER")
PASSWORD = os.getenv("GRIDAPPSD_PASSWORD")

_log = logging.getLogger(__name__)

class GridAPPSDHelper:
   TOPICS = {
      "START_SIMULATION": "/queue/goss.gridappsd.process.request.simulation",
      "SIMULATION_STATUS_LOG": "/topic/goss.gridappsd.simulation.log",
      "SIMULATION_OUTPUT": "/topic/goss.gridappsd.simulation.output.>",
      "CONTROL_SIMULATION": "/topic/goss.gridappsd.simulation.input"
   }
   
   def __init__(self):
      self.gapps = None
      self._connect()
   
   def _connect(self):
      """Initialize connection to GridAPPS-D"""
      try:
         self.gapps = GridAPPSD(
            username=USERNAME,
            password=PASSWORD,
         )

         _log.info("Successfully connected to GridAPPS-D")
         return True
      except Exception as e:
         _log.error(f"Failed to connect to GridAPPS-D: {str(e)}")
         self.gapps = None
         return False
   
   def _reconnect(self):
      """Attempt to reconnect to GridAPPS-D"""
      _log.info("Attempting to reconnect to GridAPPS-D...")
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
         _log.warning(f"Connection check failed: {str(e)}")
         return False
   
   def get_models(self):
      """Retrieve available power system models"""
      if not self.is_connected():
         raise Exception("Not connected to GridAPPS-D")
      
      try:
         response = self.gapps.query_model_info()
         return response["data"]
      except Exception as e:
         _log.error(f"Error retrieving models: {str(e)}")
         raise
   
   def disconnect(self):
      """Cleanly disconnect from GridAPPS-D"""
      if self.gapps:
         try:
            self.gapps.disconnect()
            _log.info("Disconnected from GridAPPS-D")
         except Exception as e:
            _log.error(f"Error during disconnect: {str(e)}")
         finally:
               self.gapps = None
   
   def get_model(self, uuid):
      model = self.gapps.query_model(model_id=uuid)
      return model