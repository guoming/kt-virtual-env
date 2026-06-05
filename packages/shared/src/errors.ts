export interface ErrorAdvice {
  code: string;
  title: string;
  suggestion: string;
}

const ADVICE: Array<{ match: RegExp; advice: ErrorAdvice }> = [
  {
    match: /podCreationTimeout/i,
    advice: {
      code: 'POD_TIMEOUT',
      title: 'Shadow Pod 创建超时',
      suggestion: '检查命名空间配额、镜像拉取与节点资源',
    },
  },
  {
    match: /port already in use|EADDRINUSE/i,
    advice: {
      code: 'PORT_IN_USE',
      title: '本地端口被占用',
      suggestion: '更换本地端口或停止占用进程',
    },
  },
  {
    match: /Forbidden/i,
    advice: {
      code: 'RBAC_FORBIDDEN',
      title: '集群权限不足',
      suggestion: '确认具备 deploy/svc/pod 的 get/list/create 权限',
    },
  },
  {
    match: /connection refused/i,
    advice: {
      code: 'LOCAL_NOT_LISTENING',
      title: '本地服务未启动',
      suggestion: '先启动本地服务并监听指定端口',
    },
  },
];

export function matchErrorAdvice(logText: string): ErrorAdvice | null {
  for (const { match, advice } of ADVICE) {
    if (match.test(logText)) {
      return advice;
    }
  }
  return null;
}
