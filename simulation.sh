#!/bin/bash.exe

nohup python testsocket.py > /dev/null 2>&1 &
bash run_outside_docker.sh $1
bash quiteDocker.sh $1
