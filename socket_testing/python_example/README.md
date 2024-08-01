# Usage
**Only dependancy needed**
```
pip install python-socketio
```

The testsocket.py python script contains example code on how to connect to the local web socket server
and how to send data to the "glimpse" event.

## To test using the test_update_data.json file simply:

```
cd socket_testing/

python testsocket.py test_update_data.json 
```

**The `test_update_data.json` file contains the structure that GLIMPSE is reading for when updating the visualization**