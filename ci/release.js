const {execSync} = require('child_process');
const path = require('path');
const fs = require('fs');
const semver = require('semver');
const {Octokit} = require('@octokit/core');
const Handlebars = require('handlebars');

const GH_TOKEN = process.argv[2] ? process.argv[2] : process.env.GH_ACCESS_TOKEN;
const GH_USER = process.argv[3] ? process.argv[3] : 'x-access-token';

const githubApi = new Octokit({auth: GH_TOKEN});
const repoName = 'openapi-public';
const latestTagDirectory = path.join(__dirname, '../', 'temp', repoName);
const tempDirectory = path.join(__dirname, '../', 'temp');
const openapisFolder = path.join('/');
const latestOpenAPIsFolder = path.join(__dirname, '../', openapisFolder);

async function release() {
  console.log('Checking out latest version tag');
  const latestTag = await cloneAndCheckoutLatestTag();
  console.log('Latest version tag:', latestTag);
  console.log('Running diffs between current `master` OpenAPIs and latest version tag');
  const {newEndpoints, missingEndpoints, deprecatedEndpoints} = await createDiffs();
  if (newEndpoints.length || missingEndpoints.length || deprecatedEndpoints.length) {
    const releaseType = determineReleaseType(missingEndpoints, deprecatedEndpoints);
    const newVersion = increaseVersion(latestTag, releaseType);
    console.log('Changes found, will create a new release', releaseType, newVersion);
    const releaseBody = generateReleaseDescription(newEndpoints, missingEndpoints, deprecatedEndpoints);
    await githubApi.request('POST /repos/{owner}/{repo}/releases', {
      owner: 'frontegg',
      repo: repoName,
      tag_name: newVersion,
      target_commitish: 'master',
      name: newVersion,
      body: releaseBody,
      draft: false,
      prerelease: false,
      generate_release_notes: false,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    console.log('Release created successfully!');
  } else {
    console.log('No changes found, will skip release');
  }
  await clean();
}

async function cloneAndCheckoutLatestTag() {
  try {
    fs.rmdirSync(latestTagDirectory, {recursive: true});
  } catch (e) {}
  try {
    fs.mkdirSync(latestTagDirectory, {recursive: true});
  } catch (e) {}
  execSync(`git clone https://${GH_USER}:${GH_TOKEN}@github.com/frontegg/${repoName}.git ${latestTagDirectory}`);
  const latestTag = execSync('git describe --tags --abbrev=0').toString().trim();
  execSync(`git checkout ${latestTag}`, {cwd: latestTagDirectory});
  return latestTag;
}

async function listOpenAPIs() {
  return ['agent.json', 'entitlements.json', 'identity.json', 'scim.json', 'sso.json', 'tenants.json'];
}

async function createDiffs() {
  const latestOpenAPIs = await listOpenAPIs(latestOpenAPIsFolder);
  try {
    fs.mkdirSync(path.join(tempDirectory, 'diffs'), {recursive: true});
  } catch (e) {}
  const totalNewEndpoints = [];
  const totalMissingEndpoints = [];
  const totalDeprecatedEndpoints = [];
  for (const openapi of latestOpenAPIs) {
    const execCommand = `docker run -d \
                -v ${path.join(__dirname, '../')}:/specs \
                openapitools/openapi-diff:latest ${path.join(
                  '/specs',
                  'temp',
                  repoName,
                  openapisFolder,
                  openapi,
                )}  ${path.join('/specs', openapisFolder, openapi)} --json /specs/temp/diffs/${openapi}`;
    execSync(execCommand);
    const diffFilePath = path.join(__dirname, '../', 'temp/diffs', openapi);
    await waitForDiffFileToGenerate(diffFilePath);
    const {newEndpoints, missingEndpoints, deprecatedEndpoints} = JSON.parse(fs.readFileSync(diffFilePath).toString());
    totalNewEndpoints.push(...newEndpoints);
    totalMissingEndpoints.push(...missingEndpoints);
    totalDeprecatedEndpoints.push(...deprecatedEndpoints);
  }

  return {
    newEndpoints: totalNewEndpoints,
    missingEndpoints: totalMissingEndpoints,
    deprecatedEndpoints: totalDeprecatedEndpoints,
  };
}

async function clean() {
  fs.rmdirSync(tempDirectory, {recursive: true});
}

function determineReleaseType(missingEndpoints, deprecatedEndpoints) {
  if (missingEndpoints.length) {
    return 'major';
  }

  if (deprecatedEndpoints.length) {
    return 'minor';
  }

  return 'patch';
}

function increaseVersion(latestVersion, releaseType) {
  return `v${semver.inc(latestVersion, releaseType)}`;
}

function generateReleaseDescription(newEndpoints, missingEndpoints, deprecatedEndpoints) {
  return Handlebars.compile(hbReleaseTemplate)({newEndpoints, missingEndpoints, deprecatedEndpoints});
}

async function waitForDiffFileToGenerate(path) {
  const promise = new Promise((resolve) => {
    const interval = setInterval(() => {
      const exist = fs.existsSync(path);
      if (exist) {
        try {
          JSON.parse(fs.readFileSync(path).toString());
          resolve();
          clearInterval(interval);
        } catch (e) {}
      }
    }, 100);
  });

  await promise;
}

release();

const hbReleaseTemplate = `
{{#if newEndpoints.length}}
## New Endpoints
{{#each newEndpoints}}
	 {{method}} {{pathUrl}}
{{/each}}
{{/if}}

{{#if deprecatedEndpoints.length}}
## Deprecated Endpoints
{{#each deprecatedEndpoints}}
	 {{method}} {{pathUrl}}
{{/each}}
{{/if}}

{{#if missingEndpoints.length}}
## Removed Endpoints
{{#each missingEndpoints}}
	 {{method}} {{pathUrl}}
{{/each}}
{{/if}}
`;
