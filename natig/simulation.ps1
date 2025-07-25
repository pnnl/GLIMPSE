param(
   [Parameter(Mandatory=$true)]
   [string]$ContainerName
)

& "$PSScriptRoot\run_outside_docker.ps1" $ContainerName
& "$PSScriptRoot\quitDocker.ps1" $ContainerName
