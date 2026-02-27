import logging
import os
from gridappsd import GridAPPSD

os.environ["GRIDAPPSD_USER"] = "system"
os.environ["GRIDAPPSD_PASSWORD"] = "manager"


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
         raise
   
   def disconnect(self):
      """Cleanly disconnect from GridAPPS-D"""
      if self.gapps:
         try:
            self.gapps.disconnect()
         except Exception as e:
            print(e)
         finally:
            self.gapps = None