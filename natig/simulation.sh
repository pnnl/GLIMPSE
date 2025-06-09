#!/bin/bash

# nohup python testsocket.py update_workstation.sh > /dev/null 2>&1 &
bash run_outside_docker.sh $1
bash quiteDocker.sh $1
