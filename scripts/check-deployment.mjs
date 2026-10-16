const base = "https://pos.prodrillos.com";
const checks = [["/store", 200], ["/api/store/products", 200], ["/pos", 401], ["/api/customers", 401]];
for (const [path, expected] of checks) {
  let passed = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(base + path, { signal: AbortSignal.timeout(15000) });
      if (response.status === expected) {
        if (path === "/api/store/products") await response.json();
        console.log(`${path}: ${response.status}`);
        passed = true;
        break;
      }
      console.error(`${path}: expected ${expected}, received ${response.status}`);
    } catch {
      console.error(`${path}: connection failed`);
    }
    if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 10000));
  }
  if (!passed) throw new Error(`Deployment check failed: ${path}`);
}
