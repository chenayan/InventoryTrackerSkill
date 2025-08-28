#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function logSuccess(message) {
  console.log(`${colors.green}${colors.bright}✅ ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}${colors.bright}⚠️ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}${colors.bright}❌ ${message}${colors.reset}`);
}

function execCommand(command, description) {
  try {
    const output = execSync(command, { 
      stdio: 'pipe',
      encoding: 'utf8'
    });
    logSuccess(description);
    return output.trim();
  } catch (error) {
    logWarning(`${description} - process may not be running`);
    return null;
  }
}

function main() {
  console.log(`${colors.cyan}${colors.bright}🛑 Stopping Development Environment${colors.reset}`);
  console.log('');

  // Try to load saved PIDs
  let serverPid = null;
  let ngrokPid = null;
  
  try {
    const config = JSON.parse(fs.readFileSync('.dev-config.json', 'utf8'));
    serverPid = config.serverPid;
    ngrokPid = config.ngrokPid;
  } catch (error) {
    logWarning('No .dev-config.json found, will try to find processes by port/name');
  }

  // Stop server (by PID first, then by port)
  if (serverPid) {
    execCommand(`kill ${serverPid}`, `Stopped server (PID: ${serverPid})`);
  }
  
  // Also try to find and stop any node server.js processes
  try {
    const pids = execSync('pgrep -f "node.*server.js"', { encoding: 'utf8' }).trim().split('\n');
    pids.forEach(pid => {
      if (pid) {
        execCommand(`kill ${pid}`, `Stopped server process (PID: ${pid})`);
      }
    });
  } catch (error) {
    // No processes found
  }

  // Stop processes using port 3000
  try {
    const portPids = execSync('lsof -ti:3000', { encoding: 'utf8' }).trim().split('\n');
    portPids.forEach(pid => {
      if (pid) {
        execCommand(`kill ${pid}`, `Stopped process on port 3000 (PID: ${pid})`);
      }
    });
  } catch (error) {
    // No processes on port 3000
  }

  // Stop ngrok (by PID first, then by process name)
  if (ngrokPid) {
    execCommand(`kill ${ngrokPid}`, `Stopped ngrok (PID: ${ngrokPid})`);
  }

  // Also try to find and stop any ngrok processes
  try {
    const pids = execSync('pgrep ngrok', { encoding: 'utf8' }).trim().split('\n');
    pids.forEach(pid => {
      if (pid) {
        execCommand(`kill ${pid}`, `Stopped ngrok process (PID: ${pid})`);
      }
    });
  } catch (error) {
    // No ngrok processes found
  }

  console.log('');
  logSuccess('🎉 Development environment stopped');
  console.log('');
  console.log(`${colors.yellow}To restart: ${colors.cyan}npm run dev-deploy${colors.reset}`);
}

main();