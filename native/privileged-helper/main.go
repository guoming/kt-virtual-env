// [AI-GEN] scope:main, model:auto, reviewed:false
package main

import (
	"fmt"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"

	"git.eminxing.com/fbg/tools/dev-tools/zt-virtual-env/native/privileged-helper/ipc"
)

const helperVersion = "0.1.0"

func main() {
	home, err := os.UserHomeDir()
	if err != nil {
		fmt.Fprintln(os.Stderr, "home dir:", err)
		os.Exit(1)
	}
	socketPath := filepath.Join(home, ".zt-virtual-env", "helper.sock")
	_ = os.MkdirAll(filepath.Dir(socketPath), 0o700)
	_ = os.Remove(socketPath)

	fmt.Println("zt-virtual-env-helper", helperVersion, "listening on", socketPath)

	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		_ = ipc.HandleDisconnect()
		_ = os.Remove(socketPath)
		os.Exit(0)
	}()

	err = ipc.Serve(socketPath, dispatch)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func dispatch(conn net.Conn, msg map[string]any) error {
	cmd, _ := msg["cmd"].(string)
	switch cmd {
	case "ping":
		return ipc.WriteEvent(conn, map[string]any{"event": "pong", "version": helperVersion})
	case "connect":
		return handleConnect(conn, msg)
	case "disconnect":
		_ = ipc.HandleDisconnect()
		return ipc.WriteEvent(conn, map[string]any{"event": "status", "state": "stopped"})
	case "shutdown":
		_ = ipc.HandleDisconnect()
		_ = conn.Close()
		os.Exit(0)
	default:
		return ipc.WriteEvent(conn, map[string]any{"event": "error", "code": "UNKNOWN_CMD", "message": "unknown command"})
	}
	return nil
}

func handleConnect(conn net.Conn, msg map[string]any) error {
	ktctlPath, _ := msg["ktctlPath"].(string)
	if ktctlPath == "" {
		return ipc.WriteEvent(conn, map[string]any{"event": "error", "code": "MISSING_KTCTL", "message": "ktctlPath required"})
	}
	params, _ := msg["params"].(map[string]any)
	args := buildConnectArgs(params)
	_ = ipc.WriteEvent(conn, map[string]any{"event": "status", "state": "starting"})

	if err := ipc.HandleConnect(ktctlPath, args, func(line string) {
		_ = ipc.WriteEvent(conn, map[string]any{"event": "log", "line": line})
	}); err != nil {
		return ipc.WriteEvent(conn, map[string]any{"event": "status", "state": "failed", "message": err.Error()})
	}
	return ipc.WriteEvent(conn, map[string]any{"event": "status", "state": "running"})
}

func buildConnectArgs(params map[string]any) []string {
	namespace, _ := params["namespace"].(string)
	kubeconfig, _ := params["kubeconfig"].(string)
	contextName, _ := params["context"].(string)
	dnsNamespaces := toStringSlice(params["dnsNamespaces"])
	dnsMode := "hosts:" + strings.Join(dnsNamespaces, ",")

	args := []string{"connect", "--namespace", namespace, "--dnsMode", dnsMode}
	if kubeconfig != "" {
		args = append(args, "--kubeconfig", kubeconfig)
	}
	if contextName != "" {
		args = append(args, "--context", contextName)
	}
	return args
}

func toStringSlice(v any) []string {
	raw, ok := v.([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(raw))
	for _, item := range raw {
		if s, ok := item.(string); ok {
			out = append(out, s)
		}
	}
	return out
}
// [/AI-GEN]
