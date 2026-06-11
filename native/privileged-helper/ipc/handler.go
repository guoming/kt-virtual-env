// [AI-GEN] scope:ipc/handler, model:auto, reviewed:false
package ipc

import (
	"bufio"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
)

var (
	connectCmd *exec.Cmd
	mu         sync.Mutex
)

func withoutHome(env []string) []string {
	out := make([]string, 0, len(env))
	for _, item := range env {
		if len(item) > 5 && item[:5] == "HOME=" {
			continue
		}
		out = append(out, item)
	}
	return out
}

func isProcessAlive(pid int) bool {
	if pid <= 0 {
		return false
	}
	proc, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	return proc.Signal(syscall.Signal(0)) == nil
}

func HandleConnect(ktctlPath string, args []string, ktHome string, onLog func(line string), onExit func(exitErr error)) error {
	mu.Lock()
	defer mu.Unlock()
	if connectCmd != nil && connectCmd.Process != nil {
		if isProcessAlive(connectCmd.Process.Pid) {
			return nil
		}
		connectCmd = nil
	}
	connectCmd = exec.Command(ktctlPath, args...)
	if ktHome != "" {
		pidDir := filepath.Join(ktHome, ".kt", "pid")
		_ = os.MkdirAll(pidDir, 0o777)
		_ = os.Chmod(pidDir, 0o777)
		connectCmd.Env = append(withoutHome(os.Environ()), "HOME="+ktHome)
	}
	stdout, err := connectCmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := connectCmd.StderrPipe()
	if err != nil {
		return err
	}
	if err := connectCmd.Start(); err != nil {
		connectCmd = nil
		return err
	}
	cmd := connectCmd
	if onLog != nil {
		go streamLogs(stdout, onLog)
		go streamLogs(stderr, onLog)
	}
	if onExit != nil {
		go func() {
			waitErr := cmd.Wait()
			mu.Lock()
			if connectCmd == cmd {
				connectCmd = nil
			}
			mu.Unlock()
			onExit(waitErr)
		}()
	}
	return nil
}

func streamLogs(r io.Reader, onLog func(line string)) {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		onLog(scanner.Text())
	}
}

func HandleDisconnect() error {
	mu.Lock()
	defer mu.Unlock()
	if connectCmd != nil && connectCmd.Process != nil {
		_ = connectCmd.Process.Kill()
		connectCmd = nil
	}
	return nil
}

func Shutdown() {
	_ = HandleDisconnect()
}
// [/AI-GEN]
