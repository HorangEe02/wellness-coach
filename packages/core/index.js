// Entry point for the agent server: one namespace per original app, plus the merged helpers.
// Same-named functions differ between apps (e.g. diet.streak counts days, strength.streak counts weeks), so always call through the namespace.
module.exports = {
  shared: require('./shared.js'),
  diet: require('./diet.core.js'),
  strength: require('./strength.core.js'),
  pace: require('./pace.core.js'),
};
