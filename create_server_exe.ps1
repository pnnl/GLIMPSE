# Step 1: Change directory to local-server
Set-Location -Path ".\local-server"

# Step 2: Create a Python virtual environment
python -m venv env

# Step 3: Activate the virtual environment
# For Windows PowerShell
. .\env\Scripts\Activate.ps1

# Step 4: Install requirements via pip
pip install -r requirements.txt

# Step 5: Run pyinstaller with server.spec
pyinstaller server.spec

# Step 6: Move output server/ file out of the dist folder
# (Assuming the output is a folder named 'server' inside 'dist')
Move-Item -Path ".\dist\server" -Destination "." -Force

# Step 7: Delete the dist/ and build/ folders created by pyinstaller
Remove-Item -Path ".\dist" -Recurse -Force
Remove-Item -Path ".\build" -Recurse -Force

# deactivate environment
deactivate

# remove environment folder
Remove-Item -Path ".\env" -Recurse -Force
