const BASE = 8000;

export function suggestLocalPort(containerPort: number): number {
  if (containerPort >= 8000 && containerPort <= 8999) {
    return containerPort;
  }
  if (containerPort === 8080) {
    return 8080;
  }
  return BASE + (containerPort % 1000);
}
