function packageExists(packageName) {
  try {
    return require.resolve(packageName);
  } catch (error) {
    return false;
  }
}

module.exports = packageExists;

console.log(packageExists('webpack'), require.resolve('webpack'));