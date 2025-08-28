#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.cyan) {
  console.log(`${color}${colors.bright}🚀 ${message}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}${colors.bright}✅ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}${colors.bright}❌ ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}${colors.bright}⚠️ ${message}${colors.reset}`);
}

function execCommand(command, description) {
  log(`${description}...`);
  try {
    const output = execSync(command, { 
      stdio: 'pipe',
      encoding: 'utf8',
      cwd: process.cwd()
    });
    logSuccess(`${description} completed`);
    return output;
  } catch (error) {
    logError(`${description} failed: ${error.message}`);
    if (error.stdout) {
      console.log('stdout:', error.stdout);
    }
    if (error.stderr) {
      console.log('stderr:', error.stderr);
    }
    throw error;
  }
}

function waitForBuild(skillId, resourceType = 'interactionModel') {
  log(`Waiting for ${resourceType} build to complete...`);
  
  let attempts = 0;
  const maxAttempts = 30; // 5 minutes max
  
  while (attempts < maxAttempts) {
    try {
      const statusOutput = execSync(
        `ask smapi get-skill-status --skill-id ${skillId} --resource ${resourceType}`,
        { stdio: 'pipe', encoding: 'utf8' }
      );
      
      const status = JSON.parse(statusOutput);
      
      if (resourceType === 'interactionModel') {
        const jaJPStatus = status.interactionModel?.['ja-JP']?.lastUpdateRequest?.status;
        if (jaJPStatus === 'SUCCEEDED') {
          logSuccess('Interaction model build completed successfully');
          return;
        } else if (jaJPStatus === 'FAILED') {
          logError('Interaction model build failed');
          console.log('Status details:', JSON.stringify(status, null, 2));
          throw new Error('Build failed');
        }
        log(`Build status: ${jaJPStatus || 'UNKNOWN'} (attempt ${attempts + 1}/${maxAttempts})`);
      } else {
        const manifestStatus = status.manifest?.lastUpdateRequest?.status;
        if (manifestStatus === 'SUCCEEDED') {
          logSuccess('Skill manifest build completed successfully');
          return;
        } else if (manifestStatus === 'FAILED') {
          logError('Skill manifest build failed');
          throw new Error('Manifest build failed');
        }
        log(`Manifest status: ${manifestStatus || 'UNKNOWN'} (attempt ${attempts + 1}/${maxAttempts})`);
      }
      
    } catch (error) {
      if (error.message.includes('Build failed')) {
        throw error;
      }
      logWarning(`Status check failed (attempt ${attempts + 1}): ${error.message}`);
    }
    
    // Wait 10 seconds before next check
    execSync('sleep 10');
    attempts++;
  }
  
  logError('Build timeout - manual check required');
  throw new Error('Build timeout');
}

