/**
 * Test setup and global configuration
 */

// Set up performance.now() for Node.js if not available
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => {
      const [sec, nsec] = process.hrtime();
      return sec * 1000 + nsec / 1000000;
    }
  };
}
