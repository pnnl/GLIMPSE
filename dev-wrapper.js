const { spawn } = require('child_process');

console.log(`Starting docker container: ${process.argv[2]}`);

const containerName = process.argv[2] || 'natigbase_pf';

// Run electron-vite dev
spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

setTimeout(() => {
  spawn('bash', ['run_outside_docker.sh', containerName], {
    cwd: './natig/',
    stdio: 'inherit',
    shell: true
  });
}, 15000);

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('Caught SIGINT, cleaning up...');

  // Run the quit docker script
  const cleanup = spawn('bash', ['quiteDocker.sh', containerName], {
    cwd: './natig/',
    stdio: 'inherit',
    shell: true
  });

  cleanup.on('close', (code) => process.exit(code));
});
