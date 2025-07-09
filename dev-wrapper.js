const { spawn } = require('child_process');

console.log(`Starting docker container: ${process.argv[2]}`);

const containerName = process.argv[2] || 'natigbase_pf';

// Run electron-vite dev
spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

setTimeout(() => {
  spawn('bash', ['simulation.sh', containerName], {
    cwd: './natig/',
    stdio: 'inherit',
    shell: true
  });
}, 20000);
