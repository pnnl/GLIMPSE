const { spawn } = require('child_process');

console.log(`Starting docker container: ${process.argv[2]}`);

process.env.CONTAINER_NAME = process.argv[2] || 'natigbase_pf';

// Run electron-vite dev
spawn('npm', ['run', 'start'], {
   stdio: 'inherit',
   shell: true
});
