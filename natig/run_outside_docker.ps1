param(
   [Parameter(Mandatory=$true)]
   [string]$ContainerName
)

Write-Warning "Make sure to hardcode the port of helics in run.sh to the same value as the one set by brokerport in gridlabd_config.json"

# Execute command inside Docker container
docker exec -i $ContainerName sh -c "cd /rd2c/PUSH/NATIG/RC/code/ && sudo bash run_listener.sh"