async function main() {
  const startTime = Date.now();
  
  log('🎯 Starting Alexa Skill Deployment Pipeline');
  console.log('');
  
  try {
    // Step 1: Run tests
    log('📋 Step 1: Running test suite');
    execCommand('npm test', 'Running unit tests');
    console.log('');
    
    // Step 2: Check ASK CLI configuration
    log('🔧 Step 2: Checking ASK CLI configuration');
    try {
      execCommand('ask --version', 'Checking ASK CLI version');
    } catch (error) {
      logError('ASK CLI not found. Please install it first: npm install -g ask-cli');
      process.exit(1);
    }
    console.log('');
    
    // Step 3: Get skill ID from existing configuration
    log('🎯 Step 3: Detecting skill configuration');
    let skillId;
    try {
      const skillConfig = fs.readFileSync('skill-package/skill.json', 'utf8');
      const config = JSON.parse(skillConfig);
      
      // Try to detect skill ID from existing deployments
      try {
        const skillListOutput = execSync('ask skill list', { stdio: 'pipe', encoding: 'utf8' });
        const skillList = JSON.parse(skillListOutput);
        
        // Find skill by name
        const skill = skillList.skills?.find(s => 
          s.nameByLocale?.['ja-JP'] === '在庫管理' || 
          s.nameByLocale?.['ja-JP'] === config.manifest?.publishingInformation?.locales?.['ja-JP']?.name
        );
        
        if (skill) {
          skillId = skill.skillId;
          logSuccess(`Found existing skill: ${skillId}`);
        }
      } catch (error) {
        logWarning('Could not list existing skills');
      }
      
    } catch (error) {
      logError('skill-package/skill.json not found');
      process.exit(1);
    }
    console.log('');
    
    // Step 4: Deploy skill manifest
    if (skillId) {
      log('📤 Step 4: Updating existing skill manifest');
      execCommand(
        `ask smapi update-skill-manifest --skill-id ${skillId} --stage development --manifest file:skill-package/skill.json`,
        'Updating skill manifest'
      );
      waitForBuild(skillId, 'manifest');
    } else {
      log('📤 Step 4: Creating new skill');
      const createOutput = execCommand('ask deploy --target skill-metadata', 'Creating new skill');
      
      // Extract skill ID from output
      const skillIdMatch = createOutput.match(/Skill ID: (amzn1\.ask\.skill\.[a-f0-9-]+)/);
      if (skillIdMatch) {
        skillId = skillIdMatch[1];
        logSuccess(`New skill created: ${skillId}`);
      } else {
        logError('Could not extract skill ID from deployment output');
        process.exit(1);
      }
    }
    console.log('');
    
    // Step 5: Deploy interaction model
    log('🗣️ Step 5: Deploying interaction model');
    execCommand(
      `ask smapi set-interaction-model --skill-id ${skillId} --stage development --locale ja-JP --interaction-model file:skill-package/interactionModels/custom/ja-JP.json`,
      'Deploying interaction model'
    );
    waitForBuild(skillId, 'interactionModel');
    console.log('');
    
    // Step 6: Verify deployment
    log('🔍 Step 6: Verifying deployment');
    const modelOutput = execCommand(
      `ask smapi get-interaction-model --skill-id ${skillId} --locale ja-JP`,
      'Retrieving deployed interaction model'
    );
    
    const model = JSON.parse(modelOutput);
    const intentNames = model.interactionModel.languageModel.intents.map(intent => intent.name);
    
    const expectedIntents = [
      'AddCarrotsIntent', 'AddEggsIntent', 
      'RemoveCarrotsIntent', 'RemoveEggsIntent',
      'CheckCarrotsIntent', 'CheckEggsIntent', 
      'TestIntent'
    ];
    
    const missingIntents = expectedIntents.filter(intent => !intentNames.includes(intent));
    if (missingIntents.length > 0) {
      logWarning(`Missing intents: ${missingIntents.join(', ')}`);
    } else {
      logSuccess('All expected intents deployed correctly');
    }
    console.log('');
    
    // Step 7: Show testing commands
    log('🧪 Step 7: Ready for testing!');
    console.log('');
    console.log(`${colors.bright}Skill ID:${colors.reset} ${skillId}`);
    console.log(`${colors.bright}Test commands:${colors.reset}`);
    console.log(`  Interactive testing: ${colors.cyan}ask dialog --locale ja-JP --skill-id ${skillId}${colors.reset}`);
    console.log(`  Skill status: ${colors.cyan}ask smapi get-skill-status --skill-id ${skillId}${colors.reset}`);
    console.log('');
    console.log(`${colors.bright}Voice commands to try:${colors.reset}`);
    console.log(`  ${colors.green}"在庫管理を開いて"${colors.reset} - Launch skill`);
    console.log(`  ${colors.green}"にんじんを4個冷蔵庫に追加した"${colors.reset} - Add carrots`);
    console.log(`  ${colors.green}"にんじんはいくつある"${colors.reset} - Check carrots`);
    console.log(`  ${colors.green}"たまごを3個使った"${colors.reset} - Remove eggs`);
    console.log(`  ${colors.green}"テスト"${colors.reset} - Test intent`);
    console.log('');
    
    // Step 8: Save skill ID for future deployments
    log('💾 Step 8: Saving configuration');
    const deployConfig = {
      skillId: skillId,
      lastDeployed: new Date().toISOString(),
      endpoint: 'https://48f93498a4b9.ngrok-free.app/api/alexa'
    };
    
    fs.writeFileSync('.deploy-config.json', JSON.stringify(deployConfig, null, 2));
    logSuccess('Configuration saved to .deploy-config.json');
    
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    logSuccess(`🎉 Deployment completed successfully in ${elapsed} seconds!`);
    
  } catch (error) {
    logError(`Deployment failed: ${error.message}`);
    console.log('');
    console.log(`${colors.yellow}Common solutions:${colors.reset}`);
    console.log('1. Check ASK CLI configuration: ask configure');
    console.log('2. Verify ngrok tunnel is running: curl https://48f93498a4b9.ngrok-free.app/api/alexa');
    console.log('3. Check server is running: ps aux | grep "node.*server.js"');
    console.log('4. Review interaction model syntax in skill-package/');
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n');
  logWarning('Deployment interrupted by user');
  process.exit(1);
});

main();