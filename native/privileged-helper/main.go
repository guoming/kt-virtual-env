// [AI-GEN] scope:main, model:auto, reviewed:false
package main

import (
	"flag"
	"fmt"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"git.eminxing.com/fbg/tools/dev-tools/kt-virtual-env/native/privileged-helper/ipc"
	"strconv"
)

const helperVersion = "0.1.15"

func main() {
	socketFlag := flag.String("socket", "", "IPC endpoint (tcp:127.0.0.1:port or unix path)")
	logFlag := flag.String("log", "", "Log file path")
	flag.Parse()

	logPath := strings.TrimSpace(*logFlag)
	logFile, logErr := openHelperLogAt(logPath)
	writeHelperLog(logFile, logErr, "starting helper %s args=%v", helperVersion, os.Args)

	socketPath := strings.TrimSpace(*socketFlag)
	if socketPath == "" {
		socketPath = os.Getenv("KTVE_HELPER_SOCKET")
	}
	if socketPath == "" {
		socketPath = filepath.Join(os.TempDir(), fmt.Sprintf("kt-virtual-env-helper-%d.sock", os.Getuid()))
	}
	if !strings.HasPrefix(socketPath, "tcp:") {
		_ = os.Remove(socketPath)
	}

	writeHelperLog(logFile, logErr, "listening on %s", socketPath)

	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		writeHelperLog(logFile, logErr, "received shutdown signal")
		_ = ipc.HandleDisconnect()
		if !strings.HasPrefix(socketPath, "tcp:") {
			_ = os.Remove(socketPath)
		}
		os.Exit(0)
	}()

	err := ipc.Serve(socketPath, func(conn net.Conn, msg map[string]any) error {
		return dispatch(conn, msg, logFile, logErr)
	})
	if err != nil {
		writeHelperLog(logFile, logErr, "serve error: %v", err)
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func openHelperLogAt(path string) (*os.File, error) {
	if path == "" {
		path = filepath.Join(os.TempDir(), "kt-virtual-env-helper.log")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	return os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
}

func writeHelperLog(logFile *os.File, logErr error, format string, args ...any) {
	line := fmt.Sprintf("%s [helper] %s", time.Now().Format(time.RFC3339), fmt.Sprintf(format, args...))
	fmt.Println(line)
	if logErr != nil || logFile == nil {
		return
	}
	_, _ = fmt.Fprintln(logFile, line)
}

func dispatch(conn net.Conn, msg map[string]any, logFile *os.File, logErr error) error {
	cmd, _ := msg["cmd"].(string)
	writeHelperLog(logFile, logErr, "command %s", cmd)
	switch cmd {
	case "ping":
		return ipc.WriteEvent(conn, map[string]any{"event": "pong", "version": helperVersion})
	case "connect":
		return handleConnect(conn, msg, logFile, logErr)
	case "disconnect":
		_ = ipc.HandleDisconnect()
		return ipc.WriteEvent(conn, map[string]any{"event": "status", "state": "stopped"})
	case "shutdown":
		_ = ipc.HandleDisconnect()
		_ = conn.Close()
		writeHelperLog(logFile, logErr, "shutdown requested")
		os.Exit(0)
	default:
		return ipc.WriteEvent(conn, map[string]any{"event": "error", "code": "UNKNOWN_CMD", "message": "unknown command"})
	}
	return nil
}

func handleConnect(conn net.Conn, msg map[string]any, logFile *os.File, logErr error) error {
	ktctlPath, _ := msg["ktctlPath"].(string)
	if ktctlPath == "" {
		return ipc.WriteEvent(conn, map[string]any{"event": "error", "code": "MISSING_KTCTL", "message": "ktctlPath required"})
	}
	ktHome, _ := msg["ktHome"].(string)
	params, _ := msg["params"].(map[string]any)
	args := buildConnectArgs(params)
	writeHelperLog(logFile, logErr, "connect ktctl=%s args=%v", ktctlPath, args)
	_ = ipc.WriteEvent(conn, map[string]any{"event": "status", "state": "starting"})

	if err := ipc.HandleConnect(ktctlPath, args, ktHome, func(line string) {
		writeHelperLog(logFile, logErr, "ktctl: %s", line)
		_ = ipc.WriteEvent(conn, map[string]any{"event": "log", "line": line})
	}, func(exitErr error) {
		writeHelperLog(logFile, logErr, "connect process exited: %v", exitErr)
		msg := "ktctl connect 进程已退出"
		if exitErr != nil {
			msg = exitErr.Error()
		}
		_ = ipc.WriteEvent(conn, map[string]any{
			"event":   "status",
			"state":   "stopped",
			"reason":  "process_exit",
			"message": msg,
		})
	}); err != nil {
		writeHelperLog(logFile, logErr, "connect failed: %v", err)
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
	return appendConnectOptions(args, params)
}

func appendConnectOptions(args []string, params map[string]any) []string {
	options, _ := params["options"].(map[string]any)
	if options == nil {
		return args
	}
	if debug, ok := options["debug"].(bool); ok && debug {
		args = append(args, "--debug")
	}
	if useLocalTime, ok := options["useLocalTime"].(bool); ok && useLocalTime {
		args = append(args, "--useLocalTime")
	}
	if mode, ok := options["mode"].(string); ok && mode != "" && mode != "tun2socks" {
		args = append(args, "--mode", mode)
	}
	if excludeIps, ok := options["excludeIps"].(string); ok && strings.TrimSpace(excludeIps) != "" {
		args = append(args, "--excludeIps", strings.TrimSpace(excludeIps))
	}
	if pft := parsePositiveInt(options["portForwardTimeout"]); pft > 0 && pft != 10 {
		args = append(args, "--portForwardTimeout", strconv.Itoa(pft))
	}
	return args
}

func parsePositiveInt(v any) int {
	switch n := v.(type) {
	case float64:
		if n >= 1 {
			return int(n)
		}
	case int:
		if n >= 1 {
			return n
		}
	case int64:
		if n >= 1 {
			return int(n)
		}
	case string:
		if parsed, err := strconv.Atoi(strings.TrimSpace(n)); err == nil && parsed >= 1 {
			return parsed
		}
	}
	return 0
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
