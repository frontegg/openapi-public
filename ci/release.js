const {execSync} = require('child_process');
const path = require('path');
const fs = require('fs');
const semver = require('semver');
const {Octokit} = require('@octokit/core');
const Handlebars = require('handlebars');
const gitHelpers = require('./git.helpers');

const GH_TOKEN = process.argv[2] ? process.argv[2] : process.env.GH_ACCESS_TOKEN;
const GH_USER = process.argv[3] ? process.argv[3] : 'x-access-token';
const repoName = 'openapi-public';
const repoUrl = `https://${GH_USER}:${GH_TOKEN}@github.com/frontegg/${repoName}.git`;

const githubApi = new Octokit({auth: GH_TOKEN});
const tempDirectory = path.join(__dirname, '../', 'temp');
const latestTagDirectory = path.join(tempDirectory, repoName);
const openapisFolder = path.join('/');

async function release() {
  console.log('Create latest-tag directory');
  createDirectory(latestTagDirectory);

  console.log('Clone openapi-public');
  gitHelpers.cloneToDirectory(repoUrl, latestTagDirectory);

  console.log('Getting latest tag');
  const latestTag = gitHelpers.getLatestTag(latestTagDirectory);

  console.log('Checkout latest tag', latestTag);
  gitHelpers.checkoutTag(latestTag, latestTagDirectory);

  console.log('Running diffs between current `master` OpenAPIs and latest version tag');
  const {newEndpoints, missingEndpoints, deprecatedEndpoints} = await createDiffs();

  if (newEndpoints.length || missingEndpoints.length || deprecatedEndpoints.length) {
    const releaseType = missingEndpoints.length ? 'major' : deprecatedEndpoints.length ? 'minor' : 'patch';
    const newVersion = `v${semver.inc(latestTag, releaseType)}`;
    const releaseBody = generateReleaseDescription(newEndpoints, missingEndpoints, deprecatedEndpoints);

    console.log('Creating release', releaseType, newVersion);
    await createRelease(newVersion, releaseBody);

    console.log('Release created successfully!');
  } else {
    console.log('No changes found, will skip release');
  }
  await clean();
}

async function createRelease(tag, body) {
  await githubApi.request('POST /repos/{owner}/{repo}/releases', {
    owner: 'frontegg',
    repo: repoName,
    tag_name: tag,
    target_commitish: 'master',
    name: tag,
    body: body,
    draft: false,
    prerelease: false,
    generate_release_notes: false,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
}

function createDirectory(path) {
  fs.mkdirSync(path, {recursive: true});
}

async function createDiffs() {
  const tempDiffsPath = path.join(tempDirectory, 'diffs');
  createDirectory(tempDiffsPath);

  const totalNewEndpoints = [];
  const totalMissingEndpoints = [];
  const totalDeprecatedEndpoints = [];

  for (const openapi of listOpenAPIs()) {
    const openapiJson = readJsonFile(path.join(__dirname, '../', openapisFolder, openapi));
    const serviceEndpointsPrefix = openapi === 'agent.json' ? '/' : new URL(openapiJson.servers[0].url).pathname;
    const serviceTitle = openapiJson.info.title;
    runOpenApiDiffDocker(openapi);
    const diffFilePath = path.join(tempDiffsPath, openapi);
    await waitForDiffFileToGenerate(diffFilePath);
    const {newEndpoints, missingEndpoints, deprecatedEndpoints} = readJsonFile(diffFilePath);
    if (newEndpoints.length) {
      totalNewEndpoints.push({serviceTitle, endpoints: mapEndpoints(newEndpoints, serviceEndpointsPrefix)});
    }

    if (missingEndpoints.length) {
      totalMissingEndpoints.push({serviceTitle, endpoints: mapEndpoints(missingEndpoints, serviceEndpointsPrefix)});
    }

    if (deprecatedEndpoints.length) {
      totalDeprecatedEndpoints.push({
        serviceTitle,
        endpoints: mapEndpoints(deprecatedEndpoints, serviceEndpointsPrefix),
      });
    }
  }

  return {
    newEndpoints: totalNewEndpoints,
    missingEndpoints: totalMissingEndpoints,
    deprecatedEndpoints: totalDeprecatedEndpoints,
  };
}

function mapEndpoints(endpoints, serviceEndpointPrefix) {
  return endpoints.map(({method, pathUrl}) => ({
    method,
    pathUrl: path.join(serviceEndpointPrefix, pathUrl),
  }));
}

function listOpenAPIs() {
  return [
    'agent.json',
    'entitlements.json',
    'identity.json',
    'scim.json',
    'sso.json',
    'tenants.json',
    'applications.json',
    'audits.json',
  ];
}

function generateReleaseDescription(newEndpoints, missingEndpoints, deprecatedEndpoints) {
  const releaseTemplate = fs.readFileSync(path.join(__dirname, 'release-template.hbs')).toString();
  return Handlebars.compile(releaseTemplate)({newEndpoints, missingEndpoints, deprecatedEndpoints});
}

async function waitForDiffFileToGenerate(path) {
  const promise = new Promise((resolve) => {
    const interval = setInterval(() => {
      const exist = fs.existsSync(path);
      if (exist) {
        try {
          readJsonFile(path);
          resolve();
          clearInterval(interval);
        } catch (e) {}
      }
    }, 100);
  });

  await promise;
}

function readJsonFile(path) {
  return JSON.parse(fs.readFileSync(path).toString());
}

async function clean() {
  fs.rmdirSync(tempDirectory, {recursive: true});
}

function runOpenApiDiffDocker(openapi) {
  const lastTagOpenApiPath = path.join('/specs', 'temp', repoName, openapisFolder);
  const currentOpenApiPath = path.join('/specs', openapisFolder);
  const diffsPath = path.join('/specs/temp/diffs');
  const execCommand = `docker run -d \
    -v ${path.join(__dirname, '../')}:/specs \
    openapitools/openapi-diff:latest ${path.join(lastTagOpenApiPath, openapi)}  ${path.join(
    currentOpenApiPath,
    openapi,
  )} --json ${path.join(diffsPath, openapi)}`;
  execSync(execCommand);
}

release();
