#!/bin/bash

# Step 1: Change directory to local-server
cd "$(dirname "$0")/local-server" || exit 1

# Step 2: Create a Python virtual environment
python3 -m venv env

# Step 3: Activate the virtual environment
source ./env/bin/activate

# Step 4: Install requirements via pip
pip install -r requirements.txt

# Step 5: Run pyinstaller with server.spec
pyinstaller server.spec

# Step 6: Move output server/ file out of the dist folder
# (Assuming the output is a folder named 'server' inside 'dist')
mv ./dist/server ./

# Step 7: Delete the dist/ and build/ folders created by pyinstaller
rm -rf ./dist ./build

# deactivate environment
deactivate

# remove environment folder
rm -rf ./env
