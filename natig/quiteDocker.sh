#!/bin/bash

echo "WARNING: If you use this script make sure to hardcode the port of helics in run.sh to the same value as the one set by brokerport in gridlabd_config.json"

docker exec -i $1 /bin/sh -c "cd /rd2c/integration/control;bash killall.sh "
