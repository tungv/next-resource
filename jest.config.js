module.exports = {
  testPathIgnorePatterns: ["/node_modules/", ".history"],
  transform: {
    "^.+\\.tsx?$": "esbuild-jest",
  },
};
