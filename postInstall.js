const { exec } = require('child_process');

if (process.platform === 'win32') {
   exec('powershell.exe create_server_exe.ps1', { stdio: 'inherit', shell: true });
} else if (process.platform === 'darwin') {
   exec('bash create_server_exe.sh', { stdio: 'inherit', shell: true });
}
