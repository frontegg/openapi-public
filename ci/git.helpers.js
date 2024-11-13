const {execSync} = require('child_process');

function cloneToDirectory(repo, cwd) {
  execSync(`git clone ${repo} ${cwd}`);
}

function getLatestTag(cwd) {
  return execSync('git describe --tags --abbrev=0', {cwd}).toString().trim();
}

function checkoutTag(tag, cwd) {
  execSync(`git checkout ${tag}`, {cwd});
}

module.exports = {cloneToDirectory, getLatestTag, checkoutTag};
